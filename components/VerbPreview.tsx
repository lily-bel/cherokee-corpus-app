import React, { useState, useMemo } from 'react';
import { useCorpus, RootEntry, DictionaryEntry } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';
import { 
    renderStyledText, 
    renderSegmentedSurface, 
    renderColorizedCherokee, 
    segmentVerbForm, 
    processFormsContextually, 
    VerbMorphologyTemplate 
} from '../utils';
import ReferenceFormsPreview, { getReferencePreviewMatchedForms } from './ReferenceFormsPreview';
import { BookOpen, ChevronDown, ChevronUp } from './Icons';

export interface VerbPreviewProps {
    rootEntry: RootEntry;
    entry?: DictionaryEntry;
    onViewEntry: (entry: any) => void;
    onViewRoot?: (slug: string) => void;
    onViewClass?: (className: string) => void;
    settings?: {
        showToneInForms?: boolean;
        colorWordSegments?: boolean;
        showClassMascots?: boolean;
        [key: string]: any;
    };
    className?: string;
}

export const VerbPreview: React.FC<VerbPreviewProps> = ({
    rootEntry,
    entry: propEntry,
    onViewEntry,
    onViewRoot,
    onViewClass,
    settings,
    className = ''
}) => {
    const { dictionaryMap } = useCorpus();
    const { packages, importedData } = usePackageManager();
    const [isExpanded, setIsExpanded] = useState(false);

    const entry = propEntry || dictionaryMap.get(rootEntry.entry_id);
    if (!entry) return null;

    const isColored = settings?.colorWordSegments !== undefined
        ? settings.colorWordSegments !== false
        : (() => {
            try {
                const s = localStorage.getItem('cherokee_app_settings');
                return s ? JSON.parse(s).colorWordSegments !== false : true;
            } catch {
                return true;
            }
        })();

    const showMascot = settings?.showClassMascots !== undefined
        ? settings.showClassMascots
        : (() => {
            try {
                const s = localStorage.getItem('cherokee_app_settings');
                return s ? JSON.parse(s).showClassMascots ?? false : false;
            } catch {
                return false;
            }
        })();

    // 1. Get CED forms for the mini forms table
    const finalCedForms = useMemo(() => {
        const entryId = entry.id || entry.Index || (entry as any).merged_id;
        const list: any[] = [];
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                const forms = importedData[p.id].word_forms!.filter((f: any) => 
                    f.word_index === entryId || f.word_index === entry.id || f.word_index === entry.Index || f.word_index === (entry as any).merged_id
                );
                forms.forEach(f => list.push({ ...f, color: p.color, pkgName: p.name, pkgType: p.type, packageId: p.id }));
            }
        });
        const sortedRawList = list.sort((a, b) => (a.order || 0) - (b.order || 0));
        const legacyCount = entry.Other_Forms ? entry.Other_Forms.split('|').length : 0;
        const rawCedList = sortedRawList.filter(f => f.source === 'ced').map((f, idx) => ({
            ...f,
            index: legacyCount + idx + 1
        }));
        let processedCed = processFormsContextually(rawCedList);

        // Fallback to legacy Other_Forms if empty
        if (processedCed.length === 0 && entry.Other_Forms) {
            const fallback: any[] = [];
            entry.Other_Forms.split('|').forEach((form: string) => {
                const parts = form.split(':');
                if (parts.length >= 2) {
                    const label = parts[0];
                    const values = parts[1].split('^');
                    let displayLabel = label;
                    if (label.includes('3rd person singular present habitual')) {
                        displayLabel = "3rd person singular present habitual";
                    } else if (label.includes('1st person singular with animate object') || label.includes('1st person singular with animate/ inanimate object')) {
                        displayLabel = "1st person singular present (animate)";
                    } else if (label.includes('1st person singular with inanimate object')) {
                        displayLabel = "1st person singular present (inanimate)";
                    } else if (label.includes('imperative with animate direct') || label.includes('imperative with animate/ inanimate direct')) {
                        displayLabel = "2nd person singular imperative (animate)";
                    } else if (label.includes('imperative with inanimate direct')) {
                        displayLabel = "2nd person singular imperative (inanimate)";
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
            processedCed = fallback;
        }
        return processedCed;
    }, [packages, importedData, entry]);

    const presGroups = useMemo(() => {
        const seg = rootEntry.segmented_forms?.present;
        return seg ? segmentVerbForm(seg, 'present', rootEntry.config, rootEntry.class_name) : null;
    }, [rootEntry]);

    const pronounSet = rootEntry.config?.pron?.set_type === 'b' ? 'B' : 'A';

    return (
        <div className={`border-t border-slate-200 dark:border-slate-800 pt-6 first:border-t-0 first:pt-0 ${className}`}>
            {/* Header: English definition and Cherokee surface */}
            <div className="mb-2 flex justify-between items-start gap-4">
                <div 
                    className="flex-1 cursor-pointer group/item min-w-0"
                    onClick={() => onViewEntry(entry)}
                >
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-snug mb-1 group-hover/item:text-amber-600 dark:group-hover/item:text-amber-400 transition-colors">
                        {renderStyledText(entry.Definition || '')}
                    </h2>
                    <div className="flex items-baseline gap-2.5 flex-wrap">
                        {entry.Syllabary && (
                            <span className="font-noto-cherokee text-base font-bold text-slate-800 dark:text-slate-200">
                                {entry.Syllabary}
                            </span>
                        )}
                        <span className="text-sm font-noto-serif text-amber-700 dark:text-amber-400 font-bold">
                            {rootEntry?.surface_segments?.present
                                ? renderSegmentedSurface(rootEntry.surface_segments.present, isColored)
                                : (presGroups
                                    ? renderColorizedCherokee(entry.Entry, presGroups, pronounSet, isColored)
                                    : (rootEntry.surface_spelling || entry.Entry))}
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => onViewEntry(entry)}
                    className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-1 shrink-0 uppercase tracking-wider"
                    title="View Full Entry"
                >
                    <BookOpen size={12} />
                    Full Entry
                </button>
            </div>

            {/* Morphology Template & Expand Toggle */}
            <div className="flex items-center justify-between gap-3 mt-3 mb-4 flex-wrap">
                <div className="flex-1 min-w-0">
                    <VerbMorphologyTemplate
                        rootEntry={rootEntry}
                        onViewRoot={onViewRoot || (() => {})}
                        onViewClass={onViewClass || (() => {})}
                        showMascot={showMascot}
                        className="text-xs sm:text-sm"
                    />
                </div>
                <button 
                    type="button"
                    onClick={() => setIsExpanded(prev => !prev)}
                    className="shrink-0 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                    <span>{isExpanded ? 'Hide Forms' : 'Show Forms'}</span>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
            </div>

            {/* Expanding Mini Other Forms Table */}
            {isExpanded && (
                <div className="animate-fade-in -mx-6 px-6 pt-2 pb-2">
                    <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 px-1">
                        CED Conjugations
                    </div>
                    {finalCedForms.length > 0 && getReferencePreviewMatchedForms(finalCedForms, entry, rootEntry).hasMiniPreview ? (
                        <ReferenceFormsPreview
                            forms={finalCedForms}
                            entry={entry}
                            rootEntry={rootEntry}
                            settings={settings}
                            onViewEntry={onViewEntry}
                        />
                    ) : (
                        <div className="text-xs text-slate-400 italic px-1 py-2">
                            No CED conjugations available
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VerbPreview;
