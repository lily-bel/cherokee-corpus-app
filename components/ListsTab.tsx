import React, { useState, useRef, useEffect } from 'react';
import { Star, ListIcon, Trash2, Pencil, ChevronRight, GripVertical, Folder, ArrowLeft, Plus, X, Search, Check, Volume2, Pause } from './Icons';
import { Modal, SourceBadge } from './UI';
import { usePackageManager } from './PackageManagerContext';
import { getAudioFromDB } from '../utils';

export interface ListData {
    id: string;
    name: string;
    items: string[]; // Array of Entry Index/IDs
    color?: string; // 'amber' | 'slate' | hex
    type: 'user' | 'imported' | 'default';
    packageId?: string;
}

interface ListsTabProps {
    customLists: Record<string, ListData | string[]>;
    setCustomLists: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    customListOrder: string[];
    setCustomListOrder: React.Dispatch<React.SetStateAction<string[]>>;
    favorites: string[];
    setFavorites: React.Dispatch<React.SetStateAction<string[]>>;
    allData: any[];
    notebooks: any;
    userNotes: any;
    userAudioMeta: any;
    onEntryClick: (entry: any) => void;
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal' | 'modal_sentences') => any[];
    settings: any;
    openWordModal: (word?: any) => void;
    sentences?: any[];
    userSentences?: any[];
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

