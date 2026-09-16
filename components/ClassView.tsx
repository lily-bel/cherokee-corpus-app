import React, { useMemo, useState } from 'react';
import { ArrowLeft, Menu } from './Icons';
import { UserAuthButton } from './UI';
import { useCorpus } from './CorpusContext';
import VerbPreview from './VerbPreview';
import { 
    getParentClassName, 
    getAspectClass, 
    getClassEndings, 
    getClassMascot, 
    ClassEndingInfo 
} from '../classMascots';

interface ClassViewProps {
    className: string;
    onClose: () => void;
    onViewClass: (className: string) => void;
    onViewEntry: (entry: any) => void;
    onViewRoot?: (slug: string) => void;
    onShowSettings?: () => void;
    settings?: {
        showToneInForms?: boolean;
        colorWordSegments?: boolean;
        showClassMascots?: boolean;
        [key: string]: any;
    };
    style?: React.CSSProperties;
}

interface SelectionState {
    type: 'subclass' | 'variant';
    name: string;
}

const ClassView: React.FC<ClassViewProps> = ({ 
    className, 
    onClose, 
    onViewClass, 
    onViewEntry, 
    onViewRoot, 
    onShowSettings, 
    settings, 
    style 
}) => {
    const { roots } = useCorpus();

    // 1. Resolve Parent Class
    const parentClassName = useMemo(() => {
        return getParentClassName(className) || className.split('[')[0];
    }, [className]);

    const aspectClassInfo = useMemo(() => {
        return getAspectClass(parentClassName);
    }, [parentClassName]);

    // 2. Selection State (Subclass or Variant)
    const [selectedItem, setSelectedItem] = useState<SelectionState | null>(() => {
        if (className.includes('[')) {
            return { type: 'variant', name: className };
        }
        const rawBase = className.split('[')[0];
        if (rawBase !== parentClassName) {
            return { type: 'subclass', name: rawBase };
        }
        return null;
    });

    const selectedSubclassName = useMemo(() => {
        if (selectedItem?.type === 'subclass') {
            return selectedItem.name;
        }
        if (selectedItem?.type === 'variant') {
            return selectedItem.name.split('[')[0];
        }
        return null;
    }, [selectedItem]);

    const selectedVariantName = useMemo(() => {
        if (selectedItem?.type === 'variant') {
            return selectedItem.name;
        }
        return null;
    }, [selectedItem]);

    // 3. All verbs belonging to this parent class
    const allVerbsInClass = useMemo(() => {
        return roots.filter(r => {
            if (!r.class_name) return false;
            const parent = getParentClassName(r.class_name);
            return parent === parentClassName || r.class_name === parentClassName || r.class_name.startsWith(parentClassName + '-');
        });
    }, [parentClassName, roots]);

    // 4. Known Subclasses under this Class
    const subclassesList = useMemo(() => {
        const set = new Set<string>();
        if (aspectClassInfo?.subclasses) {
            aspectClassInfo.subclasses.forEach(s => set.add(s.name));
        }
        allVerbsInClass.forEach(r => {
            if (r.class_name) {
                const sub = r.class_name.split('[')[0];
                set.add(sub);
            }
        });
        if (set.size === 0) {
            set.add(parentClassName);
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [aspectClassInfo, allVerbsInClass, parentClassName]);

    // 5. Group verbs by subclass & exact class
    const verbsBySubclass = useMemo(() => {
        const map = new Map<string, typeof allVerbsInClass>();
        subclassesList.forEach(s => map.set(s, []));
        allVerbsInClass.forEach(r => {
            const sub = r.class_name ? r.class_name.split('[')[0] : parentClassName;
            if (!map.has(sub)) {
                map.set(sub, []);
            }
            map.get(sub)!.push(r);
        });
        return map;
    }, [subclassesList, allVerbsInClass, parentClassName]);

    const verbsByExactClass = useMemo(() => {
        const map = new Map<string, typeof allVerbsInClass>();
        allVerbsInClass.forEach(r => {
            const cls = r.class_name || parentClassName;
            if (!map.has(cls)) {
                map.set(cls, []);
            }
            map.get(cls)!.push(r);
        });
        return map;
    }, [allVerbsInClass, parentClassName]);

    // 6. Helper to get endings
    const getEndings = (clsName: string): ClassEndingInfo | null => {
        const mascotEndings = getClassEndings(clsName);
        if (mascotEndings) {
            return mascotEndings;
        }

        const classVerbs = roots.filter(r => r.class_name === clsName && r.segmented_forms);
        if (classVerbs.length === 0) return null;

        const parseForm = (formStr: string, isImp = false) => {
            if (!formStr || formStr === '---') return '';
            const parts = formStr.replace(/-+/g, '-').split('-').filter(Boolean);
            if (parts.length === 0) return '';
            const aspect = isImp ? parts[parts.length - 1] : (parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1]);
            const clean = aspect.replace(/[*@>:]/g, '').trim();
            return clean ? `-${clean}` : '';
        };

        const result: ClassEndingInfo = {
            present: '',
            imperfective: '',
            perfective: '',
            imperative: '',
            infinitive: ''
        };

        for (const verb of classVerbs) {
            const f = verb.segmented_forms;
            if (f) {
                if (!result.present && f.present) result.present = parseForm(f.present, false);
                if (!result.imperfective && f.imperfective) result.imperfective = parseForm(f.imperfective, false);
                if (!result.perfective && f.perfective) result.perfective = parseForm(f.perfective, false);
                if (!result.imperative && f.imperative) result.imperative = parseForm(f.imperative, true);
                if (!result.infinitive && f.infinitive) result.infinitive = parseForm(f.infinitive, false);
            }
        }

        if (result.present || result.imperfective || result.perfective || result.imperative || result.infinitive) {
            return result;
        }
        return null;
    };

    // Subclass mascot for active selection
    const activeSubclassMascot = useMemo(() => {
        if (!selectedSubclassName) return undefined;
        return getClassMascot(selectedSubclassName);
    }, [selectedSubclassName]);

    // Verbs to display
    const displayedVerbsList = useMemo(() => {
        if (selectedItem?.type === 'variant') {
            return verbsByExactClass.get(selectedItem.name) || [];
        }
        if (selectedItem?.type === 'subclass') {
            return verbsBySubclass.get(selectedItem.name) || [];
        }
        return allVerbsInClass;
    }, [selectedItem, verbsByExactClass, verbsBySubclass, allVerbsInClass]);

    return (
        <div style={style} className="fixed inset-0 z-[10002] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden font-sans">
            {/* Standard Top Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm shrink-0 h-12">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onClose} 
                        className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors"
                    >
                        <ArrowLeft size={24} />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Back</span>
                    </button>
                </div>
                <div className="flex gap-1.5 items-center">
                    <UserAuthButton />
                    {onShowSettings && (
                        <button 
                            onClick={onShowSettings} 
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors" 
                            title="Settings"
                        >
                            <Menu size={22} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-24">
                {/* Header Section: Stacked Equal-Sized Levels with Staggered Indents */}
                <div className="mb-6 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    
                    <div className="space-y-1.5">
                        {/* Level 1: Class (No indent) */}
                        <div className="flex items-baseline gap-3 flex-wrap pl-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-20 shrink-0">
                                Class
                            </span>
                            {selectedSubclassName ? (
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="text-xl font-bold font-mono text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors"
                                    title="View entire class"
                                >
                                    [{parentClassName}]
                                </button>
                            ) : (
                                <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
                                    [{parentClassName}]
                                </span>
                            )}
                        </div>

                        {/* Level 2: Subclass (Slight indent pl-5, shows mascot) */}
                        {selectedSubclassName && (
                            <div className="flex items-baseline gap-3 flex-wrap pl-5">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-20 shrink-0">
                                    Subclass
                                </span>
                                {selectedVariantName ? (
                                    <button
                                        onClick={() => setSelectedItem({ type: 'subclass', name: selectedSubclassName })}
                                        className="text-xl font-bold font-mono text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:underline transition-colors"
                                        title="View entire subclass"
                                    >
                                        [{selectedSubclassName}]
                                    </button>
                                ) : (
                                    <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
                                        [{selectedSubclassName}]
                                    </span>
                                )}
                                {activeSubclassMascot && (
                                    <span className="text-sm italic font-normal text-amber-700 dark:text-amber-400 font-serif ml-2" title="Subclass mascot verb">
                                        mascot: {activeSubclassMascot}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Level 3: Variant (Further indent pl-10) */}
                        {selectedSubclassName && (
                            <div className="flex items-baseline gap-3 flex-wrap pl-10">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-20 shrink-0">
                                    Variant
                                </span>
                                {selectedVariantName ? (
                                    <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
                                        [{selectedVariantName}]
                                    </span>
                                ) : (
                                    <span className="text-lg font-mono italic text-slate-500 dark:text-slate-400">
                                        base
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Stats summary */}
                    <div className="mt-3 text-slate-500 dark:text-slate-400 italic text-xs">
                        {selectedItem?.type === 'variant' ? (
                            <span>{displayedVerbsList.length} verbs in variant <strong className="font-mono font-semibold">[{selectedItem.name}]</strong></span>
                        ) : selectedItem?.type === 'subclass' ? (
                            <span>{displayedVerbsList.length} verbs in subclass <strong className="font-mono font-semibold">[{selectedItem.name}]</strong></span>
                        ) : (
                            <span>{allVerbsInClass.length} verbs across {subclassesList.length} {subclassesList.length === 1 ? 'subclass' : 'subclasses'}</span>
                        )}
                    </div>
                </div>

                {/* Table Section: Mini-table cards separated by small gaps */}
                <div className="mb-10 overflow-x-auto">
                    <div className="w-full min-w-[320px]">
                        {/* Shared Table Header */}
                        <div className="rounded-t-lg border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-800/60 shadow-xs overflow-hidden mb-2">
                            <table className="w-full text-left border-collapse table-fixed">
                                <colgroup>
                                    <col className="w-[30%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[14%]" />
                                </colgroup>
                                <thead>
                                    <tr className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                        <th className="py-2 px-2 sm:px-3">Subclass / Variant</th>
                                        <th className="py-2 px-1 text-center">Pres</th>
                                        <th className="py-2 px-1 text-center">Impf</th>
                                        <th className="py-2 px-1 text-center">Perf</th>
                                        <th className="py-2 px-1 text-center">Impr</th>
                                        <th className="py-2 px-1 text-center">Inf</th>
                                    </tr>
                                </thead>
                            </table>
                        </div>

                        {/* Separate Subclass Cards with a small space between them */}
                        <div className="space-y-2">
                            {subclassesList.map((subName) => {
                                const subInfo = aspectClassInfo?.subclasses.find(s => s.name === subName);
                                const baseEndings = getEndings(subName) || subInfo?.endings || null;
                                const subVerbs = verbsBySubclass.get(subName) || [];

                                // Gather variants for this subclass
                                const variantNamesSet = new Set<string>();
                                if (subInfo?.variants) {
                                    subInfo.variants.forEach(v => {
                                        if (v.name !== subName) variantNamesSet.add(v.name);
                                    });
                                }
                                subVerbs.forEach(v => {
                                    if (v.class_name && v.class_name !== subName && v.class_name.startsWith(subName + '[')) {
                                        variantNamesSet.add(v.class_name);
                                    }
                                });
                                const variantsList = Array.from(variantNamesSet).sort((a, b) => a.localeCompare(b));

                                const isThisSubclassSelected = selectedSubclassName === subName;
                                const isSubclassLevelSelected = selectedItem?.type === 'subclass' && selectedItem.name === subName;

                                return (
                                    <div 
                                        key={subName}
                                        className={`rounded-lg border shadow-xs overflow-hidden transition-all ${
                                            isSubclassLevelSelected
                                                ? 'border-amber-400 dark:border-amber-600 bg-amber-50/70 dark:bg-amber-950/50 ring-2 ring-amber-500/40'
                                                : isThisSubclassSelected
                                                    ? 'border-amber-300/80 dark:border-amber-700/80 bg-white dark:bg-slate-900/60'
                                                    : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <colgroup>
                                                <col className="w-[30%]" />
                                                <col className="w-[14%]" />
                                                <col className="w-[14%]" />
                                                <col className="w-[14%]" />
                                                <col className="w-[14%]" />
                                                <col className="w-[14%]" />
                                            </colgroup>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                                {/* Subclass Primary Row */}
                                                <tr
                                                    onClick={() => {
                                                        if (isSubclassLevelSelected) {
                                                            setSelectedItem(null);
                                                        } else {
                                                            setSelectedItem({ type: 'subclass', name: subName });
                                                        }
                                                    }}
                                                    className={`cursor-pointer transition-colors ${
                                                        isSubclassLevelSelected
                                                            ? 'bg-amber-100/90 dark:bg-amber-950/80 font-bold' 
                                                            : isThisSubclassSelected
                                                                ? 'bg-amber-50/70 dark:bg-amber-950/40'
                                                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <td className="py-2 px-2 sm:px-3 font-mono text-[11px] text-slate-800 dark:text-slate-200" title={subName}>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold">[{subName}]</span>
                                                            {subInfo?.preconditions && subInfo.preconditions.length > 0 && (
                                                                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-normal">
                                                                    pre: {subInfo.preconditions.join(',')}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                                                ({subVerbs.length})
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                        {baseEndings?.present || '—'}
                                                    </td>
                                                    <td className="py-2 px-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                        {baseEndings?.imperfective || '—'}
                                                    </td>
                                                    <td className="py-2 px-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                        {baseEndings?.perfective || '—'}
                                                    </td>
                                                    <td className="py-2 px-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                        {baseEndings?.imperative || '—'}
                                                    </td>
                                                    <td className="py-2 px-1 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                        {baseEndings?.infinitive || '—'}
                                                    </td>
                                                </tr>

                                                {/* Variant Rows for this Subclass */}
                                                {variantsList.map((varName) => {
                                                    const varEndings = getEndings(varName);
                                                    const varVerbsCount = (verbsByExactClass.get(varName) || []).length;
                                                    const isThisVariantSelected = selectedItem?.type === 'variant' && selectedItem.name === varName;

                                                    const isPresDiff = Boolean(baseEndings?.present && varEndings?.present !== baseEndings.present);
                                                    const isImpfDiff = Boolean(baseEndings?.imperfective && varEndings?.imperfective !== baseEndings.imperfective);
                                                    const isPerfDiff = Boolean(baseEndings?.perfective && varEndings?.perfective !== baseEndings.perfective);
                                                    const isImpDiff = Boolean(baseEndings?.imperative && varEndings?.imperative !== baseEndings.imperative);
                                                    const isInfDiff = Boolean(baseEndings?.infinitive && varEndings?.infinitive !== baseEndings.infinitive);

                                                    return (
                                                        <tr
                                                            key={varName}
                                                            onClick={() => {
                                                                if (isThisVariantSelected) {
                                                                    setSelectedItem({ type: 'subclass', name: subName });
                                                                } else {
                                                                    setSelectedItem({ type: 'variant', name: varName });
                                                                }
                                                            }}
                                                            className={`group cursor-pointer transition-colors ${
                                                                isThisVariantSelected
                                                                    ? 'bg-amber-200/90 dark:bg-amber-900/90 ring-1 ring-inset ring-amber-500/80 font-bold' 
                                                                    : isSubclassLevelSelected
                                                                        ? 'bg-amber-100/60 dark:bg-amber-950/50 hover:bg-amber-100/90 dark:hover:bg-amber-950/80'
                                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                            }`}
                                                        >
                                                            <td className="py-2 px-2 sm:px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-normal" title={varName}>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className={isThisVariantSelected ? 'font-bold' : 'font-medium'}>[{varName}]</span>
                                                                    <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                                                        ({varVerbsCount})
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className={`py-2 px-1 font-mono text-[11px] text-center ${isPresDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                                {varEndings?.present || '—'}
                                                            </td>
                                                            <td className={`py-2 px-1 font-mono text-[11px] text-center ${isImpfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                                {varEndings?.imperfective || '—'}
                                                            </td>
                                                            <td className={`py-2 px-1 font-mono text-[11px] text-center ${isPerfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                                {varEndings?.perfective || '—'}
                                                            </td>
                                                            <td className={`py-2 px-1 font-mono text-[11px] text-center ${isImpDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                                {varEndings?.imperative || '—'}
                                                            </td>
                                                            <td className={`py-2 px-1 font-mono text-[11px] text-center ${isInfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                                {varEndings?.infinitive || '—'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Verbs List Section */}
                <div>
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                {selectedItem 
                                    ? `Filtered Verbs (${displayedVerbsList.length})` 
                                    : `All Class Verbs (${displayedVerbsList.length})`
                                }
                            </h3>
                        </div>

                        {selectedItem && (
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1.5 font-medium bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200/50 dark:border-amber-900/50 transition-colors"
                            >
                                <span>Selected {selectedItem.type}: <strong className="font-mono">[{selectedItem.name}]</strong></span>
                                <span className="text-slate-400 dark:text-slate-500 text-[10px]">✕ Show all</span>
                            </button>
                        )}
                    </div>

                    {displayedVerbsList.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 italic text-sm">
                            No verbs documented for this selection.
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {subclassesList.map((subName) => {
                                // If a specific subclass or variant is selected, check if this subclass applies
                                if (selectedItem?.type === 'subclass' && selectedItem.name !== subName) {
                                    return null;
                                }
                                if (selectedItem?.type === 'variant' && !selectedItem.name.startsWith(subName)) {
                                    return null;
                                }

                                const subVerbs = selectedItem?.type === 'variant'
                                    ? (verbsByExactClass.get(selectedItem.name) || [])
                                    : (verbsBySubclass.get(subName) || []);

                                if (subVerbs.length === 0) return null;

                                return (
                                    <div key={subName} className="space-y-4">
                                        {/* Subclass Section Header above verbs when viewing all subclasses */}
                                        {!selectedItem && subclassesList.length > 1 && (
                                            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-800">
                                                <div className="w-1.5 h-4 rounded-full bg-amber-500 dark:bg-amber-400" />
                                                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                                    Subclass [{subName}]
                                                </span>
                                                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                                    ({subVerbs.length} {subVerbs.length === 1 ? 'verb' : 'verbs'})
                                                </span>
                                            </div>
                                        )}

                                        {/* Verbs List */}
                                        <div className="space-y-6">
                                            {subVerbs.map((r) => (
                                                <VerbPreview
                                                    key={r.entry_id}
                                                    rootEntry={r}
                                                    onViewEntry={onViewEntry}
                                                    onViewRoot={onViewRoot}
                                                    onViewClass={onViewClass}
                                                    settings={settings}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClassView;
