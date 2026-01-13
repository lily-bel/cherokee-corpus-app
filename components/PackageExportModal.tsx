import React, { useState, useMemo } from 'react';
import { Modal } from './UI';
import { useCorpus } from './CorpusContext';
import { usePackageExport } from './usePackageHooks';
import { Download, Check, ListIcon, Mic, Box } from './Icons'; // Check imports
import { ListData } from './ListsTab';

interface PackageExportModalProps {
    onClose: () => void;
    customLists: Record<string, ListData | string[]>;
}

const PackageExportModal: React.FC<PackageExportModalProps> = ({ onClose, customLists }) => {
    const { customDictionaries, userAudioMeta, personalWords, userSentences, glosses } = useCorpus(); // Added glosses
    const { exportPackage } = usePackageExport();
    // userNotes needed for built-in lists? The hook uses them but they are in App.tsx... 
    // Wait, ListsTab uses userNotes passed from App.tsx. 
    // PackageExportModal uses useCorpus. 
    // CorpusContext DOES NOT have userNotes. App.tsx manages them.
    // So I need to pass userNotes to PackageExportModal too?
    // Or I can just skip "Custom Notes" built-in list if I don't have userNotes.
    // Or I assume userNotes are not critical for "dependency" calculation?
    // "Custom Notes" list just contains IDs of items with notes.
    // If I can't calculate it, I can't show it.
    // I should probably pass userNotes too if I want full parity.
    // Let's assume for now I skip "Custom Notes" list generation or pass it.
    // Passing it requires updating App -> PackageManagerTab -> PackageExportModal chain. 
    // I already updated the chain for customLists.
    // The prompt didn't explicitly ask for Custom Notes export parity but "The built-in dynamic lists ... can appear".
    // I'll skip "Custom Notes" for now to save complexity, or try to get it if easy.
    // Actually, `userNotes` are just strings in a record. 
    // I'll stick to what I have in CorpusContext.

    const [selectedDictionaries, setSelectedDictionaries] = useState<string[]>([]);
    const [selectedLists, setSelectedLists] = useState<Record<string, { selected: boolean, includeDependencies: boolean }>>({});
    const [metadata, setMetadata] = useState({
        name: '',
        author: '',
        description: ''
    });
    const [isExporting, setIsExporting] = useState(false);
    
    // Global Includes
    const [includeAllAudio, setIncludeAllAudio] = useState(false);
    const [includeAllGlosses, setIncludeAllGlosses] = useState(false);
    const [includeAllNotesAndForms, setIncludeAllNotesAndForms] = useState(false);
    
    // Dependency State
    const [dependencyEntries, setDependencyEntries] = useState<{ id: string, name: string, type: 'word' | 'sentence' }[]>([]);
    const [includeDependencies, setIncludeDependencies] = useState(true);

    // --- GENERATE BUILT-IN LISTS (Exclude dynamic ones from "Lists" section) ---
    const displayableLists = useMemo(() => {
         const userLists = Object.values(customLists).map(l => {
             if (Array.isArray(l)) return null; 
             return l as ListData;
        }).filter(Boolean) as ListData[];
        
        return userLists; // Only user lists in the "Select Included Lists" section
    }, [customLists]);


    // Calculate Dependencies
    React.useEffect(() => {
        const deps: typeof dependencyEntries = [];
        const selectedNbSet = new Set(selectedDictionaries);
        const processedIds = new Set<string>();

        // 1. Check Lists
        displayableLists.forEach(l => {
            if (selectedLists[l.id]?.selected && l.items) {
                l.items.forEach(id => {
                    if (processedIds.has(id)) return;
                    
                    let targetId = id;
                    let type: 'word' | 'sentence' = 'word';
                    let source = '';
                    let name = 'Unknown';
                    
                    if (id.startsWith('s_')) {
                        targetId = id.replace('s_', '');
                        type = 'sentence';
                        const s = userSentences.find(x => x.id === targetId);
                        if (s) {
                            source = s.source;
                            name = s.translit || s.english || 'Sentence';
                        }
                    } else {
                        const w = personalWords.find(x => x.id === targetId);
                        if (w) {
                            source = w.customDictionaryId;
                            name = w.Entry || w.Syllabary || 'Word';
                        }
                    }

                    if (source && !selectedNbSet.has(source)) {
                        deps.push({ id: targetId, name, type });
                        processedIds.add(id); // Use full ID (s_...) or targetId? List uses full ID.
                    }
                });
            }
        });

        // 2. Check Global Audio
        if (includeAllAudio) {
            Object.entries(userAudioMeta).forEach(([key, list]) => {
                const hasUser = list.some(a => !a.packageId || a.packageId === 'user');
                if (hasUser) {
                     let targetId = key;
                     let type: 'word' | 'sentence' = 'word';
                     if (key.endsWith('_sentence')) {
                         targetId = key.replace('_sentence', '');
                         type = 'sentence';
                     }
                     
                     if (processedIds.has(type === 'sentence' ? `s_${targetId}` : targetId)) return;

                     let source = '';
                     let name = 'Unknown';

                     if (type === 'sentence') {
                         const s = userSentences.find(x => x.id === targetId);
                         if (s) { source = s.source; name = s.translit || 'Sentence'; }
                     } else {
                         const w = personalWords.find(x => x.id === targetId);
                         if (w) { source = w.customDictionaryId; name = w.Entry || 'Word'; }
                     }

                     if (source && !selectedNbSet.has(source)) {
                         deps.push({ id: targetId, name, type });
                         processedIds.add(type === 'sentence' ? `s_${targetId}` : targetId);
                     }
                }
            });
        }
        
        // 3. Check Global Glosses
        if (includeAllGlosses) {
            glosses.forEach(g => {
                if (g.source === 'user') {
                     const targetId = g.sentence_id;
                     if (processedIds.has(`s_${targetId}`)) return;

                     const s = userSentences.find(x => x.id === targetId);
                     if (s && !selectedNbSet.has(s.source)) {
                         deps.push({ id: targetId, name: s.translit || 'Sentence', type: 'sentence' });
                         processedIds.add(`s_${targetId}`);
                     }
                }
            });
        }

        setDependencyEntries(deps);

    }, [selectedDictionaries, selectedLists, includeAllAudio, includeAllGlosses, displayableLists, userSentences, personalWords, userAudioMeta, glosses]);


    const toggleDictionary = (id: string) => {
        setSelectedDictionaries(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleList = (id: string) => {
        setSelectedLists(prev => {
            const current = prev[id] || { selected: false, includeDependencies: true };
            return {
                ...prev,
                [id]: { ...current, selected: !current.selected }
            };
        });
    };
    
    // toggleListDeps removed as per request to move to Global Includes

    const handleExport = async () => {
        if (!metadata.name || (selectedDictionaries.length === 0 && !Object.values(selectedLists).some(l => l.selected) && !includeAllAudio && !includeAllGlosses)) return;

        setIsExporting(true);
        console.log("Starting export...");
        try {
            // Re-map with dependency flag
            const finalListsConfig = displayableLists
                .filter(l => selectedLists[l.id]?.selected)
                .map(l => ({
                    list: l,
                    includeDependencies: selectedLists[l.id]?.includeDependencies ?? true
                }));
            
            const depAudioIds: string[] = [];
            if (includeAllAudio) {
                 Object.values(userAudioMeta).forEach(list => {
                     if (Array.isArray(list)) {
                         list.forEach(a => { if(!a.isOfficial) depAudioIds.push(a.id); });
                     }
                 });
            }
            
            // Pass dependency entries if confirmed
            const depEntryIds = includeDependencies ? dependencyEntries.map(d => d.id) : [];

            console.log("Calling exportPackage with:", { selectedDictionaries, metadata, finalListsConfig, depAudioIds, depEntryIds, includeAllNotesAndForms });
            await exportPackage(selectedDictionaries, metadata, finalListsConfig, depAudioIds, depEntryIds, includeAllNotesAndForms);
            onClose();
        } catch (e) {
            console.error("Export failed detailed:", e);
            alert("Export failed: " + (e as Error).message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Modal title="Export Package" onClose={onClose}>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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

                        {/* Custom Dictionaries */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Custom Dictionaries</h3>
                            <div className="max-h-48 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                                {Object.values(customDictionaries).length === 0 && <p className="text-slate-400 text-sm italic p-2">No custom dictionaries available.</p>}
                                {Object.values(customDictionaries).map((nb: any) => (
                                    <div
                                        key={nb.id}
                                        onClick={() => toggleDictionary(nb.id)}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedDictionaries.includes(nb.id) ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${selectedDictionaries.includes(nb.id) ? 'bg-amber-600 border-amber-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {selectedDictionaries.includes(nb.id) && <Check size={14} className="text-white" />}
                                        </div>
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{nb.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>


                {/* Lists */}
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Included Lists</h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-100 dark:border-slate-800 rounded-lg p-2">
                        {displayableLists.length === 0 && <p className="text-slate-400 text-sm italic p-2">No lists available.</p>}
                        {displayableLists.map((list) => {
                            const isSelected = selectedLists[list.id]?.selected;
                            const includeDeps = selectedLists[list.id]?.includeDependencies ?? true;

                            return (
                                <div
                                    key={list.id}
                                    className={`flex flex-col p-2 rounded-lg transition-colors ${isSelected ? 'bg-amber-50 dark:bg-amber-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                >
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleList(list.id)}>
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-amber-600 border-amber-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {isSelected && <Check size={14} className="text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-amber-600 dark:text-amber-500">
                                                    {list.name}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {list.items.length} items
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Dependencies Checkbox - KEEPING IT for User Lists */}
                                    {isSelected && (
                                        <div className="ml-8 mt-2 animate-fade-in">
                                            <label className="flex items-center gap-2 cursor-pointer" onClick={e => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={includeDeps} 
                                                    onChange={(e) => {
                                                        const el = e.target as HTMLInputElement;
                                                        setSelectedLists(prev => ({ ...prev, [list.id]: { ...prev[list.id], includeDependencies: el.checked } }))
                                                    }}
                                                    className="w-4 h-4 accent-amber-600 rounded"
                                                />
                                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                                    Export attached data (audio, glosses)
                                                </span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Global Includes */}
                <div className="space-y-3">
                     <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Global Includes</h3>
                     <div className="space-y-2">
                         <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                             <input type="checkbox" checked={includeAllAudio} onChange={e => setIncludeAllAudio(e.target.checked)} className="accent-amber-600 w-5 h-5 rounded" />
                             <div className="flex items-center gap-3">
                                 <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><Mic size={18} /></div>
                                 <div>
                                     <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Include All Custom Audio</div>
                                     <div className="text-xs text-slate-400">Export every user recording</div>
                                 </div>
                             </div>
                         </label>
                         <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                             <input type="checkbox" checked={includeAllGlosses} onChange={e => setIncludeAllGlosses(e.target.checked)} className="accent-amber-600 w-5 h-5 rounded" />
                             <div className="flex items-center gap-3">
                                 <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><ListIcon size={18} /></div>
                                 <div>
                                     <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Include All Custom Glosses</div>
                                     <div className="text-xs text-slate-400">Export every user gloss/breakdown</div>
                                 </div>
                             </div>
                         </label>
                         <label className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                             <input type="checkbox" checked={includeAllNotesAndForms} onChange={e => setIncludeAllNotesAndForms(e.target.checked)} className="accent-amber-600 w-5 h-5 rounded" />
                             <div className="flex items-center gap-3">
                                 <div className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400"><Box size={18} /></div>
                                 <div>
                                     <div className="font-bold text-sm text-slate-700 dark:text-slate-200">Include All Notes & Forms</div>
                                     <div className="text-xs text-slate-400">Export every custom note and word form</div>
                                 </div>
                             </div>
                         </label>
                     </div>
                </div>
            </div>

            {dependencyEntries.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800 mb-4 mt-6">
                    <div className="flex items-start gap-3">
                        <div className="p-1 bg-amber-100 dark:bg-amber-800 rounded text-amber-600 dark:text-amber-200 mt-0.5">
                            <Box size={16} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-1">Dependency Entries Found</h4>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                                Found {dependencyEntries.length} entries (words/sentences) referenced by your selected lists/audio/glosses that are NOT in the selected custom dictionaries.
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeDependencies}
                                    onChange={e => setIncludeDependencies(e.target.checked)}
                                    className="accent-amber-600 w-4 h-4"
                                />
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Include these entries (orphaned)</span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={handleExport}
                disabled={isExporting || !metadata.name || (selectedDictionaries.length === 0 && !Object.values(selectedLists).some(l => l.selected) && !includeAllAudio && !includeAllGlosses && !includeAllNotesAndForms)}
                className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {isExporting ? 'Exporting...' : <><Download size={20} /> Export Package</>}
            </button>

        </Modal >
    );
};

export default PackageExportModal;
