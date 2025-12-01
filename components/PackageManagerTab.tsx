import React, { useState, useRef } from 'react';
import { useCorpus } from './CorpusContext';
import { usePackageManager, Package } from './PackageManagerContext';
import { usePackageImport } from './usePackageHooks';
import PackageExportModal from './PackageExportModal';
import { Upload, Download, Trash2, ToggleLeft, ToggleRight, Box } from './Icons';
import { Toast } from './UI';

const PackageManagerTab: React.FC = () => {
    const { packages, togglePackage, removePackage } = usePackageManager();
    const { importPackage } = usePackageImport();
    const { personalWords, userSentences } = useCorpus();

    const [showExportModal, setShowExportModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            const colors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];
            const color = colors[Math.floor(Math.random() * colors.length)];

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

    const PackageItem = ({ pkg }: { pkg: Package }) => {
        const isOfficial = pkg.type === 'official';
        const isUser = pkg.type === 'user';

        const wordCount = isUser ? personalWords.length : (pkg.metadata?.stats?.words || 0);
        const sentCount = isUser ? userSentences.length : (pkg.metadata?.stats?.sentences || 0);

        return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm" style={{ backgroundColor: pkg.color }}>
                            {pkg.type === 'official' ? 'OF' : (pkg.type === 'user' ? 'MY' : pkg.name.substring(0, 2).toUpperCase())}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100">{pkg.name}</h3>
                            <p className="text-xs text-slate-400">{pkg.metadata?.description || (isOfficial ? "Official Cherokee Data" : "Your personal data")}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => togglePackage(pkg.id)}
                        className={`transition-colors ${pkg.status === 'active' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'}`}
                    >
                        {pkg.status === 'active' ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}
                    </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <span>{wordCount} words</span>
                        <span>{sentCount} sentences</span>
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
                    {packages.filter(p => p.type === 'official').map(p => <PackageItem key={p.id} pkg={p} />)}
                </div>

                {/* User Library */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">My Library</h3>
                    {packages.filter(p => p.type === 'user').map(p => <PackageItem key={p.id} pkg={p} />)}
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
                    {packages.filter(p => p.type === 'imported').map(p => <PackageItem key={p.id} pkg={p} />)}
                </div>
            </div>

            {showExportModal && <PackageExportModal onClose={() => setShowExportModal(false)} />}
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

export default PackageManagerTab;
