import React, { useState, useMemo } from 'react';
import { useReader, Book, Chapter } from './ReaderContext';
import { usePackageManager } from './PackageManagerContext';
import { InvestigationQueue } from './InvestigationQueue';
import { ArrowLeft, BookOpen, ChevronRight, Plus, Search } from './Icons';

interface ReaderTabProps {
    notebooks?: Record<string, any>;
    onNavigateToReader: (bookId: string, chapterId: string, scrollToSentenceId?: string) => void;
    onOpenImporter: () => void;
}

type ViewState = 'books' | 'chapters' | 'queue';

export const ReaderTab: React.FC<ReaderTabProps> = ({
    notebooks,
    onNavigateToReader,
    onOpenImporter
}) => {
    const { books, getChaptersForBook, investigationQueue, findBookAndChapterForSentence } = useReader();
    const { packages, getPackageColor } = usePackageManager();

    const [view, setView] = useState<ViewState>('books');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);

    // Group books by source type
    const groupedBooks = useMemo(() => {
        const groups: {
            user: Book[];
            imported: Book[];
            official: Book[];
        } = { user: [], imported: [], official: [] };

        books.forEach(book => {
            if (book.source === 'user' || book.source.startsWith('nb_')) {
                groups.user.push(book);
            } else {
                // Check if it's from an imported or official package
                const pkg = packages.find(p =>
                    p.id === book.source ||
                    (p.metadata.source_names && p.metadata.source_names[book.source])
                );
                if (pkg?.type === 'official') {
                    groups.official.push(book);
                } else {
                    groups.imported.push(book);
                }
            }
        });

        return groups;
    }, [books, packages]);

    const handleBookClick = (book: Book) => {
        const chapters = getChaptersForBook(book.id);
        if (chapters.length === 1) {
            // Skip chapter view if only one chapter
            onNavigateToReader(book.id, chapters[0].id);
        } else {
            setSelectedBook(book);
            setView('chapters');
        }
    };

    const handleChapterClick = (chapter: Chapter) => {
        if (selectedBook) {
            onNavigateToReader(selectedBook.id, chapter.id);
        }
    };

    const handleNavigateToReaderFromQueue = (sentenceId: string) => {
        const location = findBookAndChapterForSentence(sentenceId);
        if (location) {
            onNavigateToReader(location.bookId, location.chapterId, sentenceId);
        }
    };

    const getSourceColor = (source: string) => {
        const color = getPackageColor(source);
        if (color?.startsWith('#')) return color;
        return undefined;
    };

    // Render Queue View
    if (view === 'queue') {
        return (
            <InvestigationQueue
                onBack={() => setView('books')}
                onNavigateToReader={handleNavigateToReaderFromQueue}
                notebooks={notebooks}
            />
        );
    }

    // Render Chapters View
    if (view === 'chapters' && selectedBook) {
        const chapters = getChaptersForBook(selectedBook.id);

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setView('books'); setSelectedBook(null); }}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                                {selectedBook.title}
                            </h1>
                            {selectedBook.author && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    by {selectedBook.author}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Chapter List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {chapters.map(chapter => (
                            <button
                                key={chapter.id}
                                onClick={() => handleChapterClick(chapter)}
                                className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                                        {chapter.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {chapter.sentenceIds.length} sentence{chapter.sentenceIds.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Render Books View (Main)
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        Reader
                    </h1>
                    <button
                        onClick={onOpenImporter}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-bold rounded-full hover:bg-amber-600 transition-colors shadow-md"
                    >
                        <Plus size={18} />
                        <span>New Story</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Investigation Queue Entry Point */}
                <button
                    onClick={() => setView('queue')}
                    className="w-full mb-4 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-xl p-4 text-white flex items-center justify-between shadow-lg hover:from-sky-600 hover:to-indigo-600 transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 rounded-full p-2">
                            <Search size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="font-bold text-lg">Investigation Queue</h3>
                            <p className="text-sm text-white/80">Words to research</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {investigationQueue.length > 0 && (
                            <span className="bg-white text-indigo-600 font-bold text-sm px-3 py-1 rounded-full">
                                {investigationQueue.length}
                            </span>
                        )}
                        <ChevronRight size={24} className="text-white/60" />
                    </div>
                </button>

                {/* No Books State */}
                {books.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <BookOpen size={48} className="mb-4 opacity-30" />
                        <p className="text-center">No stories available yet.</p>
                        <p className="text-center text-sm mt-1">
                            Import a story or package to get started.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* User Stories */}
                        {groupedBooks.user.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    My Stories
                                </h2>
                                <div className="space-y-2">
                                    {groupedBooks.user.map(book => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            color="#f59e0b"
                                            onClick={() => handleBookClick(book)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Imported Stories */}
                        {groupedBooks.imported.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Imported
                                </h2>
                                <div className="space-y-2">
                                    {groupedBooks.imported.map(book => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            color={getSourceColor(book.source)}
                                            onClick={() => handleBookClick(book)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Official Stories */}
                        {groupedBooks.official.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Official Sources
                                </h2>
                                <div className="space-y-2">
                                    {groupedBooks.official.map(book => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            onClick={() => handleBookClick(book)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Book Card Component
const BookCard: React.FC<{
    book: Book;
    color?: string;
    onClick: () => void;
}> = ({ book, color, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center gap-4 group"
        >
            {/* Book Icon/Badge */}
            <div
                className="w-12 h-16 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: color ? color + '20' : '#64748b20' }}
            >
                <BookOpen
                    size={24}
                    className="transition-colors"
                    style={{ color: color || '#64748b' }}
                />
            </div>

            {/* Book Info */}
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors truncate">
                    {book.title}
                </h3>
                {book.author && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        by {book.author}
                    </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{book.sentenceCount} sentences</span>
                    {book.chapterCount > 1 && (
                        <span>{book.chapterCount} chapters</span>
                    )}
                </div>
            </div>

            <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500 shrink-0" />
        </button>
    );
};