    return (
        <button
            onClick={handlePlay}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${bgClass}`}
            style={style}
            title={isOfficial ? "Official Audio" : (audio.speaker || "User Recording")}
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
    notebooks
}: {
    isOpen: boolean,
    onClose: () => void,
    listMode: 'words' | 'sentences',
    activeList: ListData | null,
    onToggleItem: (id: string) => void,
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal' | 'modal_sentences') => any[],
    notebooks: any
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
                                                name={notebooks?.[source]?.name}
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
    notebooks,
    userAudioMeta,
    onEntryClick,
    onPerformSearch,
    sentences = [],
    userSentences = [],
}) => {
    const { getPackageColor, packages } = usePackageManager();

    // Component State
    const [view, setView] = useState<'all' | 'detail'>('all');
    const [listMode, setListMode] = useState<'words' | 'sentences'>('words'); // New State
    const [activeListId, setActiveListId] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Modal States
    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [showAddWordsModal, setShowAddWordsModal] = useState(false);

    // --- MIGRATION CHECK ---
    const getList = (id: string): ListData | null => {
        const raw = customLists[id];
        if (!raw) return null;
        if (Array.isArray(raw)) {
            return { id, name: id, items: raw, type: 'user', color: 'amber' };
        }
        return raw as ListData;
    };

    const handleToggleItem = (itemId: string) => {
        if (!activeListId) return;
        const list = getList(activeListId);
        if (!list) return;

        const isCurrentlyIn = list.items.includes(itemId);
        const nextItems = isCurrentlyIn
            ? list.items.filter(i => i !== itemId)
            : [...list.items, itemId];

        // Optimistic update for UI responsiveness
        if (activeListId === 'favorites') {
             setFavorites(prev => isCurrentlyIn ? prev.filter(i => i !== itemId) : [...prev, itemId]);
        } else {
            setCustomLists(prev => ({
                ...prev,
                [activeListId]: {
                    ...list,
                    items: nextItems
                }
            }));
        }
    };

    // --- DRAG AND DROP HANDLERS ---
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

    useEffect(() => {
        const handlePointerUpWindow = () => {
            if (draggingId) {
                stopDrag();
            }
            if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        };
        const handlePointerMoveWindow = (e: PointerEvent) => {
            if (draggingId && dragItemRef.current) {
                e.preventDefault();
                handleDragMove(e);
            }
        };

        window.addEventListener('pointerup', handlePointerUpWindow);
        window.addEventListener('pointercancel', handlePointerUpWindow);
        window.addEventListener('pointermove', handlePointerMoveWindow, { passive: false });

        return () => {
            window.removeEventListener('pointerup', handlePointerUpWindow);
            window.removeEventListener('pointercancel', handlePointerUpWindow);
            window.removeEventListener('pointermove', handlePointerMoveWindow);
        };
    }, [draggingId, customListOrder]);

    const startDrag = (id: string, el: HTMLElement, initialY: number) => {
        setIsReordering(true);
        setDraggingId(id);
        isDragTriggered.current = true;

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
        const target = e.currentTarget as HTMLDivElement;

        if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' || (e.target as HTMLElement).closest('button')) return;

        dragItemRef.current = target;
        initialTouchPos.current = { x: e.clientX, y: e.clientY };

        const startY = e.clientY;
        longPressTimer.current = setTimeout(() => {
            lastPointerEvent.current = { clientX: e.clientX, clientY: e.clientY };
            startDrag(id, target, startY);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 300);
    };

    const checkMoveTolerance = (e: React.PointerEvent) => {
        if (longPressTimer.current && !draggingId && initialTouchPos.current) {
            const dist = Math.hypot(e.clientX - initialTouchPos.current.x, e.clientY - initialTouchPos.current.y);
            if (dist > 10) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
            }
        }
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

    // --- LIST MANAGEMENT ---
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

    const handleRenameList = (id: string, newName: string) => {
        setCustomLists(prev => ({
            ...prev,
            [id]: { ...prev[id] as ListData, name: newName }
        }));
        closeNewListModal();
    };

    const closeNewListModal = () => {
        setShowNewListModal(false);
        setRenameTargetId(null);
        setNewListName('');
    };

    // --- DETAIL VIEW HELPERS ---
    const activeList = activeListId ? (activeListId === 'favorites' ? { id: 'favorites', name: 'Favorites', items: favorites, type: 'default', color: 'slate' } : getList(activeListId)) : null;
    
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
        // Determine ID to remove (word Index or prefixed sentence ID)
        // We need to match what's in the list.
        // But here we might receive the raw data object or ID?
        // The render passes `word.Index` or `sentence.id`.
        // If it's a sentence, we need to try both `s_ID` and `ID`.
        
        const removeId = (id: string) => {
             if (activeListId === 'favorites') {
                setFavorites(prev => prev.filter(i => i !== id));
            } else {
                setCustomLists(prev => ({
                    ...prev,
                    [activeListId]: {
                        ...prev[activeListId] as ListData,
                        items: (prev[activeListId] as ListData).items.filter(i => i !== id)
                    }
                }));
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
                    notebooks={notebooks}
                />
            </>
        );
    };

    if (view === 'detail' && activeList) {
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
                            {listMode === 'words' && <button onClick={() => setShowAddWordsModal(true)} className="mt-4 text-amber-600 font-bold hover:underline">Add Words</button>}
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
                                            const userAudio = (userAudioMeta?.[word.Index] || [])
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
                                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveFromList(word!.Index); }} className="text-slate-300 hover:text-red-400 transition-colors">
                                                            <X size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        } else {
                                            // Sentence Row
                                            const sentence = data;
                                            const userAudio = (userAudioMeta?.[sentence.id + '_sentence'] || [])
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
                                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveFromList(sentence.id); }} className="text-slate-300 hover:text-red-400 transition-colors">
                                                            <X size={16} />
                                                        </button>
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
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <button onClick={() => setShowAddWordsModal(true)} className="w-full py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Plus size={24} />
                        Add {listMode === 'words' ? 'Words' : 'Sentences'}
                    </button>
                </div>
                {renderModals()}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <h2 className="font-noto-serif text-2xl font-bold text-slate-800 dark:text-slate-100">My Lists</h2>
                <div className="flex gap-2">
                    <button onClick={() => { setNewListName(''); setShowNewListModal(true); }} className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors">
                        <Plus size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 content-start grid gap-3" ref={dragContainerRef} style={{ touchAction: 'none' }}>
                <div
                    onClick={() => { if (!isDragTriggered.current) { setActiveListId('favorites'); setView('detail'); } }}
                    className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <Star size={24} className="fill-slate-400 dark:fill-slate-500" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Favorites</h3>
                            <p className="text-xs text-slate-400">{favorites.filter(id => {
                                if (id.startsWith('s_')) {
                                    const sId = id.substring(2);
                                    return sentences.some(s => s.id === sId) || userSentences.some(s => s.id === sId);
                                }
                                return allData.some(d => d.Index === id) || sentences.some(s => s.id === id) || userSentences.some(s => s.id === id);
                            }).length} items</p>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                </div>

                {customListOrder.map((id) => {
                    const list = getList(id);
                    if (!list) return null;
                    const isUser = list.type === 'user';
                    const colorClass = isUser ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
                    const icon = isUser ? <ListIcon size={24} /> : <Folder size={24} />;

                    return (
                        <div
                            key={id}
                            data-list-id={id}
                            onPointerDown={e => handlePointerDown(e, id)}
                            onPointerMove={checkMoveTolerance}
                            onClick={() => { if (!isReordering && !draggingId && !isDragTriggered.current) { setActiveListId(id); setView('detail'); } }}
                            className={`
                                relative bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] select-none touch-none
                                ${draggingId === id ? 'opacity-90 border-amber-500 scale-105 z-50 transition-none shadow-xl' : 'transition-all'}
                            `}
                        >
                            <div className="flex items-center gap-4 pointer-events-none">
                                <div className="text-slate-300 dark:text-slate-700">
                                    <GripVertical size={20} />
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClass}`}>
                                    {icon}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{list.name}</h3>
                                    <p className="text-xs text-slate-400">{list.items.filter(id => {
                                        if (id.startsWith('s_')) {
                                            const sId = id.substring(2);
                                            return sentences.some(s => s.id === sId) || userSentences.some(s => s.id === sId);
                                        }
                                        return allData.some(d => d.Index === id) || sentences.some(s => s.id === id) || userSentences.some(s => s.id === id);
                                    }).length} items</p>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-slate-300" />
                        </div>
                    );
                })}
            </div>
            {renderModals()}
        </div>
    );
};

export default ListsTab;
