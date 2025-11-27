import React, { useRef, useEffect } from 'react';
import { Gloss, DictionaryEntry } from './CorpusContext';
import { SourceBadge } from './UI';
import { Book, ArrowLeft } from './Icons';

interface GlossPopoverProps {
    glosses: Gloss[];
    dictionaryMap: Map<string, DictionaryEntry>;
    position: { x: number, y: number };
    onClose: () => void;
    onEntryClick: (entryId: string) => void;
}

export const GlossPopover: React.FC<GlossPopoverProps> = ({ glosses, dictionaryMap, position, onClose, onEntryClick }) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position to not overflow screen (basic logic)
    const style: React.CSSProperties = {
        top: position.y + 10,
        left: Math.min(position.x, window.innerWidth - 300), // Prevent right overflow
    };

    return (
        <div
            ref={ref}
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-72 max-h-80 overflow-y-auto animate-scale-in"
            style={style}
        >
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Glosses</h4>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {glosses.map((gloss, idx) => {
                    const entry = dictionaryMap.get(gloss.entry_id);
                    if (!entry) return null;

                    return (
                        <div
                            key={idx}
                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                            onClick={() => onEntryClick(gloss.entry_id)}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="font-serif text-lg text-slate-900 dark:text-slate-100 leading-none">
                                    {entry.syllabary || entry.Syllabary}
                                </div>
                                <SourceBadge source={gloss.source} name={gloss.source} />
                            </div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">
                                {entry.translit || entry.Entry}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-1">
                                {entry.definition || entry.Definition}
                            </div>
                            {gloss.notes && (
                                <div className="text-xs text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded mt-1">
                                    Note: {gloss.notes}
                                </div>
                            )}
                            <div className="mt-2 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Book size={12} /> View Entry
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
