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
    onPerformSearch: (query: string, scope?: 'dictionary' | 'sentences' | 'modal') => any[];
    settings: any;
    openWordModal: (word?: any) => void;
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
}) => {
    const { getPackageColor, packages } = usePackageManager();

    // Component State
    const [view, setView] = useState<'all' | 'detail'>('all');
    const [activeListId, setActiveListId] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    // Modal States
    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
    const [showAddWordsModal, setShowAddWordsModal] = useState(false);

    // Search for adding words
    const [addWordQuery, setAddWordQuery] = useState('');
    const [addWordSearchTerm, setAddWordSearchTerm] = useState('');
    const [addWordResults, setAddWordResults] = useState<any[]>([]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setAddWordSearchTerm(addWordQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [addWordQuery]);

    useEffect(() => {
        const results = onPerformSearch(addWordSearchTerm, 'modal');
        setAddWordResults(results);
    }, [addWordSearchTerm, onPerformSearch]);

    // --- MIGRATION CHECK ---
    const getList = (id: string): ListData | null => {
        const raw = customLists[id];
        if (!raw) return null;
        if (Array.isArray(raw)) {
            return { id, name: id, items: raw, type: 'user', color: 'amber' };
        }
        return raw as ListData;
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
    const listWords = activeList ? activeList.items.map(idx => allData.find(d => d.Index === idx)).filter(Boolean) : [];

    const handleRemoveFromList = (wordIndex: string) => {
        if (!activeListId) return;
        if (activeListId === 'favorites') {
            setFavorites(prev => prev.filter(i => i !== wordIndex));
        } else {
            setCustomLists(prev => ({
                ...prev,
                [activeListId]: {
                    ...prev[activeListId] as ListData,
                    items: (prev[activeListId] as ListData).items.filter(i => i !== wordIndex)
                }
            }));
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

                {showAddWordsModal && (
                    <Modal title="Add Words" onClose={() => setShowAddWordsModal(false)}>
                        <div className="h-[70vh] flex flex-col gap-4">
                            <div className="relative shrink-0">
                                <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                                <input
                                    className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-lg py-2.5 pl-10 pr-4 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Search dictionary..."
                                    value={addWordQuery}
                                    onChange={e => setAddWordQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 -mr-2 pr-2">
                                {addWordResults.map(res => {
                                    const isInList = activeList?.items.includes(res.Index);
                                    const source = res.Source || res.source;
                                    return (
                                        <div
                                            key={res.Index}
                                            onClick={() => {
                                                if (activeListId) {
                                                    const list = getList(activeListId);
                                                    if (!list) return;
                                                    const isCurrentlyIn = list.items.includes(res.Index);
                                                    const nextItems = isCurrentlyIn
                                                        ? list.items.filter(i => i !== res.Index)
                                                        : [...list.items, res.Index];

                                                    setCustomLists(prev => ({
                                                        ...prev,
                                                        [activeListId]: {
                                                            ...list,
                                                            items: nextItems
                                                        }
                                                    }));
                                                }
                                            }}
                                            className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer rounded-lg flex justify-between items-center group transition-colors"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <div className="font-serif font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-700 transition-colors leading-tight">{res.Syllabary || res.syllabary}</div>
                                                    {source && (
                                                        <SourceBadge
                                                            source={source}
                                                            name={notebooks?.[source]?.name}
                                                            customColor={getPackageColor(source)}
                                                        />
                                                    )}
                                                </div>
                                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{res.Entry || res.translit}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{res.Definition || res.definition}</div>
                                            </div>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isInList ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                {isInList ? <Check size={18} /> : <Plus size={18} />}
                                            </div>
                                        </div>
                                    );
                                })}
                                {addWordQuery && addWordResults.length === 0 && (
                                    <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center">
                                        <Search size={32} className="mb-3 opacity-20" />
                                        <p>No matches found</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2">
                                <button onClick={() => setShowAddWordsModal(false)} className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                                    Done
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
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
                        <p className="text-xs text-slate-500 dark:text-slate-400">{listWords.length} words</p>
                    </div>
                    {activeList.type === 'user' && (
                        <button onClick={() => setDeleteTargetId(activeList.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-full">
                            <Trash2 size={24} />
                        </button>
                    )}
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {listWords.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                            <ListIcon size={48} className="mb-4 opacity-20" />
                            <p>This list is empty.</p>
                            <button onClick={() => setShowAddWordsModal(true)} className="mt-4 text-amber-600 font-bold hover:underline">Add Words</button>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700">Word</th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700">English</th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-24"></th>
                                        <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {listWords.map(word => {
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
                                                <td className="p-3">
                                                    <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 leading-tight">{word?.Syllabary || ''}</div>
                                                    <div className="font-noto-serif text-sm text-slate-500 dark:text-slate-400 font-medium">{word?.Entry || ''}</div>
                                                </td>
                                                <td className="p-3 font-noto-serif text-slate-600 dark:text-slate-300 text-sm line-clamp-2">{word?.Definition || ''}</td>
                                                <td className="p-3">
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
                        Add Words
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
                            <p className="text-xs text-slate-400">{favorites.length} words</p>
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
                                    <p className="text-xs text-slate-400">{list.items.length} words</p>
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
