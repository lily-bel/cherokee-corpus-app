import React, { useState, useMemo } from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, Menu, BookOpen } from './Icons';
import { useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';

import { renderStyledText, processFormsContextually } from '../utils';

interface RootViewProps {
    slug: string;
    onClose: () => void;
    onViewEntry: (entry: any) => void;
    onViewClass: (className: string) => void;
    onShowSettings?: () => void;
}

const RootView: React.FC<RootViewProps> = ({ slug, onClose, onViewEntry, onViewClass, onShowSettings }) => {
    const { groupedRootsMap, dictionaryMap } = useCorpus();
    const { packages, importedData } = usePackageManager();
    const [expandedEntries, setExpandedEntries] = useState<Record<string, boolean>>({});

    const rootEntries = useMemo(() => groupedRootsMap.get(slug) || [], [slug, groupedRootsMap]);
    const rootInfo = rootEntries[0];

    if (!rootInfo) return null;

    const toggleExpand = (entryId: string) => {
        setExpandedEntries(prev => ({ ...prev, [entryId]: !prev[entryId] }));
    };



    return (
        <div className="fixed inset-0 z-[10001] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden animate-fade-in font-sans">
            {/* Standard Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors">
                        <ArrowLeft size={24} />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Back</span>
                    </button>
                </div>
                <div className="flex gap-2">
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                            <Menu size={24} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-24">
                {/* Root Display */}
                <div className="mb-8 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">H-Grade Root</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-noto-cherokee">-{rootInfo.root_h || '-'}-</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Glottal Root</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-noto-cherokee">-{rootInfo.root_g || '-'}-</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {rootEntries.map((r) => {
                        const entry = dictionaryMap.get(r.entry_id);
                        if (!entry) return null;
                        
                        const isExpanded = expandedEntries[r.entry_id];
                        
                        // 1. Get CED Forms from Word Forms
                        const list: any[] = [];
                        packages.forEach(p => {
                            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                                const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === entry.id || f.word_index === entry.Index);
                                forms.forEach(f => list.push({ ...f, color: p.color, pkgName: p.name, pkgType: p.type }));
                            }
                        });
                        const sortedRawList = list.sort((a, b) => (a.order || 0) - (b.order || 0));
                        
                        // Compute context ONLY among CED forms for the mini table view
                        const rawCedList = sortedRawList.filter(f => f.source === 'ced');
                        let finalCedForms = processFormsContextually(rawCedList);

                        // 2. Fallback to parsed legacy forms if empty
                        if (finalCedForms.length === 0 && entry.Other_Forms) {
                            const fallback: any[] = [];
                            entry.Other_Forms.split('|').forEach((form: string) => {
                                const parts = form.split(':');
                                if (parts.length >= 2) {
                                    const label = parts[0];
                                    const values = parts[1].split('^');
                                    
                                    let displayLabel = label;
                                    if (label.includes('3rd person singular present habitual')) {
                                        displayLabel = "3rd person singular present";
                                    } else if (label.includes('1st person singular with animate object')) {
                                        displayLabel = "1st person singular present (animate)";
                                    } else if (label.includes('1st person singular with inanimate object')) {
                                        displayLabel = "1st person singular present (inanimate)";
                                    } else if (label.includes('non-progressive remote past')) {
                                        displayLabel = "3rd person singular completive past";
                                    } else if (label.includes('habitual past')) {
                                        displayLabel = "3rd person singular habitual past";
                                    }
                                    
                                    fallback.push({
                                        displayLabel: displayLabel,
                                        syllabary: values[1],
                                        translit: values[0]
                                    });
                                }
                            });
                            finalCedForms = fallback;
                        }

                        return (
                            <div key={r.entry_id} className="border-t border-slate-200 dark:border-slate-800 pt-6">
                                <div className="mb-2 flex justify-between items-start gap-4">
                                    <div 
                                        className="flex-1 cursor-pointer group/item"
                                        onClick={() => onViewEntry(entry)}
                                    >
                                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-snug mb-0.5 group-hover/item:text-amber-600 dark:group-hover/item:text-amber-400 transition-colors">{renderStyledText(entry.Definition || '')}</h2>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 italic font-medium">{entry.Entry}</div>
                                    </div>
                                    <button 
                                        onClick={() => onViewEntry(entry)}
                                        className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-1 shrink-0 uppercase tracking-wider"
                                    >
                                        <BookOpen size={12} />
                                        Full Entry
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">
                                    <button onClick={() => onViewClass(r.class_name)} className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors">cl. [{r.class_name}]</button>
                                    <span>Set {r.config?.pron?.set_type?.toUpperCase() || 'A'}</span>
                                    <button onClick={() => toggleExpand(r.entry_id)} className="ml-auto flex items-center gap-1 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                        {isExpanded ? 'Hide' : 'Show'} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="animate-fade-in">
                                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">CED Conjugations</div>
                                        {finalCedForms.length > 0 ? (
                                            <div className="grid grid-cols-[auto_auto_1fr] gap-x-6 gap-y-2.5 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 items-center shadow-sm">
                                                {finalCedForms.map((f, i) => (
                                                    <React.Fragment key={i}>
                                                         <div className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider pr-2">
                                                             {f.displayLabel}:
                                                         </div>
                                                         <div className="font-noto-cherokee text-base text-slate-800 dark:text-slate-200 font-medium">
                                                             {f.syllabary}
                                                         </div>
                                                         <div className="text-[15px] text-amber-800 dark:text-amber-400 italic font-semibold">
                                                             {f.translit}
                                                         </div>
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 italic">No CED conjugations available</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RootView;
