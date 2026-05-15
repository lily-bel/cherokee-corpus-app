import React, { useMemo } from 'react';
import { ArrowLeft, Menu } from './Icons';
import { useCorpus } from './CorpusContext';
import { renderStyledText } from '../utils';

interface ClassViewProps {
    className: string;
    onClose: () => void;
    onViewClass: (className: string) => void;
    onViewEntry: (entry: any) => void;
    onShowSettings?: () => void;
}

const ClassView: React.FC<ClassViewProps> = ({ className, onClose, onViewClass, onViewEntry, onShowSettings }) => {
    const { roots, dictionaryMap } = useCorpus();

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
        const example = roots.find(r => r.class_name === clsName && r.segmented_forms);
        if (!example || !example.segmented_forms) return null;

        const parseForm = (formStr: string) => {
            if (!formStr) return '';
            const parts = formStr.replace(/-+/g, '-').split('-');
            return parts.length > 1 ? parts[parts.length - 1] : '';
        };

        return {
            present: parseForm(example.segmented_forms.present),
            imperfective: parseForm(example.segmented_forms.imperfective),
            perfective: parseForm(example.segmented_forms.perfective),
            imperative: parseForm(example.segmented_forms.imperative),
            infinitive: parseForm(example.segmented_forms.infinitive)
        };
    };

    const parentEndings = useMemo(() => getEndings(mainClassName), [mainClassName, roots]);

    return (
        <div className="fixed inset-0 z-[10002] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden animate-fade-in font-sans">
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
                {/* Superclass Display */}
                <div className="mb-8 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Verb Superclass</div>
                        <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono">[{mainClassName}]</div>
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
                            {variations.length > 0 ? variations.map(v => {
                                const endings = getEndings(v);
                                if (!endings) return null;

                                return (
                                    <tr key={v} className={`group cursor-pointer hover:bg-amber-50/40 dark:hover:bg-slate-800/40 transition-colors ${v === className ? 'bg-amber-50 dark:bg-slate-900/60' : ''}`} onClick={() => onViewClass(v)}>
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
                                <tr>
                                    <td colSpan={6} className="py-4 text-center text-[10px] text-slate-400 dark:text-slate-500 italic">No variations documented</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* All Verbs Section */}
                <div>
                    <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-6">All Verbs</h3>
                    <div className="space-y-5">
                        {allVerbsInSuperclass.map((r, i) => {
                            const entry = dictionaryMap.get(r.entry_id);
                            if (!entry) return null;
                            return (
                                <div 
                                    key={i} 
                                    onClick={() => onViewEntry(entry)}
                                    className="flex items-start justify-between gap-4 group cursor-pointer border-b border-slate-100 dark:border-slate-800 pb-4 hover:bg-white dark:hover:bg-slate-900 -mx-2 px-2 rounded-lg transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-0.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
                                            {renderStyledText(entry.Definition || '')}
                                        </h4>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-noto-cherokee text-sm text-slate-500 dark:text-slate-400">{entry.Syllabary}</span>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">({entry.Entry})</span>
                                        </div>
                                    </div>
                                    {r.class_name !== mainClassName && (
                                        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold text-slate-600 dark:text-slate-300 mt-1 shrink-0 uppercase tracking-wider">
                                            {r.class_name}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClassView;
