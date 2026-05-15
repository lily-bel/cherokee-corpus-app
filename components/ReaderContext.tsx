import React, { createContext, useContext, useMemo, useState } from 'react';
import { Sentence, useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';

// --- Types ---

export interface Book {
    id: string;           // Generated from source
    title: string;        // Source name from metadata
    author?: string;      // From first sentence
    source: string;       // Data source (shorthand)
    storyCount: number;
    sentenceCount: number;
    isCollection: boolean; // true if ONLY "Individual Sentences"
    userType?: 'book' | 'notebook';
}

export interface Story {
    id: string;
    title: string;
    bookId: string;
    chapterCount: number;
    sentenceCount: number;
    isSequential: boolean; // false for "Individual Sentences"
}

export interface Chapter {
    id: string;
    name: string;
    storyId: string;
    sentenceIds: string[];
}

export interface InvestigationItem {
    id: string;
    sentence_id: string;
    word_index: number;   // Which word in the sentence
    date_added: number;   // Timestamp
    notes?: string;       // Optional user notes
}

interface ReaderContextType {
    books: Book[];
    getStoriesForBook: (bookId: string) => Story[];
    getChaptersForStory: (storyId: string) => Chapter[];
    getSentencesForChapter: (chapterId: string) => Sentence[];
    getSentencesForBook: (bookId: string) => Sentence[];
    findBookAndChapterForSentence: (sentenceId: string) => { bookId: string, storyId: string, chapterId: string } | null;
    investigationQueue: InvestigationItem[];
    addToInvestigationQueue: (sentenceId: string, wordIndex: number, notes?: string) => void;
    removeFromInvestigationQueue: (itemId: string) => void;
    updateInvestigationNote: (itemId: string, notes: string) => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export const useReader = () => {
    const context = useContext(ReaderContext);
    if (!context) {
        throw new Error('useReader must be used within a ReaderProvider');
    }
    return context;
};

// Helper: Create a stable book ID from source
const createBookId = (source: string): string => {
    return `book_${source.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

// Helper: Create a stable story ID
const createStoryId = (bookId: string, story: string | undefined): string => {
    const storyName = story && story.trim() ? story : 'Individual Sentences';
    return `${bookId}_st_${storyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

// Helper: Create a stable chapter ID
const createChapterId = (storyId: string, chapter: string | undefined): string => {
    const chapterName = chapter && chapter.trim() ? chapter : '1';
    return `${storyId}_ch_${chapterName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

export const ReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { sentences, userSentences, customDictionaries: userDictionaries } = useCorpus();
    const { packages } = usePackageManager();

    const [investigationQueue, setInvestigationQueue] = useState<InvestigationItem[]>([]);

    // ... (rest of investigation queue effects) ...

    // Combine all sentences
    const allSentences = useMemo(() => {
        return [...sentences, ...userSentences];
    }, [sentences, userSentences]);

    // Group sentences into books, stories, and chapters
    const { books, storiesByBook, chaptersByStory, sentencesByChapter } = useMemo(() => {
        const sourceMap = new Map<string, Sentence[]>();

        const officialPkg = packages.find(p => p.id === 'official-cherokee-data');
        const officialSources = officialPkg?.metadata?.source_names 
            ? Object.keys(officialPkg.metadata.source_names).map(s => s.toLowerCase()) 
            : [];

        allSentences.forEach(sentence => {
            let mappedSource = sentence.source;
            const lowerSource = mappedSource ? mappedSource.toLowerCase() : '';
            if (officialSources.includes(lowerSource)) {
                if (!['ced', 'rrd', 'bible'].includes(lowerSource)) {
                    mappedSource = 'other_official';
                }
            }

            if (!sourceMap.has(mappedSource)) {
                sourceMap.set(mappedSource, []);
            }
            sourceMap.get(mappedSource)!.push(sentence);
        });

        // Ensure all user-created BOOKS are represented, even if empty
        Object.entries(userDictionaries).forEach(([id, nb]) => {
            if (nb.type === 'book' && !sourceMap.has(id)) {
                sourceMap.set(id, []);
            }
        });

        const books: Book[] = [];
        const storiesByBook = new Map<string, Story[]>();
        const chaptersByStory = new Map<string, Chapter[]>();
        const sentencesByChapter = new Map<string, string[]>();

        sourceMap.forEach((sourceSentences, source) => {
            const bookId = createBookId(source);

            // Find title from metadata or custom dictionaries
            let title = source;
            let author = sourceSentences.length > 0 ? sourceSentences[0].author : undefined;

            if (source === 'other_official') {
                title = 'Other Official Sentences';
            } else if (userDictionaries[source]) {
                title = userDictionaries[source].name;
            } else {
                for (const p of packages) {
                    if (p.metadata.source_names && p.metadata.source_names[source]) {
                        title = p.metadata.source_names[source];
                        break;
                    }
                    if (p.id === source) {
                        title = p.name;
                        break;
                    }
                }
            }
            
            // Group sentences in this source by STORY
            const storyMap = new Map<string, Sentence[]>();
            sourceSentences.forEach(s => {
                const storyName = s.story && s.story.trim() ? s.story : 'Individual Sentences';
                if (!storyMap.has(storyName)) {
                    storyMap.set(storyName, []);
                }
                storyMap.get(storyName)!.push(s);
            });

            const stories: Story[] = [];
            storyMap.forEach((storySentences, storyName) => {
                const storyId = createStoryId(bookId, storyName);
                const isSequential = storyName !== 'Individual Sentences';

                // Group story sentences by CHAPTER
                const chapterMap = new Map<string, Sentence[]>();
                storySentences.forEach(s => {
                    const chapterName = s.chapter && s.chapter.trim() ? s.chapter : '1';
                    if (!chapterMap.has(chapterName)) {
                        chapterMap.set(chapterName, []);
                    }
                    chapterMap.get(chapterName)!.push(s);
                });

                const chapters: Chapter[] = [];
                chapterMap.forEach((chapterSentences, chapterName) => {
                    const chapterId = createChapterId(storyId, chapterName);
                    
                    // Sort sentences within chapter
                    const sorted = [...chapterSentences].sort((a, b) => {
                        if (a.line !== undefined && b.line !== undefined) {
                            return a.line - b.line;
                        }
                        return a.id.localeCompare(b.id);
                    });

                    chapters.push({
                        id: chapterId,
                        name: isSequential ? `Chapter ${chapterName}` : 'Sentences',
                        storyId: storyId,
                        sentenceIds: sorted.map(s => s.id)
                    });

                    sentencesByChapter.set(chapterId, sorted.map(s => s.id));
                });

                // Sort chapters numerically
                chapters.sort((a, b) => {
                    const aNum = parseInt(a.name.replace(/\D/g, ''), 10);
                    const bNum = parseInt(b.name.replace(/\D/g, ''), 10);
                    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                    return a.name.localeCompare(b.name);
                });

                chaptersByStory.set(storyId, chapters);

                stories.push({
                    id: storyId,
                    title: storyName,
                    bookId: bookId,
                    chapterCount: chapters.length,
                    sentenceCount: storySentences.length,
                    isSequential
                });
            });

            // Sort stories
            stories.sort((a, b) => {
                if (a.title === 'Individual Sentences') return 1;
                if (b.title === 'Individual Sentences') return -1;
                return a.title.localeCompare(b.title);
            });

            storiesByBook.set(bookId, stories);

            const isCollection = (stories.length === 1 && !stories[0].isSequential) || (stories.length === 0 && userDictionaries[source]?.type !== 'book');

            books.push({
                id: bookId,
                title: title,
                author: author,
                source: source,
                storyCount: stories.length,
                sentenceCount: sourceSentences.length,
                isCollection,
                userType: userDictionaries[source]?.type
            });
        });

        // Sort books: user sources first, then alphabetically
        books.sort((a, b) => {
            const aUser = a.source === 'user' || a.source.startsWith('nb_');
            const bUser = b.source === 'user' || b.source.startsWith('nb_');
            if (aUser && !bUser) return -1;
            if (!aUser && bUser) return 1;
            return a.title.localeCompare(b.title);
        });

        return { books, storiesByBook, chaptersByStory, sentencesByChapter };
    }, [allSentences, packages, userDictionaries]);

    // Create a sentence lookup map
    const sentenceToLocation = useMemo(() => {
        const map = new Map<string, { bookId: string, storyId: string, chapterId: string }>();

        storiesByBook.forEach((stories, bookId) => {
            stories.forEach(story => {
                const chapters = chaptersByStory.get(story.id) || [];
                chapters.forEach(chapter => {
                    chapter.sentenceIds.forEach(sentenceId => {
                        map.set(sentenceId, { bookId, storyId: story.id, chapterId: chapter.id });
                    });
                });
            });
        });

        return map;
    }, [storiesByBook, chaptersByStory]);

    const getStoriesForBook = (bookId: string): Story[] => {
        return storiesByBook.get(bookId) || [];
    };

    const getChaptersForStory = (storyId: string): Chapter[] => {
        return chaptersByStory.get(storyId) || [];
    };

    const getSentencesForChapter = (chapterId: string): Sentence[] => {
        const sentenceIds = sentencesByChapter.get(chapterId) || [];
        const sentenceMap = new Map(allSentences.map(s => [s.id, s]));
        return sentenceIds.map(id => sentenceMap.get(id)).filter(Boolean) as Sentence[];
    };

    const getSentencesForBook = (bookId: string): Sentence[] => {
        const stories = storiesByBook.get(bookId) || [];
        const allIds = stories.flatMap(story => {
            const chapters = chaptersByStory.get(story.id) || [];
            return chapters.flatMap(ch => ch.sentenceIds);
        });
        const sentenceMap = new Map(allSentences.map(s => [s.id, s]));
        return allIds.map(id => sentenceMap.get(id)).filter(Boolean) as Sentence[];
    };

    const findBookAndChapterForSentence = (sentenceId: string) => {
        return sentenceToLocation.get(sentenceId) || null;
    };

    const addToInvestigationQueue = (sentenceId: string, wordIndex: number, notes?: string) => {
        const newItem: InvestigationItem = {
            id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sentence_id: sentenceId,
            word_index: wordIndex,
            date_added: Date.now(),
            notes
        };
        setInvestigationQueue(prev => [...prev, newItem]);
    };

    const removeFromInvestigationQueue = (itemId: string) => {
        setInvestigationQueue(prev => prev.filter(item => item.id !== itemId));
    };

    const updateInvestigationNote = (itemId: string, notes: string) => {
        setInvestigationQueue(prev => prev.map(item =>
            item.id === itemId ? { ...item, notes } : item
        ));
    };

    return (
        <ReaderContext.Provider value={{
            books,
            getStoriesForBook,
            getChaptersForStory,
            getSentencesForChapter,
            getSentencesForBook,
            findBookAndChapterForSentence,
            investigationQueue,
            addToInvestigationQueue,
            removeFromInvestigationQueue,
            updateInvestigationNote
        }}>
            {children}
        </ReaderContext.Provider>
    );
};
