
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Menu, Globe, FileCode } from './Icons';
import { getAllWidgets, saveWidget, deleteWidget, Widget, getWidgetIcon } from '../widgetUtils';
import WidgetViewer from './WidgetViewer';
import { Modal, SourceBadge, UserAuthButton } from './UI';
import { usePackageManager } from './PackageManagerContext';

const WidgetsTab = ({ onShowSettings }: { onShowSettings?: () => void }) => {
    const { packages, getPackageColor } = usePackageManager();
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [selectedWidget, setSelectedWidget] = useState<Widget | null>(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<'file' | 'url'>('file');
    const [widgetName, setWidgetName] = useState('');
    const [widgetUrl, setWidgetUrl] = useState('');
    const [widgetIcon, setWidgetIcon] = useState('📄');
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

    const handleModeSwitch = (mode: 'file' | 'url') => {
        setImportMode(mode);
        if (mode === 'file' && widgetIcon === '🌐') {
            setWidgetIcon('📄');
        } else if (mode === 'url' && widgetIcon === '📄') {
            setWidgetIcon('🌐');
        }
    };

    const handleImport = async () => {
        const cleanIcon = widgetIcon.trim() || (importMode === 'file' ? '📄' : '🌐');
        if (importMode === 'file') {
            if (!importFile) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                if (e.target?.result) {
                    const content = e.target.result as string;
                    const name = widgetName.trim() || importFile.name.replace(/\.html$/i, '');
                    await saveWidget(name, content, undefined, cleanIcon);
                    resetImport();
                    loadWidgets();
                }
            };
            reader.readAsText(importFile);
        } else {
            if (!widgetName.trim() || !widgetUrl.trim()) return;
            // Ensure URL starts with http/https
            let finalUrl = widgetUrl.trim();
            if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
                finalUrl = 'https://' + finalUrl;
            }
            await saveWidget(widgetName.trim(), '', finalUrl, cleanIcon);
            resetImport();
            loadWidgets();
        }
    };

    const resetImport = () => {
        setShowImportModal(false);
        setImportFile(null);
        setWidgetName('');
        setWidgetUrl('');
        setWidgetIcon('📄');
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
                    <div className="flex flex-col gap-3">
                        {widgets.map((w) => {
                            const iconChar = getWidgetIcon(w);
                            const isBuiltIn = !!w.isBuiltIn;
                            const isPackage = !isBuiltIn && !!w.packageId;
                            const pkg = isPackage ? packages.find(p => p.id === w.packageId) : null;
                            const pkgColor = isPackage ? (getPackageColor(w.packageId!) || pkg?.color || '#ef4444') : undefined;

                            let iconBoxClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
                            let iconBoxStyle: React.CSSProperties = {};

                            if (isBuiltIn) {
                                iconBoxClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700";
                            } else if (isPackage && pkgColor) {
                                iconBoxClass = "border";
                                iconBoxStyle = {
                                    backgroundColor: `${pkgColor}20`,
                                    color: pkgColor,
                                    borderColor: `${pkgColor}40`
                                };
                            } else {
                                // User-generated
                                iconBoxClass = "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40";
                            }

                            return (
                                <div
                                    key={w.name}
                                    onClick={() => handleSelectWidget(w)}
                                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer h-16 relative group bg-white dark:bg-slate-900"
                                >
                                    <div
                                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border text-xl select-none ${iconBoxClass}`}
                                        style={iconBoxStyle}
                                    >
                                        {iconChar}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-800 dark:text-slate-200 truncate text-sm sm:text-base">{w.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {isBuiltIn && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase tracking-wide">
                                                    Built-in
                                                </span>
                                            )}
                                            {isPackage && (
                                                <SourceBadge
                                                    source={pkg?.metadata?.short_name || 'PKG'}
                                                    name={pkg?.name}
                                                    customColor={pkgColor}
                                                />
                                            )}
                                            {!isBuiltIn && !isPackage && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 uppercase tracking-wide">
                                                    Custom
                                                </span>
                                            )}
                                            {w.path && (w.path.startsWith('http://') || w.path.startsWith('https://')) && (
                                                <span className="text-[11px] text-slate-400 truncate hidden sm:inline">
                                                    {w.path}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {!w.isBuiltIn && (
                                        <button
                                            onClick={(e) => handleDelete(e, w.name)}
                                            className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                            title={`Delete widget "${w.name}"`}
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
                                onClick={() => handleModeSwitch('file')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${importMode === 'file' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <FileCode size={16} /> File
                            </button>
                            <button
                                onClick={() => handleModeSwitch('url')}
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
                                    placeholder={importMode === 'file' ? (importFile ? importFile.name.replace(/\.html$/i, '') : "Enter name...") : "Enter name..."}
                                    value={widgetName}
                                    onChange={(e) => setWidgetName(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white text-sm"
                                />
                            </div>

                            {/* Widget Icon Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Icon (Emoji / 1 Char)</label>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-xl select-none shrink-0 text-amber-700 dark:text-amber-400">
                                        {widgetIcon || '📄'}
                                    </div>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="Icon (e.g. 📄, 🎮)"
                                        value={widgetIcon}
                                        onChange={(e) => setWidgetIcon(e.target.value)}
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                                    />
                                </div>
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
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleImport}
                            disabled={importMode === 'file' ? !importFile : (!widgetName.trim() || !widgetUrl.trim())}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2 transition-colors text-sm"
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
