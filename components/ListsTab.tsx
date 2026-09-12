import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Star, ListIcon, Trash2, Pencil, ChevronRight, ChevronDown, GripVertical, Folder, FolderPlus, ArrowLeft, Plus, X, Search, Check, Volume2, Pause, Eye, EyeOff, Mic, StickyNote, ListPlus, BookOpen, Menu } from './Icons';
import { Modal, SourceBadge, UserAuthButton } from './UI';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import { getAudioFromDB, renderStyledText, parseListName, formatListName, sanitizeListName, ColorizedCherokeeWord, VerbMorphologyTemplate } from '../utils';

export interface ListData {
    id: string;
    name: string; // "Folder|List Name" or "List Name"
    items: string[]; // Array of Entry Index/IDs
    color?: string; // 'amber' | 'slate' | hex
    type: 'user' | 'imported' | 'default' | 'builtin_audio' | 'builtin_notes' | 'builtin_glosses' | 'builtin_entries';
    packageId?: string;
    icon?: any;
}

interface ListsTabProps {
    customLists: Record<string, ListData | string[]>;
    setCustomLists: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    customListOrder: string[];
    setCustomListOrder: React.Dispatch<React.SetStateAction<string[]>>;
    favorites: string[];
    setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
    allData: any[];
    customDictionaries: any;
    userNotes: any;
    userAudioMeta: any;
    onEntryClick: (entry: any) => void;
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal' | 'modal_sentences') => any[];
    settings: any;
    openWordModal: (word?: any) => void;
    sentences?: any[];
    userSentences?: any[];
    activeListId?: string | null;
    setActiveListId?: (id: string | null) => void;
    view?: 'all' | 'detail';
    setView?: (view: 'all' | 'detail') => void;
    onReadInContext?: (sentenceId: string) => void;
    onShowSettings?: () => void;
}

