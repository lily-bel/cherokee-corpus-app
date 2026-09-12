import React, { useMemo } from 'react';
import { ArrowLeft, Menu } from './Icons';
import { UserAuthButton } from './UI';
import { useCorpus } from './CorpusContext';
import VerbPreview from './VerbPreview';
import { isEmptyRoot } from '../utils';

interface RootViewProps {
    slug: string;
    onClose: () => void;
    onViewEntry: (entry: any) => void;
    onViewClass: (className: string) => void;
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

const RootView: React.FC<RootViewProps> = ({ slug, onClose, onViewEntry, onViewClass, onViewRoot, onShowSettings, settings, style }) => {
    const { groupedRootsMap } = useCorpus();

    const rootEntries = useMemo(() => {
        if (!slug) return [];
        const direct = groupedRootsMap.get(slug);
        if (direct && direct.length > 0) return direct;
        const lower = slug.toLowerCase();
        for (const [key, entries] of groupedRootsMap.entries()) {
            if (key.toLowerCase() === lower) return entries;
        }
        return [];
    }, [slug, groupedRootsMap]);

    const rootInfo = rootEntries[0];

    if (!rootInfo) return null;

    const isRootEmpty = isEmptyRoot(rootInfo);

    return (
        <div style={style} className="fixed inset-0 z-[10001] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden font-sans">
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
                {/* Root Display */}
                <div className="mb-8 relative pl-6 mt-6">
                    <div className="absolute left-0 top-1 bottom-1 w-1 bg-amber-500 dark:bg-amber-400 rounded-full"></div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">H-Grade Root</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-noto-cherokee">
                                {isRootEmpty ? '∅' : (rootInfo.root_h ? `-${rootInfo.root_h}-` : '-')}
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">Glottal Root</div>
                            <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-noto-cherokee">
                                {isRootEmpty ? '∅' : (rootInfo.root_g ? `-${rootInfo.root_g}-` : '-')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {rootEntries.map((r) => (
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
    );
};

export default RootView;
