import React, { useState, useMemo, useEffect } from 'react';
import { useCorpus, CustomDictionary } from './CorpusContext';
import { useReader } from './ReaderContext';
import { ArrowLeft, ArrowRight, Check, Type, BookOpen, ChevronDown, Menu, Trash2, Plus, AlertCircle } from './Icons';

type Step = 'details' | 'paste' | 'review' | 'done';
type Mode = 'new' | 'append';

interface ReviewSentence {
    id: string;
    syllabary: string;
    translit: string;
    english: string;
}

const generateId = () => 'us_' + Math.random().toString(36).substring(2, 11);

interface TextImporterProps {
    onBack: () => void;
    onComplete: (storyId: string) => void;
    customDictionaries: Record<string, CustomDictionary>;
    preselectedDictionaryId?: string;
    initialStoryName?: string;
    initialMode?: Mode;
    onShowSettings?: () => void;
}

export const TextImporter: React.FC<TextImporterProps> = ({
    onBack,
    onComplete,
    customDictionaries,
    preselectedDictionaryId,
    initialStoryName,
    initialMode,
    onShowSettings
}) => {
    const { addUserSentence, setCustomDictionaries } = useCorpus();
    const { books, getStoriesForBook, getChaptersForStory } = useReader();

    // Mode: 'new' book/story or 'append' chapter to existing book
    const [mode, setMode] = useState<Mode>(initialMode || (initialStoryName ? 'append' : 'new'));
    const [step, setStep] = useState<Step>('details');

    // Details state (New Book)
    const [bookTitle, setBookTitle] = useState(initialStoryName || '');
    const [chapterName, setChapterName] = useState('Chapter 1');
    const [selectedDictionary, setSelectedDictionary] = useState<string | ''>(preselectedDictionaryId || '');
    const [showDictionaryDropdown, setShowDictionaryDropdown] = useState(false);
    const [newDictionaryName, setNewDictionaryName] = useState('');

    // Details state (Append Chapter)
    const [selectedBookId, setSelectedBookId] = useState<string>('');

    // Raw text inputs
    const [syllabaryText, setSyllabaryText] = useState('');
    const [translitText, setTranslitText] = useState('');
    const [englishText, setEnglishText] = useState('');

    // Sentence cards review state
    const [reviewSentences, setReviewSentences] = useState<ReviewSentence[]>([]);

    // Convert custom dictionaries to array for dropdown
    const dictionaryArray = useMemo(() => {
        return Object.entries(customDictionaries).map(([id, nb]) => ({ id, name: nb.name }));
    }, [customDictionaries]);

    // Filter available books for appending (user created or notebooks)
    const appendableBooks = useMemo(() => {
        return books.filter(b => b.source === 'user' || b.source.startsWith('nb_') || customDictionaries[b.source]);
    }, [books, customDictionaries]);

    // If appendable books change or initial selection
    useEffect(() => {
        if (appendableBooks.length > 0 && !selectedBookId) {
            if (preselectedDictionaryId) {
                const found = appendableBooks.find(b => b.source === preselectedDictionaryId);
                if (found) {
                    setSelectedBookId(found.id);
                    return;
                }
            }
            setSelectedBookId(appendableBooks[0].id);
        }
    }, [appendableBooks, selectedBookId, preselectedDictionaryId]);

    // Auto-calculate chapter number when book changes in append mode
    useEffect(() => {
        if (mode === 'append' && selectedBookId) {
            const stories = getStoriesForBook(selectedBookId);
            let totalChapters = 0;
            if (stories.length > 0) {
                const chapters = getChaptersForStory(stories[0].id);
                totalChapters = chapters.length;
            }
            setChapterName(`Chapter ${totalChapters + 1}`);
        } else if (mode === 'new' && !chapterName) {
            setChapterName('Chapter 1');
        }
    }, [mode, selectedBookId, getStoriesForBook, getChaptersForStory]);

    // Helper to get lines strictly by newline, trimming leading and trailing blank lines
    const getLines = (text: string): string[] => {
        const trimmed = text.replace(/^[\r\n]+|[\r\n]+$/g, '');
        if (!trimmed.trim()) return [];
        return trimmed.split(/\r?\n/);
    };

    const sylLines = useMemo(() => getLines(syllabaryText), [syllabaryText]);
    const trLines = useMemo(() => getLines(translitText), [translitText]);
    const enLines = useMemo(() => getLines(englishText), [englishText]);

    // Live validation
    const validation = useMemo(() => {
        const hasSyl = sylLines.length > 0;
        const hasTr = trLines.length > 0;
        const hasEn = enLines.length > 0;

        const hasCherokee = hasSyl || hasTr;
        if (!hasCherokee && !hasEn) {
            return {
                status: 'empty' as const,
                message: 'Enter Cherokee Syllabary or Transliteration text below to split into sentences.',
                targetCount: 0,
                isValid: false
            };
        }

        if (!hasCherokee && hasEn) {
            return {
                status: 'error' as const,
                message: 'Cherokee text (Syllabary or Transliteration) is required.',
                targetCount: 0,
                isValid: false
            };
        }

        const counts: { field: string; count: number }[] = [];
        if (hasSyl) counts.push({ field: 'Syllabary', count: sylLines.length });
        if (hasTr) counts.push({ field: 'Transliteration', count: trLines.length });
        if (hasEn) counts.push({ field: 'English', count: enLines.length });

        const targetCount = counts[0].count;
        const isAligned = counts.every(c => c.count === targetCount);

        if (isAligned) {
            return {
                status: 'aligned' as const,
                message: `Sentences Aligned (${targetCount} line${targetCount === 1 ? '' : 's'})`,
                targetCount,
                isValid: true
            };
        }

        const summary = [
            `Syllabary (${sylLines.length})`,
            `Transliteration (${trLines.length})`,
            `English (${enLines.length})`
        ].join(', ');

        return {
            status: 'mismatch' as const,
            message: `Sentence count mismatch: ${summary}. Please adjust line counts so all provided texts match before proceeding.`,
            targetCount: 0,
            isValid: false
        };
    }, [sylLines, trLines, enLines]);

    // Handle proceeding from Step 2 (Paste) to Step 3 (Review)
    const handleProceedToReview = () => {
        if (!validation.isValid || validation.targetCount === 0) return;

        const count = validation.targetCount;
        const generated: ReviewSentence[] = [];

        for (let i = 0; i < count; i++) {
            generated.push({
                id: generateId(),
                syllabary: sylLines[i] || '',
                translit: trLines[i] || '',
                english: enLines[i] || ''
            });
        }

        setReviewSentences(generated);
        setStep('review');
    };

    // Handle back from Step 3 (Review) to Step 2 (Paste) with 2-way sync
    const handleBackFromReview = () => {
        setSyllabaryText(reviewSentences.map(s => s.syllabary).join('\n'));
        setTranslitText(reviewSentences.map(s => s.translit).join('\n'));
        setEnglishText(reviewSentences.map(s => s.english).join('\n'));
        setStep('paste');
    };

    // Update single sentence field in review
    const handleUpdateSentence = (index: number, field: keyof ReviewSentence, value: string) => {
        setReviewSentences(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    // Delete single sentence in review
    const handleDeleteSentence = (index: number) => {
        setReviewSentences(prev => prev.filter((_, i) => i !== index));
    };

    // Add empty sentence in review
    const handleAddSentence = () => {
        setReviewSentences(prev => [
            ...prev,
            { id: generateId(), syllabary: '', translit: '', english: '' }
        ]);
    };

    // Save final sentences
    const handleSave = async () => {
        if (reviewSentences.length === 0) return;

        let finalStoryTitle = '';
        let finalDictionaryId = selectedDictionary;
        let finalChapterName = chapterName.trim() || 'Chapter 1';

        if (mode === 'new') {
            if (!bookTitle.trim()) return;
            finalStoryTitle = bookTitle.trim();

            if (selectedDictionary === '__new__' && newDictionaryName.trim()) {
                finalDictionaryId = `nb_${Date.now()}`;
                setCustomDictionaries(prev => ({
                    ...prev,
                    [finalDictionaryId]: {
                        id: finalDictionaryId,
                        name: newDictionaryName.trim(),
                        date: Date.now(),
                        type: 'book'
                    }
                }));
            } else if (!finalDictionaryId) {
                finalDictionaryId = `nb_${Date.now()}`;
                setCustomDictionaries(prev => ({
                    ...prev,
                    [finalDictionaryId]: {
                        id: finalDictionaryId,
                        name: finalStoryTitle,
                        date: Date.now(),
                        type: 'book'
                    }
                }));
            }
        } else {
            // Append Mode
            const targetBook = appendableBooks.find(b => b.id === selectedBookId);
            if (!targetBook) return;

            finalStoryTitle = targetBook.title;
            finalDictionaryId = targetBook.source;
        }

        // Add all sentences
        reviewSentences.forEach((sent, idx) => {
            addUserSentence({
                id: sent.id || generateId(),
                syllabary: sent.syllabary.trim(),
                translit: sent.translit.trim(),
                english: sent.english.trim(),
                source: finalDictionaryId,
                story: finalStoryTitle,
                chapter: finalChapterName,
                line: idx + 1
            });
        });

        // Compute generated story ID
        const finalStoryId = `book_${finalDictionaryId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_st_${finalStoryTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

        setStep('done');
        setTimeout(() => {
            onComplete(finalStoryId);
        }, 1200);
    };

    // Step indicators
    const steps: { key: Step; label: string; icon: React.FC<any> }[] = [
        { key: 'details', label: 'Details', icon: BookOpen },
        { key: 'paste', label: 'Paste Text', icon: Type },
        { key: 'review', label: 'Review', icon: Check },
    ];

    const canProceedFromDetails = useMemo(() => {
        if (mode === 'new') {
            return bookTitle.trim().length > 0 && chapterName.trim().length > 0;
        } else {
            return !!(selectedBookId && chapterName.trim().length > 0);
        }
    }, [mode, bookTitle, chapterName, selectedBookId]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0">
                <div className="flex items-center gap-3 w-full">
                    <button
                        onClick={onBack}
                        className="p-1.5 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                            {mode === 'new' ? 'Create Book / Story' : 'Add Chapter'}
                        </h1>
                    </div>
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                            <Menu size={24} strokeWidth={1.5} />
                        </button>
                    )}
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = s.key === step;
                        const isPast = steps.findIndex(st => st.key === step) > i;

                        return (
                            <div key={s.key} className="flex items-center gap-2 shrink-0">
                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${isActive
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : isPast
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                    {isPast ? <Check size={13} /> : <Icon size={13} />}
                                    <span>{s.label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <ArrowRight size={12} className="text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* STEP 1: Details */}
                {step === 'details' && (
                    <div className="max-w-2xl mx-auto space-y-5">
                        {/* Mode Toggle */}
                        <div className="bg-slate-200/80 dark:bg-slate-800 p-1 rounded-xl flex">
                            <button
                                type="button"
                                onClick={() => setMode('new')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'new'
                                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                Create New Book
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('append')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${mode === 'append'
                                    ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                            >
                                Add Chapter to Existing Book
                            </button>
                        </div>

                        {/* Mode 1: Create New Book Details */}
                        {mode === 'new' ? (
                            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Book Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={bookTitle}
                                        onChange={e => setBookTitle(e.target.value)}
                                        placeholder=""
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Chapter Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={chapterName}
                                        onChange={e => setChapterName(e.target.value)}
                                        placeholder="Chapter 1"
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Save to Custom Dictionary / Notebook
                                    </label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowDictionaryDropdown(!showDictionaryDropdown)}
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-left text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center justify-between"
                                        >
                                            <span className="truncate">
                                                {selectedDictionary === '__new__'
                                                    ? '+ Create New Custom Dictionary'
                                                    : selectedDictionary
                                                        ? customDictionaries[selectedDictionary]?.name || selectedDictionary
                                                        : 'Default (Create with Book Title)'
                                                }
                                            </span>
                                            <ChevronDown size={16} className="text-slate-400 shrink-0" />
                                        </button>
                                        {showDictionaryDropdown && (
                                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedDictionary(''); setShowDictionaryDropdown(false); }}
                                                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800"
                                                >
                                                    Default (Create with Book Title)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedDictionary('__new__'); setShowDictionaryDropdown(false); }}
                                                    className="w-full px-4 py-2.5 text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs text-amber-600 font-bold border-b border-slate-100 dark:border-slate-800"
                                                >
                                                    + Create New Custom Dictionary
                                                </button>
                                                {dictionaryArray.map(nb => (
                                                    <button
                                                        key={nb.id}
                                                        type="button"
                                                        onClick={() => { setSelectedDictionary(nb.id); setShowDictionaryDropdown(false); }}
                                                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 truncate"
                                                    >
                                                        {nb.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedDictionary === '__new__' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                            New Custom Dictionary Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={newDictionaryName}
                                            onChange={e => setNewDictionaryName(e.target.value)}
                                            placeholder=""
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Mode 2: Append Chapter Details */
                            <div className="space-y-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                {appendableBooks.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">
                                        No custom books found. Please switch to &ldquo;Create New Book&rdquo; to start your first story.
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Select Book / Notebook
                                            </label>
                                            <select
                                                value={selectedBookId}
                                                onChange={e => setSelectedBookId(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            >
                                                {appendableBooks.map(book => (
                                                    <option key={book.id} value={book.id}>
                                                        {book.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                                Chapter Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={chapterName}
                                                onChange={e => setChapterName(e.target.value)}
                                                placeholder="Chapter 1"
                                                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => setStep('paste')}
                            disabled={!canProceedFromDetails}
                            className="w-full py-3.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                        >
                            <span>Next: Enter Text</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                )}

                {/* STEP 2: Paste Raw Text with Live Counter Badges & Validation */}
                {step === 'paste' && (
                    <div className="max-w-2xl mx-auto space-y-4">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
                            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                Line-by-Line Sentence Input
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Each line corresponds to 1 sentence (1 line = 1 sentence). Syllabary or Transliteration is required.
                            </p>
                        </div>

                        {/* Live Validation Banner */}
                        <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 transition-all text-xs ${validation.status === 'aligned'
                            ? 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                            : validation.status === 'mismatch'
                                ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                            {validation.status === 'aligned' ? (
                                <Check size={16} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle size={16} className={`shrink-0 mt-0.5 ${validation.status === 'mismatch' ? 'text-red-500' : 'text-slate-400'}`} />
                            )}
                            <div className="flex-1 font-medium leading-relaxed">
                                {validation.message}
                            </div>
                        </div>

                        {/* 3 Stacked Textareas */}
                        <div className="space-y-4">
                            {/* Textarea 1: Syllabary */}
                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        1. Cherokee Syllabary
                                    </label>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sylLines.length > 0
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                        {sylLines.length} {sylLines.length === 1 ? 'line' : 'lines'}
                                    </span>
                                </div>
                                <textarea
                                    value={syllabaryText}
                                    onChange={e => setSyllabaryText(e.target.value)}
                                    placeholder=""
                                    rows={4}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-base font-serif text-slate-900 dark:text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Textarea 2: Transliteration */}
                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        2. Transliteration / Phonetic
                                    </label>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${trLines.length > 0
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                        {trLines.length} {trLines.length === 1 ? 'line' : 'lines'}
                                    </span>
                                </div>
                                <textarea
                                    value={translitText}
                                    onChange={e => setTranslitText(e.target.value)}
                                    placeholder=""
                                    rows={4}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-sans text-slate-900 dark:text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Textarea 3: English Translation */}
                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                        3. English Translation (Optional)
                                    </label>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${enLines.length > 0
                                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                        }`}>
                                        {enLines.length} {enLines.length === 1 ? 'line' : 'lines'}
                                    </span>
                                </div>
                                <textarea
                                    value={englishText}
                                    onChange={e => setEnglishText(e.target.value)}
                                    placeholder=""
                                    rows={4}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-sm font-sans text-slate-900 dark:text-slate-100 resize-y focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setStep('details')}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleProceedToReview}
                                disabled={!validation.isValid}
                                className="flex-2 py-3 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                            >
                                <span>Review →</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Review Sentences List */}
                {step === 'review' && (
                    <div className="max-w-2xl mx-auto space-y-4">
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                    Review & Edit Sentences ({reviewSentences.length})
                                </h2>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {mode === 'new' ? bookTitle : appendableBooks.find(b => b.id === selectedBookId)?.title} • {chapterName}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddSentence}
                                className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
                            >
                                <Plus size={14} /> Add Line
                            </button>
                        </div>

                        {/* Sentence Cards List */}
                        <div className="space-y-3">
                            {reviewSentences.map((sent, idx) => (
                                <div
                                    key={sent.id || idx}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                            Sentence #{idx + 1}
                                        </span>
                                        {reviewSentences.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSentence(idx)}
                                                className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                title="Delete sentence"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Syllabary input */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                                            Cherokee Syllabary
                                        </label>
                                        <input
                                            type="text"
                                            value={sent.syllabary}
                                            onChange={e => handleUpdateSentence(idx, 'syllabary', e.target.value)}
                                            placeholder=""
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-base font-serif text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    {/* Transliteration input */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                                            Transliteration / Phonetic
                                        </label>
                                        <input
                                            type="text"
                                            value={sent.translit}
                                            onChange={e => handleUpdateSentence(idx, 'translit', e.target.value)}
                                            placeholder=""
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-sans text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    {/* English input */}
                                    <div>
                                        <label className="block text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 mb-1">
                                            English Translation
                                        </label>
                                        <input
                                            type="text"
                                            value={sent.english}
                                            onChange={e => handleUpdateSentence(idx, 'english', e.target.value)}
                                            placeholder=""
                                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-sans text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-3">
                            <button
                                type="button"
                                onClick={handleBackFromReview}
                                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={reviewSentences.length === 0}
                                className="flex-2 py-3.5 bg-green-500 text-white font-bold text-sm rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Check size={18} />
                                <span>{mode === 'new' ? 'Create Book' : 'Save Chapter'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Done */}
                {step === 'done' && (
                    <div className="flex flex-col items-center justify-center h-80 text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 shadow-sm animate-bounce">
                            <Check size={32} className="text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                            {mode === 'new' ? 'Book Created!' : 'Chapter Added!'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {reviewSentences.length} sentences saved to your library.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
