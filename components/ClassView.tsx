import React, { useMemo } from 'react';
import { ArrowLeft, Menu } from './Icons';
import { useCorpus } from './CorpusContext';
import VerbPreview from './VerbPreview';


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

    const getEndings = (clsName: string) => {
        const classVerbs = roots.filter(r => r.class_name === clsName && r.segmented_forms);
        if (classVerbs.length === 0) return null;

        const parseForm = (formStr: string) => {
            if (!formStr) return '';
            const parts = formStr.replace(/-+/g, '-').split('-');
            return parts.length > 1 ? parts[parts.length - 1] : formStr;
        };

        const result = {
            present: '',
            imperfective: '',
            perfective: '',
            imperative: '',
            infinitive: ''
        };

        for (const verb of classVerbs) {
            const f = verb.segmented_forms;
            if (f) {
                if (!result.present && f.present) result.present = parseForm(f.present);
                if (!result.imperfective && f.imperfective) result.imperfective = parseForm(f.imperfective);
                if (!result.perfective && f.perfective) result.perfective = parseForm(f.perfective);
                if (!result.imperative && f.imperative) result.imperative = parseForm(f.imperative);
                if (!result.infinitive && f.infinitive) result.infinitive = parseForm(f.infinitive);
            }
        }

        if (result.present || result.imperfective || result.perfective || result.imperative || result.infinitive) {
            return result;
        }
        return null;
    };

    const parentEndings = useMemo(() => {
        const baseEndings = getEndings(mainClassName);
        const result = baseEndings || {
            present: '',
            imperfective: '',
            perfective: '',
            imperative: '',
            infinitive: ''
        };

        // Fallback to any verb in the superclass to ensure all columns are filled if possible
        const superclassVerbs = roots.filter(r => r.class_name && (r.class_name === mainClassName || r.class_name.startsWith(mainClassName + '[')) && r.segmented_forms);

        const parseForm = (formStr: string) => {
            if (!formStr) return '';
            const parts = formStr.replace(/-+/g, '-').split('-');
            return parts.length > 1 ? parts[parts.length - 1] : formStr;
        };

        for (const verb of superclassVerbs) {
            const f = verb.segmented_forms;
            if (f) {
                if (!result.present && f.present) result.present = parseForm(f.present);
                if (!result.imperfective && f.imperfective) result.imperfective = parseForm(f.imperfective);
                if (!result.perfective && f.perfective) result.perfective = parseForm(f.perfective);
                if (!result.imperative && f.imperative) result.imperative = parseForm(f.imperative);
                if (!result.infinitive && f.infinitive) result.infinitive = parseForm(f.infinitive);
            }
        }

        return (result.present || result.imperfective || result.perfective || result.imperative || result.infinitive) ? result : null;
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
                                <tr key={mainClassName} className={`group transition-colors ${mainClassName === className ? 'bg-amber-50 dark:bg-slate-900/60' : ''}`}>
                                    <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 text-[10px] truncate pr-1 font-mono" title={mainClassName}>
                                        {mainClassName}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.present || ''}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.imperfective || ''}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.perfective || ''}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.imperative || ''}
                                    </td>
                                    <td className="py-2.5 px-1 font-mono text-[10px] text-slate-800 dark:text-slate-200 text-center font-semibold">
                                        {parentEndings.infinitive || ''}
                                    </td>
                                </tr>
                            )}
                            {variations.length > 0 ? variations.map(v => {
                                const endings = getEndings(v);
                                if (!endings) return null;

                                return (
                                    <tr key={v} className={`group transition-colors ${v === className ? 'bg-amber-50 dark:bg-slate-900/60' : ''}`}>
                                        <td className="py-2.5 font-medium text-slate-800 dark:text-slate-200 text-[10px] truncate pr-1 font-mono" title={v}>
                                            {v}
                                        </td>
                                        <td className="py-2.5 px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">
                                            {(endings.present !== parentEndings?.present) ? endings.present : ''}
                                        </td>
                                        <td className="py-2.5 px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">
                                            {(endings.imperfective !== parentEndings?.imperfective) ? endings.imperfective : ''}
                                        </td>
                                        <td className="py-2.5 px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">
                                            {(endings.perfective !== parentEndings?.perfective) ? endings.perfective : ''}
                                        </td>
                                        <td className="py-2.5 px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">
                                            {(endings.imperative !== parentEndings?.imperative) ? endings.imperative : ''}
                                        </td>
                                        <td className="py-2.5 px-1 font-mono text-[10px] text-slate-500 dark:text-slate-400 text-center">
                                            {(endings.infinitive !== parentEndings?.infinitive) ? endings.infinitive : ''}
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
