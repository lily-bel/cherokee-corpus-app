import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Sentence, useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';

// --- Types ---

export interface Book {
    id: string;           // Generated from source
    title: string;        // Source name from metadata
    author?: string;      // From first sentence
    source: string;       // Data source (shorthand)
    storyCount: number;
    chapterCount: number;
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
    order?: number;        // Canonical ordering within the book
}

export interface Chapter {
    id: string;
    name: string;
    storyId: string;
    sentenceIds: string[];
    order?: number;        // Canonical ordering within the story
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
const createBookId = (source: string | undefined): string => {
    const safeSource = source && typeof source === 'string' && source.trim() ? source.trim() : 'unknown';
    return `book_${safeSource.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

// Helper: Create a stable story ID
const createStoryId = (bookId: string | undefined, story: string | undefined): string => {
    const safeBookId = bookId && typeof bookId === 'string' && bookId.trim() ? bookId.trim() : 'book_unknown';
    const storyName = story && typeof story === 'string' && story.trim() ? story.trim() : 'Individual Sentences';
    return `${safeBookId}_st_${storyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

// Helper: Create a stable chapter ID
const createChapterId = (storyId: string | undefined, chapter: string | undefined): string => {
    const safeStoryId = storyId && typeof storyId === 'string' && storyId.trim() ? storyId.trim() : 'story_unknown';
    const chapterName = chapter && typeof chapter === 'string' && chapter.trim() ? chapter.trim() : '1';
    return `${safeStoryId}_ch_${chapterName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

export const ReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { sentences, userSentences, customDictionaries: userDictionaries = {} } = useCorpus();
    const { packages } = usePackageManager();

    const [investigationQueue, setInvestigationQueue] = useState<InvestigationItem[]>(() => {
        try {
            const saved = localStorage.getItem('cherokee_app_investigation_queue');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Failed to load investigation queue', e);
        }
        return [];
    });

    // Persist investigation queue to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_investigation_queue', JSON.stringify(investigationQueue));
        } catch (e) {
            console.error('Failed to save investigation queue', e);
        }
    }, [investigationQueue]);

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
            if (!sentence) return;
            let mappedSource = (sentence.source && typeof sentence.source === 'string' && sentence.source.trim())
                ? sentence.source.trim()
                : 'other_official';
            const lowerSource = mappedSource.toLowerCase();
            if (officialSources.includes(lowerSource)) {
                if (!['ced', 'rrd'].includes(lowerSource)) {
                    mappedSource = 'other_official';
                }
            }

            if (!sourceMap.has(mappedSource)) {
                sourceMap.set(mappedSource, []);
            }
            sourceMap.get(mappedSource)!.push(sentence);
        });

        // Ensure all user-created BOOKS are represented, even if empty
        Object.entries(userDictionaries || {}).forEach(([id, nb]) => {
            if (nb?.type === 'book' && id && !sourceMap.has(id)) {
                sourceMap.set(id, []);
            }
        });

        const books: Book[] = [];
        const storiesByBook = new Map<string, Story[]>();
        const chaptersByStory = new Map<string, Chapter[]>();
        const sentencesByChapter = new Map<string, string[]>();

        sourceMap.forEach((sourceSentences, source) => {
            const safeSource = source && typeof source === 'string' && source.trim() ? source.trim() : 'unknown';
            const bookId = createBookId(safeSource);

            // Find title from metadata or custom dictionaries
            let title = safeSource;
            let author = sourceSentences.length > 0 ? sourceSentences[0]?.author : undefined;

            if (safeSource === 'other_official') {
                title = 'Other Official Sentences';
            } else if (userDictionaries && userDictionaries[safeSource]) {
                title = userDictionaries[safeSource].name || safeSource;
            } else {
                for (const p of packages) {
                    if (p.metadata?.source_names) {
                        const matchKey = Object.keys(p.metadata.source_names).find(k => k.toLowerCase() === safeSource.toLowerCase());
                        if (matchKey) {
                            title = p.metadata.source_names[matchKey];
                            break;
                        }
                    }
                    if (p.id === safeSource || p.metadata?.id === safeSource || p.metadata?.short_name?.toLowerCase() === safeSource.toLowerCase()) {
                        title = p.name;
                        break;
                    }
                }
            }
            
            // Group sentences in this source by STORY
            const storyMap = new Map<string, Sentence[]>();
            sourceSentences.forEach(s => {
                if (!s) return;
                const storyName = s.story && typeof s.story === 'string' && s.story.trim() ? s.story.trim() : 'Individual Sentences';
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
                    if (!s) return;
                    const chapterName = s.chapter && typeof s.chapter === 'string' && s.chapter.trim() ? s.chapter.trim() : '1';
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
                        return String(a.id || '').localeCompare(String(b.id || ''));
                    });

                    let chapterOrder: number | undefined = undefined;
                    for (const s of chapterSentences) {
                        if (s.chapter_order !== undefined) {
                            if (chapterOrder === undefined || s.chapter_order < chapterOrder) {
                                chapterOrder = s.chapter_order;
                            }
                        }
                    }

                    chapters.push({
                        id: chapterId,
                        name: isSequential ? chapterName : 'Sentences',
                        storyId: storyId,
                        sentenceIds: sorted.map(s => s.id),
                        order: chapterOrder
                    });

                    sentencesByChapter.set(chapterId, sorted.map(s => s.id));
                });

                // Sort chapters: by order if available, otherwise numerically / alphabetically
                chapters.sort((a, b) => {
                    if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                    if (a.order !== undefined) return -1;
                    if (b.order !== undefined) return 1;
                    const aName = a.name || '';
                    const bName = b.name || '';
                    const aNum = parseInt(aName.replace(/\D/g, ''), 10);
                    const bNum = parseInt(bName.replace(/\D/g, ''), 10);
                    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
                    return aName.localeCompare(bName);
                });

                chaptersByStory.set(storyId, chapters);

                // Determine story order from sentences (use minimum story_order found)
                let storyOrder: number | undefined = undefined;
                for (const s of storySentences) {
                    if (s.story_order !== undefined) {
                        if (storyOrder === undefined || s.story_order < storyOrder) {
                            storyOrder = s.story_order;
                        }
                    }
                }

                stories.push({
                    id: storyId,
                    title: storyName,
                    bookId: bookId,
                    chapterCount: chapters.length,
                    sentenceCount: storySentences.length,
                    isSequential,
                    order: storyOrder
                });
            });

            // Sort stories: by story_order if available, otherwise alphabetically
            stories.sort((a, b) => {
                const aTitle = a.title || '';
                const bTitle = b.title || '';
                if (aTitle === 'Individual Sentences') return 1;
                if (bTitle === 'Individual Sentences') return -1;
                // If both have order, sort by order
                if (a.order !== undefined && b.order !== undefined) return a.order - b.order;
                // If only one has order, it comes first
                if (a.order !== undefined) return -1;
                if (b.order !== undefined) return 1;
                return aTitle.localeCompare(bTitle);
            });

            storiesByBook.set(bookId, stories);

            const isCollection = (stories.length === 1 && !stories[0].isSequential) || (stories.length === 0 && userDictionaries[safeSource]?.type !== 'book');

            books.push({
                id: bookId,
                title: title,
                author: author,
                source: safeSource,
                storyCount: stories.length,
                chapterCount: stories.reduce((acc, s) => acc + s.chapterCount, 0),
                sentenceCount: sourceSentences.length,
                isCollection,
                userType: userDictionaries[safeSource]?.type
            });
        });

        // Sort books: user sources first, then alphabetically
        books.sort((a, b) => {
            const aSrc = a.source || '';
            const bSrc = b.source || '';
            const aUser = aSrc === 'user' || aSrc.startsWith('nb_');
            const bUser = bSrc === 'user' || bSrc.startsWith('nb_');
            if (aUser && !bUser) return -1;
            if (!aUser && bUser) return 1;
            return (a.title || '').localeCompare(b.title || '');
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
