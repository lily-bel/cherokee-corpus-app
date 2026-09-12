import React, { useMemo } from 'react';
import { ArrowLeft, Menu } from './Icons';
import { UserAuthButton } from './UI';
import { useCorpus } from './CorpusContext';
import VerbPreview from './VerbPreview';
import { getClassEndings, ClassEndingInfo } from '../classMascots';


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

const ClassView: React.FC<ClassViewProps> = ({ className, onClose, onViewClass, onViewEntry, onViewRoot, onShowSettings, settings, style }) => {
    const { roots } = useCorpus();

    const mainClassName = className.includes('[') ? className.split('[')[0] : className;

    const variations = useMemo(() => {
        const set = new Set<string>();
        roots.forEach(r => {
            if (r.class_name && r.class_name !== mainClassName && r.class_name.startsWith(mainClassName + '[')) {
                set.add(r.class_name);
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [mainClassName, roots]);

    const allVerbsInSuperclass = useMemo(() => {
        return roots.filter(r => r.class_name && (r.class_name === mainClassName || r.class_name.startsWith(mainClassName + '[')));
    }, [mainClassName, roots]);

    const verbCountByClass = useMemo(() => {
        const counts = new Map<string, number>();
        allVerbsInSuperclass.forEach(r => {
            if (r.class_name) {
                counts.set(r.class_name, (counts.get(r.class_name) || 0) + 1);
            }
        });
        return counts;
    }, [allVerbsInSuperclass]);

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

    const parentEndings = useMemo(() => {
        return getEndings(mainClassName);
    }, [mainClassName, roots]);

    return (
        <div style={style} className="fixed inset-0 z-[10002] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden font-sans">
            {/* Standard Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm shrink-0 h-12">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full flex items-center gap-2 text-slate-700 dark:text-slate-200 transition-colors">
                        <ArrowLeft size={24} />
                        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Back</span>
                    </button>
                </div>
                <div className="flex gap-1.5 items-center">
                    <UserAuthButton />
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors" title="Settings">
                            <Menu size={22} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-24">
                {/* Superclass Display */}
                <div className="mb-8 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Verb Superclass</div>
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono">[{mainClassName}]</div>
                            {(() => {
                                const mascot = roots.find(r => r.class_name === mainClassName || r.class_name?.split('[')[0] === mainClassName)?.class_mascot;
                                return mascot ? (
                                    <div className="text-sm italic font-normal text-amber-700 dark:text-amber-400 font-serif" title="Class mascot verb">
                                        mascot: {mascot}
                                    </div>
                                ) : null;
                            })()}
                        </div>
                        <div className="mt-2 text-slate-500 dark:text-slate-400 italic text-xs">
                            {allVerbsInSuperclass.length} verbs across {variations.length + 1} variations
                        </div>

                    </div>
                </div>

                {/* Variations Table */}
                <div className="mb-10 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[400px]">
                        <thead>
                            <tr className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-200 dark:border-slate-800">
                                <th className="py-2 pr-1">Variation</th>
                                <th className="py-2 px-1 text-center">Pres</th>
                                <th className="py-2 px-1 text-center">Impf</th>
                                <th className="py-2 px-1 text-center">Perf</th>
                                <th className="py-2 px-1 text-center">Impr</th>
                                <th className="py-2 px-1 text-center">Inf</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {parentEndings && (
                                <tr 
                                    key={mainClassName} 
                                    onClick={() => onViewClass(mainClassName)}
                                    className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${mainClassName === className ? 'bg-amber-50 dark:bg-slate-900/60' : ''}`}
                                >
                                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 text-[10px] truncate pr-1 font-mono" title={mainClassName}>
                                        <span>{mainClassName}</span>
                                        <span className="ml-1 text-[9px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                            ({verbCountByClass.get(mainClassName) || 0})
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.present || '—'}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.imperfective || '—'}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.perfective || '—'}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.imperative || '—'}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.infinitive || '—'}
                                    </td>
                                </tr>
                            )}
                            {variations.length > 0 ? variations.map(v => {
                                const endings = getEndings(v);
                                if (!endings) return null;

                                const isPresDiff = Boolean(parentEndings?.present && endings.present !== parentEndings.present);
                                const isImpfDiff = Boolean(parentEndings?.imperfective && endings.imperfective !== parentEndings.imperfective);
                                const isPerfDiff = Boolean(parentEndings?.perfective && endings.perfective !== parentEndings.perfective);
                                const isImpDiff = Boolean(parentEndings?.imperative && endings.imperative !== parentEndings.imperative);
                                const isInfDiff = Boolean(parentEndings?.infinitive && endings.infinitive !== parentEndings.infinitive);

                                return (
                                    <tr 
                                        key={v} 
                                        onClick={() => onViewClass(v)}
                                        className={`group cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${v === className ? 'bg-amber-50 dark:bg-slate-900/60' : ''}`}
                                    >
                                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200 text-[10px] truncate pr-1 font-mono" title={v}>
                                            <span>{v}</span>
                                            <span className="ml-1 text-[9px] font-normal text-slate-400 dark:text-slate-500 font-sans">
                                                ({verbCountByClass.get(v) || 0})
                                            </span>
                                        </td>
                                        <td className={`py-2.5 px-1 font-mono text-[10px] text-center ${isPresDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                            {endings.present || '—'}
                                        </td>
                                        <td className={`py-2.5 px-1 font-mono text-[10px] text-center ${isImpfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                            {endings.imperfective || '—'}
                                        </td>
                                        <td className={`py-2.5 px-1 font-mono text-[10px] text-center ${isPerfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                            {endings.perfective || '—'}
                                        </td>
                                        <td className={`py-2.5 px-1 font-mono text-[10px] text-center ${isImpDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                            {endings.imperative || '—'}
                                        </td>
                                        <td className={`py-2.5 px-1 font-mono text-[10px] text-center ${isInfDiff ? 'font-bold text-amber-700 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500 opacity-60'}`}>
                                            {endings.infinitive || '—'}
                                        </td>
                                    </tr>
                                );
                            }) : (
                                !parentEndings && (
                                    <tr>
                                        <td colSpan={6} className="py-4 text-center text-[10px] text-slate-400 dark:text-slate-500 italic">No variations documented</td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>

                {/* All Verbs Section */}
                <div>
                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">All Verbs</h3>
                    <div className="space-y-6">
                        {allVerbsInSuperclass.map((r) => (
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
            </div>
        </div>
    );
};

export default ClassView;
