import React, { useState, useRef, useEffect } from 'react';
import { Gloss, DictionaryEntry } from './CorpusContext';
import { SourceBadge } from './UI';
import { ChevronRight, Trash2, Pencil, Plus } from './Icons';

interface GlossPopoverProps {
    glosses: Gloss[];
    targetWord?: { syllabary: string, translit: string };
    dictionaryMap: Map<string, DictionaryEntry>;
    position: { x: number, y: number };
    onClose: () => void;
    onEntryClick: (id: string) => void;
    onEdit?: (gloss: Gloss) => void;
    onDelete?: (gloss: Gloss) => void;
    onAdd?: () => void;
    personalWords?: any[];
}

import { usePackageManager } from './PackageManagerContext';

export const GlossPopover: React.FC<GlossPopoverProps> = ({ glosses, targetWord, dictionaryMap, position, onClose, onEntryClick, onEdit, onDelete, onAdd, personalWords }) => {
    const { getPackageColor } = usePackageManager();
    const popoverRef = useRef<HTMLDivElement>(null);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [showActionsFor, setShowActionsFor] = useState<string | null>(null); // gloss entry_id

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const handleTouchStart = (glossId: string) => {
        const timer = setTimeout(() => {
            setShowActionsFor(glossId);
        }, 800); // 800ms long press
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) clearTimeout(longPressTimer);
    };

    return (
        <div
            ref={popoverRef}
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-80 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            style={{ top: position.y + 8, left: Math.min(position.x, window.innerWidth - 330) }}
        >
            {/* Header with Target Word */}
            {targetWord && (
                <div className="bg-slate-50 dark:bg-slate-950/50 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 backdrop-blur-sm">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Glossing</div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-serif font-bold text-slate-900 dark:text-slate-100">{targetWord.syllabary}</span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{targetWord.translit}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {glosses.map((gloss, i) => {
                    let entry = dictionaryMap.get(gloss.entry_id);
                    if (!entry && personalWords) {
                        const pw = personalWords.find(w => w.Index === gloss.entry_id || w.id === gloss.entry_id);
                        if (pw) entry = { ...pw, id: pw.Index };
                    }
                    const isUser = gloss.source === 'user';
                    const pkgColor = getPackageColor(gloss.source);

                    // IGT Segments
                    let igtSegments: { c: string, e: string }[] = [];
                    if (gloss.breakdown_cherokee || gloss.breakdown_english) {
                        const cParts = (gloss.breakdown_cherokee || '').split('-').map(s => s.trim());
                        const eParts = (gloss.breakdown_english || '').split('-').map(s => s.trim());
                        const max = Math.max(cParts.length, eParts.length);
                        for (let k = 0; k < max; k++) {
                            igtSegments.push({ c: cParts[k] || '', e: eParts[k] || '' });
                        }
                    }

                    return (
                        <div
                            key={i}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative group"
                            onTouchStart={() => isUser && handleTouchStart(gloss.entry_id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => isUser && handleTouchStart(gloss.entry_id)}
                            onMouseUp={handleTouchEnd}
                            onMouseLeave={handleTouchEnd}
                        >
                            {/* Actions Overlay (Long Press) */}
                            {showActionsFor === gloss.entry_id && (
                                <div className="absolute inset-0 bg-white/95 dark:bg-slate-900/95 z-10 flex items-center justify-center gap-4 animate-in fade-in">
                                    <button onClick={() => { onEdit?.(gloss); setShowActionsFor(null); }} className="flex flex-col items-center gap-1 text-amber-600 hover:scale-110 transition-transform">
                                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full"><Pencil size={20} /></div>
                                        <span className="text-xs font-bold">Edit</span>
                                    </button>
                                    <button onClick={() => { onDelete?.(gloss); setShowActionsFor(null); }} className="flex flex-col items-center gap-1 text-red-600 hover:scale-110 transition-transform">
                                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full"><Trash2 size={20} /></div>
                                        <span className="text-xs font-bold">Delete</span>
                                    </button>
                                    <button onClick={() => setShowActionsFor(null)} className="absolute top-2 right-2 text-slate-400"><ChevronRight size={16} className="rotate-90" /></button>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-2">
                                <SourceBadge source={gloss.source} name={gloss.source} customColor={pkgColor} />
                                <div className="flex items-center gap-3">
                                    {isUser && onEdit && (
                                        <button onClick={() => onEdit(gloss)} className="text-slate-400 hover:text-amber-600 transition-colors">
                                            <Pencil size={14} />
                                        </button>
                                    )}
                                    {entry && (
                                        <button onClick={() => onEntryClick(entry.id)} className="text-amber-600 hover:text-amber-700 flex items-center gap-1 text-xs font-bold uppercase tracking-wide">
                                            View Entry <ChevronRight size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {entry ? (
                                <div className="mb-3">
                                    <div className="font-serif font-bold text-lg text-slate-900 dark:text-slate-100 mb-0.5">{entry.syllabary || entry.Syllabary}</div>
                                    <div className="text-base font-medium text-amber-800 dark:text-amber-500 mb-1">{entry.translit || entry.Entry}</div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{entry.definition || entry.Definition}</div>
                                </div>
                            ) : (
                                <div className="text-sm text-slate-400 italic mb-3">Linked entry not found in dictionary.</div>
                            )}

                            {/* IGT Display */}
                            {igtSegments.length > 0 && (
                                <div className="mb-3 overflow-x-auto pb-2">
                                    <div className="flex gap-3 min-w-max border-t border-slate-100 dark:border-slate-800 pt-3">
                                        {igtSegments.map((seg, k) => (
                                            <div key={k} className="flex flex-col items-center">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-700 pb-0.5 mb-0.5">{seg.c}</span>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">{seg.e}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gloss.notes && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 p-2 rounded text-xs text-amber-900 dark:text-amber-100/80 italic border border-amber-100 dark:border-amber-900/20">
                                    {gloss.notes}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Add New Button */}
            {onAdd && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
                    <button
                        onClick={onAdd}
                        className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-200 dark:hover:border-amber-900 transition-colors flex items-center justify-center gap-2"
                    >
                        <Plus size={16} /> Add New Gloss
                    </button>
                </div>
            )}
        </div>
    );
};
