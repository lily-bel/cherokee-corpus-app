
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Box } from './Icons';
import { getAllWidgets, saveWidget, deleteWidget, Widget } from '../widgetUtils';
import WidgetViewer from './WidgetViewer';
import { Modal } from './UI';

const COLORS = [
    'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200',
    'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-200',
    'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200',
    'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-200',
    'bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-200',
    'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-200',
    'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-200',
    'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-200',
    'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-200',
    'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-200',
    'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-200',
    'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-200',
    'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-200',
    'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-200',
    'bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-200',
    'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-200',
    'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-200',
];

const getColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLORS.length;
    return COLORS[index];
};

const WidgetsTab = () => {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(true);

    const loadWidgets = async () => {
        setLoading(true);
        try {
            const all = await getAllWidgets();
            setWidgets(all);
        } catch (e) {
            console.error("Failed to load widgets", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWidgets();
    }, []);

    const handleImport = async () => {
        if (!importFile) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            if (e.target?.result) {
                const content = e.target.result as string;
                const name = importFile.name.replace('.html', '');
                await saveWidget(name, content);
                setShowImportModal(false);
                setImportFile(null);
                loadWidgets();
            }
        };
        reader.readAsText(importFile);
    };

    const handleDelete = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Delete widget "${name}"?`)) {
            await deleteWidget(name);
            loadWidgets();
        }
    };

    if (selectedWidget) {
        return <WidgetViewer widget={selectedWidget} onClose={() => setSelectedWidget(null)} />;
    }

    return (
        <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950">
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h2 className="font-noto-serif text-2xl font-bold text-slate-800 dark:text-slate-100">Widgets</h2>
                <button
                    onClick={() => setShowImportModal(true)}
                    className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                >
                    <Plus size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading widgets...</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {widgets.map((w) => {
                            const colorClass = getColor(w.name);
                            return (
                                <div
                                    key={w.name}
                                    onClick={() => setSelectedWidget(w)}
                                    className={`
                                        rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer h-16 relative group bg-white dark:bg-slate-900
                                    `}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                                        <Box size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{w.name}</h3>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{w.isBuiltIn ? 'Built-in' : 'Custom'}</p>
                                    </div>
                                    {!w.isBuiltIn && (
                                        <button
                                            onClick={(e) => handleDelete(e, w.name)}
                                            className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {showImportModal && (
                <Modal title="Import Widget" onClose={() => setShowImportModal(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Select an HTML file to import as a widget. It will be saved locally.
                        </p>
                        <input
                            type="file"
                            accept=".html"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="block w-full text-sm text-slate-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-sm file:font-semibold
                                file:bg-amber-50 file:text-amber-700
                                hover:file:bg-amber-100
                            "
                        />
                        <button
                            onClick={handleImport}
                            disabled={!importFile}
                            className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Import Widget
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WidgetsTab;
