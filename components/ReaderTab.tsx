import React, { useState, useMemo } from 'react';
import { useReader, Book, Chapter, Story } from './ReaderContext';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import { InvestigationQueue } from './InvestigationQueue';
import { ArrowLeft, BookOpen, ChevronRight, Plus, Search, Folder } from './Icons';
import { Modal } from './UI';

interface ReaderTabProps {
    customDictionaries?: Record<string, any>;
    onNavigateToReader: (bookId: string, chapterId: string, scrollToSentenceId?: string) => void;
    onOpenImporter: (dictionaryId?: string) => void;
}

type ViewState = 'books' | 'stories' | 'chapters' | 'queue';

export const ReaderTab: React.FC<ReaderTabProps> = ({
    customDictionaries,
    onNavigateToReader,
    onOpenImporter
}) => {
    const { books, getStoriesForBook, getChaptersForStory, investigationQueue, findBookAndChapterForSentence } = useReader();
    const { getPackageColor } = usePackageManager();
    const { setCustomDictionaries } = useCorpus();

    const [view, setView] = useState<ViewState>('books');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);

    const [showNewBookModal, setShowNewBookModal] = useState(false);
    const [newBookName, setNewBookName] = useState('');

    // Group books into sequential and collections
    const groupedBooks = useMemo(() => {
        const groups: {
            sequential: Book[];
            collections: Book[];
        } = { sequential: [], collections: [] };

        books.forEach(book => {
            // Always treat notebook-tab sources as collections in the Reader
            if (book.userType === 'notebook') {
                // Only show notebooks in reader if they actually have sentences
                if (book.sentenceCount > 0) {
                    groups.collections.push(book);
                }
            } else if (book.isCollection) {
                // Sources marked as collections (unstructured) go to collections
                groups.collections.push(book);
            } else {
                // Structured/Sequential books
                groups.sequential.push(book);
            }
        });

        // Sort both groups by title
        groups.sequential.sort((a, b) => a.title.localeCompare(b.title));
        groups.collections.sort((a, b) => a.title.localeCompare(b.title));

        return groups;
    }, [books]);

    const handleStoryClick = (story: Story) => {
        const chapters = getChaptersForStory(story.id);
        if (chapters.length === 1 && !story.isSequential) {
            // If it's just individual sentences and only one "chapter", go straight to reader
            onNavigateToReader(story.bookId, chapters[0].id);
        } else if (chapters.length === 1 && story.isSequential) {
            // Even if sequential, if only one chapter, skip chapter view
            onNavigateToReader(story.bookId, chapters[0].id);
        } else {
            setSelectedStory(story);
            setView('chapters');
        }
    };

    const handleBookClick = (book: Book) => {
        const stories = getStoriesForBook(book.id);
        if (stories.length === 1) {
            handleStoryClick(stories[0]);
        } else {
            setSelectedBook(book);
            setView('stories');
        }
    };

    const handleChapterClick = (chapter: Chapter) => {
        onNavigateToReader(chapter.storyId.split('_st_')[0], chapter.id);
    };

    const handleNavigateToReaderFromQueue = (sentenceId: string) => {
        const location = findBookAndChapterForSentence(sentenceId);
        if (location) {
            onNavigateToReader(location.bookId, location.chapterId, sentenceId);
        }
    };

    const getSourceColor = (source: string) => {
        if (source === 'user' || source.startsWith('nb_')) {
            return '#f59e0b'; // Gold
        }

        const color = getPackageColor(source);
        if (!color) return '#64748b'; // Default Grey
        if (color.startsWith('#')) return color;

        // Map Tailwind/Named colors to hex
        const colorMap: Record<string, string> = {
            'slate': '#64748b',
            'gray': '#64748b',
            'grey': '#64748b',
            'amber': '#f59e0b',
            'gold': '#f59e0b',
            'blue': '#3b82f6',
            'red': '#ef4444',
            'green': '#10b981',
            'purple': '#8b5cf6',
            'indigo': '#6366f1'
        };

        return colorMap[color.toLowerCase()] || '#64748b';
    };

    const handleCreateBook = () => {
        if (!newBookName.trim()) return;
        const id = `nb_${Date.now()}`;
        setCustomDictionaries(prev => ({
            ...prev,
            [id]: {
                id,
                name: newBookName.trim(),
                date: Date.now(),
                type: 'book'
            }
        }));
        setNewBookName('');
        setShowNewBookModal(false);
    };

    // Render Queue View
    if (view === 'queue') {
        return (
            <InvestigationQueue
                onBack={() => setView('books')}
                onNavigateToReader={handleNavigateToReaderFromQueue}
                customDictionaries={customDictionaries}
            />
        );
    }

    // Render Stories View
    if (view === 'stories' && selectedBook) {
        const stories = getStoriesForBook(selectedBook.id);

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setView('books'); setSelectedBook(null); }}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {selectedBook.title}
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {stories.map(story => (
                            <button
                                key={story.id}
                                onClick={() => handleStoryClick(story)}
                                className={`w-full rounded-xl border p-4 text-left transition-colors flex items-center justify-between group ${story.isSequential
                                        ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700"
                                        : "bg-slate-50 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900"
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${story.isSequential ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" : "bg-slate-200 dark:bg-slate-800 text-slate-500"}`}>
                                        {story.isSequential ? <BookOpen size={18} /> : <Folder size={18} />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold transition-colors ${story.isSequential ? 'text-slate-900 dark:text-slate-100 group-hover:text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {story.title}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {story.sentenceCount} sentences {story.chapterCount > 1 && ` across ${story.chapterCount} chapters`}
                                            {!story.isSequential && ' • Unstructured Collection'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500" />
                            </button>
                        ))}

                        {/* Create New Story Button (only for user notebooks) */}
                        {(selectedBook.source === 'user' || selectedBook.source.startsWith('nb_')) && (
                            <div className="pt-2">
                                <button
                                    onClick={() => onOpenImporter(selectedBook.source)}
                                    className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} />
                                    <span>Create New Story</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Render Chapters View
    if (view === 'chapters' && selectedStory) {
        const chapters = getChaptersForStory(selectedStory.id);

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setView(selectedBook ? 'stories' : 'books'); setSelectedStory(null); }}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {selectedStory.title}
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {selectedBook ? selectedBook.title : ''}
                            </p>
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
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                    Reader
                </h1>
                <button
                    onClick={() => setShowNewBookModal(true)}
                    className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md hover:bg-slate-800 transition-colors"
                >
                    <Plus size={20} />
                </button>
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
                        {/* Sequential Books */}
                        {groupedBooks.sequential.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Books
                                </h2>
                                <div className="space-y-2">
                                    {groupedBooks.sequential.map(book => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            title={book.title}
                                            color={getSourceColor(book.source)}
                                            onClick={() => handleBookClick(book)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Create New Book Button */}
                        <div className="pt-2">
                            <button
                                onClick={() => setShowNewBookModal(true)}
                                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                <span>Create New Book</span>
                            </button>
                        </div>

                        {/* Sentence Collections */}
                        {groupedBooks.collections.length > 0 && (
                            <section>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                    Sentence Collections
                                </h2>
                                <div className="space-y-2">
                                    {groupedBooks.collections.map(book => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            title={book.title}
                                            color={getSourceColor(book.source)}
                                            onClick={() => handleBookClick(book)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}

                {showNewBookModal && (
                    <Modal title="Create New Book" onClose={() => setShowNewBookModal(false)}>
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Give your new book a name. You can then add multiple stories inside it.
                            </p>
                            <input
                                type="text"
                                autoFocus
                                value={newBookName}
                                onChange={e => setNewBookName(e.target.value)}
                                placeholder="Title"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                onKeyDown={e => e.key === 'Enter' && handleCreateBook()}
                            />
                            <button
                                onClick={handleCreateBook}
                                disabled={!newBookName.trim()}
                                className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Create Book
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        </div>
    );
};

// Book Card Component
const BookCard: React.FC<{
    book: Book;
    title: string;
    color?: string;
    onClick: () => void;
}> = ({ book, title, color, onClick }) => {
    const Icon = book.isCollection ? Folder : BookOpen;

    return (
        <button
            onClick={onClick}
            className={`w-full rounded-xl border p-4 text-left transition-colors flex items-center gap-4 group ${book.isCollection
                    ? "bg-slate-50/50 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-900"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700"
                }`}
        >
            {/* Book Icon/Badge */}
            <div
                className={`w-12 h-16 rounded-lg flex items-center justify-center shrink-0 ${book.isCollection ? "" : "shadow-sm"}`}
                style={{ backgroundColor: color ? color + '20' : '#64748b20' }}
            >
                <Icon
                    size={24}
                    className="transition-colors"
                    style={{ color: color || '#64748b' }}
                />
            </div>

            {/* Book Info */}
            <div className="flex-1 min-w-0">
                <h3 className={`font-bold transition-colors ${book.isCollection ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100 group-hover:text-amber-600"}`}>
                    {title}
                </h3>
                {book.author && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        by {book.author}
                    </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                    <span>{book.sentenceCount} sentences</span>
                    {!book.isCollection && (
                        <>
                            <span>•</span>
                            <span>{book.storyCount} {book.storyCount === 1 ? 'story' : 'stories'}</span>
                        </>
                    )}
                </div>
            </div>

            <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500 shrink-0" />
        </button>
    );
};

