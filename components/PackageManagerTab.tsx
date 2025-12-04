import React, { useState, useRef } from 'react';
import { useCorpus } from './CorpusContext';
import { usePackageManager, Package } from './PackageManagerContext';
import { usePackageImport } from './usePackageHooks';
import PackageExportModal from './PackageExportModal';
import { Upload, Download, Trash2, ToggleLeft, ToggleRight, Box, Mic, StickyNote, ListIcon } from './Icons';
import { Toast, AudioPlayer, SourceBadge } from './UI';

const PackageManagerTab: React.FC = () => {
    const { packages, togglePackage, removePackage, updatePackageColor } = usePackageManager();
    const { importPackage } = usePackageImport();
    const { personalWords, userSentences, removePackageAudio, userAudioMeta } = useCorpus();

    const [showExportModal, setShowExportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [colorPicker, setColorPicker] = useState<{ show: boolean, pkgId: string | null }>({ show: false, pkgId: null });

    const showToast = (message: string, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            // Generate a random color for the package
            const color = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];

            await importPackage(file, color);
            showToast(`Imported ${file.name}`);
        } catch (err) {
            console.error(err);
            showToast("Import failed: " + (err as Error).message, 'error');
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950">
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h2 className="font-noto-serif text-2xl font-bold text-slate-800 dark:text-slate-100">Packages</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowExportModal(true)}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Export Package"
                    >
                        <Upload size={20} />
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md hover:bg-slate-800 transition-colors"
                        title="Import Package"
                    >
                        <Download size={20} />
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".zip"
                        onChange={handleImport}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Official Packages */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Official Sources</h3>
                    {packages.filter(p => p.type === 'official').map(p => <PackageItem key={p.id} pkg={p} onColorClick={(id) => setColorPicker({ show: true, pkgId: id })} showToast={showToast} togglePackage={togglePackage} removePackage={removePackage} />)}
                </div>

                {/* User Library */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">My Library</h3>
                    {packages.filter(p => p.type === 'user').map(p => {
                        // Calculate actual user audio count
                        const userAudioCount = Object.values(userAudioMeta || {}).reduce((acc, list) => acc + list.length, 0);
                        const pkgWithStats = {
                            ...p,
                            metadata: {
                                ...p.metadata,
                                stats: {
                                    ...p.metadata.stats,
                                    audio_files: userAudioCount
                                }
                            }
                        };
                        return <PackageItem key={p.id} pkg={pkgWithStats} onColorClick={(id) => setColorPicker({ show: true, pkgId: id })} showToast={showToast} togglePackage={togglePackage} removePackage={removePackage} />;
                    })}
                </div>

                {/* Imported Packages */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Imported Packages</h3>
                    {packages.filter(p => p.type === 'imported').length === 0 && (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
                            <Box size={32} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No imported packages.</p>
                        </div>
                    )}
                    {packages.filter(p => p.type === 'imported').map(p => (
                        <PackageItem
                            key={p.id}
                            pkg={p}
                            onColorClick={(id) => setColorPicker({ show: true, pkgId: id })}
                            showToast={showToast}
                            togglePackage={togglePackage}
                            removePackage={(id) => {
                                removePackageAudio(id);
                                removePackage(id);
                            }}
                        />
                    ))}
                </div>
            </div>

            {showExportModal && <PackageExportModal onClose={() => setShowExportModal(false)} />}
            {colorPicker.show && colorPicker.pkgId && (
                <ColorPickerModal pkgId={colorPicker.pkgId} onClose={() => setColorPicker({ show: false, pkgId: null })} />
            )}
            <Toast show={toast.show} message={toast.message} type={toast.type} />

            {importing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="font-bold text-slate-700 dark:text-slate-200">Importing Package...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const PRESET_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#64748b', '#71717a', '#737373'
];

const ColorPickerModal = ({ pkgId, onClose }: { pkgId: string, onClose: () => void }) => {
    const { packages, updatePackageColor } = usePackageManager();
    const pkg = packages.find(p => p.id === pkgId);

    if (!pkg) return null;

    const isLocked = pkg.metadata?.locked === 'yes' || pkg.type === 'official' || pkg.type === 'user';
    const usedColors = new Set(packages.map(p => p.color));

    // Mock Audio Player Style for Preview
    const PreviewAudioButton = ({ color }: { color: string }) => (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm text-white" style={{ backgroundColor: color }}>
            <Mic size={16} /> <span>Audio</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-scale-in border dark:border-slate-800" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Package Color</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <Box size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm transition-colors duration-300" style={{ backgroundColor: pkg.color }}>
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm transition-colors duration-300" style={{ backgroundColor: pkg.color }}>
                            {(pkg.name.split(' ').length > 1 ? (pkg.name.split(' ')[0][0] + pkg.name.split(' ')[1][0]).toUpperCase() : pkg.name.substring(0, 2).toUpperCase())}
                        </div>
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">{pkg.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Preview of package icon</div>
                    </div>
                </div>

                {/* UI PREVIEWS */}
                <div className="mb-6 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">UI Previews</h4>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-wrap gap-4 items-center justify-center">
                        {/* Source Badge Preview */}
                        <SourceBadge source="DICT" name="DICT" customColor={pkg.color} />

                        {/* Audio Button Preview */}
                        <PreviewAudioButton color={pkg.color} />

                        {/* Icons Preview */}
                        <div className="flex gap-2 text-slate-400">
                            <Mic size={20} style={{ color: pkg.color }} />
                            <StickyNote size={20} style={{ color: pkg.color }} />
                            <ListIcon size={20} style={{ color: pkg.color }} />
                        </div>
                    </div>
                </div>

                {isLocked ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-xl text-sm flex items-center gap-2 mb-4">
                        <Box size={16} />
                        <span>This package's color is locked and cannot be changed.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-5 gap-3 mb-4">
                        {PRESET_COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => updatePackageColor(pkg.id, c)}
                                className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center transition-transform hover:scale-110 ${pkg.color === c ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-slate-500' : ''}`}
                                style={{ backgroundColor: c }}
                            >
                                {pkg.color === c && <div className="w-2 h-2 bg-white rounded-full" />}
                                {usedColors.has(c) && pkg.color !== c && <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

const PackageItem = ({ pkg, onColorClick, showToast, togglePackage, removePackage }: { pkg: Package, onColorClick: (id: string) => void, showToast: (message: string, type?: string) => void, togglePackage: (id: string) => void, removePackage: (id: string) => void }) => {
    const { personalWords, userSentences } = useCorpus();
    const isOfficial = pkg.type === 'official';
    const isUser = pkg.type === 'user';
    const isLocked = pkg.metadata?.locked === 'yes' || isOfficial || isUser;

    const wordCount = isUser ? personalWords.length : (pkg.metadata?.stats?.words || 0);
    const sentCount = isUser ? userSentences.length : (pkg.metadata?.stats?.sentences || 0);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm transition-colors duration-300" style={{ backgroundColor: pkg.color }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm transition-colors duration-300" style={{ backgroundColor: pkg.color }}>
                            {(pkg.name.split(' ').length > 1 ? (pkg.name.split(' ')[0][0] + pkg.name.split(' ')[1][0]).toUpperCase() : pkg.name.substring(0, 2).toUpperCase())}
                        </div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">{pkg.name}</h3>
                        <p className="text-xs text-slate-400">{pkg.metadata?.description || (isOfficial ? "Official Cherokee Data" : "Your personal data")}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {!isLocked && (
                        <button
                            onClick={() => onColorClick(pkg.id)}
                            className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                            title="Change Color"
                        >
                            <Box size={20} />
                        </button>
                    )}
                    <button
                        onClick={() => togglePackage(pkg.id)}
                        className={`transition-colors ${pkg.status === 'active' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'}`}
                    >
                        {pkg.status === 'active' ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                    <span>{wordCount} words</span>
                    <span>{sentCount} sentences</span>
                    {pkg.metadata?.stats?.audio_files !== undefined && <span>{pkg.metadata.stats.audio_files} audio</span>}
                </div>

                {!isOfficial && !isUser && (
                    <button
                        onClick={() => {
                            if (window.confirm(`Delete package "${pkg.name}"?`)) {
                                removePackage(pkg.id);
                                showToast("Package removed");
                            }
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default PackageManagerTab;
