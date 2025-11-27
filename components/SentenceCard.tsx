import React, { useState, useMemo } from 'react';
import { Sentence, useCorpus } from './CorpusContext';
import { GlossPopover } from './GlossPopover';
import { LinkerModal } from './LinkerModal';
import { AudioPlayer } from './UI';
import { Check, Plus } from './Icons';

interface SentenceCardProps {
    sentence: Sentence;
}

export const SentenceCard: React.FC<SentenceCardProps> = ({ sentence }) => {
    const { glossMap, dictionaryMap, addUserGloss } = useCorpus();
    const [activePopover, setActivePopover] = useState<{ index: number, rect: { x: number, y: number } } | null>(null);
    const [showLinker, setShowLinker] = useState<{ indices: number[], initialQuery: string } | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    const glosses = glossMap.get(sentence.id) || [];

    const tokens = useMemo(() => {
        const syl = sentence.syllabary ? sentence.syllabary.split(' ') : [];
        const tr = sentence.translit ? sentence.translit.split(' ') : [];
        const max = Math.max(syl.length, tr.length);
        const res: { syl: string, tr: string, index: number }[] = [];
        for (let i = 0; i < max; i++) {
            res.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
        }
        return res;
    }, [sentence]);

    const getGlossStyle = (index: number) => {
        const wordGlosses = glosses.filter(g => {
            const indices = g.word_index.split(',').map(Number);
            return indices.includes(index);
        });

        if (wordGlosses.length === 0) return '';

        const hasUser = wordGlosses.some(g => g.source === 'user');

        // Conflict or Multiple
        if (wordGlosses.length > 1) {
            return 'underline decoration-wavy decoration-amber-400 decoration-2 underline-offset-4';
        }

        // Single User
        if (hasUser) {
            return 'border-b-2 border-amber-400';
        }

        // Single Built-in
        return 'border-b-2 border-slate-300 dark:border-slate-600';
    };

    const handleWordClick = (index: number, event: React.MouseEvent) => {
        if (selectMode) {
            setSelectedIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
            return;
        }

        const wordGlosses = glosses.filter(g => g.word_index.split(',').map(Number).includes(index));

        if (wordGlosses.length > 0) {
            // Open Popover
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            setActivePopover({ index, rect: { x: rect.left, y: rect.bottom } });
        } else {
            // Open Linker
            setShowLinker({ indices: [index], initialQuery: tokens[index]?.syl || '' });
        }
    };

    const handleLinkSelection = () => {
        if (selectedIndices.length === 0) return;
        const sorted = [...selectedIndices].sort((a, b) => a - b);
        // Construct query from first selected word
        const query = tokens[sorted[0]]?.syl || '';
        setShowLinker({ indices: sorted, initialQuery: query });
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-4">
            {/* Header / Controls */}
            <div className="flex justify-between items-start mb-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    {sentence.source || 'Corpus'} • {sentence.id}
                </div>
                <div className="flex gap-2">
                    {selectMode ? (
                        <>
                            <button
                                onClick={() => { setSelectMode(false); setSelectedIndices([]); }}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLinkSelection}
                                disabled={selectedIndices.length === 0}
                                className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${selectedIndices.length > 0 ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-slate-100 text-slate-400'}`}
                            >
                                <Plus size={12} /> Link ({selectedIndices.length})
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setSelectMode(true)}
                            className="text-xs font-bold text-slate-400 hover:text-amber-600 px-2 py-1 rounded hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        >
                            Select Mode
                        </button>
                    )}
                </div>
            </div>

            {/* Sentence Tokens */}
            <div className="flex flex-wrap gap-x-3 gap-y-6 mb-6">
                {tokens.map((token, i) => {
                    const isSelected = selectedIndices.includes(i);
                    return (
                        <div
                            key={i}
                            className={`flex flex-col items-center cursor-pointer group relative ${isSelected ? 'bg-amber-100 dark:bg-amber-900/40 rounded px-1 -mx-1' : ''}`}
                            onClick={(e) => handleWordClick(i, e)}
                        >
                            <span className={`font-serif text-xl text-slate-900 dark:text-slate-100 leading-none mb-1 ${getGlossStyle(i)}`}>
                                {token.syl}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {token.tr}
                            </span>
                            {/* Selection Checkmark */}
                            {isSelected && <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-0.5"><Check size={10} /></div>}
                        </div>
                    );
                })}
            </div>

            {/* English Translation */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                {sentence.english}
            </div>

            {/* Audio */}
            {sentence.audio && (
                <div className="mt-3">
                    <AudioPlayer src={`/audio/${sentence.audio}`} label="Play Sentence" />
                </div>
            )}

            {/* Modals/Popovers */}
            {activePopover && (
                <GlossPopover
                    glosses={glosses.filter(g => g.word_index.split(',').map(Number).includes(activePopover.index))}
                    dictionaryMap={dictionaryMap}
                    position={activePopover.rect}
                    onClose={() => setActivePopover(null)}
                    onEntryClick={(id) => {
                        // Navigate to entry (using window location for now or callback?)
                        const url = new URL(window.location.href);
                        url.searchParams.set('word', id);
                        window.history.pushState({}, '', url.toString());
                        // Trigger popstate to update App
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        setActivePopover(null);
                    }}
                />
            )}

            {showLinker && (
                <LinkerModal
                    initialQuery={showLinker.initialQuery}
                    dictionary={Array.from(dictionaryMap.values())}
                    onClose={() => setShowLinker(null)}
                    onSelect={(entry) => {
                        const gloss = {
                            sentence_id: sentence.id,
                            word_index: showLinker.indices.join(','),
                            entry_id: entry.id || entry.Index || '', // Handle legacy Index
                            source: 'user',
                            notes: ''
                        };
                        addUserGloss(gloss);
                        setShowLinker(null);
                        setSelectMode(false);
                        setSelectedIndices([]);
                    }}
                />
            )}
        </div>
    );
};
