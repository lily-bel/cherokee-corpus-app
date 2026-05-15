
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Box, Menu, Globe, FileCode } from './Icons';
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

const WidgetsTab = ({ onShowSettings }: { onShowSettings?: () => void }) => {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'file' | 'url'>('file');
    const [widgetName, setWidgetName] = useState('');
    const [widgetUrl, setWidgetUrl] = useState('');
    const [loading, setLoading] = useState(true);

    const loadWidgets = async () => {
        setLoading(true);
        try {
            const all = await getAllWidgets();
            setWidgets(all);

            // Initial sync from URL parameter
            const params = new URLSearchParams(window.location.search);
            const widgetNameParam = params.get('widget');
            if (widgetNameParam) {
                const found = all.find(w => w.name === widgetNameParam);
                if (found) setSelectedWidget(found);
            }
        } catch (e) {
            console.error("Failed to load widgets", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWidgets();
    }, []);

    // Listen for browser back/forward navigation
    useEffect(() => {
        const handleUrlChange = () => {
            const params = new URLSearchParams(window.location.search);
            const widgetNameParam = params.get('widget');
            if (widgetNameParam) {
                setWidgets(prev => {
                    const found = prev.find(w => w.name === widgetNameParam);
                    if (found) setSelectedWidget(found);
                    return prev;
                });
            } else {
                setSelectedWidget(null);
            }
        };

        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    const handleSelectWidget = (w: Widget) => {
        const params = new URLSearchParams(window.location.search);
        params.set('widget', w.name);
        window.history.pushState({}, '', '?' + params.toString());
        window.dispatchEvent(new PopStateEvent('popstate'));
        setSelectedWidget(w);
    };

    const handleCloseWidget = () => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('widget')) {
            params.delete('widget');
            const search = params.toString();
            window.history.pushState({}, '', search ? '?' + search : window.location.pathname);
            window.dispatchEvent(new PopStateEvent('popstate'));
        }
        setSelectedWidget(null);
    };

    const handleImport = async () => {
        if (importMode === 'file') {
            if (!importFile) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                if (e.target?.result) {
                    const content = e.target.result as string;
                    const name = widgetName || importFile.name.replace('.html', '');
                    await saveWidget(name, content);
                    resetImport();
                    loadWidgets();
                }
            };
            reader.readAsText(importFile);
        } else {
            if (!widgetName || !widgetUrl) return;
            // Ensure URL starts with http/https
            let finalUrl = widgetUrl;
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }
            await saveWidget(widgetName, '', finalUrl);
            resetImport();
            loadWidgets();
        }
    };

    const resetImport = () => {
        setShowImportModal(false);
        setImportFile(null);
        setWidgetName('');
        setWidgetUrl('');
        setImportMode('file');
    };

    const handleDelete = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Delete widget "${name}"?`)) {
            await deleteWidget(name);
            loadWidgets();
        }
    };

    if (selectedWidget) {
        return <WidgetViewer widget={selectedWidget} onClose={handleCloseWidget} />;
    }

    return (
        <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Widgets</h1>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                    >
                        <Plus size={20} />
                    </button>
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                            <Menu size={24} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
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
                                    onClick={() => handleSelectWidget(w)}
                                    className={`
                                        rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-4 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer h-16 relative group bg-white dark:bg-slate-900
                                    `}
                                >
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                                        {w.path && (w.path.startsWith('http') && !w.path.includes(window.location.hostname)) ? <Globe size={20} /> : <Box size={20} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate">{w.name}</h3>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400">{w.isBuiltIn ? 'Built-in' : (w.path ? 'External' : 'Custom')}</p>
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
                <Modal title="Add Widget" onClose={resetImport}>
                    <div className="space-y-4">
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button
                                onClick={() => setImportMode('file')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'file' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <FileCode size={16} /> File
                            </button>
                            <button
                                onClick={() => setImportMode('url')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'url' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Globe size={16} /> URL
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Widget Name</label>
                                <input
                                    type="text"
                                    placeholder={importMode === 'file' ? (importFile ? importFile.name.replace('.html', '') : "Enter name...") : "Enter name..."}
                                    value={widgetName}
                                    onChange={(e) => setWidgetName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                                />
                            </div>

                            {importMode === 'file' ? (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">HTML File</label>
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
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">URL</label>
                                    <input
                                        type="text"
                                        placeholder="https://example.com"
                                        value={widgetUrl}
                                        onChange={(e) => setWidgetUrl(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={importMode === 'file' ? !importFile : (!widgetName || !widgetUrl)}
                            className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            Add Widget
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default WidgetsTab;
