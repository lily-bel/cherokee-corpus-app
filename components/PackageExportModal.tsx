import React, { useState } from 'react';
import { Modal } from './UI';
import { useCorpus } from './CorpusContext';
import { usePackageExport } from './usePackageHooks';
import { Download, Check } from './Icons';

interface PackageExportModalProps {
    onClose: () => void;
}

const PackageExportModal: React.FC<PackageExportModalProps> = ({ onClose }) => {
    const { notebooks, userAudioMeta, personalWords, userSentences } = useCorpus();
    const { exportPackage } = usePackageExport();

    const [selectedNotebooks, setSelectedNotebooks] = useState<string[]>([]);
    const [metadata, setMetadata] = useState({
        name: '',
        author: '',
        description: ''
    });
    const [isExporting, setIsExporting] = useState(false);
    const [dependencyAudio, setDependencyAudio] = useState<{ id: string, speaker: string, targetName: string, targetSource: string }[]>([]);
    const [includeDependencies, setIncludeDependencies] = useState(false);

    // Calculate Dependencies when selection changes
    React.useEffect(() => {
        if (selectedNotebooks.length === 0) {
            setDependencyAudio([]);
            return;
        }

        const deps: typeof dependencyAudio = [];
        const selectedSet = new Set(selectedNotebooks);

        // Scan all user audio
        Object.entries(userAudioMeta).forEach(([key, audioList]) => {
            // Check if this key belongs to a selected notebook
            let isSelected = false;
            let targetName = '';
            let targetSource = '';

            if (key.endsWith('_sentence')) {
                const sId = key.replace('_sentence', '');
                const s = userSentences.find(x => x.id === sId);
                if (s) {
                    if (selectedSet.has(s.source)) isSelected = true;
                    targetName = s.english || s.translit || 'Sentence';
                    targetSource = notebooks[s.source]?.name || s.source;
                }
            } else {
                // Word
                const w = personalWords.find(x => x.id === key);
                if (w) {
                    if (selectedSet.has(w.notebookId)) isSelected = true;
                    targetName = w.Entry || w.Syllabary || 'Word';
                    targetSource = notebooks[w.notebookId]?.name || 'Unknown';
                } else {
                    // Might be attached to an official word?
                    // If we can't find it in personalWords, it might be an official word ID.
                    // We don't have easy access to ALL official words here without scanning `dictionary`.
                    // But if it's not in personalWords, it's NOT in a user notebook (unless it's a bug).
                    // So it IS a dependency if it exists.
                    // Let's try to find it in the full dictionary if possible, or just assume it's external.
                    // Wait, `userAudioMeta` keys are IDs.
                    // If I attached audio to an official word, the key is the official word ID.
                    // That ID is NOT in `personalWords`.
                    // So `isSelected` is false.
                    // So it IS a dependency.
                    targetName = 'External Entry (' + key + ')';
                    targetSource = 'External Source';
                }
            }

            if (!isSelected) {
                // This audio is attached to something NOT in the selected notebooks.
                audioList.forEach(a => {
                    if (!a.isOfficial) {
                        deps.push({ id: a.id, speaker: a.speaker, targetName, targetSource });
                    }
                });
            }
        });

        setDependencyAudio(deps);
    }, [selectedNotebooks, userAudioMeta, personalWords, userSentences, notebooks]);

    const toggleNotebook = (id: string) => {
        setSelectedNotebooks(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExport = async () => {
        if (!metadata.name || selectedNotebooks.length === 0) return;

        setIsExporting(true);
        try {
            const depIds = includeDependencies ? dependencyAudio.map(d => d.id) : [];
            await exportPackage(selectedNotebooks, metadata, depIds);
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
            </div>

            {dependencyAudio.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                        <div className="p-1 bg-amber-100 dark:bg-amber-800 rounded text-amber-600 dark:text-amber-200 mt-0.5">
                            <Download size={16} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">Dependency Audio Found</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                                Found {dependencyAudio.length} audio recordings attached to entries outside the selected notebooks (e.g. on official words).
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeDependencies}
                                    onChange={e => setIncludeDependencies(e.target.checked)}
                                    className="accent-amber-600 w-4 h-4"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Include these recordings</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={handleExport}
                disabled={isExporting || !metadata.name || selectedNotebooks.length === 0}
                className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isExporting ? 'Exporting...' : <><Download size={20} /> Export Package</>}
            </button>

        </Modal >
    );
};

export default PackageExportModal;
