import React, { useState, useMemo } from 'react';
import { DictionaryEntry, useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';
import { Search, Check, Trash2 } from './Icons';
import { Modal, SourceBadge } from './UI';
import { performSearch, buildWordFormsLookupMap, getAllFormsForEntry } from '../utils';

interface LinkerModalProps {
    initialQuery: string;
    targetWord?: { syllabary: string, translit: string } | { syllabary: string, translit: string }[];
    initialData?: {
        entry: DictionaryEntry;
        notes: string;
        breakdownCherokee: string;
        breakdownEnglish: string;
        formName?: string;
        formSyllabary?: string;
        formTranslit?: string;
    };
    dictionary: DictionaryEntry[];
    personalWords?: DictionaryEntry[];
    onSelect: (
        entry: DictionaryEntry,
        notes: string,
        breakdownCherokee: string,
        breakdownEnglish: string,
        formInfo?: { form_name?: string; form_syllabary?: string; form_translit?: string }
    ) => void;
    onDelete?: () => void;
    onClose: () => void;
    onCreateNew?: () => void;
    customDictionaries?: Record<string, any>;
}

export const LinkerModal: React.FC<LinkerModalProps> = ({ initialQuery, targetWord, initialData, dictionary, personalWords, onSelect, onDelete, onClose, onCreateNew, customDictionaries }) => {
    const [step, setStep] = useState<'search' | 'form'>(initialData ? 'form' : 'search');
    const [query, setQuery] = useState(initialQuery);
    const [selectedEntry, setSelectedEntry] = useState<DictionaryEntry | null>(initialData?.entry || null);
    const [selectedForm, setSelectedForm] = useState<{ form_name?: string; form_syllabary?: string; form_translit?: string } | null>(
        initialData?.formSyllabary || initialData?.formTranslit || initialData?.formName
            ? {
                form_name: initialData.formName,
                form_syllabary: initialData.formSyllabary,
                form_translit: initialData.formTranslit
            }
            : null
    );

    // Form State
    const [notes, setNotes] = useState(initialData?.notes || '');
    const [breakdownCherokee, setBreakdownCherokee] = useState(initialData?.breakdownCherokee || '');
    const [breakdownEnglish, setBreakdownEnglish] = useState(initialData?.breakdownEnglish || '');

    const { sentences, entryToSentencesMap, rootMap, userWordForms } = useCorpus();
    const { packages, importedData, getPackageColor } = usePackageManager();

    const wordFormsLookupMap = useMemo(() => {
        return buildWordFormsLookupMap(importedData, userWordForms);
    }, [importedData, userWordForms]);

    const results = useMemo(() => {
        if (!query) return [];
        const settings = {
            searchLangs: { syllabary: true, translit: true, english: true, tone: false },
            searchScopes: { main: true, otherForms: true, sentences: false, notes: false, roots: true },
            showRootHeaders: true,
            enableRegex: false
        };
        const mappedPersonal = personalWords ? personalWords.map(w => ({ ...w, id: w.Index, Source: (w as any).customDictionaryId })) : [];
        const searchDict = [...dictionary, ...mappedPersonal];
        return performSearch(query, searchDict, sentences, entryToSentencesMap, settings, customDictionaries || {}, {}, "All", 'dictionary', [], rootMap, wordFormsLookupMap).slice(0, 30);
    }, [query, dictionary, personalWords, sentences, entryToSentencesMap, customDictionaries, rootMap, wordFormsLookupMap]);

    const availableForms = useMemo(() => {
        if (!selectedEntry) return [];
        return getAllFormsForEntry(selectedEntry, wordFormsLookupMap, userWordForms, packages, importedData);
    }, [selectedEntry, wordFormsLookupMap, userWordForms, packages, importedData]);

    const handleEntrySelect = (entry: any) => {
        setSelectedEntry(entry);
        const forms = getAllFormsForEntry(entry, wordFormsLookupMap, userWordForms, packages, importedData);
        if (entry.matchedForm) {
            const matched = forms.find(f => 
                (entry.matchedForm.syllabary && f.syllabary === entry.matchedForm.syllabary) ||
                (entry.matchedForm.translit && f.translit === entry.matchedForm.translit)
            );
            if (matched) {
                setSelectedForm({
                    form_name: matched.label || '',
                    form_syllabary: matched.syllabary || '',
                    form_translit: matched.translit || ''
                });
            } else {
                setSelectedForm({
                    form_name: entry.matchedForm.label || '',
                    form_syllabary: entry.matchedForm.syllabary || '',
                    form_translit: entry.matchedForm.translit || ''
                });
            }
        } else {
            const primaryForm = forms[0];
            if (primaryForm) {
                setSelectedForm({
                    form_name: primaryForm.label || 'Base Form',
                    form_syllabary: primaryForm.syllabary || '',
                    form_translit: primaryForm.translit || ''
                });
            } else {
                setSelectedForm({
                    form_name: 'Base Form',
                    form_syllabary: entry.syllabary || entry.Syllabary || '',
                    form_translit: entry.translit || entry.Entry || ''
                });
            }
        }
        setStep('form');
    };

    const handleSave = () => {
        if (selectedEntry) {
            const formToSave = selectedForm || (availableForms[0] ? {
                form_name: availableForms[0].label,
                form_syllabary: availableForms[0].syllabary,
                form_translit: availableForms[0].translit
            } : undefined);

            onSelect(
                selectedEntry,
                notes,
                breakdownCherokee,
                breakdownEnglish,
                formToSave || undefined
            );
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
                            placeholder="Search dictionary or word forms..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mr-2 pr-2">
                        {results.map((entry: any, index: number, array: any[]) => {
                            const rootEntry = (entry.Index || entry.id) ? rootMap?.get(entry.Index || entry.id) : null;
                            
                            let showRootHeader = false;
                            if (rootEntry) {
                                const prevItem = index > 0 ? array[index - 1] : null;
                                const prevEntryId = prevItem ? (prevItem.Index || prevItem.id) : null;
                                const prevRootEntry = prevEntryId ? rootMap?.get(prevEntryId) : null;
                                if (!prevRootEntry || prevRootEntry.root_slug !== rootEntry.root_slug) {
                                    showRootHeader = true;
                                }
                            }

                            const srcColor = getPackageColor(entry.source || entry.Source);

                            return (
                                <React.Fragment key={entry.Index || entry.id || index}>
                                    {showRootHeader && rootEntry && (
                                        <div className="flex items-center gap-2.5 px-3 py-1.5 mt-3 mb-1 bg-amber-50/50 dark:bg-amber-950/30 rounded-lg">
                                            <div className="w-1.5 h-4 bg-amber-500 dark:bg-amber-400 rounded-full shrink-0" />
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">Root:</span>
                                                <span className="text-xs font-bold font-noto-cherokee text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-800/40">
                                                    -{rootEntry.root_h || rootEntry.root_g}-
                                                </span>
                                                {rootEntry.definition && <span className="text-xs text-slate-500 dark:text-slate-400 italic">({rootEntry.definition})</span>}
                                            </div>
                                        </div>
                                    )}
                                    <div className={rootEntry ? "ml-3 pl-2 border-l-2 border-amber-500/20 dark:border-amber-400/20" : ""}>
                                        <button
                                            className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors flex flex-col gap-1 group"
                                            onClick={() => handleEntrySelect(entry)}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-serif font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 transition-colors">{entry.syllabary || entry.Syllabary}</span>
                                                <SourceBadge source={entry.source || entry.Source} name={customDictionaries?.[entry.source || entry.Source]?.name || entry.source} customColor={srcColor} />
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.translit || entry.Entry}</span>
                                            {entry.matchedForm && (
                                                <div className="text-xs text-amber-600 dark:text-amber-400 italic font-medium flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                                                    <span className="text-slate-400 dark:text-slate-500 not-italic">matched form:</span>
                                                    {entry.matchedForm.syllabary && (
                                                        <span className="font-serif font-semibold">{entry.matchedForm.syllabary}</span>
                                                    )}
                                                    {entry.matchedForm.translit && (
                                                        <span className="font-sans">{entry.matchedForm.translit}</span>
                                                    )}
                                                    {entry.matchedForm.label && (
                                                        <span className="text-slate-400 not-italic">({entry.matchedForm.label})</span>
                                                    )}
                                                </div>
                                            )}
                                            <span className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{entry.definition || entry.Definition}</span>
                                        </button>
                                    </div>
                                </React.Fragment>
                            );
                        })}
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

                    {/* Form Selection */}
                    {availableForms.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                Word Form
                            </label>
                            <select
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                                value={selectedForm ? `${selectedForm.form_name || ''}|${selectedForm.form_syllabary || ''}|${selectedForm.form_translit || ''}` : `${availableForms[0]?.label || ''}|${availableForms[0]?.syllabary || ''}|${availableForms[0]?.translit || ''}`}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const [fName, fSyl, fTr] = val.split('|');
                                    setSelectedForm({
                                        form_name: fName,
                                        form_syllabary: fSyl,
                                        form_translit: fTr
                                    });
                                }}
                            >
                                {availableForms.map((f, i) => (
                                    <option key={i} value={`${f.label}|${f.syllabary}|${f.translit}`}>
                                        {f.label ? `${f.label}: ` : ''}{f.syllabary} ({f.translit})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

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