const MiniAudioButton = ({ audio, isOfficial = false, color }: { audio: any, isOfficial?: boolean, color?: string }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const handlePlay = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
            return;
        }

        try {
            let url = "";
            const audioId = typeof audio === 'string' ? audio : audio.id;

            if (isOfficial) {
                url = audioId.startsWith('http') ? audioId : `https://cherokeenationdictionary.net/Audio/${audioId}`;
            } else if (audio.src) {
                url = audio.src;
            } else {
                const data = await getAudioFromDB(audioId);
                if (data) {
                    const blob = new Blob([data as Blob], { type: 'audio/mp3' });
                    url = URL.createObjectURL(blob);
                }
            }

            if (url) {
                const a = new Audio(url);
                audioRef.current = a;
                a.onplay = () => setIsPlaying(true);
                a.onended = () => {
                    setIsPlaying(false);
                    if (!isOfficial && !audio.src) URL.revokeObjectURL(url);
                };
                a.play();
            }
        } catch (err) {
            console.error("Playback failed", err);
        }
    };

    const Icon = Volume2;

    let style = {};
    let bgClass = "";

    if (isPlaying) {
        bgClass = "bg-amber-100 dark:bg-amber-900/40 text-amber-600";
    } else if (color) {
        if (color.startsWith('#')) {
            style = { backgroundColor: color, color: '#fff' };
        } else {
            bgClass = `bg-${color}-500 text-white hover:bg-${color}-600`;
        }
    } else if (isOfficial) {
        bgClass = "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-700 transition-colors";
    } else {
        bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-amber-600";
    }

    const audioId = typeof audio === 'string' ? audio : audio.id;
    const speakerName = isOfficial ? (audioId.split('_')[0] || "Official Audio") : (audio.speaker || "User Recording");

    return (
        <button
            onClick={handlePlay}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${bgClass}`}
            style={style}
            title={speakerName}
        >
            {isPlaying ? <Pause size={14} className="fill-current" /> : <Icon size={14} />}
        </button>
    );
};

const AddWordsModal = ({
    isOpen,
    onClose,
    listMode,
    activeList,
    onToggleItem,
    onPerformSearch,
    customDictionaries,
    settings
}: {
    isOpen: boolean,
    onClose: () => void,
    listMode: 'words' | 'sentences',
    activeList: ListData | null,
    onToggleItem: (id: string) => void,
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal' | 'modal_sentences') => any[],
    customDictionaries: any,
    settings?: any
}) => {
    const { getPackageColor } = usePackageManager();
    const { rootMap } = useCorpus();
    const isLinguist = settings?.dictionaryLevel === 'linguist';
    const [query, setQuery] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [limit, setLimit] = useState(50);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(query);
            setLimit(50);
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        const scope = listMode === 'words' ? 'modal' : 'modal_sentences';
        const res = onPerformSearch(searchTerm, scope);
        setResults(res);
    }, [searchTerm, onPerformSearch, listMode]);

    if (!isOpen) return null;

    const displayedResults = results.slice(0, limit);

    return (
        <Modal title={`Add ${listMode === 'words' ? 'Words' : 'Sentences'}`} onClose={onClose}>
            <div className="h-[70vh] flex flex-col gap-4">
                <div className="relative shrink-0">
                    <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                    <input
                        className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder="Search dictionary..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mr-2 pr-2">
                    {displayedResults.map(res => {
                        const isSentenceResult = listMode === 'sentences';
                        const data = isSentenceResult ? (res.item || res) : res;
                        const itemId = isSentenceResult ? `s_${data.id}` : data.Index;

                        const isInList = activeList?.items.includes(itemId);
                        const source = data.Source || data.source;
                        const rootEntry = (!isSentenceResult && data) ? (rootMap?.get(data.Index) || rootMap?.get(data.id) || rootMap?.get(data.merged_id)) : null;

                        return (
                            <div
                                key={itemId}
                                onClick={() => onToggleItem(itemId)}
                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded-lg flex justify-between items-center group transition-colors"
                            >
                                <div className="flex-1">
                                    {isLinguist && rootEntry ? (
                                        <div className="py-0.5">
                                            <VerbMorphologyTemplate
                                                rootEntry={rootEntry}
                                                showMascot={settings?.showClassMascots}
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <div className="font-serif font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 transition-colors leading-tight">
                                                    {isSentenceResult ? (data.syllabary || '') : (data.Syllabary || data.syllabary)}
                                                </div>
                                                {source && (
                                                    <SourceBadge
                                                        source={source}
                                                        name={customDictionaries?.[source]?.name}
                                                        customColor={getPackageColor(source)}
                                                    />
                                                )}
                                            </div>
                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                {isSentenceResult ? (data.translit || '') : (
                                                    <ColorizedCherokeeWord
                                                        word={data.Entry || data.translit}
                                                        entry={data}
                                                        settings={settings}
                                                    />
                                                )}
                                            </div>
                                        </>
                                    )}
                                    <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                        {isSentenceResult ? (data.english || '') : (data.Definition || data.definition)}
                                    </div>
                                </div>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInList ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                    {isInList ? <Check size={18} /> : <Plus size={18} />}
                                </div>
                            </div>
                        );
                    })}
                    {results.length > limit && (
                        <div className="pt-2 pb-2">
                            <button
                                onClick={() => setLimit(prev => prev + 50)}
                                className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                Show More ({results.length - limit} remaining)
                            </button>
                        </div>
                    )}
                    {query && results.length === 0 && (
                        <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center">
                            <Search size={32} className="mb-3 opacity-20" />
                            <p>No matches found</p>
                        </div>
                    )}
                </div>

                <div className="pt-2">
                    <button onClick={onClose} className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ListsTab: React.FC<ListsTabProps> = ({
    customLists,
    setCustomLists,
    customListOrder,
    setCustomListOrder,
    favorites,
    setFavorites,
    allData,
    customDictionaries: propCustomDictionaries,
    userAudioMeta: propUserAudioMeta,
    onEntryClick,
    onPerformSearch,
    sentences = [],
    userSentences = [],
    userNotes,
    activeListId: propActiveListId,
    setActiveListId: propSetActiveListId,
    view: propView,
    setView: propSetView,
    onReadInContext,
    onShowSettings,
    settings
}) => {
    const { getPackageColor, packages, importedData } = usePackageManager();
    const { userAudioMeta, personalWords, glosses, rootMap } = useCorpus();
    const isLinguist = settings?.dictionaryLevel === 'linguist';

    const effectiveUserAudioMeta = propUserAudioMeta || userAudioMeta;

    // Component State
    const [localView, setLocalView] = useState<'all' | 'detail'>('all');
    const view = propView !== undefined ? propView : localView;
    const setView = propSetView || setLocalView;

    const [listMode, setListMode] = useState<'words' | 'sentences'>('words');

    const [localActiveListId, setLocalActiveListId] = useState<string | null>(null);
    const activeListId = propActiveListId !== undefined ? propActiveListId : localActiveListId;
    const setActiveListId = propSetActiveListId || setLocalActiveListId;

    const [isReordering, setIsReordering] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [hiddenBuiltInLists, setHiddenBuiltInLists] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('cherokee_app_hidden_builtin_lists') || '[]');
        } catch { return []; }
    });

    const [collapsedFolders, setCollapsedFolders] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('cherokee_app_collapsed_folders') || '[]');
        } catch { return []; }
    });

    useEffect(() => {
        localStorage.setItem('cherokee_app_collapsed_folders', JSON.stringify(collapsedFolders));
    }, [collapsedFolders]);

    // --- IMPORTED LISTS ---
    const importedLists = useMemo(() => {
        const lists: ListData[] = [];
        packages.forEach(pkg => {
            if (pkg.status === 'active' && importedData[pkg.id]?.lists) {
                importedData[pkg.id].lists!.forEach((l: any) => {
                    lists.push({ ...l, color: pkg.color });
                });
            }
        });
        return lists;
    }, [packages, importedData]);

    useEffect(() => {
        localStorage.setItem('cherokee_app_hidden_builtin_lists', JSON.stringify(hiddenBuiltInLists));
    }, [hiddenBuiltInLists]);

    // Modal States
    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [newListFolder, setNewListFolder] = useState('');
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [renameFolderTarget, setRenameFolderTarget] = useState<string | null>(null);
    const [renameFolderName, setRenameFolderName] = useState('');
    const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [showAddWordsModal, setShowAddWordsModal] = useState(false);
    const [hoveredDropFolder, setHoveredDropFolder] = useState<string | null>(null);
    const [addExistingModalFolder, setAddExistingModalFolder] = useState<string | null>(null);
    const [existingSearchQuery, setExistingSearchQuery] = useState('');

    // --- GENERATE BUILT-IN LISTS (All in "Auto Lists" folder) ---
    const builtInLists = useMemo(() => {
        const audioItems: string[] = [];
        const noteItems: string[] = [];
        const glossItems: string[] = [];
        const entryItems: string[] = [];

        // 1. Audio
        Object.entries(effectiveUserAudioMeta).forEach(([key, audioList]: [string, any]) => {
            const hasUserAudio = audioList.some((a: any) => !a.packageId || a.packageId === 'user');
            if (hasUserAudio) {
                let listId = key;
                if (key.endsWith('_sentence')) {
                    const baseId = key.replace('_sentence', '');
                    listId = `s_${baseId}`;
                }

                if (!audioItems.includes(listId)) audioItems.push(listId);
            }
        });

        // 2. Custom Entries (Personal Words + User Sentences)
        personalWords.forEach(w => {
            if (w.Index && !entryItems.includes(w.Index)) entryItems.push(w.Index);
        });
        userSentences.forEach(s => {
            const listId = `s_${s.id}`;
            if (!entryItems.includes(listId)) entryItems.push(listId);
        });

        // 3. User Glosses -> Custom Glosses
        glosses.forEach(g => {
            if (g.source === 'user') {
                if (g.sentence_id) {
                    const listId = `s_${g.sentence_id}`;
                    if (!glossItems.includes(listId)) {
                        glossItems.push(listId);
                    }
                }
            }
        });

        // 4. User Notes -> Custom Notes
        if (userNotes) {
            Object.keys(userNotes).forEach(key => {
                if (!noteItems.includes(key)) noteItems.push(key);
            });
        }

        return [
            {
                id: 'builtin_audio',
                name: 'Auto Lists|Custom Audio',
                items: audioItems,
                type: 'builtin_audio',
                color: 'slate',
                icon: <Mic size={24} />
            },
            {
                id: 'builtin_notes',
                name: 'Auto Lists|Custom Notes',
                items: noteItems,
                type: 'builtin_notes',
                color: 'slate',
                icon: <StickyNote size={24} />
            },
            {
                id: 'builtin_glosses',
                name: 'Auto Lists|Custom Glosses',
                items: glossItems,
                type: 'builtin_glosses',
                color: 'slate',
                icon: <ListPlus size={24} />
            },
            {
                id: 'builtin_entries',
                name: 'Auto Lists|Custom Entries',
                items: entryItems,
                type: 'builtin_entries',
                color: 'slate',
                icon: <Pencil size={24} />
            }
        ] as ListData[];
    }, [effectiveUserAudioMeta, personalWords, userSentences, glosses, userNotes]);

    const toggleBuiltInVisibility = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHiddenBuiltInLists(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleFolderCollapse = (folderName: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCollapsedFolders(prev =>
            prev.includes(folderName) ? prev.filter(f => f !== folderName) : [...prev, folderName]
        );
    };

    // Sync Imported Lists to Order
    useEffect(() => {
        if (importedLists.length > 0) {
            setCustomListOrder(prev => {
                const newOrder = [...prev];
                let changed = false;
                importedLists.forEach(l => {
                    if (!newOrder.includes(l.id)) {
                        newOrder.push(l.id);
                        changed = true;
                    }
                });
                return changed ? newOrder : prev;
            });
        }
    }, [importedLists]);

    // --- GET LIST HELPER ---
    const getList = (id: string): ListData | null => {
        if (id === 'favorites') {
            return { id: 'favorites', name: 'Favorites', items: favorites, type: 'default', color: 'slate', icon: <Star size={24} className="fill-slate-400 dark:fill-slate-500" /> };
        }

        const builtIn = builtInLists.find(l => l.id === id);
        if (builtIn) return builtIn;

        const imported = importedLists.find(l => l.id === id);
        if (imported) return imported;

        const raw = customLists[id];
        if (!raw) return null;
        if (Array.isArray(raw)) {
            return { id, name: id, items: raw, type: 'user', color: 'amber' };
        }
        return {
            ...raw,
            items: Array.isArray(raw.items) ? raw.items : []
        } as ListData;
    };

    // Get all available lists
    const allAvailableLists = useMemo(() => {
        const listMap = new Map<string, ListData>();
        const fav = getList('favorites');
        if (fav) listMap.set('favorites', fav);
        builtInLists.forEach(l => listMap.set(l.id, l));
        importedLists.forEach(l => listMap.set(l.id, l));
        Object.keys(customLists).forEach(id => {
            const listObj = getList(id);
            if (listObj) listMap.set(id, listObj);
        });
        return listMap;
    }, [favorites, builtInLists, importedLists, customLists]);

    // Existing folders list
    const existingFolders = useMemo(() => {
        const folders = new Set<string>();
        allAvailableLists.forEach(list => {
            const { folder } = parseListName(list.name);
            if (folder) folders.add(folder);
        });
        customListOrder.forEach(item => {
            if (item.startsWith('folder:')) {
                folders.add(item.substring(7));
            }
        });
        return Array.from(folders);
    }, [allAvailableLists, customListOrder]);

    // --- DETAIL VIEW HELPERS ---
    const activeList = activeListId ? getList(activeListId) : null;

    const listItems = activeList ? activeList.items.map(id => {
        if (id.startsWith('s_')) {
            const sId = id.substring(2);
            const sentence = sentences.find(s => s.id === sId) || userSentences.find(s => s.id === sId);
            if (sentence) return { type: 'sentence', data: sentence };
            return null;
        }

        const word = allData.find(d => d.Index === id);
        if (word) return { type: 'word', data: word };

        const sentence = sentences.find(s => s.id === id) || userSentences.find(s => s.id === id);
        if (sentence) return { type: 'sentence', data: sentence };

        return null;
    }).filter(Boolean) as { type: 'word' | 'sentence', data: any }[] : [];

    const displayedItems = listItems.filter(item => item?.type === (listMode === 'words' ? 'word' : 'sentence'));

    const handleRemoveFromList = (item: any) => {
        if (!activeListId) return;

        const list = getList(activeListId);
        if (!list) return;

        const canEdit = list.type === 'user' || list.id === 'favorites';
        if (!canEdit) return;

        const removeId = (id: string) => {
            if (activeListId === 'favorites') {
                setFavorites(prev => prev.filter(i => i !== id));
            } else {
                setCustomLists(prev => {
                    if (!prev[activeListId]) return prev;
                    return {
                        ...prev,
                        [activeListId]: {
                            ...prev[activeListId] as ListData,
                            items: ((prev[activeListId] as ListData).items || []).filter(i => i !== id)
                        }
                    };
                });
            }
        };

        if (typeof item === 'string') {
            removeId(item);
            if (!item.startsWith('s_')) removeId('s_' + item);
        }
    };

    const closeNewListModal = () => {
        setShowNewListModal(false);
        setRenameTargetId(null);
        setNewListName('');
        setNewListFolder('');
    };

    const handleMoveListToFolder = (listId: string, targetFolder: string | null, targetIndexInOrder?: number) => {
        const currentList = customLists[listId];
        if (!currentList) return;

        const currentName = Array.isArray(currentList) ? listId : currentList.name;
        const { name: displayName, folder: currentFolder } = parseListName(currentName);

        const cleanTargetFolder = targetFolder ? sanitizeListName(targetFolder) : null;
        if (currentFolder === cleanTargetFolder && targetIndexInOrder === undefined) return;

        const newFullName = formatListName(cleanTargetFolder, displayName);

        setCustomLists(prev => {
            const item = prev[listId];
            if (!item) return prev;
            const listObj: ListData = Array.isArray(item)
                ? { id: listId, items: item, type: 'user', color: 'gold', name: newFullName }
                : { ...(item as ListData), name: newFullName };
            return {
                ...prev,
                [listId]: listObj
            };
        });

        // Update customListOrder
        setCustomListOrder(prev => {
            const nextOrder = prev.filter(k => k !== listId);

            if (cleanTargetFolder) {
                const folderToken = `folder:${cleanTargetFolder}`;
                if (!nextOrder.includes(folderToken)) {
                    nextOrder.unshift(folderToken);
                }
                if (targetIndexInOrder !== undefined && targetIndexInOrder >= 0) {
                    nextOrder.splice(targetIndexInOrder, 0, listId);
                } else {
                    const fIdx = nextOrder.indexOf(folderToken);
                    nextOrder.splice(fIdx + 1, 0, listId);
                }
            } else {
                // Moved to root
                if (targetIndexInOrder !== undefined && targetIndexInOrder >= 0) {
                    nextOrder.splice(targetIndexInOrder, 0, listId);
                } else {
                    nextOrder.unshift(listId);
                }
            }
            return nextOrder;
        });

        // Ensure target folder is expanded
        if (cleanTargetFolder) {
            setCollapsedFolders(prev => prev.filter(f => f !== cleanTargetFolder));
        }
    };

    const handleRenameList = (id: string, newName: string, folder: string) => {
        const cleanFolder = sanitizeListName(folder);
        const cleanName = sanitizeListName(newName);
        if (!cleanName) return;

        const currentList = customLists[id];
        const currentName = Array.isArray(currentList) ? id : currentList?.name || '';
        const { folder: oldFolder } = parseListName(currentName);

        const fullName = formatListName(cleanFolder || null, cleanName);
        setCustomLists(prev => ({
            ...prev,
            [id]: { ...prev[id] as ListData, name: fullName }
        }));

        if (cleanFolder !== oldFolder) {
            setCustomListOrder(prev => {
                const nextOrder = prev.filter(k => k !== id);
                if (cleanFolder) {
                    const folderToken = `folder:${cleanFolder}`;
                    if (!nextOrder.includes(folderToken)) {
                        nextOrder.unshift(folderToken);
                    }
                    const fIdx = nextOrder.indexOf(folderToken);
                    nextOrder.splice(fIdx + 1, 0, id);
                } else {
                    nextOrder.unshift(id);
                }
                return nextOrder;
            });
            if (cleanFolder) {
                setCollapsedFolders(prev => prev.filter(f => f !== cleanFolder));
            }
        }

        closeNewListModal();
    };

    const handleCreateList = () => {
        const cleanName = sanitizeListName(newListName);
        if (!cleanName) return;
        const cleanFolder = sanitizeListName(newListFolder);
        const fullName = formatListName(cleanFolder, cleanName);

        const id = 'list_' + Date.now();
        const newList: ListData = {
            id,
            name: fullName,
            items: [],
            type: 'user',
            color: 'gold'
        };
        setCustomLists(prev => ({ ...prev, [id]: newList }));

        setCustomListOrder(prev => {
            const newOrder = [...prev];
            if (cleanFolder) {
                const folderToken = `folder:${cleanFolder}`;
                if (!newOrder.includes(folderToken)) {
                    newOrder.unshift(folderToken);
                }
                const folderIdx = newOrder.indexOf(folderToken);
                newOrder.splice(folderIdx + 1, 0, id);
            } else {
                newOrder.unshift(id);
            }
            return newOrder;
        });

        closeNewListModal();
    };

    const handleDeleteList = (id: string) => {
        setCustomLists(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setCustomListOrder(prev => prev.filter(k => k !== id));
        setDeleteTargetId(null);
        if (activeListId === id) {
            setActiveListId(null);
            setView('all');
        }
    };

    // --- FOLDER ACTIONS ---
    const handleCreateFolder = () => {
        const clean = sanitizeListName(newFolderName);
        if (!clean) return;
        const folderToken = `folder:${clean}`;
        if (!customListOrder.includes(folderToken)) {
            setCustomListOrder(prev => [folderToken, ...prev]);
        }
        setNewFolderName('');
        setShowNewFolderModal(false);
    };

    const handleRenameFolder = (oldFolder: string, newFolder: string) => {
        const cleanOld = sanitizeListName(oldFolder);
        const cleanNew = sanitizeListName(newFolder);
        if (!cleanNew || cleanOld === cleanNew) {
            setRenameFolderTarget(null);
            setRenameFolderName('');
            return;
        }

        // Update all user lists inside this folder
        setCustomLists(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                const item = next[id];
                if (!Array.isArray(item) && item.name) {
                    const { folder, name: displayName } = parseListName(item.name);
                    if (folder === cleanOld) {
                        next[id] = {
                            ...item,
                            name: formatListName(cleanNew, displayName)
                        };
                    }
                }
            });
            return next;
        });

        // Update customListOrder folder token
        setCustomListOrder(prev => prev.map(k => k === `folder:${cleanOld}` ? `folder:${cleanNew}` : k));

        // Update collapsed state
        setCollapsedFolders(prev => prev.map(f => f === cleanOld ? cleanNew : f));

        setRenameFolderTarget(null);
        setRenameFolderName('');
    };

    const handleDeleteFolder = (folderName: string) => {
        const clean = sanitizeListName(folderName);

        // Delete user lists in folder
        setCustomLists(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(id => {
                const item = next[id];
                if (!Array.isArray(item) && item.name) {
                    const { folder } = parseListName(item.name);
                    if (folder === clean) {
                        delete next[id];
                    }
                }
            });
            return next;
        });

        setCustomListOrder(prev => prev.filter(k => k !== `folder:${clean}`));
        setDeleteFolderTarget(null);
    };

    const handleToggleItem = (itemId: string) => {
        if (!activeListId) return;
        const list = getList(activeListId);
        if (!list) return;

        const canEdit = list.type === 'user' || list.id === 'favorites';
        if (!canEdit) return;

        const isCurrentlyIn = list.items.includes(itemId);
        const nextItems = isCurrentlyIn
            ? list.items.filter(i => i !== itemId)
            : [...list.items, itemId];

        if (activeListId === 'favorites') {
            setFavorites(prev => isCurrentlyIn ? prev.filter(i => i !== itemId) : [...prev, itemId]);
        } else {
            setCustomLists(prev => {
                const currentList = prev[activeListId];
                if (!currentList) return prev;
                return {
                    ...prev,
                    [activeListId]: {
                        ...currentList,
                        items: nextItems
                    }
                };
            });
        }
    };

    // --- DRAG AND DROP HANDLERS ---
    const pendingDragRef = useRef<{ id: string, startY: number, startX: number, target: HTMLElement, pointerId: number } | null>(null);
    const dragItemRef = useRef<HTMLDivElement | null>(null);
    const dragContainerRef = useRef<HTMLDivElement | null>(null);
    const longPressTimer = useRef<any>(null);
    const initialTouchPos = useRef<{ x: number, y: number } | null>(null);
    const initialScrollTop = useRef<number>(0);
    const lastPointerEvent = useRef<{ clientX: number, clientY: number } | null>(null);
    const scrollSpeed = useRef<number>(0);
    const updateRef = useRef<(() => void) | null>(null);
    const dragOffset = useRef<number>(0);
    const isDragTriggered = useRef<boolean>(false);
    const scrollInterval = useRef<any>(null);
    const isDraggingRef = useRef(false);
    const hoveredDropFolderRef = useRef<string | null>(null);
    const hoveredTargetIdRef = useRef<string | null>(null);
    const autoExpandTimer = useRef<any>(null);
    const autoExpandFolderRef = useRef<string | null>(null);

    useEffect(() => {
        const handlePointerUpWindow = () => {
            if (draggingId) {
                stopDrag();
            }
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            if (autoExpandTimer.current) {
                clearTimeout(autoExpandTimer.current);
                autoExpandTimer.current = null;
                autoExpandFolderRef.current = null;
            }
            pendingDragRef.current = null;
        };
        const handlePointerMoveWindow = (e: PointerEvent) => {
            if (draggingId && dragItemRef.current) {
                e.preventDefault();
                handleDragMove(e);
            }
        };

        const handleTouchMoveWindow = (e: TouchEvent) => {
            if (isDraggingRef.current) {
                if (e.cancelable) e.preventDefault();
            }
        };

        window.addEventListener('pointerup', handlePointerUpWindow);
        window.addEventListener('pointercancel', handlePointerUpWindow);
        window.addEventListener('pointermove', handlePointerMoveWindow, { passive: false });
        window.addEventListener('touchmove', handleTouchMoveWindow, { passive: false });

        return () => {
            if (autoExpandTimer.current) {
                clearTimeout(autoExpandTimer.current);
                autoExpandTimer.current = null;
                autoExpandFolderRef.current = null;
            }
            window.removeEventListener('pointerup', handlePointerUpWindow);
            window.removeEventListener('pointercancel', handlePointerUpWindow);
            window.removeEventListener('pointermove', handlePointerMoveWindow);
            window.removeEventListener('touchmove', handleTouchMoveWindow);
        };
    }, [draggingId, customListOrder]);

    const startDrag = (id: string, el: HTMLElement, initialY: number) => {
        setIsReordering(true);
        setDraggingId(id);
        isDragTriggered.current = true;
        isDraggingRef.current = true;

        const container = dragContainerRef.current;
        if (container) {
            initialScrollTop.current = container.scrollTop;
        }

        const rect = el.getBoundingClientRect();
        dragOffset.current = initialY - rect.top;

        el.style.zIndex = '50';
        el.style.position = 'relative';
    };

    const stopDrag = () => {
        if (autoExpandTimer.current) {
            clearTimeout(autoExpandTimer.current);
            autoExpandTimer.current = null;
            autoExpandFolderRef.current = null;
        }

        const dragId = draggingId;
        const targetFolder = hoveredDropFolderRef.current;
        const targetId = hoveredTargetIdRef.current;

        if (dragId) {
            const isFolder = dragId.startsWith('folder:');
            const draggedList = getList(dragId);

            if (!isFolder && draggedList && draggedList.type === 'user') {
                const { folder: currentFolder } = parseListName(draggedList.name);

                if (targetFolder && targetFolder !== currentFolder) {
                    // Dropped onto a different folder!
                    let targetIndex: number | undefined = undefined;
                    if (targetId) {
                        const idx = customListOrder.indexOf(targetId);
                        if (idx !== -1) targetIndex = idx;
                    }
                    handleMoveListToFolder(dragId, targetFolder, targetIndex);
                } else if (!targetFolder && currentFolder) {
                    // Dragged OUT of a folder onto root!
                    let targetIndex: number | undefined = undefined;
                    if (targetId) {
                        const idx = customListOrder.indexOf(targetId);
                        if (idx !== -1) targetIndex = idx;
                    }
                    handleMoveListToFolder(dragId, null, targetIndex);
                }
            }
        }

        setHoveredDropFolder(null);
        hoveredDropFolderRef.current = null;
        hoveredTargetIdRef.current = null;

        setDraggingId(null);
        setIsReordering(false);
        isDraggingRef.current = false;

        if (dragItemRef.current) {
            dragItemRef.current.style.transform = '';
            dragItemRef.current.style.zIndex = '';
            dragItemRef.current.style.boxShadow = '';
            dragItemRef.current = null;
        }
        if (scrollInterval.current) {
            clearInterval(scrollInterval.current);
            scrollInterval.current = null;
        }

        setTimeout(() => {
            isDragTriggered.current = false;
        }, 150);
    };

    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        if (view !== 'all') return;

        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' || (e.target as HTMLElement).closest('button')) return;

        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        const row = (e.target as HTMLElement).closest('[data-list-id]') as HTMLDivElement;
        if (!row) return;

        initialTouchPos.current = { x: e.clientX, y: e.clientY };
        pendingDragRef.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            target: e.currentTarget as HTMLElement,
            pointerId: e.pointerId
        };

        const isDragHandle = !!(e.target as HTMLElement).closest('.drag-handle');

        if (isDragHandle) {
            const { id, startY, target, pointerId } = pendingDragRef.current;
            dragItemRef.current = row;
            lastPointerEvent.current = { clientX: e.clientX, clientY: e.clientY };
            startDrag(id, row, startY);
            if (navigator.vibrate) navigator.vibrate(50);
            try { target.setPointerCapture(pointerId); } catch (err) { console.warn("Failed to capture pointer", err); }
            return;
        }

        longPressTimer.current = setTimeout(() => {
            if (pendingDragRef.current) {
                const { id, startY, target, pointerId } = pendingDragRef.current;

                dragItemRef.current = row;
                lastPointerEvent.current = { clientX: pendingDragRef.current.startX, clientY: startY };

                startDrag(id, row, startY);
                if (navigator.vibrate) navigator.vibrate(50);

                try {
                    target.setPointerCapture(pointerId);
                } catch (err) {
                    console.warn("Failed to capture pointer", err);
                }
            }
        }, 300);
    };

    const handlePointerMoveRow = (e: React.PointerEvent) => {
        if (longPressTimer.current && pendingDragRef.current && !draggingId) {
            const moveThreshold = 10;
            const dx = Math.abs(e.clientX - pendingDragRef.current.startX);
            const dy = Math.abs(e.clientY - pendingDragRef.current.startY);

            if (dx > moveThreshold || dy > moveThreshold) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
                pendingDragRef.current = null;
            }
        }
    };

    const handlePointerUpRow = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
        pendingDragRef.current = null;
    };

    const performDragUpdate = () => {
        const e = lastPointerEvent.current;
        if (!e || !dragItemRef.current || !draggingId || !initialTouchPos.current) return;

        const container = dragContainerRef.current;
        if (!container) return;

        const ds = container.scrollTop - initialScrollTop.current;
        const dy = (e.clientY - initialTouchPos.current.y) + ds;
        dragItemRef.current.style.transform = `translateY(${dy}px) scale(1.02)`;
        dragItemRef.current.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
        isDragTriggered.current = true;

        const scrollZone = 100;
        const rect = container.getBoundingClientRect();
        let speed = 0;
        if (e.clientY < rect.top + scrollZone) {
            speed = - Math.max(5, (rect.top + scrollZone - e.clientY) / 5);
        } else if (e.clientY > rect.bottom - scrollZone) {
            speed = Math.max(5, (e.clientY - (rect.bottom - scrollZone)) / 5);
        }
        scrollSpeed.current = speed;

        if (speed !== 0) {
            if (!scrollInterval.current) {
                scrollInterval.current = setInterval(() => {
                    if (dragContainerRef.current && scrollSpeed.current !== 0) {
                        dragContainerRef.current.scrollTop += scrollSpeed.current;
                        if (updateRef.current) updateRef.current();
                    }
                }, 16);
            }
        } else {
            if (scrollInterval.current) {
                clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }
        }

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const isFolder = draggingId.startsWith('folder:');
        const draggedList = getList(draggingId);
        const isUserList = !isFolder && draggedList?.type === 'user';

        if (isFolder || !isUserList) {
            // Folders, Favorites, or Built-in lists: cannot be dropped into folders, only reordered
            if (hoveredDropFolderRef.current !== null) {
                hoveredDropFolderRef.current = null;
                setHoveredDropFolder(null);
            }
            if (autoExpandTimer.current) {
                clearTimeout(autoExpandTimer.current);
                autoExpandTimer.current = null;
                autoExpandFolderRef.current = null;
            }

            const listRow = elements.find(el => el.hasAttribute('data-list-id') && el.getAttribute('data-list-id') !== draggingId);

            if (listRow) {
                const targetId = listRow.getAttribute('data-list-id');
                if (targetId) {
                    const targetRect = listRow.getBoundingClientRect();
                    const singleH = targetRect.height + 12;

                    setCustomListOrder(prev => {
                        const currentIndex = prev.indexOf(draggingId);
                        const targetIndex = prev.indexOf(targetId);

                        if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
                            const diff = targetIndex - currentIndex;
                            const newOrder = [...prev];
                            newOrder.splice(currentIndex, 1);
                            newOrder.splice(targetIndex, 0, draggingId);

                            initialTouchPos.current!.y += (diff * singleH);
                            return newOrder;
                        }
                        return prev;
                    });
                }
            }
        } else {
            // Dragging a user list: can be dropped into folders or reordered
            const folderEl = elements.find(el => 
                el.hasAttribute('data-folder-header') ||
                el.hasAttribute('data-folder-dropzone') ||
                el.hasAttribute('data-folder-body') ||
                el.hasAttribute('data-folder-empty') ||
                el.hasAttribute('data-folder-wrapper')
            );

            const detectedFolderName = folderEl ? (
                folderEl.getAttribute('data-folder-header') ||
                folderEl.getAttribute('data-folder-dropzone') ||
                folderEl.getAttribute('data-folder-body') ||
                folderEl.getAttribute('data-folder-empty') ||
                folderEl.getAttribute('data-folder-wrapper')
            ) : null;

            const targetListRow = elements.find(el => 
                el.hasAttribute('data-list-id') && 
                el.getAttribute('data-list-id') !== draggingId
            );

            const targetListFolder = targetListRow?.getAttribute('data-folder-name') || null;
            const effectiveFolder = detectedFolderName || (targetListFolder ? targetListFolder : null);

            // Update folder drop target
            if (effectiveFolder !== hoveredDropFolderRef.current) {
                hoveredDropFolderRef.current = effectiveFolder;
                setHoveredDropFolder(effectiveFolder);

                // Auto-expand folder if hovering over a collapsed folder
                if (effectiveFolder && collapsedFolders.includes(effectiveFolder)) {
                    if (autoExpandTimer.current) clearTimeout(autoExpandTimer.current);
                    autoExpandFolderRef.current = effectiveFolder;
                    autoExpandTimer.current = setTimeout(() => {
                        setCollapsedFolders(prev => prev.filter(f => f !== effectiveFolder));
                    }, 500);
                } else {
                    if (autoExpandTimer.current) {
                        clearTimeout(autoExpandTimer.current);
                        autoExpandTimer.current = null;
                        autoExpandFolderRef.current = null;
                    }
                }
            }

            hoveredTargetIdRef.current = targetListRow?.getAttribute('data-list-id') || null;

            // Live reorder within the same folder or root
            const draggedList = getList(draggingId);
            const currentListFolder = draggedList ? parseListName(draggedList.name).folder : null;

            if (targetListRow && effectiveFolder === currentListFolder) {
                const targetId = targetListRow.getAttribute('data-list-id');
                if (targetId && !targetId.startsWith('folder:')) {
                    const targetRect = targetListRow.getBoundingClientRect();
                    const singleH = targetRect.height + 12;

                    setCustomListOrder(prev => {
                        const currentIndex = prev.indexOf(draggingId);
                        const targetIndex = prev.indexOf(targetId);

                        if (currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex) {
                            const diff = targetIndex - currentIndex;
                            const newOrder = [...prev];
                            newOrder.splice(currentIndex, 1);
                            newOrder.splice(targetIndex, 0, draggingId);

                            initialTouchPos.current!.y += (diff * singleH);
                            return newOrder;
                        }
                        return prev;
                    });
                }
            }
        }
    };

    updateRef.current = performDragUpdate;

    const handleDragMove = (e: PointerEvent) => {
        lastPointerEvent.current = { clientX: e.clientX, clientY: e.clientY };
        performDragUpdate();
    };

    // --- RENDER HELPERS ---
    const renderModals = () => {
        return (
            <>
                {showNewListModal && (
                    <Modal title={renameTargetId ? "Edit List" : "New List"} onClose={closeNewListModal}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">List Name</label>
                                <input
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                                    placeholder="List Name"
                                    value={newListName}
                                    onChange={e => setNewListName(sanitizeListName(e.target.value))}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Folder (Optional)</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                                        value={newListFolder}
                                        onChange={e => setNewListFolder(e.target.value)}
                                    >
                                        <option value="">(No Folder / Root)</option>
                                        {existingFolders.map(f => (
                                            <option key={f} value={f}>{f}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Select an existing folder or type a folder name above.</p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button onClick={closeNewListModal} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button
                                onClick={renameTargetId ? () => handleRenameList(renameTargetId, newListName, newListFolder) : handleCreateList}
                                disabled={!newListName.trim()}
                                className="flex-1 py-3 bg-amber-500 rounded-lg text-white font-bold disabled:opacity-50"
                            >
                                Save
                            </button>
                        </div>
                    </Modal>
                )}

                {showNewFolderModal && (
                    <Modal title="New Folder" onClose={() => setShowNewFolderModal(false)}>
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                            placeholder="Folder Name"
                            value={newFolderName}
                            onChange={e => setNewFolderName(sanitizeListName(e.target.value))}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setShowNewFolderModal(false)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} className="flex-1 py-3 bg-amber-500 rounded-lg text-white font-bold disabled:opacity-50">Create Folder</button>
                        </div>
                    </Modal>
                )}

                {renameFolderTarget && (
                    <Modal title="Rename Folder" onClose={() => setRenameFolderTarget(null)}>
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                            placeholder="Folder Name"
                            value={renameFolderName}
                            onChange={e => setRenameFolderName(sanitizeListName(e.target.value))}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => setRenameFolderTarget(null)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button onClick={() => handleRenameFolder(renameFolderTarget, renameFolderName)} disabled={!renameFolderName.trim()} className="flex-1 py-3 bg-amber-500 rounded-lg text-white font-bold disabled:opacity-50">Save</button>
                        </div>
                    </Modal>
                )}

                {deleteFolderTarget && (
                    <Modal title="Delete Folder?" onClose={() => setDeleteFolderTarget(null)}>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">Are you sure you want to delete folder <strong>"{deleteFolderTarget}"</strong> and all custom lists inside it?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteFolderTarget(null)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button onClick={() => handleDeleteFolder(deleteFolderTarget)} className="flex-1 py-3 bg-red-500 rounded-lg text-white font-bold">Delete</button>
                        </div>
                    </Modal>
                )}

                {deleteTargetId && (
                    <Modal title="Delete List?" onClose={() => setDeleteTargetId(null)}>
                        <p className="text-slate-600 dark:text-slate-400 mb-4">Are you sure you want to delete this list?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button onClick={() => handleDeleteList(deleteTargetId)} className="flex-1 py-3 bg-red-500 rounded-lg text-white font-bold">Delete</button>
                        </div>
                    </Modal>
                )}

                <AddWordsModal
                    isOpen={showAddWordsModal}
                    onClose={() => setShowAddWordsModal(false)}
                    listMode={listMode}
                    activeList={activeList}
                    onToggleItem={handleToggleItem}
                    onPerformSearch={onPerformSearch}
                    customDictionaries={propCustomDictionaries}
                    settings={settings}
                />

                {addExistingModalFolder && (() => {
                    const userLists = Array.from(allAvailableLists.values()).filter(l => l.type === 'user');
                    const filteredLists = userLists.filter(l => {
                        const { name: dName } = parseListName(l.name);
                        return dName.toLowerCase().includes(existingSearchQuery.toLowerCase());
                    });

                    return (
                        <Modal
                            title={`Add Lists to "${addExistingModalFolder}"`}
                            onClose={() => { setAddExistingModalFolder(null); setExistingSearchQuery(''); }}
                        >
                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Choose existing custom lists to move into folder <strong>"{addExistingModalFolder}"</strong>. You can also drag and drop lists directly into folders.
                                </p>

                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                                    <input
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="Search custom lists..."
                                        value={existingSearchQuery}
                                        onChange={e => setExistingSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 pr-1">
                                    {filteredLists.length === 0 ? (
                                        <div className="py-8 text-center text-slate-400 text-xs italic">
                                            {userLists.length === 0 ? "No custom lists found. Create one first!" : "No matching lists found."}
                                        </div>
                                    ) : (
                                        filteredLists.map(list => {
                                            const { folder: currentFolder, name: dName } = parseListName(list.name);
                                            const isAlreadyInFolder = currentFolder === addExistingModalFolder;

                                            return (
                                                <div
                                                    key={list.id}
                                                    className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                                                                {dName}
                                                            </span>
                                                            {currentFolder && (
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                                    isAlreadyInFolder 
                                                                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' 
                                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                                                }`}>
                                                                    {isAlreadyInFolder ? 'In this folder' : `In "${currentFolder}"`}
                                                                </span>
                                                            )}
                                                            {!currentFolder && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                                    Root
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {list.items?.length || 0} items
                                                        </p>
                                                    </div>

                                                    <div>
                                                        {isAlreadyInFolder ? (
                                                            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 px-3 py-1.5">
                                                                <Check size={14} /> Added
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleMoveListToFolder(list.id, addExistingModalFolder)}
                                                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                                                            >
                                                                <Plus size={14} /> Add
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => { setAddExistingModalFolder(null); setExistingSearchQuery(''); }}
                                        className="w-full py-2.5 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors text-sm"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </Modal>
                    );
                })()}
            </>
        );
    };

    if (view === 'detail' && activeList) {
        const canEdit = activeList.type === 'user' || activeList.id === 'favorites';
        const { folder: activeListFolder, name: activeListDisplayName } = parseListName(activeList.name);

        return (
            <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950">
                {/* Header */}
                <div className="px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0 h-12">
                    <button onClick={() => setView('all')} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {activeListFolder && (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded shrink-0">
                                    {activeListFolder}
                                </span>
                            )}
                            <h2 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 truncate">
                                {activeListDisplayName}
                                {activeList.type === 'user' && (
                                    <button onClick={() => { setRenameTargetId(activeList.id); setNewListName(activeListDisplayName); setNewListFolder(activeListFolder || ''); setShowNewListModal(true); }} className="text-slate-400 hover:text-amber-600">
                                        <Pencil size={16} />
                                    </button>
                                )}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{listItems.length} items</p>
                    </div>
                    {activeList.type === 'user' && (
                        <button onClick={() => setDeleteTargetId(activeList.id)} className="p-1.5 text-slate-400 hover:text-red-500 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" title="Delete List">
                            <Trash2 size={20} />
                        </button>
                    )}
                    <UserAuthButton />
                    {onShowSettings && (
                        <button onClick={onShowSettings} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300 transition-colors" title="Settings">
                            <Menu size={22} strokeWidth={1.5} />
                        </button>
                    )}
                </div>

                {/* Mode Toggle */}
                <div className="px-4 pb-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button onClick={() => setListMode('words')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${listMode === 'words' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'} `}>Words ({listItems.filter(i => i?.type === 'word').length})</button>
                        <button onClick={() => setListMode('sentences')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${listMode === 'sentences' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'} `}>Sentences ({listItems.filter(i => i?.type === 'sentence').length})</button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {displayedItems.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                            <ListIcon size={48} className="mb-4 opacity-20" />
                            <p>No {listMode} in this list.</p>
                            {canEdit && listMode === 'words' && <button onClick={() => setShowAddWordsModal(true)} className="mt-4 text-amber-600 font-bold hover:underline">Add Words</button>}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700">
                                            <span className="hidden md:inline">{listMode === 'words' ? 'Word' : 'Cherokee'}</span>
                                        </th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700 hidden md:table-cell">English</th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700"></th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {displayedItems.map(({ type, data }) => {
                                        if (type === 'word') {
                                            const word = data;
                                            const rootEntry = word ? (rootMap?.get(word.Index) || rootMap?.get(word.id) || rootMap?.get(word.merged_id)) : null;
                                            const userAudio = (effectiveUserAudioMeta?.[word.Index] || [])
                                                .filter((audio: any) => {
                                                    if (!audio.packageId) {
                                                        const userPkg = packages.find(p => p.id === 'user');
                                                        return userPkg ? userPkg.status === 'active' : true;
                                                    }
                                                    const pkg = packages.find(p => p.id === audio.packageId);
                                                    return pkg && pkg.status === 'active';
                                                });

                                            return (
                                                <tr key={word.Index} onClick={() => onEntryClick(word)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-amber-50 dark:active:bg-amber-900/20">
                                                    <td className="p-3 align-middle">
                                                        {isLinguist && rootEntry ? (
                                                            <div className="py-1">
                                                                <VerbMorphologyTemplate
                                                                    rootEntry={rootEntry}
                                                                    showMascot={settings?.showClassMascots}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 leading-tight">{word?.Syllabary || ''}</div>
                                                                <div className="font-noto-serif text-sm text-slate-700 dark:text-slate-300 font-bold">
                                                                    <ColorizedCherokeeWord
                                                                        word={word?.Entry || word?.translit}
                                                                        entry={word}
                                                                        settings={settings}
                                                                    />
                                                                </div>
                                                            </>
                                                        )}
                                                        <div className="md:hidden mt-2 font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {word?.Definition || ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle hidden md:table-cell">
                                                        <div className="font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {word?.Definition || ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle">
                                                        <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                                                            {(word.Entry_Audio || word.entry_audio) && (
                                                                <MiniAudioButton audio={word.Entry_Audio || word.entry_audio} isOfficial={true} />
                                                            )}
                                                            {userAudio.map((audio: any) => {
                                                                const isOfficialItem = audio.packageId === 'official-cherokee-data';
                                                                return (
                                                                    <MiniAudioButton
                                                                        key={audio.id}
                                                                        audio={isOfficialItem ? audio.id : audio}
                                                                        isOfficial={isOfficialItem}
                                                                        color={isOfficialItem ? undefined : getPackageColor(audio.packageId || 'user')}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {canEdit && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveFromList(word!.Index); }} className="text-slate-300 hover:text-red-400 transition-colors">
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            const sentence = data;
                                            const userAudio = (effectiveUserAudioMeta?.[sentence.id + '_sentence'] || [])
                                                .filter((audio: any) => {
                                                    if (!audio.packageId) {
                                                        const userPkg = packages.find(p => p.id === 'user');
                                                        return userPkg ? userPkg.status === 'active' : true;
                                                    }
                                                    const pkg = packages.find(p => p.id === audio.packageId);
                                                    return pkg && pkg.status === 'active';
                                                });

                                            return (
                                                <tr key={sentence.id} onClick={() => onEntryClick(sentence)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors active:bg-amber-50 dark:active:bg-amber-900/20">
                                                    <td className="p-3 align-middle">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 leading-tight">{(sentence.syllabary || '').replace(/\*/g, '')}</div>
                                                                <div className="font-noto-serif text-sm text-slate-500 dark:text-slate-400 font-medium">{(sentence.translit || '').replace(/\*/g, '')}</div>
                                                            </div>
                                                            {onReadInContext && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); onReadInContext(sentence.id); }}
                                                                    className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 mt-1"
                                                                >
                                                                    <BookOpen size={10} />
                                                                    <span className="hidden sm:inline">See in Context</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="md:hidden mt-2 font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {renderStyledText(sentence.english || '')}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle hidden md:table-cell">
                                                        <div className="font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {renderStyledText(sentence.english || '')}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle">
                                                        <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                                                            {sentence.audio && (
                                                                <MiniAudioButton audio={sentence.audio} isOfficial={true} />
                                                            )}
                                                            {userAudio.map((audio: any) => {
                                                                const isOfficialItem = audio.packageId?.startsWith('official');
                                                                return (
                                                                    <MiniAudioButton
                                                                        key={audio.id}
                                                                        audio={isOfficialItem ? audio.id : audio}
                                                                        isOfficial={isOfficialItem}
                                                                        color={isOfficialItem ? undefined : getPackageColor(audio.packageId || 'user')}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        {canEdit && (
                                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveFromList(sentence.id); }} className="text-slate-300 hover:text-red-400 transition-colors">
                                                                <X size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Add Button */}
                {canEdit && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <button onClick={() => setShowAddWordsModal(true)} className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                            <Plus size={24} />
                            Add {listMode === 'words' ? 'Words' : 'Sentences'}
                        </button>
                    </div>
                )}
                {renderModals()}
            </div>
        );
    }

    const renderListRow = (list: ListData, isHidden: boolean, _isInsideFolder = false, parentFolder?: string) => {
        if (!list) return null;

        const { name: displayName } = parseListName(list.name);
        const isUser = list.type === 'user';
        const isFavorite = list.type === 'default';
        const isBuiltIn = list.type.startsWith('builtin');
        const isImported = list.type === 'imported';

        let colorClass = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
        let style = {};

        if (isUser) colorClass = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500';
        if (isImported && list.color) {
            if (list.color.startsWith('#')) {
                style = { backgroundColor: list.color, color: 'white' };
                colorClass = '';
            }
        }

        let icon = (isUser || isImported) ? <ListIcon size={24} /> : <Folder size={24} />;
        if (isFavorite) icon = <Star size={24} className="fill-slate-400 dark:fill-slate-500" />;
        if (isBuiltIn && list.icon) icon = list.icon;

        return (
            <div
                key={list.id}
                data-list-id={list.id}
                data-folder-name={parentFolder || ''}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => { if (!isReordering && !draggingId && !isDragTriggered.current) { setActiveListId(list.id); setView('detail'); } }}
                onPointerDown={e => { if (!isHidden) handlePointerDown(e, list.id); }}
                onPointerMove={handlePointerMoveRow}
                onPointerUp={handlePointerUpRow}
                onPointerCancel={handlePointerUpRow}
                style={{ touchAction: 'pan-y' }}
                className={`
                    relative bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] select-none min-w-0 w-full
                    ${draggingId === list.id ? 'opacity-90 border-amber-500 scale-105 z-50 transition-none shadow-xl' : 'transition-all'}
                    ${isHidden ? 'opacity-60 grayscale' : ''}
                `}
            >
                <div className="flex items-center gap-3 pointer-events-none min-w-0 flex-1">
                    {!isHidden && (
                        <div
                            className="text-slate-300 dark:text-slate-700 shrink-0 drag-handle pointer-events-auto cursor-grab active:cursor-grabbing"
                        >
                            <GripVertical size={18} />
                        </div>
                    )}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`} style={style}>
                        {React.cloneElement(icon as React.ReactElement, { size: 18 })}
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">{displayName}</h3>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{list.items?.length || 0} items</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                    {isUser && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setRenameTargetId(list.id);
                                setNewListName(displayName);
                                setNewListFolder(parentFolder || '');
                                setShowNewListModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors pointer-events-auto rounded-md"
                            title="Edit List / Move to Folder"
                        >
                            <Pencil size={15} />
                        </button>
                    )}
                    {isBuiltIn && (
                        <button
                            onClick={(e) => toggleBuiltInVisibility(list.id, e)}
                            className="p-1.5 text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 pointer-events-auto"
                            title={isHidden ? "Unhide" : "Hide"}
                        >
                            {isHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    )}
                    <ChevronRight size={18} className="text-slate-300" />
                </div>
            </div>
        );
    };

    const renderFolderRow = (folderName: string, folderLists: ListData[]) => {
        const isCollapsed = collapsedFolders.includes(folderName);
        const folderToken = `folder:${folderName}`;
        const totalItems = folderLists.reduce((acc, list) => acc + (list.items?.length || 0), 0);
        const isUserFolder = folderLists.some(l => l.type === 'user');
        const isDraggingUserList = !!draggingId && getList(draggingId)?.type === 'user';
        const isDropTarget = hoveredDropFolder === folderName && isDraggingUserList;

        return (
            <div
                key={folderToken}
                data-list-id={folderToken}
                data-folder-wrapper={folderName}
                data-folder-name={folderName}
                className="space-y-2 min-w-0 w-full"
            >
                {/* Folder Header */}
                <div
                    data-folder-header={folderName}
                    data-folder-name={folderName}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={(e) => {
                        if (isReordering || isDragTriggered.current) return;
                        if ((e.target as HTMLElement).closest('.drag-handle')) return;
                        toggleFolderCollapse(folderName, e);
                    }}
                    onPointerDown={e => handlePointerDown(e, folderToken)}
                    onPointerMove={handlePointerMoveRow}
                    onPointerUp={handlePointerUpRow}
                    onPointerCancel={handlePointerUpRow}
                    style={{ touchAction: 'pan-y' }}
                    className={`
                        relative rounded-xl p-3 border shadow-sm flex items-center justify-between cursor-pointer select-none transition-all
                        ${isDropTarget 
                            ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/90 dark:bg-amber-950/40 shadow-md scale-[1.01]' 
                            : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700/60'
                        }
                        ${draggingId === folderToken ? 'opacity-90 border-amber-500 scale-105 z-50 shadow-xl' : ''}
                    `}
                >
                    <div className="flex items-center gap-3 pointer-events-none min-w-0 flex-1">
                        <div className="text-slate-400 dark:text-slate-600 shrink-0 drag-handle pointer-events-auto cursor-grab active:cursor-grabbing">
                            <GripVertical size={18} />
                        </div>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isDropTarget 
                                ? 'bg-amber-500 text-white scale-110 shadow-sm' 
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}>
                            {isDropTarget ? <FolderPlus size={20} /> : <Folder size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{folderName}</h3>
                                {isDropTarget && (
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full animate-pulse">
                                        Drop to add
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-0.5">
                                {folderLists.length} {folderLists.length === 1 ? 'list' : 'lists'} · {totalItems} items
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); setAddExistingModalFolder(folderName); setExistingSearchQuery(''); }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors pointer-events-auto rounded-md"
                            title="Add Existing Lists to Folder"
                        >
                            <ListPlus size={18} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setNewListFolder(folderName); setNewListName(''); setShowNewListModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors pointer-events-auto rounded-md"
                            title="New List in Folder"
                        >
                            <Plus size={18} />
                        </button>
                        {isUserFolder && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setRenameFolderTarget(folderName); setRenameFolderName(folderName); }}
                                    className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors pointer-events-auto rounded-md"
                                    title="Rename Folder"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeleteFolderTarget(folderName); }}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors pointer-events-auto rounded-md"
                                    title="Delete Folder"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={(e) => toggleFolderCollapse(folderName, e)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 transition-colors pointer-events-auto rounded-md"
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                        </button>
                    </div>
                </div>

                {/* Folder Body (List Items) */}
                {!isCollapsed && (
                    <div
                        data-folder-body={folderName}
                        data-folder-name={folderName}
                        className={`pl-2 sm:pl-3 border-l-2 space-y-2 py-1 ml-2 sm:ml-4 min-w-0 transition-colors ${
                            isDropTarget 
                                ? 'border-amber-500 dark:border-amber-400 bg-amber-50/20 dark:bg-amber-950/20 rounded-lg pr-1' 
                                : 'border-slate-200 dark:border-slate-800'
                        }`}
                    >
                        {folderLists.length === 0 ? (
                            <div
                                data-folder-empty={folderName}
                                data-folder-name={folderName}
                                className={`p-4 text-center text-xs rounded-xl border-2 border-dashed transition-colors ${
                                    isDropTarget
                                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-bold'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-400'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5">
                                    <span>Folder is empty. Drag a list here, or</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setAddExistingModalFolder(folderName); setExistingSearchQuery(''); }}
                                        className="text-amber-600 dark:text-amber-500 font-bold hover:underline inline-flex items-center gap-1"
                                    >
                                        <Plus size={12} /> Add existing lists
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {folderLists.map(list => {
                                    const isHidden = hiddenBuiltInLists.includes(list.id);
                                    return renderListRow(list, isHidden, true, folderName);
                                })}
                                {isDropTarget && draggingId && !folderLists.some(l => l.id === draggingId) && (
                                    <div
                                        data-folder-dropzone={folderName}
                                        data-folder-name={folderName}
                                        className="p-2.5 rounded-lg border-2 border-dashed border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 text-center text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5"
                                    >
                                        <Plus size={14} />
                                        <span>Drop to place inside "{folderName}"</span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Build the ordered view of items & folders
    const renderOrderedContent = () => {
        const renderedFolders = new Set<string>();
        const renderedListIds = new Set<string>();

        const activeFolders = new Set<string>(existingFolders);

        const fullOrder = [...customListOrder];
        activeFolders.forEach(f => {
            const token = `folder:${f}`;
            if (!fullOrder.includes(token)) {
                fullOrder.push(token);
            }
        });

        const elementsToRender: React.ReactNode[] = [];

        fullOrder.forEach(itemKey => {
            if (itemKey.startsWith('folder:')) {
                const folderName = itemKey.substring(7);
                if (renderedFolders.has(folderName)) return;
                renderedFolders.add(folderName);

                const folderLists = Array.from(allAvailableLists.values()).filter(l => {
                    const { folder } = parseListName(l.name);
                    return folder === folderName;
                });

                folderLists.sort((a, b) => {
                    const idxA = fullOrder.indexOf(a.id);
                    const idxB = fullOrder.indexOf(b.id);
                    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                    return 0;
                });

                folderLists.forEach(l => renderedListIds.add(l.id));
                elementsToRender.push(renderFolderRow(folderName, folderLists));
            } else {
                const list = getList(itemKey);
                if (!list || renderedListIds.has(list.id)) return;

                const { folder } = parseListName(list.name);
                if (!folder) {
                    renderedListIds.add(list.id);
                    const isHidden = hiddenBuiltInLists.includes(list.id);
                    if (!isHidden) {
                        elementsToRender.push(renderListRow(list, false, false, undefined));
                    }
                }
            }
        });

        allAvailableLists.forEach((list, id) => {
            if (!renderedListIds.has(id)) {
                const { folder } = parseListName(list.name);
                if (!folder && !hiddenBuiltInLists.includes(id)) {
                    renderedListIds.add(id);
                    elementsToRender.push(renderListRow(list, false, false, undefined));
                }
            }
        });

        // If dragging a list that is currently in a folder, and hovering outside any folder:
        // Render a visual drop indicator zone at the root bottom
        const draggedList = draggingId ? getList(draggingId) : null;
        const isDraggingFromFolder = draggedList ? parseListName(draggedList.name).folder !== null : false;

        if (isDraggingFromFolder && !hoveredDropFolder) {
            elementsToRender.push(
                <div
                    key="root-dropzone"
                    className="p-3 rounded-xl border-2 border-dashed border-amber-400/80 dark:border-amber-500/60 bg-amber-50/40 dark:bg-amber-950/20 text-center text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all animate-pulse"
                >
                    <ArrowLeft className="-rotate-90" size={14} />
                    <span>Drop here to move out of folder to root</span>
                </div>
            );
        }

        return elementsToRender;
    };

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0 h-12">
                <h1 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100 truncate">My Lists</h1>
                <div className="flex gap-1.5 items-center">
                    <button
                        onClick={() => { setNewFolderName(''); setShowNewFolderModal(true); }}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 p-1.5 rounded-full shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="New Folder"
                    >
                        <FolderPlus size={18} />
                    </button>
                    <button
                        onClick={() => { setNewListName(''); setNewListFolder(''); setShowNewListModal(true); }}
                        className="bg-amber-500 text-white p-1.5 rounded-full shadow-sm hover:bg-amber-600 transition-colors"
                        title="New List"
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

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 content-start grid gap-3 min-w-0 w-full" ref={dragContainerRef}>
                {renderOrderedContent()}

                {/* Hidden Built-in Lists */}
                {builtInLists.filter(l => hiddenBuiltInLists.includes(l.id)).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Hidden Lists</h4>
                        <div className="grid gap-3">
                            {builtInLists.filter(l => hiddenBuiltInLists.includes(l.id)).map(l => renderListRow(l, true))}
                        </div>
                    </div>
                )}
            </div>
            {renderModals()}
        </div>
    );
};

export default ListsTab;
