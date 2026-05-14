import React, { useState, useMemo } from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, Menu, BookOpen } from './Icons';
import { useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';

import { renderStyledText, getFriendlyLabel } from '../utils';

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

    const getEnding = (formStr: string) => {
        if (!formStr) return '';
        const parts = formStr.split('--');
        const rest = parts[1] || '';
        const restParts = rest.split('-');
        return restParts.length > 1 ? restParts[restParts.length - 1] : '';
    };

    return (
        <div className="fixed inset-0 z-[10001] bg-[#F4EFE6] dark:bg-slate-950 flex flex-col overflow-hidden animate-fade-in font-serif">
            {/* Standard Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px] font-sans">
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
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-[#8C7355] rounded-full"></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-[10px] font-bold text-[#B5A994] uppercase tracking-[0.2em] mb-1">H-Grade Root</div>
                            <div className="text-2xl font-bold text-[#4A3F35] font-noto-cherokee">{rootInfo.root_h || '-'}</div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-[#B5A994] uppercase tracking-[0.2em] mb-1">Glottal Root</div>
                            <div className="text-2xl font-bold text-[#4A3F35] font-noto-cherokee">{rootInfo.root_g || '-'}</div>
                        </div>
                    </div>
                </div>

                <div className="space-y-10">
                    {rootEntries.map((r) => {
                        const entry = dictionaryMap.get(r.entry_id);
                        if (!entry) return null;
                        
                        const isExpanded = expandedEntries[r.entry_id];
                        
                        const conjugations: any[] = [];
                        
                        // 1. Official/Imported Forms
                        const importedForms: any[] = [];
                        packages.forEach(p => {
                            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                                const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === entry.id || f.word_index === entry.Index);
                                forms.forEach(f => importedForms.push(f));
                            }
                        });

                        importedForms.forEach((f: any) => {
                            let displayLabel = getFriendlyLabel(f.form_name);
                            let badge = "";
                            
                            if (f.form_name === '3s|3s|present') {
                                badge = "PRES: -" + (r.segmented_forms ? getEnding(r.segmented_forms.present) : "");
                            } else if (f.form_name === '3s|3s|completive past') {
                                badge = "PERF: -" + (r.segmented_forms ? getEnding(r.segmented_forms.perfective) : "");
                            } else if (f.form_name === '3s|3s|habitual') {
                                badge = "HAB: -" + (r.segmented_forms ? getEnding(r.segmented_forms.imperfective) : "");
                            }

                            conjugations.push({
                                label: displayLabel,
                                badge: badge,
                                syllabary: f.syllabary,
                                translit: f.translit,
                                tone: f.tone
                            });
                        });

                        // 2. Legacy/Custom Forms fallback
                        if (conjugations.length === 0 && entry.Other_Forms) {
                            entry.Other_Forms.split('|').forEach((form: string) => {
                                const parts = form.split(':');
                                if (parts.length >= 2) {
                                    const label = parts[0];
                                    const values = parts[1].split('^');
                                    
                                    let displayLabel = label;
                                    let badge = "";
                                    
                                    if (label.includes('3rd person singular present habitual')) {
                                        displayLabel = "3rd person present";
                                        badge = "PRES: -" + (r.segmented_forms ? getEnding(r.segmented_forms.present) : "");
                                    } else if (label.includes('1st person singular with animate object')) {
                                        displayLabel = "1st person present (animate object)";
                                        badge = "PRES: -" + (r.segmented_forms ? getEnding(r.segmented_forms.present) : "");
                                    } else if (label.includes('1st person singular with inanimate object')) {
                                        displayLabel = "1st person present (inanimate object)";
                                        badge = "PRES: -" + (r.segmented_forms ? getEnding(r.segmented_forms.present) : "");
                                    } else if (label.includes('non-progressive remote past')) {
                                        displayLabel = "3rd person completive past";
                                        badge = "PERF: -" + (r.segmented_forms ? getEnding(r.segmented_forms.perfective) : "");
                                    }

                                    conjugations.push({
                                        label: displayLabel,
                                        badge: badge,
                                        syllabary: values[1],
                                        translit: values[0],
                                        tone: values[2]
                                    });
                                }
                            });
                        }

                        return (
                            <div key={r.entry_id} className="border-t border-[#E8E1D5] pt-6">
                                <div className="mb-2 flex justify-between items-start gap-4">
                                    <div 
                                        className="flex-1 cursor-pointer group/item"
                                        onClick={() => onViewEntry(entry)}
                                    >
                                        <h2 className="text-lg font-bold text-[#4A3F35] leading-snug mb-0.5 group-hover/item:text-amber-800 transition-colors">{renderStyledText(entry.Definition || '')}</h2>
                                        <div className="text-sm text-[#8C7355] italic font-medium">{entry.Entry}</div>
                                    </div>
                                    <button 
                                        onClick={() => onViewEntry(entry)}
                                        className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-1 shrink-0 font-sans uppercase tracking-wider"
                                    >
                                        <BookOpen size={12} />
                                        Full Entry
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 text-[9px] font-bold text-[#B5A994] uppercase tracking-[0.2em] mb-6">
                                    <button onClick={() => onViewClass(r.class_name)} className="hover:text-[#8C7355] transition-colors">cl. [{r.class_name}]</button>
                                    <span>Set {r.config?.pron?.set_type?.toUpperCase() || 'A'}</span>
                                    <button onClick={() => toggleExpand(r.entry_id)} className="ml-auto flex items-center gap-1 hover:text-[#8C7355] transition-colors">
                                        {isExpanded ? 'Hide' : 'Show'} {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                </div>

                                {isExpanded && (
                                    <div className="space-y-6 animate-fade-in">
                                        <div className="text-[9px] font-bold text-[#B5A994] uppercase tracking-[0.2em]">CED Conjugations</div>
                                        
                                        <div className="space-y-4">
                                            {conjugations.map((conj, i) => (
                                                <div key={i} className="bg-[#EBE5D9] dark:bg-slate-900/40 p-4 rounded-xl relative">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="text-[11px] font-medium text-[#8C7355]">{conj.label}</div>
                                                        {conj.badge && (
                                                            <div className="bg-[#DED5C5] dark:bg-slate-800 px-1.5 py-0.5 rounded text-[8px] font-mono text-[#4A3F35] uppercase tracking-wider font-bold">
                                                                {conj.badge}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="font-noto-cherokee text-xl text-[#4A3F35] mb-0.5">{conj.syllabary}</div>
                                                    <div className="text-sm text-[#8C7355] italic font-medium">{conj.translit}</div>
                                                </div>
                                            ))}
                                        </div>
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
