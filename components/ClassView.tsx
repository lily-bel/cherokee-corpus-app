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

    // 1. Resolve Parent Class and Initial Mode
    const parentClassName = useMemo(() => {
        return getParentClassName(className) || className.split('[')[0];
    }, [className]);

    const aspectClassInfo = useMemo(() => {
        return getAspectClass(parentClassName);
    }, [parentClassName]);

    // Initial focused subclass: if className specifies a subclass or variant, focus on it
    const [focusedSubclass, setFocusedSubclass] = useState<string | null>(() => {
        const rawBase = className.split('[')[0];
        // If className is not just the parent class (e.g. it's "sg-s-a" or "sg-s-a[inf2]"), focus that subclass
        if (rawBase !== parentClassName) {
            return rawBase;
        }
        return null;
    });

    // Initial selection (highlighted row / filter)
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

    // 2. All verbs belonging to this parent class
    const allVerbsInClass = useMemo(() => {
        return roots.filter(r => {
            if (!r.class_name) return false;
            const parent = getParentClassName(r.class_name);
            return parent === parentClassName || r.class_name === parentClassName || r.class_name.startsWith(parentClassName + '-');
        });
    }, [parentClassName, roots]);

    // 3. Known Subclasses under this Class (from aspect_classes.json merged with any in roots)
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

    // 4. Group verbs by subclass & variant
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

    // 5. Helper to get endings for a subclass or variant
    const getEndings = (clsName: string): ClassEndingInfo | null => {
        const mascotEndings = getClassEndings(clsName);
        if (mascotEndings) {
            return mascotEndings;
        }

        // Dynamic fallback from roots if not in mascot endings
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

    // 6. Subclasses to display in table: if focusedSubclass is active, only show that subclass
    const displayedSubclasses = useMemo(() => {
        if (focusedSubclass) {
            return subclassesList.filter(s => s === focusedSubclass);
        }
        return subclassesList;
    }, [focusedSubclass, subclassesList]);

    // Mascot
    const mascot = useMemo(() => {
        const m = getClassMascot(focusedSubclass || parentClassName);
        if (m) return m;
        const rMatch = allVerbsInClass.find(r => r.class_mascot);
        return rMatch?.class_mascot;
    }, [focusedSubclass, parentClassName, allVerbsInClass]);

    // Calculate total variants count across displayed subclasses
    const totalVariantsCount = useMemo(() => {
        let count = 0;
        displayedSubclasses.forEach(subName => {
            const subInfo = aspectClassInfo?.subclasses.find(s => s.name === subName);
            const varSet = new Set<string>();
            if (subInfo?.variants) {
                subInfo.variants.forEach(v => varSet.add(v.name));
            }
            const verbs = verbsBySubclass.get(subName) || [];
            verbs.forEach(v => {
                if (v.class_name && v.class_name !== subName) {
                    varSet.add(v.class_name);
                }
            });
            count += Math.max(1, varSet.size);
        });
        return count;
    }, [displayedSubclasses, aspectClassInfo, verbsBySubclass]);

    // Filter verbs to display
    const displayedVerbsList = useMemo(() => {
        if (selectedItem?.type === 'variant') {
            return (verbsByExactClass.get(selectedItem.name) || []);
        }
        if (selectedItem?.type === 'subclass') {
            return (verbsBySubclass.get(selectedItem.name) || []);
        }
        if (focusedSubclass) {
            return (verbsBySubclass.get(focusedSubclass) || []);
        }
        return allVerbsInClass;
    }, [selectedItem, focusedSubclass, verbsByExactClass, verbsBySubclass, allVerbsInClass]);

    return (
        <div style={style} className="fixed inset-0 z-[10002] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden font-sans">
            {/* Standard Header */}
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
                {/* Header & Breadcrumb Section */}
                <div className="mb-6 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-sans flex-wrap mb-2">
                        <button
                            onClick={() => {
                                setFocusedSubclass(null);
                                setSelectedItem(null);
                            }}
                            className={`transition-colors hover:underline ${
                                !focusedSubclass && !selectedItem 
                                    ? 'text-amber-700 dark:text-amber-400 font-bold' 
                                    : 'text-slate-600 dark:text-slate-300'
                            }`}
                        >
                            Class: <span className="font-mono font-bold">[{parentClassName}]</span>
                        </button>

                        {(focusedSubclass || (selectedItem?.type === 'subclass' && selectedItem.name !== parentClassName)) && (
                            <>
                                <span className="text-slate-300 dark:text-slate-600">›</span>
                                <button
                                    onClick={() => {
                                        const sub = focusedSubclass || selectedItem?.name || '';
                                        setFocusedSubclass(sub);
                                        setSelectedItem({ type: 'subclass', name: sub });
                                    }}
                                    className={`transition-colors hover:underline ${
                                        selectedItem?.type === 'subclass' 
                                            ? 'text-amber-700 dark:text-amber-400 font-bold' 
                                            : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                >
                                    Subclass: <span className="font-mono font-bold">[{focusedSubclass || selectedItem?.name}]</span>
                                </button>
                            </>
                        )}

                        {selectedItem?.type === 'variant' && (
                            <>
                                <span className="text-slate-300 dark:text-slate-600">›</span>
                                <span className="text-amber-700 dark:text-amber-400 font-bold font-mono">
                                    Variant: [{selectedItem.name}]
                                </span>
                            </>
                        )}
                    </div>

                    {/* Main Title Banner */}
                    <div className="flex items-baseline justify-between gap-4 flex-wrap">
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono">
                                {focusedSubclass ? `[${focusedSubclass}]` : `[${parentClassName}]`}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {focusedSubclass ? 'Verb Subclass' : 'Verb Class'}
                            </span>
                            {mascot && (
                                <div className="text-sm italic font-normal text-amber-700 dark:text-amber-400 font-serif" title="Class mascot verb">
                                    mascot: {mascot}
                                </div>
                            )}
                        </div>

                        {/* "See Full Class" Action Button when in focused subclass mode */}
                        {focusedSubclass && (
                            <button
                                onClick={() => {
                                    setFocusedSubclass(null);
                                    setSelectedItem(null);
                                }}
                                className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-800 rounded-full px-3 py-1 transition-all flex items-center gap-1.5 shadow-sm"
                            >
                                <span>See Full Class [{parentClassName}]</span>
                                <span>→</span>
                            </button>
                        )}
                    </div>

                    <div className="mt-2 text-slate-500 dark:text-slate-400 italic text-xs">
                        {focusedSubclass ? (
                            <span>{(verbsBySubclass.get(focusedSubclass) || []).length} verbs in subclass <strong className="font-mono font-semibold">[{focusedSubclass}]</strong></span>
                        ) : (
                            <span>{allVerbsInClass.length} verbs across {subclassesList.length} {subclassesList.length === 1 ? 'subclass' : 'subclasses'} ({totalVariantsCount} {totalVariantsCount === 1 ? 'variant' : 'variants'})</span>
                        )}
                    </div>
                </div>

                {/* 2-Level Flat Grouped Table */}
                <div className="mb-10 overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 shadow-sm">
                    <table className="w-full text-left border-collapse min-w-[520px]">
                        <thead>
                            <tr className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40">
                                <th className="py-2.5 px-3">Subclass / Variant</th>
                                <th className="py-2.5 px-2 text-center">Pres</th>
                                <th className="py-2.5 px-2 text-center">Impf</th>
                                <th className="py-2.5 px-2 text-center">Perf</th>
                                <th className="py-2.5 px-2 text-center">Impr</th>
                                <th className="py-2.5 px-2 text-center">Inf</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                            {displayedSubclasses.map((subName) => {
                                const subInfo = aspectClassInfo?.subclasses.find(s => s.name === subName);
                                const baseEndings = getEndings(subName) || subInfo?.endings || null;
                                const subVerbs = verbsBySubclass.get(subName) || [];
                                const baseVerbsCount = (verbsByExactClass.get(subName) || []).length;

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

                                const isSubclassSelected = selectedItem?.type === 'subclass' && selectedItem.name === subName;
                                const isBaseRowSelected = isSubclassSelected || (selectedItem?.type === 'variant' && selectedItem.name === subName);

                                return (
                                    <React.Fragment key={subName}>
                                        {/* Subclass Section Header Row */}
                                        <tr 
                                            onClick={() => {
                                                if (isSubclassSelected) {
                                                    setSelectedItem(null);
                                                } else {
                                                    setSelectedItem({ type: 'subclass', name: subName });
                                                }
                                            }}
                                            className={`cursor-pointer transition-colors border-t-2 border-slate-200/80 dark:border-slate-800 ${
                                                isSubclassSelected 
                                                    ? 'bg-amber-100/90 dark:bg-amber-950/80' 
                                                    : 'bg-slate-100/60 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                                            }`}
                                        >
                                            <td colSpan={6} className="py-2 px-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${isSubclassSelected ? 'bg-amber-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
                                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-xs">
                                                            Subclass: [{subName}]
                                                        </span>
                                                        {subInfo?.preconditions && subInfo.preconditions.length > 0 && (
                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium" title="Preconditions">
                                                                pre: {subInfo.preconditions.join(',')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                                                            {subVerbs.length} {subVerbs.length === 1 ? 'verb' : 'verbs'}
                                                            {variantsList.length > 0 && ` (${variantsList.length + 1} variations)`}
                                                        </span>
                                                        {!focusedSubclass && subclassesList.length > 1 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setFocusedSubclass(subName);
                                                                    setSelectedItem({ type: 'subclass', name: subName });
                                                                }}
                                                                className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 hover:underline ml-2"
                                                                title="Focus on this subclass"
                                                            >
                                                                Focus
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Base Subclass Row */}
                                        {baseEndings && (
                                            <tr
                                                onClick={() => {
                                                    if (selectedItem?.type === 'subclass' && selectedItem.name === subName) {
                                                        setSelectedItem(null);
                                                    } else {
                                                        setSelectedItem({ type: 'subclass', name: subName });
                                                    }
                                                }}
                                                className={`group cursor-pointer transition-colors ${
                                                    isBaseRowSelected
                                                        ? 'bg-amber-50 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-500/40' 
                                                        : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                <td className="py-2 px-3 pl-6 font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold" title={subName}>
                                                    <span className="text-slate-500 dark:text-slate-400 mr-1.5">●</span>
                                                    <span>[{subName}] (base)</span>
                                                    <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                                        ({baseVerbsCount})
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                    {baseEndings.present || '—'}
                                                </td>
                                                <td className="py-2 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                    {baseEndings.imperfective || '—'}
                                                </td>
                                                <td className="py-2 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                    {baseEndings.perfective || '—'}
                                                </td>
                                                <td className="py-2 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                    {baseEndings.imperative || '—'}
                                                </td>
                                                <td className="py-2 px-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                                    {baseEndings.infinitive || '—'}
                                                </td>
                                            </tr>
                                        )}

                                        {/* Variant Rows for this Subclass */}
                                        {variantsList.map((varName) => {
                                            const varEndings = getEndings(varName);
                                            const varVerbsCount = (verbsByExactClass.get(varName) || []).length;
                                            const isVariantSelected = selectedItem?.type === 'variant' && selectedItem.name === varName;

                                            const isPresDiff = Boolean(baseEndings?.present && varEndings?.present !== baseEndings.present);
                                            const isImpfDiff = Boolean(baseEndings?.imperfective && varEndings?.imperfective !== baseEndings.imperfective);
                                            const isPerfDiff = Boolean(baseEndings?.perfective && varEndings?.perfective !== baseEndings.perfective);
                                            const isImpDiff = Boolean(baseEndings?.imperative && varEndings?.imperative !== baseEndings.imperative);
                                            const isInfDiff = Boolean(baseEndings?.infinitive && varEndings?.infinitive !== baseEndings.infinitive);

                                            return (
                                                <tr
                                                    key={varName}
                                                    onClick={() => {
                                                        if (isVariantSelected) {
                                                            setSelectedItem(null);
                                                        } else {
                                                            setSelectedItem({ type: 'variant', name: varName });
                                                        }
                                                    }}
                                                    className={`group cursor-pointer transition-colors ${
                                                        isVariantSelected
                                                            ? 'bg-amber-100/90 dark:bg-amber-950/80 ring-1 ring-inset ring-amber-500/50' 
                                                            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                                    }`}
                                                >
                                                    <td className="py-2 px-3 pl-8 font-mono text-[11px] text-slate-700 dark:text-slate-300 font-normal" title={varName}>
                                                        <span className="text-amber-500 mr-1.5">↳</span>
                                                        <span className="font-semibold">[{varName}]</span>
                                                        <span className="ml-1.5 text-[10px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                                            ({varVerbsCount})
                                                        </span>
                                                    </td>
                                                    <td className={`py-2 px-2 font-mono text-[11px] text-center ${isPresDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                        {varEndings?.present || '—'}
                                                    </td>
                                                    <td className={`py-2 px-2 font-mono text-[11px] text-center ${isImpfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                        {varEndings?.imperfective || '—'}
                                                    </td>
                                                    <td className={`py-2 px-2 font-mono text-[11px] text-center ${isPerfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                        {varEndings?.perfective || '—'}
                                                    </td>
                                                    <td className={`py-2 px-2 font-mono text-[11px] text-center ${isImpDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                        {varEndings?.imperative || '—'}
                                                    </td>
                                                    <td className={`py-2 px-2 font-mono text-[11px] text-center ${isInfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                                        {varEndings?.infinitive || '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Verbs List Section */}
                <div>
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                {selectedItem 
                                    ? `Filtered Verbs (${displayedVerbsList.length})` 
                                    : (focusedSubclass 
                                        ? `Subclass Verbs (${displayedVerbsList.length})` 
                                        : `All Class Verbs (${displayedVerbsList.length})`
                                    )
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
                            {displayedSubclasses.map((subName) => {
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
                                        {/* Subclass Section Header above verbs (in Full Class mode or when multiple subclasses exist) */}
                                        {(!focusedSubclass || subclassesList.length > 1) && (
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
