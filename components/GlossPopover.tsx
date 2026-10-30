import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { Gloss, DictionaryEntry, useCorpus } from './CorpusContext';
import { SourceBadge } from './UI';
import { ChevronRight, Trash2, Pencil, Plus, Search } from './Icons';
import { usePackageManager } from './PackageManagerContext';
import { buildWordFormsLookupMap, getAllFormsForEntry, ColorizedCherokeeWord, stripTone } from '../utils';




interface GlossPopoverProps {
    glosses: Gloss[];
    targetWord?: { syllabary: string, translit: string };
    dictionaryMap: Map<string, DictionaryEntry>;
    position: { x: number, y: number, anchorTop?: number, anchorBottom?: number };
    onClose: () => void;
    onEntryClick: (id: string) => void;
    onEdit?: (gloss: Gloss) => void;
    onDelete?: (gloss: Gloss) => void;
    onAdd?: () => void;
    onAddToQueue?: () => void;  // Add to Investigation Queue
    onQuickGloss?: (entry: DictionaryEntry) => void;
    personalWords?: any[];
    customDictionaries?: any;
    sourceMap?: Record<string, string>;
    hideCustomization?: boolean;
    settings?: any;
}

export const GlossPopover: React.FC<GlossPopoverProps> = ({ glosses, targetWord, dictionaryMap, position, onClose, onEntryClick, onEdit, onDelete, onAdd, onAddToQueue, onQuickGloss, personalWords, customDictionaries, sourceMap, hideCustomization, settings }) => {
    const { getPackageColor, packages, importedData } = usePackageManager();
    const { userWordForms, rootMap, dictionary, personalWords: corpusPersonalWords } = useCorpus();

    const popoverRef = useRef<HTMLDivElement>(null);
    const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
    const [showActionsFor, setShowActionsFor] = useState<string | null>(null); // gloss entry_id
    const [expandedForms, setExpandedForms] = useState<Record<string, boolean>>({});

    const [coords, setCoords] = useState<{ top: number; left: number; maxHeight?: number }>({
        top: position.y + 8,
        left: Math.max(16, Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 336 : 0))
    });

    useLayoutEffect(() => {
        if (!popoverRef.current || typeof window === 'undefined') return;
        const rect = popoverRef.current.getBoundingClientRect();
        const popoverWidth = rect.width || 320;
        const popoverHeight = rect.height || 200;

        // 1. Horizontal clamping
        const left = Math.max(16, Math.min(position.x, window.innerWidth - popoverWidth - 16));

        // 2. Vertical positioning & clamping
        const anchorBottom = position.anchorBottom ?? position.y;
        const anchorTop = position.anchorTop ?? (position.y - 24);

        let top = anchorBottom + 8;
        let maxHeight = window.innerHeight - 32;

        if (top + popoverHeight > window.innerHeight - 16) {
            const topAbove = anchorTop - popoverHeight - 8;
            if (topAbove >= 16) {
                top = topAbove;
            } else {
                top = Math.max(16, window.innerHeight - popoverHeight - 16);
                maxHeight = Math.max(160, window.innerHeight - top - 16);
            }
        }

        setCoords({ top, left, maxHeight });
    }, [position, expandedForms]);

    const isColored = (() => {
        try {
            const s = localStorage.getItem('cherokee_app_settings');
            return s ? JSON.parse(s).colorWordSegments !== false : true;
        } catch {
            return true;
        }
    })();

    const allPersonalWords = personalWords || corpusPersonalWords || [];

    const wordFormsLookupMap = useMemo(() => {
        return buildWordFormsLookupMap(importedData, userWordForms);
    }, [importedData, userWordForms]);

    // Exact matches from CED and custom dictionaries for fast glossing on desktop
    const exactMatches = useMemo(() => {
        if (!targetWord) return [];
        const cleanSyl = (targetWord.syllabary || '').replace(/[.,!?;:"()—\-–]/g, '').trim();
        const cleanTr = stripTone(targetWord.translit || '').toLowerCase().replace(/[.,!?;:"()—\-–]/g, '').trim();
        if (!cleanSyl && !cleanTr) return [];

        const results: DictionaryEntry[] = [];
        const seenDefs = new Set<string>();
        const seenIds = new Set<string>();

        // Don't suggest entries that are already glossed on this word
        const alreadyGlossedIds = new Set(glosses.map(g => g.entry_id));

        const checkAndAdd = (entry: DictionaryEntry) => {
            const id = entry.id || (entry as any).Index;
            if (!id || seenIds.has(id)) return;
            if (alreadyGlossedIds.has(id)) return;

            const def = (entry.definition || entry.Definition || '').trim();
            if (!def) return;
            const normDef = def.toLowerCase();
            if (seenDefs.has(normDef)) return;

            const eSyl = (entry.syllabary || entry.Syllabary || '').replace(/[.,!?;:"()—\-–]/g, '').trim();
            const eTr = stripTone(entry.translit || entry.Entry || '').toLowerCase().replace(/[.,!?;:"()—\-–]/g, '').trim();

            const sylList = eSyl.split(',').map(s => s.trim());
            const trList = eTr.split(',').map(t => stripTone(t).toLowerCase().trim());

            const sylMatch = Boolean(cleanSyl && (eSyl === cleanSyl || sylList.includes(cleanSyl)));
            const trMatch = Boolean(cleanTr && (eTr === cleanTr || trList.includes(cleanTr)));

            if (sylMatch || trMatch) {
                seenIds.add(id);
                seenDefs.add(normDef);
                results.push({ ...entry, id });
            }
        };

        // 1. Check custom dicts / personal words first
        for (const pw of allPersonalWords) {
            checkAndAdd({ ...pw, id: pw.Index || pw.id });
        }

        // 2. Check CED or custom entries in dictionary
        for (const d of (dictionary || [])) {
            const src = (d.source || d.Source || '').toLowerCase();
            const isCed = src === 'ced' || src === 'official-cherokee-data';
            const isCustom = src === 'user' || src.startsWith('nb_') || Boolean((d as any).customDictionaryId) || (customDictionaries && Boolean(customDictionaries[src]));
            if (isCed || isCustom) {
                checkAndAdd(d);
            }
        }

        return results.slice(0, 4);
    }, [targetWord, dictionary, allPersonalWords, customDictionaries, glosses]);

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
            className="fixed z-50 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 w-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
            style={{
                top: coords.top,
                left: coords.left,
                maxHeight: coords.maxHeight ? `${coords.maxHeight}px` : '24rem'
            }}
        >
            {/* Header with Target Word */}
            {targetWord && (
                <div className="bg-white/95 dark:bg-slate-950/90 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 backdrop-blur-sm z-20">
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
                    const isUser = gloss.source === 'user' || (customDictionaries && customDictionaries[gloss.source]);
                    const pkgColor = getPackageColor(gloss.source) || (isUser ? '#fbbf24' : undefined);

                    // Resolve Source Name
                    const sourceName = customDictionaries?.[gloss.source]?.name || sourceMap?.[gloss.source] || gloss.source;

                    // Available word forms for this entry
                    const availableForms = entry ? getAllFormsForEntry(entry, wordFormsLookupMap, userWordForms, packages, importedData) : [];

                    // IGT Segments
                    let igtSegments: { c: string, e: string }[] = [];
                    if (gloss.breakdown_cherokee || gloss.breakdown_english) {
                        const cParts = (gloss.breakdown_cherokee || '').split('-').map(s => s.trim()).filter(Boolean);
                        const eRaw = (gloss.breakdown_english || '').trim();
                        let eParts: string[] = [];
                        if (eRaw.includes(' ')) {
                            eParts = eRaw.split(/\s+/).map(s => s.trim()).filter(Boolean);
                        } else if (eRaw.includes('-')) {
                            eParts = eRaw.split('-').map(s => s.trim()).filter(Boolean);
                        } else if (eRaw) {
                            eParts = [eRaw];
                        }
                        const max = Math.max(cParts.length, eParts.length);
                        for (let k = 0; k < max; k++) {
                            igtSegments.push({ c: cParts[k] || '', e: eParts[k] || '' });
                        }
                    }

                    const glossKey = gloss.id || `gloss_${i}`;

                    return (
                        <div
                            key={i}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative group"
                            onTouchStart={() => isUser && !hideCustomization && handleTouchStart(gloss.entry_id)}
                            onTouchEnd={handleTouchEnd}
                            onMouseDown={() => isUser && !hideCustomization && handleTouchStart(gloss.entry_id)}
                            onMouseUp={handleTouchEnd}
                            onMouseLeave={handleTouchEnd}
                        >
                            {/* Actions Overlay (Long Press) */}
                            {!hideCustomization && showActionsFor === gloss.entry_id && (
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
                                <SourceBadge source={gloss.source} name={sourceName} customColor={pkgColor} />
                                <div className="flex items-center gap-3">
                                    {isUser && !hideCustomization && onEdit && (
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

                            {entry ? (() => {
                                const entryId = entry.id || entry.Index || (entry as any).merged_id;
                                const rootEntry = entryId ? rootMap?.get(entryId) : null;

                                return (
                                    <div className="mb-3">
                                        <div className="font-serif font-bold text-lg text-slate-900 dark:text-slate-100 mb-0.5">{entry.syllabary || entry.Syllabary}</div>
                                        <div className="text-base font-bold text-amber-800 dark:text-amber-500 mb-1">
                                            <ColorizedCherokeeWord
                                                word={entry.translit || entry.Entry}
                                                entry={entry}
                                                rootEntry={rootEntry}
                                                isColored={isColored}
                                                settings={settings}
                                            />
                                        </div>
                                        {((gloss.form_syllabary && gloss.form_syllabary !== (entry.syllabary || entry.Syllabary)) ||
                                          (gloss.form_translit && gloss.form_translit !== (entry.translit || entry.Entry)) ||
                                          (gloss.form_name && gloss.form_name !== 'Base Form' && gloss.form_name !== 'Present 3sg')) && (
                                            <div className="text-xs text-amber-600 dark:text-amber-400 italic mb-1.5 font-medium flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                                                <span className="text-slate-400 dark:text-slate-500 not-italic">matched form:</span>
                                                {gloss.form_syllabary && (
                                                    <span className="font-noto-cherokee font-semibold">{gloss.form_syllabary}</span>
                                                )}
                                                {gloss.form_translit && (
                                                    <span className="font-serif font-bold">
                                                        <ColorizedCherokeeWord
                                                            word={gloss.form_translit}
                                                            form={{ normalized_key: gloss.form_name, form_name: gloss.form_name, translit: gloss.form_translit }}
                                                            formKey={gloss.form_name}
                                                            entry={entry}
                                                            rootEntry={rootEntry}
                                                            isColored={isColored}
                                                            settings={settings}
                                                        />
                                                    </span>
                                                )}
                                                {gloss.form_name && (
                                                    <span className="text-slate-400 not-italic">({gloss.form_name})</span>
                                                )}
                                            </div>
                                        )}
                                        <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{entry.definition || entry.Definition}</div>
                                    </div>
                                );
                            })() : (gloss.gloss_english || gloss.breakdown_cherokee || gloss.breakdown_english) ? (
                                <div className="mb-3">
                                    {gloss.gloss_syllabary && (
                                        <div className="font-serif font-bold text-lg text-slate-900 dark:text-slate-100 mb-0.5">{gloss.gloss_syllabary}</div>
                                    )}
                                    {gloss.gloss_phonetic && (
                                        <div className="text-base font-medium text-emerald-800 dark:text-emerald-400 mb-1">{gloss.gloss_phonetic}</div>
                                    )}
                                    {gloss.gloss_english && (
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 italic mb-1">
                                            "{gloss.gloss_english}"
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-slate-400 italic mb-3">Linked entry not found in dictionary.</div>
                            )}

                            {/* Expandable Other Forms / Inflections Accordion */}
                            {availableForms.length > 0 && (
                                <div className="mb-3 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedForms(prev => ({ ...prev, [glossKey]: !prev[glossKey] }))}
                                        className="flex items-center justify-between w-full text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors py-1"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <span>Other Forms / Inflections</span>
                                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                                                {availableForms.length}
                                            </span>
                                        </span>
                                        <ChevronRight size={14} className={`transition-transform duration-150 ${expandedForms[glossKey] ? 'rotate-90 text-amber-600 dark:text-amber-400' : ''}`} />
                                    </button>
                                    {expandedForms[glossKey] && (
                                        <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                            {availableForms.map((f, fIdx) => {
                                                const isCurrentMatched = 
                                                    (gloss.form_syllabary && gloss.form_syllabary === f.syllabary) ||
                                                    (gloss.form_translit && gloss.form_translit === f.translit) ||
                                                    (gloss.form_name && gloss.form_name === f.label);
                                                return (
                                                    <div
                                                        key={fIdx}
                                                        className={`p-1.5 rounded-lg text-xs flex justify-between items-baseline gap-2 ${
                                                            isCurrentMatched
                                                                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                                                                : 'bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-baseline gap-1.5 flex-wrap">
                                                            {f.label && <span className="font-bold text-[10px] uppercase text-slate-400 dark:text-slate-500">{f.label}:</span>}
                                                            <span className="font-serif font-bold text-slate-900 dark:text-slate-100">{f.syllabary}</span>
                                                            <span className="text-amber-700 dark:text-amber-400 italic">{f.translit}</span>
                                                        </div>
                                                        {isCurrentMatched && (
                                                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider shrink-0 bg-amber-100 dark:bg-amber-900/50 px-1 rounded">
                                                                Linked
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* IGT Display */}
                            {igtSegments.length > 0 && (
                                <div className="mb-3 overflow-x-auto pb-2">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Morpheme Breakdown</div>
                                    <div className="flex gap-1.5 min-w-max border-t border-slate-100 dark:border-slate-800 pt-2">
                                        {igtSegments.map((seg, k) => (
                                            <div key={k} className="flex flex-col items-center bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded border border-slate-200/60 dark:border-slate-800">
                                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs border-b border-slate-200 dark:border-slate-700 pb-0.5 mb-0.5">{seg.c}</span>
                                                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium italic">{seg.e}</span>
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
            {/* Add New Button & Quick Gloss Options */}
            {!hideCustomization && (onAdd || onAddToQueue || (onQuickGloss && exactMatches.length > 0)) && (
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 flex flex-col gap-2">
                    {onAdd && (
                        <button
                            onClick={onAdd}
                            className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:border-amber-200 dark:hover:border-amber-900 transition-colors flex items-center justify-center gap-2"
                        >
                            <Plus size={16} /> Add New Gloss
                        </button>
                    )}
                    {onAddToQueue && (
                        <button
                            onClick={onAddToQueue}
                            className="w-full py-2 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            <Search size={16} /> Add to Queue
                        </button>
                    )}

                    {/* Exact match search fast-glossing buttons (Desktop) */}
                    {onQuickGloss && exactMatches.length > 0 && (
                        <div className="hidden sm:flex flex-col gap-1.5 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                            {exactMatches.map((entry) => {
                                const def = (entry.definition || entry.Definition || '').trim();
                                const displayDef = def.length > 32 ? `${def.slice(0, 32)}…` : def;
                                const src = entry.source || entry.Source || 'ced';
                                const srcName = customDictionaries?.[src]?.name || sourceMap?.[src] || src;
                                const srcColor = getPackageColor(src);

                                return (
                                    <button
                                        key={entry.id || (entry as any).Index}
                                        type="button"
                                        onClick={() => onQuickGloss(entry)}
                                        className="group relative w-full py-2 px-3 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-gradient-to-r from-amber-500/15 via-white to-amber-500/15 dark:via-slate-800/80 hover:from-amber-500/25 hover:via-amber-50/50 hover:to-amber-500/25 dark:hover:from-amber-500/30 dark:hover:via-slate-800 dark:hover:to-amber-500/30 border-y border-amber-200/70 dark:border-amber-900/40 border-l-[3px] border-r-[3px] border-l-amber-500 border-r-amber-500 shadow-xs hover:shadow-sm transition-all flex items-center justify-between gap-2 text-left cursor-pointer"
                                        title={`Fast gloss: ${def}`}
                                    >
                                        <span className="truncate flex-1">
                                            Gloss for <strong className="text-amber-800 dark:text-amber-300 font-bold font-serif">"{displayDef}"</strong>
                                        </span>
                                        <SourceBadge
                                            source={src}
                                            name={srcName}
                                            customColor={srcColor}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
