import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Sentence, useCorpus } from './CorpusContext';

// --- Types ---

export interface Book {
    id: string;           // Generated from story name or source
    title: string;        // Story column or source name
    author?: string;      // From first sentence
    source: string;       // Data source
    chapterCount: number; // Number of chapters
    sentenceCount: number;// Total sentences
}

export interface Chapter {
    id: string;
    name: string;
    bookId: string;
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
    getChaptersForBook: (bookId: string) => Chapter[];
    getSentencesForChapter: (bookId: string, chapterId: string) => Sentence[];
    getSentencesForBook: (bookId: string) => Sentence[];
    findBookAndChapterForSentence: (sentenceId: string) => { bookId: string, chapterId: string } | null;
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

// Helper: Create a stable book ID from story name or source
const createBookId = (story: string | undefined, source: string): string => {
    if (story && story.trim()) {
        return `book_${story.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    }
    return `source_${source.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
};

// Helper: Create a stable chapter ID
const createChapterId = (bookId: string, chapter: string | undefined): string => {
    if (chapter && chapter.trim()) {
        return `${bookId}_ch_${chapter.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    }
    return `${bookId}_main`;
};

export const ReaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { sentences, userSentences } = useCorpus();

    const [investigationQueue, setInvestigationQueue] = useState<InvestigationItem[]>([]);

    // Load investigation queue from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem('cherokee_app_investigation_queue');
            if (saved) {
                setInvestigationQueue(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load investigation queue", e);
        }
    }, []);

    // Save investigation queue to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_investigation_queue', JSON.stringify(investigationQueue));
        } catch (e) {
            console.error("Failed to save investigation queue", e);
        }
    }, [investigationQueue]);

    // Combine all sentences
    const allSentences = useMemo(() => {
        return [...sentences, ...userSentences];
    }, [sentences, userSentences]);

    // Group sentences into books
    const { books, sentencesByBook, chaptersByBook } = useMemo(() => {
        const bookMap = new Map<string, {
            sentences: Sentence[];
            title: string;
            author?: string;
            source: string;
        }>();

        allSentences.forEach(sentence => {
            const bookId = createBookId(sentence.story, sentence.source);

            if (!bookMap.has(bookId)) {
                bookMap.set(bookId, {
                    sentences: [],
                    title: sentence.story || sentence.source,
                    author: sentence.author,
                    source: sentence.source
                });
            }

            bookMap.get(bookId)!.sentences.push(sentence);
        });

        const books: Book[] = [];
        const sentencesByBook = new Map<string, Sentence[]>();
        const chaptersByBook = new Map<string, Chapter[]>();

        bookMap.forEach((data, bookId) => {
            // Sort sentences by line number or index
            const sortedSentences = [...data.sentences].sort((a, b) => {
                if (a.line !== undefined && b.line !== undefined) {
                    return a.line - b.line;
                }
                // Fallback to ID comparison for sources without line numbers
                return a.id.localeCompare(b.id);
            });

            sentencesByBook.set(bookId, sortedSentences);

            // Group into chapters
            const chapterMap = new Map<string, Sentence[]>();
            sortedSentences.forEach(sentence => {
                const chapterId = createChapterId(bookId, sentence.chapter);
                if (!chapterMap.has(chapterId)) {
                    chapterMap.set(chapterId, []);
                }
                chapterMap.get(chapterId)!.push(sentence);
            });

            const chapters: Chapter[] = [];
            chapterMap.forEach((chapterSentences, chapterId) => {
                // Sort within chapter by line
                const sorted = [...chapterSentences].sort((a, b) => {
                    if (a.line !== undefined && b.line !== undefined) {
                        return a.line - b.line;
                    }
                    return a.id.localeCompare(b.id);
                });

                chapters.push({
                    id: chapterId,
                    name: sorted[0].chapter || 'Main',
                    bookId: bookId,
                    sentenceIds: sorted.map(s => s.id)
                });
            });

            // Sort chapters - try to sort numerically if possible
            chapters.sort((a, b) => {
                const aNum = parseInt(a.name, 10);
                const bNum = parseInt(b.name, 10);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                }
                return a.name.localeCompare(b.name);
            });

            chaptersByBook.set(bookId, chapters);

            books.push({
                id: bookId,
                title: data.title,
                author: data.author,
                source: data.source,
                chapterCount: chapters.length,
                sentenceCount: sortedSentences.length
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

        return { books, sentencesByBook, chaptersByBook };
    }, [allSentences]);

    // Create a sentence lookup map for reverse lookups
    const sentenceToBookChapter = useMemo(() => {
        const map = new Map<string, { bookId: string, chapterId: string }>();

        chaptersByBook.forEach((chapters, bookId) => {
            chapters.forEach(chapter => {
                chapter.sentenceIds.forEach(sentenceId => {
                    map.set(sentenceId, { bookId, chapterId: chapter.id });
                });
            });
        });

        return map;
    }, [chaptersByBook]);

    const getChaptersForBook = (bookId: string): Chapter[] => {
        return chaptersByBook.get(bookId) || [];
    };

    const getSentencesForChapter = (bookId: string, chapterId: string): Sentence[] => {
        const chapters = chaptersByBook.get(bookId) || [];
        const chapter = chapters.find(c => c.id === chapterId);
        if (!chapter) return [];

        const sentenceMap = new Map(allSentences.map(s => [s.id, s]));
        return chapter.sentenceIds.map(id => sentenceMap.get(id)).filter(Boolean) as Sentence[];
    };

    const getSentencesForBook = (bookId: string): Sentence[] => {
        return sentencesByBook.get(bookId) || [];
    };

    const findBookAndChapterForSentence = (sentenceId: string): { bookId: string, chapterId: string } | null => {
        return sentenceToBookChapter.get(sentenceId) || null;
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
            getChaptersForBook,
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
