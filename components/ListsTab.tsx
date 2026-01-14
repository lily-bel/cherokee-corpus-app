import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Star, ListIcon, Trash2, Pencil, ChevronRight, GripVertical, Folder, ArrowLeft, Plus, X, Search, Check, Volume2, Pause, Eye, EyeOff, Mic, StickyNote, ListPlus } from './Icons';
import { Modal, SourceBadge } from './UI';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import { getAudioFromDB } from '../utils';

export interface ListData {
    id: string;
    name: string;
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
                url = audioId.startsWith('http') ? audioId : `/data/audio/${audioId}`;
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
    customDictionaries
}: {
    isOpen: boolean,
    onClose: () => void,
    listMode: 'words' | 'sentences',
    activeList: ListData | null,
    onToggleItem: (id: string) => void,
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal' | 'modal_sentences') => any[],
    customDictionaries: any
}) => {
    const { getPackageColor } = usePackageManager();
    const [query, setQuery] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [limit, setLimit] = useState(50);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(query);
            setLimit(50); // Reset limit on new search
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

                        return (
                            <div
                                key={itemId}
                                onClick={() => onToggleItem(itemId)}
                                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded-lg flex justify-between items-center group transition-colors"
                            >
                                <div className="flex-1">
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
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {isSentenceResult ? (data.translit || '') : (data.Entry || data.translit)}
                                    </div>
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
    userNotes, // Destructure userNotes from props
    activeListId: propActiveListId,
    setActiveListId: propSetActiveListId,
    view: propView,
    setView: propSetView
}) => {
    const { getPackageColor, packages, importedData } = usePackageManager();
    const { userAudioMeta, personalWords, glosses } = useCorpus();

    // Use props if available, otherwise fallback to hook (though hook is more direct source of truth for dynamic lists)
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

    // --- IMPORTED LISTS ---
    const importedLists = useMemo(() => {
        const lists: ListData[] = [];
        packages.forEach(pkg => {
            if (pkg.status === 'active' && importedData[pkg.id]?.lists) {
                // Ensure color is from package if not set (though import logic sets it)
                // Also update color if package color changed
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
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [showAddWordsModal, setShowAddWordsModal] = useState(false);


    // --- GENERATE BUILT-IN LISTS ---
    const builtInLists = useMemo(() => {
        const audioItems: string[] = [];
        const noteItems: string[] = [];
        const glossItems: string[] = [];
        const entryItems: string[] = [];

        // 1. Audio
        Object.entries(effectiveUserAudioMeta).forEach(([key, audioList]: [string, any]) => {
            const hasUserAudio = audioList.some((a: any) => !a.packageId || a.packageId === 'user');
            if (hasUserAudio) {
                // key is either "Index" or "ID_sentence"
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
                name: 'Custom Audio',
                items: audioItems,
                type: 'builtin_audio',
                color: 'slate',
                icon: <Mic size={24} />
            },
            {
                id: 'builtin_notes',
                name: 'Custom Notes',
                items: noteItems,
                type: 'builtin_notes',
                color: 'slate',
                icon: <StickyNote size={24} />
            },
            {
                id: 'builtin_glosses',
                name: 'Custom Glosses',
                items: glossItems,
                type: 'builtin_glosses',
                color: 'slate',
                icon: <ListPlus size={24} />
            },
            {
                id: 'builtin_entries',
                name: 'Custom Entries',
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


    // --- MIGRATION CHECK ---
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
        return raw as ListData;
    };

    // --- DETAIL VIEW HELPERS ---
    const activeList = activeListId ? getList(activeListId) : null;

    // Split items into words and sentences
    const listItems = activeList ? activeList.items.map(id => {
        // Check for Sentence Prefix
        if (id.startsWith('s_')) {
            const sId = id.substring(2);
            const sentence = sentences.find(s => s.id === sId) || userSentences.find(s => s.id === sId);
            if (sentence) return { type: 'sentence', data: sentence };
            // If not found, it might be deleted, return null
            return null;
        }

        // Standard Word Check
        const word = allData.find(d => d.Index === id);
        if (word) return { type: 'word', data: word };

        // Fallback: Check sentences (if legacy/user sentences stored without prefix)
        // Although new ones use prefix, this is for safety or existing non-colliding IDs
        const sentence = sentences.find(s => s.id === id) || userSentences.find(s => s.id === id);
        if (sentence) return { type: 'sentence', data: sentence };

        return null;
    }).filter(Boolean) as { type: 'word' | 'sentence', data: any }[] : [];

    const displayedItems = listItems.filter(item => item?.type === (listMode === 'words' ? 'word' : 'sentence'));

    const handleRemoveFromList = (item: any) => {
        if (!activeListId) return;

        const list = getList(activeListId);
        if (!list) return;

        // Only allow removing from user lists and favorites
        const canEdit = list.type === 'user' || list.id === 'favorites';
        if (!canEdit) return;

        // Determine ID to remove (word Index or prefixed sentence ID)
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
                            items: (prev[activeListId] as ListData).items.filter(i => i !== id)
                        }
                    };
                });
            }
        };

        // If we passed the ID directly
        if (typeof item === 'string') {
            // Try removing exact match first
            removeId(item);
            // Also try removing s_ prefix version if it's a sentence ID (not starting with s_)
            if (!item.startsWith('s_')) removeId('s_' + item);
        }
    };

    const closeNewListModal = () => {
        setShowNewListModal(false);
        setRenameTargetId(null);
        setNewListName('');
    };

    const handleRenameList = (id: string, newName: string) => {
        setCustomLists(prev => ({
            ...prev,
            [id]: { ...prev[id] as ListData, name: newName }
        }));
        closeNewListModal();
    };

    const handleCreateList = () => {
        if (!newListName.trim()) return;
        const id = 'list_' + Date.now();
        const newList: ListData = {
            id,
            name: newListName,
            items: [],
            type: 'user',
            color: 'gold'
        };
        setCustomLists(prev => ({ ...prev, [id]: newList }));
        setCustomListOrder(prev => [id, ...prev]);
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

    const handleToggleItem = (itemId: string) => {
        if (!activeListId) return;
        const list = getList(activeListId);
        if (!list) return;

        // Only allow editing user lists and favorites
        const canEdit = list.type === 'user' || list.id === 'favorites';
        if (!canEdit) return;

        const isCurrentlyIn = list.items.includes(itemId);
        const nextItems = isCurrentlyIn
            ? list.items.filter(i => i !== itemId)
            : [...list.items, itemId];

        // Optimistic update for UI responsiveness
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

    useEffect(() => {
        const handlePointerUpWindow = () => {
            if (draggingId) {
                stopDrag();
            }
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
            pendingDragRef.current = null;
        };
        const handlePointerMoveWindow = (e: PointerEvent) => {
            if (draggingId && dragItemRef.current) {
                e.preventDefault();
                handleDragMove(e);
            }
        };

        // Prevent native scrolling when dragging is active
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
        }, 50);
    };

    const handlePointerDown = (e: React.PointerEvent, id: string) => {
        if (view !== 'all') return;

        // Ignore clicks on buttons/interactive elements
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' || (e.target as HTMLElement).closest('button')) return;

        // Reset any existing states
        if (longPressTimer.current) clearTimeout(longPressTimer.current);

        const row = (e.target as HTMLElement).closest('[data-list-id]') as HTMLDivElement;
        if (!row) return;

        // Store initial data
        initialTouchPos.current = { x: e.clientX, y: e.clientY };
        pendingDragRef.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            target: e.currentTarget as HTMLElement, // The row itself (since we moved the listener)
            pointerId: e.pointerId
        };

        // Start Timer
        longPressTimer.current = setTimeout(() => {
            if (pendingDragRef.current) {
                const { id, startY, target, pointerId } = pendingDragRef.current;

                // Start Drag
                dragItemRef.current = row;
                lastPointerEvent.current = { clientX: pendingDragRef.current.startX, clientY: startY };

                startDrag(id, row, startY);
                if (navigator.vibrate) navigator.vibrate(50);

                // Capture Pointer
                try {
                    target.setPointerCapture(pointerId);
                } catch (err) {
                    console.warn("Failed to capture pointer", err);
                }
            }
        }, 300); // 300ms hold
    };

    const handlePointerMoveRow = (e: React.PointerEvent) => {
        // If we are WAITING for long press, we need to check movement.
        if (longPressTimer.current && pendingDragRef.current && !draggingId) {
            const moveThreshold = 10;
            const dx = Math.abs(e.clientX - pendingDragRef.current.startX);
            const dy = Math.abs(e.clientY - pendingDragRef.current.startY);

            if (dx > moveThreshold || dy > moveThreshold) {
                // Moved too much, cancel hold
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

        // 1. Update Transform
        const ds = container.scrollTop - initialScrollTop.current;
        const dy = (e.clientY - initialTouchPos.current.y) + ds;
        dragItemRef.current.style.transform = `translateY(${dy}px) scale(1.02)`;
        dragItemRef.current.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
        isDragTriggered.current = true;

        // 2. Update Scroll Speed (for next interval tick)
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
                        if (updateRef.current) updateRef.current(); // Use ref to call latest version
                    }
                }, 16);
            }
        } else {
            if (scrollInterval.current) {
                clearInterval(scrollInterval.current);
                scrollInterval.current = null;
            }
        }

        // 3. Swap Logic (Uses functional update to avoid stale customListOrder)
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
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

                        // Compensation adjustment
                        initialTouchPos.current!.y += (diff * singleH);
                        return newOrder;
                    }
                    return prev;
                });
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
                    <Modal title={renameTargetId ? "Rename List" : "New List"} onClose={closeNewListModal}>
                        <input
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                            placeholder="List Name"
                            value={newListName}
                            onChange={e => setNewListName(e.target.value)}
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={closeNewListModal} className="flex-1 py-3 bg-slate-200 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-bold">Cancel</button>
                            <button onClick={renameTargetId ? () => handleRenameList(renameTargetId, newListName) : handleCreateList} disabled={!newListName.trim()} className="flex-1 py-3 bg-amber-500 rounded-lg text-white font-bold disabled:opacity-50">Save</button>
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
                />
            </>
        );
    };

    if (view === 'detail' && activeList) {
        const canEdit = activeList.type === 'user' || activeList.id === 'favorites';
        return (
            <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0">
                    <button onClick={() => setView('all')} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
                        <ArrowLeft size={24} />
                    </button>
                    <div className="flex-1">
                        <h2 className="font-noto-serif text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            {activeList.name}
                            {activeList.type === 'user' && (
                                <button onClick={() => { setRenameTargetId(activeList.id); setNewListName(activeList.name); setShowNewListModal(true); }} className="text-slate-400 hover:text-amber-600">
                                    <Pencil size={16} />
                                </button>
                            )}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{listItems.length} items</p>
                    </div>
                    {activeList.type === 'user' && (
                        <button onClick={() => setDeleteTargetId(activeList.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full">
                            <Trash2 size={24} />
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
                                                        <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 leading-tight">{word?.Syllabary || ''}</div>
                                                        <div className="font-noto-serif text-sm text-slate-500 dark:text-slate-400 font-medium">{word?.Entry || ''}</div>
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
                                            // Sentence Row
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
                                                        <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 leading-tight">{sentence.syllabary || ''}</div>
                                                        <div className="font-noto-serif text-sm text-slate-500 dark:text-slate-400 font-medium">{sentence.translit || ''}</div>
                                                        <div className="md:hidden mt-2 font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {sentence.english || ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle hidden md:table-cell">
                                                        <div className="font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                                            {sentence.english || ''}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 align-middle">
                                                        <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                                                            {sentence.audio && (
                                                                <MiniAudioButton audio={sentence.audio} isOfficial={true} />
                                                            )}
                                                            {userAudio.map((audio: any) => {
                                                                const isOfficialItem = audio.packageId?.startsWith('official'); // Heuristic
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

    const renderListRow = (list: ListData, isHidden: boolean) => {
        if (!list) return null;

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
                colorClass = ''; // Override class
            } else {
                // Fallback or named color
                // Note: Tailwind dynamic classes might not work if not safe-listed.
                // But app seems to use some dynamic logic or safe list.
                // Package colors are hex usually now.
            }
        }

        let icon = (isUser || isImported) ? <ListIcon size={24} /> : <Folder size={24} />;
        if (isFavorite) icon = <Star size={24} className="fill-slate-400 dark:fill-slate-500" />;
        if (isBuiltIn && list.icon) icon = list.icon;

        return (
            <div
                key={list.id}
                data-list-id={list.id}
                onContextMenu={(e) => e.preventDefault()}
                onClick={() => { if (!isReordering && !draggingId && !isDragTriggered.current) { setActiveListId(list.id); setView('detail'); } }}
                onPointerDown={e => { if (!isHidden) handlePointerDown(e, list.id); }} // Re-enabled for imported
                onPointerMove={handlePointerMoveRow}
                onPointerUp={handlePointerUpRow}
                onPointerCancel={handlePointerUpRow}
                style={{ touchAction: 'pan-y' }}
                className={`
                    relative bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] select-none
                    ${draggingId === list.id ? 'opacity-90 border-amber-500 scale-105 z-50 transition-none shadow-xl' : 'transition-all'}
                    ${isHidden ? 'opacity-60 grayscale' : ''}
                `}
            >
                <div className="flex items-center gap-3 pointer-events-none">
                    {!isHidden && (
                        <div
                            className="text-slate-300 dark:text-slate-700 shrink-0"
                        >
                            <GripVertical size={18} />
                        </div>
                    )}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`} style={style}>
                        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 leading-tight">{list.name}</h3>
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{list.items.filter(id => {
                            // Logic copied from previous implementation to robustly count valid items
                            if (id.startsWith('s_')) {
                                const sId = id.substring(2);
                                return sentences.some(s => s.id === sId) || userSentences.some(s => s.id === sId);
                            }
                            return allData.some(d => d.Index === id) || sentences.some(s => s.id === id) || userSentences.some(s => s.id === id);
                        }).length} items</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {isBuiltIn && (
                        <button
                            onClick={(e) => toggleBuiltInVisibility(list.id, e)}
                            className="p-2 text-slate-300 hover:text-slate-500 dark:hover:text-slate-200 pointer-events-auto"
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

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">My Lists</h1>
                <div className="flex gap-2">
                    <button onClick={() => { setNewListName(''); setShowNewListModal(true); }} className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 content-start grid gap-3" ref={dragContainerRef}>
                {customListOrder.map(id => {
                    if (hiddenBuiltInLists.includes(id)) return null;
                    const list = getList(id);
                    if (!list) return null;
                    return renderListRow(list, false);
                })}

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
