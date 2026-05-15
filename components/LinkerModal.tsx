import React, { useState, useMemo } from 'react';
import { DictionaryEntry, useCorpus } from './CorpusContext';
import { Search, Check, Trash2 } from './Icons';
import { Modal, SourceBadge } from './UI';
import { performSearch } from '../utils';
import { usePackageManager } from './PackageManagerContext';

interface LinkerModalProps {
    initialQuery: string;
    targetWord?: { syllabary: string, translit: string } | { syllabary: string, translit: string }[];
    initialData?: { entry: DictionaryEntry, notes: string, breakdownCherokee: string, breakdownEnglish: string };
    dictionary: DictionaryEntry[];
    personalWords?: DictionaryEntry[];
    onSelect: (entry: DictionaryEntry, notes: string, breakdownCherokee: string, breakdownEnglish: string) => void;
    onDelete?: () => void;
    onClose: () => void;
    onCreateNew?: () => void;
    customDictionaries?: Record<string, any>;
}

export const LinkerModal: React.FC<LinkerModalProps> = ({ initialQuery, targetWord, initialData, dictionary, personalWords, onSelect, onDelete, onClose, onCreateNew, customDictionaries }) => {
    const [step, setStep] = useState<'search' | 'form'>(initialData ? 'form' : 'search');
    const [query, setQuery] = useState(initialQuery);
    const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(initialData?.entry || null);

    // Form State
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [breakdownCherokee, setBreakdownCherokee] = useState(initialData?.breakdownCherokee || '');
    const [breakdownEnglish, setBreakdownEnglish] = useState(initialData?.breakdownEnglish || '');

    const { sentences, entryToSentencesMap, rootMap } = useCorpus();

    const results = useMemo(() => {
        if (!query) return [];
        const settings = {
            searchLangs: { syllabary: true, translit: true, english: true, tone: false },
            searchScopes: { main: true, otherForms: true, sentences: false, notes: false, roots: false },
            showRootHeaders: false,
            enableRegex: false
        };
        const mappedPersonal = personalWords ? personalWords.map(w => ({ ...w, id: w.Index, Source: (w as any).customDictionaryId })) : [];
        const searchDict = [...dictionary, ...mappedPersonal];
        // Note: LinkerModal doesn't currently need the full wordFormsLookupMap for its simple search, passing empty Map as placeholder to satisfy signature
        return performSearch(query, searchDict, sentences, entryToSentencesMap, settings, customDictionaries || {}, {}, "All", 'dictionary', [], rootMap, new Map()).slice(0, 20);
    }, [query, dictionary, personalWords, sentences, entryToSentencesMap, customDictionaries, rootMap]);

    const handleEntrySelect = (entry: DictionaryEntry) => {
        setSelectedEntry(entry);
        setStep('form');
    };

    const handleSave = () => {
        if (selectedEntry) {
            onSelect(selectedEntry, notes, breakdownCherokee, breakdownEnglish);
        }
    };

    // IGT Alignment Logic
    const igtSegments = useMemo(() => {
        if (!breakdownCherokee && !breakdownEnglish) return [];
        const cherokeeParts = breakdownCherokee.split('-').map(s => s.trim());
        const englishParts = breakdownEnglish.split('-').map(s => s.trim());
        const max = Math.max(cherokeeParts.length, englishParts.length);
        const segments: { c: string, e: string }[] = [];
        for (let i = 0; i < max; i++) {
            segments.push({
                c: cherokeeParts[i] || '',
                e: englishParts[i] || ''
            });
        }
        return segments;
    }, [breakdownCherokee, breakdownEnglish]);

    return (
        <Modal title={step === 'search' ? "Link to Dictionary" : "Add Gloss Details"} onClose={onClose}>
            {targetWord && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30 mb-4 flex items-center justify-between">
                    <div>
                        <div className="text-xs font-bold text-amber-800/60 dark:text-amber-200/60 uppercase tracking-widest mb-1">
                            {Array.isArray(targetWord) ? "Glossing Words" : "Glossing Word"}
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            {Array.isArray(targetWord) ? (
                                targetWord.map((w, i) => (
                                    <span key={i} className="flex items-baseline gap-1">
                                        <span className="font-serif font-bold text-slate-900 dark:text-slate-100">{w.syllabary}</span>
                                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{w.translit}</span>
                                        {i < targetWord.length - 1 && <span className="text-slate-300">/</span>}
                                    </span>
                                ))
                            ) : (
                                <>
                                    <span className="font-serif font-bold text-slate-900 dark:text-slate-100">{targetWord.syllabary}</span>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{targetWord.translit}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {step === 'search' ? (
                <div className="flex flex-col gap-4 h-[60vh]">
                    <div className="relative shrink-0">
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

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mr-2 pr-2">
                        {results.map((entry: any, idx) => (
                            <button
                                key={idx}
                                className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-1 group"
                                onClick={() => handleEntrySelect(entry)}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-serif font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 transition-colors">{entry.syllabary || entry.Syllabary}</span>
                                    <SourceBadge source={entry.source || entry.Source} name={entry.source} />
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.translit || entry.Entry}</span>
                                <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{entry.definition || entry.Definition}</span>
                            </button>
                        ))}
                        {results.length === 0 && (
                            <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center">
                                <Search size={32} className="mb-3 opacity-20" />
                                <p>No matches found</p>
                            </div>
                        )}
                    </div>
                    {/* Create New Button */}
                    {onCreateNew && (
                        <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={onCreateNew}
                                className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="text-xl">+</span> Create New Word
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {/* Selected Entry Preview */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-start">
                        <div>
                            <div className="font-serif font-bold text-slate-900 dark:text-slate-100">{selectedEntry?.syllabary || selectedEntry?.Syllabary}</div>
                            <div className="text-sm font-medium text-amber-700 dark:text-amber-500">{selectedEntry?.translit || selectedEntry?.Entry}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">{selectedEntry?.definition || selectedEntry?.Definition}</div>
                        </div>
                        <button onClick={() => setStep('search')} className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase hover:underline">Change</button>
                    </div>

                    {/* Breakdown Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">ᏣᎳᎩ Breakdown</label>
                            <input
                                type="text"
                                value={breakdownCherokee}
                                onChange={e => setBreakdownCherokee(e.target.value)}
                                placeholder="wahga-gwu"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">English Breakdown</label>
                            <input
                                type="text"
                                value={breakdownEnglish}
                                onChange={e => setBreakdownEnglish(e.target.value)}
                                placeholder="cow-just"
                                className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                            />
                        </div>
                    </div>

                    {/* IGT Preview */}
                    {(breakdownCherokee || breakdownEnglish) && (
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                            <div className="flex gap-4 min-w-max">
                                {igtSegments.map((seg, i) => (
                                    <div key={i} className="flex flex-col items-center">
                                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm border-b border-slate-300 dark:border-slate-700 pb-0.5 mb-0.5">{seg.c || '?'}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 italic">{seg.e || '?'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-2 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                            placeholder="Add any morphological notes..."
                        />
                    </div>

                    <div className="flex gap-2 mt-2">
                        {onDelete && (
                            <button onClick={onDelete} className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold p-3 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                <Trash2 size={20} />
                            </button>
                        )}
                        <button onClick={handleSave} className="flex-1 bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-colors flex items-center justify-center gap-2">
                            <Check size={20} /> Save Gloss
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
