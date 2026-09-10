import React, { useState, useMemo } from 'react';
import { useReader, Book, Chapter, Story } from './ReaderContext';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import { InvestigationQueue } from './InvestigationQueue';
import { ArrowLeft, BookOpen, ChevronRight, ChevronUp, ChevronDown, Plus, Search, Folder, Menu, Trash2 } from './Icons';
import { Modal } from './UI';

interface ReaderTabProps {
    customDictionaries?: Record<string, any>;
    onNavigateToReader: (bookId: string, chapterId: string, scrollToSentenceId?: string) => void;
    onOpenImporter: (dictionaryId?: string, initialStoryName?: string, initialMode?: 'new' | 'append') => void;
    onShowSettings?: () => void;
}

type ViewState = 'books' | 'stories' | 'chapters' | 'queue';

export const ReaderTab: React.FC<ReaderTabProps> = ({
    customDictionaries,
    onNavigateToReader,
    onOpenImporter,
    onShowSettings
}) => {
    const { books, getStoriesForBook, getChaptersForStory, investigationQueue, findBookAndChapterForSentence } = useReader();
    const { getPackageColor } = usePackageManager();
    const { setCustomDictionaries, deleteUserBook, deleteUserChapter, reorderUserChapters } = useCorpus();

    const [view, setView] = useState<ViewState>('books');
    const [selectedBook, setSelectedBook] = useState<Book | null>(null);
    const [selectedStory, setSelectedStory] = useState<Story | null>(null);

    const [showNewBookModal, setShowNewBookModal] = useState(false);
    const [newBookName, setNewBookName] = useState('');
    const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
    const [chapterToDelete, setChapterToDelete] = useState<Chapter | null>(null);

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
        groups.sequential.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        groups.collections.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

        return groups;
    }, [books]);

    const handleStoryClick = (story: Story) => {
        const chapters = getChaptersForStory(story.id);
        if (chapters.length === 1 && !story.isSequential) {
            // If it's just individual sentences (unstructured collection), go straight to reader
            onNavigateToReader(story.bookId, chapters[0].id);
        } else {
            // For sequential stories/books, open chapters view even if only 1 chapter
            setSelectedStory(story);
            setView('chapters');
        }
    };

    const handleBookClick = (book: Book) => {
        setSelectedBook(book);
        const stories = getStoriesForBook(book.id);
        if (stories.length === 1) {
            handleStoryClick(stories[0]);
        } else if (stories.length === 0) {
            // Empty book - open chapters view so user can add chapter
            const safeTitle = book.title || 'Untitled';
            const emptyStory: Story = {
                id: `${book.id}_st_${safeTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
                title: safeTitle,
                bookId: book.id,
                chapterCount: 0,
                sentenceCount: 0,
                isSequential: true
            };
            setSelectedStory(emptyStory);
            setView('chapters');
        } else if (stories.length > 1) {
            // Multiple stories - show stories list (e.g. Bible)
            setView('stories');
        } else {
            // Fallback
            setView('books');
        }
    };

    const handleChapterClick = (chapter: Chapter) => {
        if (!selectedBook) return;
        onNavigateToReader(selectedBook.id, chapter.id);
    };

    const handleNavigateToReaderFromQueue = (sentenceId: string) => {
        const location = findBookAndChapterForSentence(sentenceId);
        if (location) {
            onNavigateToReader(location.bookId, location.chapterId, sentenceId);
        }
    };

    const getSourceColor = (source: string | undefined) => {
        if (!source) return '#64748b';
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

    const isBookEditable = (book: Book) => {
        return book.source === 'user' || book.source.startsWith('nb_') || !!customDictionaries?.[book.source];
    };

    const handleDeleteBook = (book: Book) => {
        setBookToDelete(book);
    };

    const handleDeleteChapter = (chapter: Chapter, e: React.MouseEvent) => {
        e.stopPropagation();
        setChapterToDelete(chapter);
    };

    const handleMoveChapter = (chapters: Chapter[], idx: number, direction: 'up' | 'down', e: React.MouseEvent) => {
        e.stopPropagation();
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= chapters.length) return;

        const reordered = [...chapters];
        const temp = reordered[idx];
        reordered[idx] = reordered[targetIdx];
        reordered[targetIdx] = temp;

        const chapterNames = reordered.map(c => c.name);
        reorderUserChapters(selectedBook?.source || 'user', selectedStory?.title || '', chapterNames);
    };

    // Render Queue View
    if (view === 'queue') {
        return (
            <InvestigationQueue
                onBack={() => setView('books')}
                onNavigateToReader={handleNavigateToReaderFromQueue}
                customDictionaries={customDictionaries}
                onShowSettings={onShowSettings}
            />
        );
    }

    // Render Stories View
    if (view === 'stories' && selectedBook) {
        const stories = getStoriesForBook(selectedBook.id);

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-12 flex items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setView('books'); setSelectedBook(null); }}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                                {selectedBook.title}
                            </h1>
                            {selectedBook.author && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    by {selectedBook.author}
                                </p>
                            )}
                        </div>
                        {onShowSettings && (
                            <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                                <Menu size={24} strokeWidth={1.5} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Story List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {stories.map(story => (
                            <button
                                key={story.id}
                                onClick={() => handleStoryClick(story)}
                                className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center justify-between group"
                            >
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors">
                                        {story.title}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {story.chapterCount} chapter{story.chapterCount !== 1 ? 's' : ''} • {story.sentenceCount} sentence{story.sentenceCount !== 1 ? 's' : ''}
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

    // Render Chapters View
    if (view === 'chapters' && selectedStory) {
        const chapters = getChaptersForStory(selectedStory.id);
        const canEdit = !selectedBook || selectedBook.source === 'user' || selectedBook.source.startsWith('nb_') || (selectedBook.source && customDictionaries?.[selectedBook.source]);

        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 h-12 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                            onClick={() => { setView(selectedBook && getStoriesForBook(selectedBook.id).length > 1 ? 'stories' : 'books'); setSelectedStory(null); }}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                                {selectedStory.title}
                            </h1>
                            {selectedBook && selectedBook.title !== selectedStory.title && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {selectedBook.title}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {canEdit && (
                            <button
                                onClick={() => onOpenImporter(selectedBook?.source, selectedStory.title, 'append')}
                                className="bg-slate-900 dark:bg-slate-700 text-white p-1.5 rounded-full shadow-sm hover:bg-slate-800 transition-colors"
                                title="Add new chapter"
                            >
                                <Plus size={18} />
                            </button>
                        )}
                        {onShowSettings && (
                            <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                                <Menu size={24} strokeWidth={1.5} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Chapter List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-2">
                        {chapters.map((chapter, idx) => (
                            <div
                                key={chapter.id}
                                onClick={() => handleChapterClick(chapter)}
                                className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-amber-300 dark:hover:border-amber-700 transition-colors flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex-1 min-w-0 pr-2">
                                    <h3 className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition-colors truncate">
                                        {chapter.name}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {chapter.sentenceIds.length} sentence{chapter.sentenceIds.length !== 1 ? 's' : ''}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                    {canEdit && (
                                        <>
                                            {chapters.length > 1 && (
                                                <div className="flex items-center">
                                                    <button
                                                        onClick={(e) => handleMoveChapter(chapters, idx, 'up', e)}
                                                        disabled={idx === 0}
                                                        className="p-1.5 text-slate-400 hover:text-amber-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        title="Move chapter up"
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleMoveChapter(chapters, idx, 'down', e)}
                                                        disabled={idx === chapters.length - 1}
                                                        className="p-1.5 text-slate-400 hover:text-amber-600 disabled:opacity-20 disabled:hover:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                        title="Move chapter down"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteChapter(chapter, e)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-1"
                                                title="Delete chapter"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                    <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500 ml-1" />
                                </div>
                            </div>
                        ))}

                        {/* Outlined Add New Chapter Card */}
                        {canEdit && (
                            <button
                                onClick={() => onOpenImporter(selectedBook?.source, selectedStory.title, 'append')}
                                className="w-full bg-slate-50/50 dark:bg-slate-900/30 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-left hover:border-amber-400 dark:hover:border-amber-600 hover:bg-white dark:hover:bg-slate-900 transition-all flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 transition-colors">
                                        <Plus size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                            Add new chapter
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Import sentences for Chapter {chapters.length + 1}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500" />
                            </button>
                        )}
                    </div>
                </div>

                {chapterToDelete && (
                    <Modal title="Delete Chapter?" onClose={() => setChapterToDelete(null)}>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Are you sure you want to delete <strong>"{chapterToDelete.name}"</strong>? All sentences inside this chapter will be deleted.
                        </p>
                        <button
                            onClick={() => {
                                deleteUserChapter(selectedBook?.source || 'user', selectedStory.title, chapterToDelete.name);
                                setChapterToDelete(null);
                            }}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Delete Chapter
                        </button>
                    </Modal>
                )}
            </div>
        );
    }

    // Render Books View (Main)
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-10 px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 h-12">
                <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                    Reader
                </h1>
                <div className="flex gap-1.5 items-center">
                    <button
                        onClick={() => setShowNewBookModal(true)}
                        className="bg-slate-900 dark:bg-slate-700 text-white p-1.5 rounded-full shadow-sm hover:bg-slate-800 transition-colors"
                    >
                        <Plus size={18} />
                    </button>
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                            <Menu size={22} strokeWidth={1.5} />
                        </button>
                    )}
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
                                            onDelete={isBookEditable(book) ? () => handleDeleteBook(book) : undefined}
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
                                            onDelete={isBookEditable(book) ? () => handleDeleteBook(book) : undefined}
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

                {bookToDelete && (
                    <Modal title="Delete Book?" onClose={() => setBookToDelete(null)}>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Are you sure you want to delete <strong>"{bookToDelete.title}"</strong> and all its chapters? All sentences inside it will be lost.
                        </p>
                        <button
                            onClick={() => {
                                deleteUserBook(bookToDelete.source);
                                setBookToDelete(null);
                            }}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
                        >
                            Delete Book
                        </button>
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
    onDelete?: () => void;
}> = ({ book, title, color, onClick, onDelete }) => {
    const Icon = book.isCollection ? Folder : BookOpen;

    return (
        <div
            onClick={onClick}
            className={`w-full rounded-xl border p-4 text-left transition-colors flex items-center gap-4 group cursor-pointer ${book.isCollection
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
                <h3 className={`font-bold transition-colors truncate ${book.isCollection ? "text-slate-600 dark:text-slate-400" : "text-slate-900 dark:text-slate-100 group-hover:text-amber-600"}`}>
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
                            <span>{book.chapterCount || book.storyCount} {book.chapterCount === 1 ? 'chapter' : 'chapters'}</span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {onDelete && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete book"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
                <ChevronRight size={20} className="text-slate-400 group-hover:text-amber-500" />
            </div>
        </div>
    );
};

