import React, { useState, useMemo } from 'react';
import { useCorpus, CustomDictionary } from './CorpusContext';
import { ArrowLeft, ArrowRight, Scissors, Merge as MergeIcon, Check, Type, BookOpen, ChevronDown, Menu } from './Icons';

type Step = 'paste' | 'split' | 'metadata' | 'done';

interface ProposedSentence {
    id: string;
    text: string;
    translit?: string;
}

const generateId = () => 'us_' + Math.random().toString(36).substring(2, 11);

interface TextImporterProps {
    onBack: () => void;
    onComplete: (storyId: string) => void;
    customDictionaries: Record<string, CustomDictionary>;
    preselectedDictionaryId?: string;
    onShowSettings?: () => void;
}

export const TextImporter: React.FC<TextImporterProps> = ({
    onBack,
    onComplete,
    customDictionaries,
    preselectedDictionaryId,
    onShowSettings
}) => {
    const { addUserSentence, setCustomDictionaries } = useCorpus();

    const [step, setStep] = useState<Step>('paste');
    const [rawText, setRawText] = useState('');
    const [proposedSentences, setProposedSentences] = useState<ProposedSentence[]>([]);
    const [storyName, setStoryName] = useState('');
    const [chapterName, setChapterName] = useState('');
    const [selectedDictionary, setSelectedDictionary] = useState<string | ''>(preselectedDictionaryId || '');
    const [showDictionaryDropdown, setShowDictionaryDropdown] = useState(false);
    const [newDictionaryName, setNewDictionaryName] = useState('');

    // Convert custom dictionaries to array for dropdown
    const dictionaryArray = useMemo(() => {
        return Object.entries(customDictionaries).map(([id, nb]) => ({ id, name: nb.name }));
    }, [customDictionaries]);

    // Step 1: Smart split by punctuation and newlines
    const handleSmartSplit = () => {
        if (!rawText.trim()) return;

        // Split by sentence-ending punctuation followed by space/newline, or by multiple newlines
        const regex = /(?<=[.!?])\s+|\n{2,}|\n(?=[A-Z\u13A0-\u13F4])/g;
        const parts = rawText.trim().split(regex).filter(p => p.trim());

        const proposed: ProposedSentence[] = parts.map((text, i) => ({
            id: `temp_${Date.now()}_${i}`,
            text: text.trim()
        }));

        setProposedSentences(proposed);
        setStep('split');
    };

    // Split a sentence at cursor position
    const handleSplit = (sentenceId: string, cursorPos: number) => {
        const idx = proposedSentences.findIndex(s => s.id === sentenceId);
        if (idx === -1) return;

        const sentence = proposedSentences[idx];
        const firstPart = sentence.text.substring(0, cursorPos).trim();
        const secondPart = sentence.text.substring(cursorPos).trim();

        if (!firstPart || !secondPart) return;

        const newSentences = [...proposedSentences];
        newSentences.splice(idx, 1,
            { id: `temp_${Date.now()}_a`, text: firstPart },
            { id: `temp_${Date.now()}_b`, text: secondPart }
        );
        setProposedSentences(newSentences);
    };

    // Merge with next sentence
    const handleMerge = (sentenceId: string) => {
        const idx = proposedSentences.findIndex(s => s.id === sentenceId);
        if (idx === -1 || idx >= proposedSentences.length - 1) return;

        const current = proposedSentences[idx];
        const next = proposedSentences[idx + 1];

        const newSentences = [...proposedSentences];
        newSentences.splice(idx, 2, {
            id: `temp_${Date.now()}_merged`,
            text: `${current.text} ${next.text}`
        });
        setProposedSentences(newSentences);
    };

    // Create dictionary if needed and save sentences
    const handleSave = async () => {
        if (!storyName.trim()) return;

        let dictionaryId = selectedDictionary;

        // Create new dictionary if selected
        if (selectedDictionary === '__new__' && newDictionaryName.trim()) {
            dictionaryId = `nb_${Date.now()}`;
            setCustomDictionaries(prev => ({
                ...prev,
                [dictionaryId]: {
                    id: dictionaryId,
                    name: newDictionaryName.trim(),
                    date: Date.now()
                }
            }));
        } else if (!dictionaryId) {
            // Default: create dictionary with story name
            dictionaryId = `nb_${Date.now()}`;
            setCustomDictionaries(prev => ({
                ...prev,
                [dictionaryId]: {
                    id: dictionaryId,
                    name: storyName.trim(),
                    date: Date.now()
                }
            }));
        }

        // Create sentences with generated IDs
        proposedSentences.forEach((ps, idx) => {
            addUserSentence({
                id: generateId(),
                syllabary: ps.text,
                translit: ps.translit || '',
                english: '',
                source: dictionaryId,
                story: storyName.trim(),
                chapter: chapterName.trim() || undefined,
                line: idx + 1
            });
        });

        // Generate story ID
        const storyId = `book_${storyName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;

        setStep('done');
        setTimeout(() => onComplete(storyId), 1500);
    };

    // Step indicators
    const steps: { key: Step; label: string; icon: React.FC<any> }[] = [
        { key: 'paste', label: 'Paste', icon: Type },
        { key: 'split', label: 'Split', icon: Scissors },
        { key: 'metadata', label: 'Details', icon: BookOpen },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            Import Story
                        </h1>
                    </div>
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                            <Menu size={24} strokeWidth={1.5} />
                        </button>
                    )}
                </div>

                {/* Step Indicator */}
                <div className="flex items-center gap-2 mt-3">
                    {steps.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = s.key === step;
                        const isPast = steps.findIndex(st => st.key === step) > i;

                        return (
                            <div key={s.key} className="flex items-center gap-2">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive
                                    ? 'bg-amber-500 text-white'
                                    : isPast
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                    }`}>
                                    {isPast ? <Check size={14} /> : <Icon size={14} />}
                                    <span>{s.label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <ArrowRight size={14} className="text-slate-300 dark:text-slate-600" />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Step 1: Paste */}
                {step === 'paste' && (
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Paste Your Text
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Paste Cherokee text (Syllabary preferred). We'll automatically split it into sentences.
                        </p>
                        <textarea
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            placeholder="ᏙᎯᏧ ᎠᏂᏴᏫᏯ..."
                            className="w-full h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-lg font-serif text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
                            autoFocus
                        />
                        <button
                            onClick={handleSmartSplit}
                            disabled={!rawText.trim()}
                            className="w-full mt-4 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Scissors size={18} />
                            Split into Sentences
                        </button>
                    </div>
                )}

                {/* Step 2: Split/Merge */}
                {step === 'split' && (
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Review Sentences
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Click a sentence to split it at the cursor. Use the merge button to combine with the next sentence.
                        </p>
                        <div className="space-y-3">
                            {proposedSentences.map((sentence, idx) => (
                                <div
                                    key={sentence.id}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 group"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <div className="flex-1">
                                            <SplittableText
                                                text={sentence.text}
                                                onSplit={(pos) => handleSplit(sentence.id, pos)}
                                            />
                                        </div>
                                        {idx < proposedSentences.length - 1 && (
                                            <button
                                                onClick={() => handleMerge(sentence.id)}
                                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                title="Merge with next"
                                            >
                                                <MergeIcon size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setStep('paste')}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={() => setStep('metadata')}
                                className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                            >
                                Continue
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Metadata */}
                {step === 'metadata' && (
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Story Details
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Give your story a name. This will appear in your Reader library.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Story Name *
                                </label>
                                <input
                                    type="text"
                                    value={storyName}
                                    onChange={e => setStoryName(e.target.value)}
                                    placeholder="My Cherokee Story"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                    Chapter Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={chapterName}
                                    onChange={e => setChapterName(e.target.value)}
                                    placeholder="Chapter 1"
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {!preselectedDictionaryId && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                            Save to Custom Dictionary
                                        </label>
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowDictionaryDropdown(!showDictionaryDropdown)}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-left text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center justify-between"
                                            >
                                                <span>
                                                    {selectedDictionary === '__new__'
                                                        ? 'Create New Custom Dictionary'
                                                        : selectedDictionary
                                                            ? customDictionaries[selectedDictionary]?.name
                                                            : 'Create New Custom Dictionary'
                                                    }
                                                </span>
                                                <ChevronDown size={16} className="text-slate-400" />
                                            </button>
                                            {showDictionaryDropdown && (
                                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden">
                                                    <button
                                                        onClick={() => { setSelectedDictionary('__new__'); setShowDictionaryDropdown(false); }}
                                                        className="w-full px-4 py-3 text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 font-medium border-b border-slate-100 dark:border-slate-800"
                                                    >
                                                        + Create New Custom Dictionary
                                                    </button>
                                                    {dictionaryArray.map(nb => (
                                                        <button
                                                            key={nb.id}
                                                            onClick={() => { setSelectedDictionary(nb.id); setShowDictionaryDropdown(false); }}
                                                            className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
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
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                                New Custom Dictionary Name
                                            </label>
                                            <input
                                                type="text"
                                                value={newDictionaryName}
                                                onChange={e => setNewDictionaryName(e.target.value)}
                                                placeholder="My Cherokee Dictionary"
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setStep('split')}
                                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!storyName.trim()}
                                className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Check size={18} />
                                Create Story
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Done */}
                {step === 'done' && (
                    <div className="flex flex-col items-center justify-center h-64">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                            <Check size={32} className="text-green-500" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                            Story Created!
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {proposedSentences.length} sentences added
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// Splittable Text Component - allows clicking to split
const SplittableText: React.FC<{
    text: string;
    onSplit: (position: number) => void;
}> = ({ text, onSplit }) => {
    const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range && range.startOffset > 0 && range.startOffset < text.length) {
            onSplit(range.startOffset);
        }
    };

    return (
        <span
            onClick={handleClick}
            className="font-serif text-lg text-slate-900 dark:text-slate-100 cursor-text select-none"
            title="Click to split at cursor"
        >
            {text}
        </span>
    );
};
