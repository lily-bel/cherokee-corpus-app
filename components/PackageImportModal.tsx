import React, { useState, useEffect, useRef } from 'react';
import { usePackageManager } from './PackageManagerContext';
import { usePackageImport } from './usePackageHooks';
import { Download, Upload, Check, Box, Book, BookOpen, ListIcon, X } from './Icons';

interface CatalogItem {
    id: string;
    name: string;
    short_name?: string;
    author: string;
    description: string;
    packageFile: string;
    stats?: {
        sentences?: number;
        stories?: number;
        words?: number;
        glosses?: number;
    };
    color?: string;
    autoInstall?: boolean;
}

const FALLBACK_CATALOG: CatalogItem[] = [
    {
        id: 'cherokee-new-testament',
        name: 'Cherokee New Testament',
        short_name: 'BIBLE',
        author: 'American Bible Society',
        description: 'Full text of the Cherokee New Testament (27 books, 260 chapters).',
        packageFile: 'cherokee_new_testament.zip',
        stats: {
            sentences: 7957,
            stories: 27,
            glosses: 0
        },
        color: '#ef4444',
        autoInstall: true
    },
    {
        id: 'cherokee-narratives',
        name: 'Cherokee Narratives',
        short_name: 'NARR',
        author: 'Durbin Feeling, et al.',
        description: 'Stories from Cherokee Narratives (edited by Durbin Feeling).',
        packageFile: 'cherokee_narratives.zip',
        stats: {
            sentences: 361,
            stories: 17,
            glosses: 3688
        },
        color: '#14b8a6'
    }
];

interface PackageImportModalProps {
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

export const PackageImportModal: React.FC<PackageImportModalProps> = ({ onClose, onSuccess, onError }) => {
    const { packages } = usePackageManager();
    const { importPackage } = usePackageImport();

    const [activeTab, setActiveTab] = useState<'catalog' | 'file'>('catalog');
    const [catalog, setCatalog] = useState<CatalogItem[]>(FALLBACK_CATALOG);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch catalog on mount if available
    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                const res = await fetch(`${import.meta.env.BASE_URL}packages/catalog.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        setCatalog(data);
                    }
                }
            } catch {
                // Fallback to FALLBACK_CATALOG
            }
        };
        fetchCatalog();
    }, []);

    const isInstalled = (pkgId: string) => {
        return packages.some(p => p.id === pkgId);
    };

    const handleInstallFromCatalog = async (item: CatalogItem) => {
        if (isInstalled(item.id)) return;

        setDownloadingId(item.id);
        try {
            const url = `${import.meta.env.BASE_URL}packages/${item.packageFile}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to fetch package file (${res.status} ${res.statusText})`);
            }

            const blob = await res.blob();
            const file = new File([blob], item.packageFile, { type: 'application/zip' });
            const color = item.color || '#10b981';

            await importPackage(file, color);
            onSuccess(`Installed "${item.name}" package!`);
            onClose();
        } catch (err: any) {
            console.error('Catalog install error:', err);
            onError('Installation failed: ' + (err?.message || 'unknown error'));
        } finally {
            setDownloadingId(null);
        }
    };

    const handleFileChosen = async (file: File) => {
        if (!file) return;
        setDownloadingId('file_upload');
        try {
            const PRESET_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];
            const randomColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
            await importPackage(file, randomColor);
            onSuccess(`Imported "${file.name}" successfully!`);
            onClose();
        } catch (err: any) {
            console.error('File import error:', err);
            onError('Import failed: ' + (err?.message || 'invalid package zip'));
        } finally {
            setDownloadingId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.name.endsWith('.zip')) {
            handleFileChosen(file);
        } else {
            onError('Please upload a valid .zip package file.');
        }
    };

    return (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] animate-in zoom-in-95"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <Box size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">Package Manager</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Add materials, stories, and dictionaries</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-white dark:bg-slate-900 shrink-0">
                    <button
                        onClick={() => setActiveTab('catalog')}
                        className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'catalog'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <BookOpen size={16} />
                        <span>Browse Packages</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('file')}
                        className={`flex items-center gap-2 py-3 px-4 font-bold text-sm border-b-2 transition-all ${
                            activeTab === 'file'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <Upload size={16} />
                        <span>Upload File</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {activeTab === 'catalog' ? (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                Available Supplementary Packages & Reading Materials
                            </div>
                            {catalog.filter(item => !isInstalled(item.id)).length === 0 ? (
                                <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                                        <Check size={24} />
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                                        All Supplementary Packages Installed
                                    </h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                                        All built-in optional packages are currently installed. If you delete a package from the Package Manager, it will reappear here for reinstallation.
                                    </p>
                                </div>
                            ) : (
                                catalog.filter(item => !isInstalled(item.id)).map(item => {
                                    const isDownloading = downloadingId === item.id;

                                    return (
                                        <div
                                            key={item.id}
                                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col gap-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                                                            {item.name}
                                                        </h3>
                                                        <span
                                                            className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full text-white"
                                                            style={{ backgroundColor: item.color || '#ef4444' }}
                                                        >
                                                            {item.short_name || 'PKG'}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                                        Author: {item.author}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleInstallFromCatalog(item)}
                                                    disabled={isDownloading}
                                                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shrink-0 shadow-sm hover:shadow transition-all disabled:opacity-50"
                                                >
                                                    <Download size={14} className={isDownloading ? 'animate-bounce' : ''} />
                                                    <span>{isDownloading ? 'Installing...' : 'Install'}</span>
                                                </button>
                                            </div>

                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                                {item.description}
                                            </p>

                                            {item.stats && (
                                                <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
                                                    {item.stats.stories !== undefined && (
                                                        <span className="flex items-center gap-1">
                                                            <Book size={12} /> {item.stats.stories} Stories
                                                        </span>
                                                    )}
                                                    {item.stats.sentences !== undefined && (
                                                        <span className="flex items-center gap-1">
                                                            <BookOpen size={12} /> {item.stats.sentences} Sentences
                                                        </span>
                                                    )}
                                                    {item.stats.glosses !== undefined && item.stats.glosses > 0 && (
                                                        <span className="flex items-center gap-1">
                                                            <ListIcon size={12} /> {item.stats.glosses} Glosses
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                                    isDragging
                                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-900/10'
                                        : 'border-slate-300 dark:border-slate-700 hover:border-amber-400 bg-slate-50/50 dark:bg-slate-800/30'
                                }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                                    <Upload size={24} />
                                </div>
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-sm mb-1">
                                    Click to select a Package ZIP file
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    or drag and drop your exported package (.zip) here if using web version.
                                </p>
                                <span className="inline-block px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm">
                                    Browse Device
                                </span>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".zip"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileChosen(file);
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/20">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
