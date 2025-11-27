import React, { useState, useMemo } from 'react';
import { DictionaryEntry } from './CorpusContext';
import { Search, X } from './Icons';
import { Modal } from './UI';

interface LinkerModalProps {
    initialQuery: string;
    dictionary: DictionaryEntry[];
    onSelect: (entry: DictionaryEntry) => void;
    onClose: () => void;
}

export const LinkerModal: React.FC<LinkerModalProps> = ({ initialQuery, dictionary, onSelect, onClose }) => {
    const [query, setQuery] = useState(initialQuery);

    const results = useMemo(() => {
        if (!query) return [];
        const lower = query.toLowerCase();
        // Simple search logic
        return dictionary.filter(d => {
            const syl = (d.syllabary || d.Syllabary || '').toLowerCase();
            const tr = (d.translit || d.Entry || '').toLowerCase();
            const def = (d.definition || d.Definition || '').toLowerCase();
            return syl.includes(lower) || tr.includes(lower) || def.includes(lower);
        }).slice(0, 20); // Limit results
    }, [query, dictionary]);

    return (
        <Modal title="Link to Dictionary" onClose={onClose}>
            <div className="flex flex-col gap-4">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                    <input
                        type="text"
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Search dictionary..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {results.map((entry, idx) => (
                        <button
                            key={idx}
                            className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-1"
                            onClick={() => onSelect(entry)}
                        >
                            <div className="flex justify-between items-center">
                                <span className="font-serif font-bold text-slate-900 dark:text-slate-100">{entry.syllabary || entry.Syllabary}</span>
                                <span className="text-xs text-slate-400 uppercase">{entry.source || entry.Source}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.translit || entry.Entry}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{entry.definition || entry.Definition}</span>
                        </button>
                    ))}
                    {results.length === 0 && (
                        <div className="text-center py-8 text-slate-400 text-sm">No matches found</div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
