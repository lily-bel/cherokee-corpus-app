import React, { useState, useMemo } from 'react';
import { useCorpus, DictionaryEntry } from './CorpusContext';
import { useReader, InvestigationItem } from './ReaderContext';
import { LinkerModal } from './LinkerModal';
import { ArrowLeft, Trash2, Search as SearchIcon, Clock, ChevronRight } from './Icons';

interface InvestigationQueueProps {
    onBack: () => void;
    onNavigateToReader?: (sentenceId: string) => void;
    notebooks?: Record<string, any>;
}

export const InvestigationQueue: React.FC<InvestigationQueueProps> = ({
    onBack,
    onNavigateToReader,
    notebooks
}) => {
    const { sentenceMap, glossMap, dictionaryMap, addUserGloss, personalWords } = useCorpus();
    const { investigationQueue, removeFromInvestigationQueue } = useReader();

    const [showLinker, setShowLinker] = useState<{
        item: InvestigationItem;
        sentenceId: string;
        wordIndex: number;
        initialQuery: string;
        targetWord: { syllabary: string; translit: string };
    } | null>(null);

    // Sort by date added (newest first)
    const sortedQueue = useMemo(() => {
        return [...investigationQueue].sort((a, b) => b.date_added - a.date_added);
    }, [investigationQueue]);

    // Tokenize sentence into words
    const tokenizeSentence = (syllabary: string, translit: string) => {
        const syl = syllabary ? syllabary.split(' ') : [];
        const tr = translit ? translit.split(' ') : [];
        const max = Math.max(syl.length, tr.length);
        const tokens: { syl: string; tr: string; index: number }[] = [];
        for (let i = 0; i < max; i++) {
            tokens.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
        }
        return tokens;
    };

    const handleItemClick = (item: InvestigationItem) => {
        const sentence = sentenceMap.get(item.sentence_id);
        if (!sentence) return;

        const tokens = tokenizeSentence(sentence.syllabary, sentence.translit);
        const token = tokens[item.word_index];
        if (!token) return;

        setShowLinker({
            item,
            sentenceId: item.sentence_id,
            wordIndex: item.word_index,
            initialQuery: (token.syl || token.tr || '').replace(/[.,!?;:"()]/g, '').trim(),
            targetWord: { syllabary: token.syl, translit: token.tr }
        });
    };

    const handleGlossCreated = (entry: DictionaryEntry, notes: string, breakdownCherokee: string, breakdownEnglish: string) => {
        if (!showLinker) return;

        // Create the gloss
        addUserGloss({
            sentence_id: showLinker.sentenceId,
            word_index: showLinker.wordIndex.toString(),
            entry_id: entry.id || (entry as any).Index,
            notes,
            breakdown_cherokee: breakdownCherokee,
            breakdown_english: breakdownEnglish,
            source: 'user'
        });

        // Remove from investigation queue
        removeFromInvestigationQueue(showLinker.item.id);
        setShowLinker(null);
    };

    const handleDelete = (e: React.MouseEvent, item: InvestigationItem) => {
        e.stopPropagation();
        if (window.confirm('Remove this word from the investigation queue?')) {
            removeFromInvestigationQueue(item.id);
        }
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

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
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                            Investigation Queue
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {investigationQueue.length} word{investigationQueue.length !== 1 ? 's' : ''} to investigate
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {sortedQueue.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                        <SearchIcon size={48} className="mb-4 opacity-30" />
                        <p className="text-center">No words in your investigation queue.</p>
                        <p className="text-center text-sm mt-1">
                            Tap unknown words while reading to add them here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedQueue.map(item => {
                            const sentence = sentenceMap.get(item.sentence_id);
                            if (!sentence) return null;

                            const tokens = tokenizeSentence(sentence.syllabary, sentence.translit);

                            return (
                                <div
                                    key={item.id}
                                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition-colors"
                                    onClick={() => handleItemClick(item)}
                                >
                                    {/* Date & Actions */}
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Clock size={12} />
                                            {formatDate(item.date_added)}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {onNavigateToReader && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onNavigateToReader(item.sentence_id);
                                                    }}
                                                    className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                                                >
                                                    Read in Context
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleDelete(e, item)}
                                                className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Spotlight Sentence */}
                                    <div className="flex flex-wrap gap-x-3 gap-y-2 mb-2">
                                        {tokens.map((token, i) => {
                                            const isTarget = i === item.word_index;
                                            const glosses = glossMap.get(sentence.id) || [];
                                            const hasGloss = glosses.some(g =>
                                                g.word_index.split(',').map(Number).includes(i)
                                            );

                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex flex-col items-center transition-opacity ${isTarget ? 'opacity-100' : 'opacity-30'
                                                        }`}
                                                >
                                                    <span className={`font-serif text-lg ${isTarget
                                                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                                                            : 'text-slate-700 dark:text-slate-300'
                                                        }`}>
                                                        {token.syl}
                                                    </span>
                                                    <span className={`text-sm ${isTarget
                                                            ? 'text-amber-600 dark:text-amber-400 font-medium'
                                                            : 'text-slate-500 dark:text-slate-500'
                                                        }`}>
                                                        {token.tr}
                                                    </span>
                                                    {hasGloss && !isTarget && (
                                                        <div className="w-full h-0.5 bg-slate-300 dark:bg-slate-600 rounded-full mt-0.5" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* English */}
                                    <div className="text-sm text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                                        {sentence.english}
                                    </div>

                                    {/* Notes */}
                                    {item.notes && (
                                        <div className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mt-2">
                                            {item.notes}
                                        </div>
                                    )}

                                    {/* Click hint */}
                                    <div className="flex items-center justify-end mt-2 text-xs text-slate-400">
                                        <span>Tap to link</span>
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Linker Modal */}
            {showLinker && (
                <LinkerModal
                    initialQuery={showLinker.initialQuery}
                    targetWord={showLinker.targetWord}
                    dictionary={Array.from(dictionaryMap.values())}
                    personalWords={personalWords}
                    notebooks={notebooks}
                    onSelect={handleGlossCreated}
                    onClose={() => setShowLinker(null)}
                />
            )}
        </div>
    );
};
