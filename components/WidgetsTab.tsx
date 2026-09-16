
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Menu, Globe, FileCode, Sparkles, GraduationCap, BookOpen, ChevronRight } from './Icons';
import { getAllWidgets, saveWidget, deleteWidget, Widget } from '../widgetUtils';
import WidgetViewer from './WidgetViewer';
import { Modal, UserAuthButton } from './UI';

const getWidgetIconAndColor = (w: Widget) => {
    const nameLower = w.name.toLowerCase();
    if (nameLower.includes('syllabary')) {
        return {
            icon: <Sparkles size={20} />,
            bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/50',
            badgeBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
            badgeText: 'Learning'
        };
    }
    if (nameLower.includes('pronoun') || nameLower.includes('game')) {
        return {
            icon: <GraduationCap size={20} />,
            bg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/50',
            badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
            badgeText: 'Interactive'
        };
    }
    if (nameLower.includes('grammar')) {
        return {
            icon: <BookOpen size={20} />,
            bg: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 border-sky-200/50 dark:border-sky-800/50',
            badgeBg: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
            badgeText: 'Reference'
        };
    }
    if (w.path && (w.path.startsWith('http') && !w.path.includes(window.location.hostname))) {
        return {
            icon: <Globe size={20} />,
            bg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/50',
            badgeBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
            badgeText: 'External URL'
        };
    }
    return {
        icon: <FileCode size={20} />,
        bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200/50 dark:border-slate-700/50',
        badgeBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
        badgeText: w.isBuiltIn ? 'Built-in' : 'Custom HTML'
    };
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
            <div className="px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 h-12">
                <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">Widgets</h1>
                <div className="flex gap-1.5 items-center">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="bg-slate-900 dark:bg-slate-700 text-white p-1.5 rounded-full shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
                        title="Add Widget"
                    >
                        <Plus size={18} />
                    </button>
                    <UserAuthButton />
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors" title="Settings">
                            <Menu size={22} strokeWidth={1.5} />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading widgets...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {widgets.map((w) => {
                            const meta = getWidgetIconAndColor(w);
                            return (
                                <div
                                    key={w.name}
                                    onClick={() => handleSelectWidget(w)}
                                    className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-white dark:bg-slate-900 p-4 flex items-center gap-3.5 shadow-sm hover:shadow-md hover:border-amber-400/80 dark:hover:border-amber-600/80 transition-all active:scale-[0.99] cursor-pointer relative group select-none min-h-[72px]"
                                >
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg} shadow-xs`}>
                                        {meta.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate text-sm">
                                                {w.name}
                                            </h3>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${meta.badgeBg}`}>
                                                {meta.badgeText}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!w.isBuiltIn && (
                                            <button
                                                onClick={(e) => handleDelete(e, w.name)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                                                title="Delete widget"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <ChevronRight size={18} className="text-slate-300 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                                    </div>
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
