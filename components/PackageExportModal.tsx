import React, { useState } from 'react';
import { Modal } from './UI';
import { useCorpus } from './CorpusContext';
import { usePackageExport } from './usePackageHooks';
import { Download, Check } from './Icons';

interface PackageExportModalProps {
    onClose: () => void;
}

const PackageExportModal: React.FC<PackageExportModalProps> = ({ onClose }) => {
    const { notebooks } = useCorpus();
    const { exportPackage } = usePackageExport();

    const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
    const [metadata, setMetadata] = useState({
        name: '',
        author: '',
        description: ''
    });
    const [isExporting, setIsExporting] = useState(false);

    const toggleNotebook = (id: string) => {
        setSelectedNotebooks(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExport = async () => {
        if (!metadata.name || selectedNotebooks.length === 0) return;

        setIsExporting(true);
        try {
            await exportPackage(selectedNotebooks, metadata);
            onClose();
        } catch (e) {
            console.error("Export failed", e);
            alert("Export failed: " + (e as Error).message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal title="Export Package" onClose={onClose}>
            <div className="space-y-6">
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Package Metadata</h3>
                    <input
                        type="text"
                        placeholder="Package Name"
                        value={metadata.name}
                        onChange={e => setMetadata({ ...metadata, name: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                    />
                    <input
                        type="text"
                        placeholder="Author"
                        value={metadata.author}
                        onChange={e => setMetadata({ ...metadata, author: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                    />
                    <textarea
                        placeholder="Description"
                        value={metadata.description}
                        onChange={e => setMetadata({ ...metadata, description: e.target.value })}
                        rows={3}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 resize-none dark:text-white"
                    />
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Notebooks</h3>
                    <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 rounded-lg p-2">
                        {Object.values(notebooks).length === 0 && <p className="text-slate-400 text-sm italic p-2">No notebooks available.</p>}
                        {Object.values(notebooks).map((nb: any) => (
                            <div
                                key={nb.id}
                                onClick={() => toggleNotebook(nb.id)}
                                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedNotebooks.includes(nb.id) ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedNotebooks.includes(nb.id) ? 'bg-amber-600 border-amber-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {selectedNotebooks.includes(nb.id) && <Check size={14} className="text-white" />}
                                </div>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{nb.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    disabled={isExporting || !metadata.name || selectedNotebooks.length === 0}
                    className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isExporting ? 'Exporting...' : <><Download size={20} /> Export Package</>}
                </button>
            </div>
        </Modal>
    );
};

export default PackageExportModal;
