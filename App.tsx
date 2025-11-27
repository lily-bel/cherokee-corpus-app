
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Book, Menu, X, Filter, Clock, ListIcon, Folder, BookOpen, Download, ArrowLeft, Pencil, ChevronDown, Share, Trash2, Plus, Star, ChevronUp, Minus, Check, ToggleLeft, ToggleRight } from './components/Icons';
import { Toast, CollapsibleCard, Modal } from './components/UI';
import EntryCard from './components/EntryCard';
import EntryDetail from './components/EntryDetail';
import { useCorpus } from './components/CorpusContext';
import { formatToneInput, downloadFile, exportNotebookToCSV, importNotebookFromCSV, saveAudioToDB, deleteAudioFromDB } from './utils';

// DEFINED SOURCE ORDER
const SOURCE_ORDER = ['CED', 'RRD', 'CN', 'CWL', 'NOQ', 'MDS', 'MSCT'];

const DEFAULT_SETTINGS = {
    darkMode: false,
    enableRegex: false,
    showPosInLists: false,
    searchLangs: { syllabary: true, translit: true, english: true, tone: false },
    searchScopes: { main: true, verbs: false, plurals: false, sentences: false, notes: false },
};

function App() {
    const { dictionary, sentences, entryToSentencesMap } = useCorpus();

    // Legacy state replacements
    const csvData = dictionary; // Map dictionary to csvData for compatibility

    const [personalWords, setPersonalWords] = useState<any[]>([]);
    const [notebooks, setNotebooks] = useState<Record<string, { id: string; name: string; date: number }>>({});

    // const [loading, setLoading] = useState(true); // Handled by CorpusContext internally
    // const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
    // const [showManualUpload, setShowManualUpload] = useState(false);
    const loading = false;

    const [activeTab, setActiveTab] = useState<string>('search');
    const [searchScope, setSearchScope] = useState<'dictionary' | 'sentences'>('dictionary');
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);

    // Search & Input States
    const [inputValue, setInputValue] = useState('');
    const [query, setQuery] = useState('');
    const [resultLimit, setResultLimit] = useState(50);
    const [posFilter, setPosFilter] = useState("All");

    const [filters, setFilters] = useState<Record<string, boolean>>({}); // Initialized dynamically now
    const [showFilters, setShowFilters] = useState(false);
    const [expandOthers, setExpandOthers] = useState(false);

    const [favorites, setFavorites] = useState<string[]>([]);
    const [customLists, setCustomLists] = useState<Record<string, string[]>>({});
    const [customListOrder, setCustomListOrder] = useState<string[]>([]);
    const [userNotes, setUserNotes] = useState<Record<string, string>>({});
    const [userAudioMeta, setUserAudioMeta] = useState<Record<string, any[]>>({}); // { entryIndex: [{ id, speaker, date }] }
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [listToDelete, setListToDelete] = useState<string | null>(null);
    const [isReordering, setIsReordering] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
    const [showWordModal, setShowWordModal] = useState(false);
    const [wordForm, setWordForm] = useState({ Entry: '', Syllabary: '', Definition: '', PoS: '', Entry_Tone: '', Notes: '' });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pdSort, setPdSort] = useState('date');
    const [showPdSortMenu, setShowPdSortMenu] = useState(false);
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [currentNote, setCurrentNote] = useState('');
    const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
    const [wordToDelete, setWordToDelete] = useState<string | null>(null);
    const [showNewNotebookModal, setShowNewNotebookModal] = useState(false);
    const [newNotebookName, setNewNotebookName] = useState('');
    const [notebookToDelete, setNotebookToDelete] = useState<string | null>(null);
    const [showBackupConfirm, setShowBackupConfirm] = useState(false);
    const restoreInputRef = useRef<any>(null);

    const [renameData, setRenameData] = useState<{ type: string | null; target: string | null; value: string; initialEntryIndex?: string | null }>({ type: null, target: null, value: '', initialEntryIndex: null });

    const [showMoveModal, setShowMoveModal] = useState(false);
    const [wordToMove, setWordToMove] = useState<string | null>(null);

    console.log("⚡ APP RENDER. Current Selected Entry:", selectedEntry);

    const showToast = (message, type = 'error') => { setToast({ show: true, message, type }); setTimeout(() => setToast(t => ({ ...t, show: false })), 3000); };

    useEffect(() => {
        if (settings.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [settings.darkMode]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery(inputValue);
            setResultLimit(50);
        }, 300);
        return () => clearTimeout(timer);
    }, [inputValue]);

    // INITIAL DATA LOAD - User Data Only
    useEffect(() => {
        const initLoad = async () => {
            try {
                const savedNotebooks = localStorage.getItem('cherokee_app_notebooks');
                const savedWords = localStorage.getItem('cherokee_app_personal_words');
                const savedNotes = localStorage.getItem('cherokee_app_user_notes');
                const savedAudioMeta = localStorage.getItem('cherokee_app_user_audio_meta');
                const savedSettings = localStorage.getItem('cherokee_app_settings');
                const savedHistory = localStorage.getItem('cherokee_app_history');

                if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
                if (savedNotes) setUserNotes(JSON.parse(savedNotes));
                if (savedAudioMeta) setUserAudioMeta(JSON.parse(savedAudioMeta));
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    setSettings(prev => ({
                        ...prev, ...parsed,
                        searchLangs: { ...prev.searchLangs, ...parsed.searchLangs },
                        searchScopes: { ...prev.searchScopes, ...parsed.searchScopes }
                    }));
                }
                if (savedWords && !savedNotebooks) {
                    const words = JSON.parse(savedWords);
                    const defaultNotebookId = 'nb_' + Date.now();
                    setNotebooks({ [defaultNotebookId]: { id: defaultNotebookId, name: 'My Dictionary', date: Date.now() } });
                    setPersonalWords(words.map(w => ({ ...w, notebookId: defaultNotebookId })));
                } else {
                    if (savedNotebooks) setNotebooks(JSON.parse(savedNotebooks));
                    if (savedWords) setPersonalWords(JSON.parse(savedWords));
                }

                const savedFavs = localStorage.getItem('cherokee_app_favorites'); if (savedFavs) setFavorites(JSON.parse(savedFavs));
                const savedLists = localStorage.getItem('cherokee_app_custom_lists');
                if (savedLists) {
                    setCustomLists(JSON.parse(savedLists));
                    const savedOrder = localStorage.getItem('cherokee_app_list_order');
                    setCustomListOrder(savedOrder ? JSON.parse(savedOrder) : Object.keys(JSON.parse(savedLists)));
                }

            } catch (e) {
                console.warn("LocalStorage access failed:", e);
            }
        };

        initLoad();
    }, []);

    // Initialize Filters when Data Loads to fix "first click" bug and set defaults
    useEffect(() => {
        if (csvData.length > 0) {
            setFilters(prev => {
                const newFilters: Record<string, boolean> = { ...prev };
                const sources = new Set(csvData.map(d => d.Source));
                sources.forEach((s) => {
                    const src = s as string;
                    if (!src) return;
                    if (newFilters[src] === undefined) {
                        // Default MSCT and MDS to false, others to true. Case insensitive check.
                        const upper = src.toUpperCase();
                        newFilters[src] = (upper === 'MSCT' || upper === 'MDS') ? false : true;
                    }
                });
                return newFilters;
            });
        }
    }, [csvData]);

    useEffect(() => { try { localStorage.setItem('cherokee_app_personal_words', JSON.stringify(personalWords)); } catch (e) { } }, [personalWords]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_user_notes', JSON.stringify(userNotes)); } catch (e) { } }, [userNotes]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_user_audio_meta', JSON.stringify(userAudioMeta)); } catch (e) { } }, [userAudioMeta]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_notebooks', JSON.stringify(notebooks)); } catch (e) { } }, [notebooks]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_settings', JSON.stringify(settings)); } catch (e) { } }, [settings]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_history', JSON.stringify(searchHistory)); } catch (e) { } }, [searchHistory]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_favorites', JSON.stringify(favorites)); } catch (e) { } }, [favorites]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_custom_lists', JSON.stringify(customLists)); localStorage.setItem('cherokee_app_list_order', JSON.stringify(customListOrder)); } catch (e) { } }, [customLists, customListOrder]);
    useEffect(() => {
        const keys = Object.keys(customLists);
        const missing = keys.filter(k => !customListOrder.includes(k)); if (missing.length) setCustomListOrder(prev => [...prev, ...missing]);
        const valid = customListOrder.filter(k => keys.includes(k)); if (valid.length !== customListOrder.length) setCustomListOrder(valid);
    }, [customLists]);

    const allData = useMemo(() => {
        const notebookEntries = personalWords.map(w => ({ ...w, Source: w.notebookId, Source_Long: notebooks[w.notebookId]?.name || 'Personal Dictionary' }));
        return [...notebookEntries, ...csvData];
    }, [csvData, personalWords, notebooks]);

    const updateUrl = (entry) => {
        try {
            const url = new URL(window.location.href);
            if (entry) {
                url.searchParams.set('word', entry.Index);
            } else {
                url.searchParams.delete('word');
            }
            window.history.pushState({}, '', url.toString());
        } catch (e) {
            console.log("Navigation update skipped (SecurityRestriction)");
        }
    };

    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const idx = params.get('word');
            if (idx) {
                const found = allData.find(d => d.Index === idx);
                if (found) setSelectedEntry(found);
            } else {
                setSelectedEntry(null);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [allData]);

    useEffect(() => {
        if (!loading && allData.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const idx = params.get('word');
            if (idx && !selectedEntry) {
                const found = allData.find(d => d.Index === idx);
                if (found) setSelectedEntry(found);
            }
        }
    }, [loading, allData]);


    const sourceStats = useMemo(() => {
        const counts = {};
        allData.forEach(d => {
            const src = d.Source;
            counts[src] = (counts[src] || 0) + 1;
        });

        // Identify "Small Sources" (<= 500 entries, not personal)
        const smallSourceCodes: string[] = [];
        Object.keys(counts).forEach(src => {
            if (counts[src] <= 500 && !src.startsWith('nb_') && src !== 'pd') {
                smallSourceCodes.push(src);
            }
        });

        return { counts, smallSourceCodes };
    }, [allData]);

    const availableSources = useMemo(() => {
        const unique = new Map();
        const sources: { code: string; name: string; badge: string; count: number }[] = [];

        allData.forEach(d => {
            if (d.Source && !unique.has(d.Source)) {
                unique.set(d.Source, true);

                if (sourceStats.smallSourceCodes.includes(d.Source)) return;

                let code = d.Source;
                let name = d.Source_Long || d.Source.toUpperCase();
                let badge = code.substring(0, 3).toUpperCase();

                if (code.startsWith('nb_') || code === 'pd') {
                    name = notebooks[code]?.name || d.Source_Long;
                    badge = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                } else {
                    badge = code.toUpperCase();
                }
                sources.push({ code, name, badge, count: sourceStats.counts[code] || 0 });
            }
        });

        // Custom Sort based on SOURCE_ORDER
        sources.sort((a, b) => {
            // NEW LOGIC: Notebooks first
            const isNbA = a.code.startsWith('nb_') || a.code === 'pd';
            const isNbB = b.code.startsWith('nb_') || b.code === 'pd';
            if (isNbA && !isNbB) return -1;
            if (!isNbA && isNbB) return 1;
            if (isNbA && isNbB) return a.name.localeCompare(b.name);

            // Ensure case-insensitive matching against SOURCE_ORDER
            const idxA = SOURCE_ORDER.indexOf(a.code.toUpperCase());
            const idxB = SOURCE_ORDER.indexOf(b.code.toUpperCase());

            // If both are in the list, sort by list order
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // If A is in list, it comes first
            if (idxA !== -1) return -1;
            // If B is in list, it comes first
            if (idxB !== -1) return 1;
            // Otherwise sort by count descending
            return b.count - a.count;
        });

        // Always add "Other" if small sources exist
        if (sourceStats.smallSourceCodes.length > 0) {
            const otherCount = sourceStats.smallSourceCodes.reduce((acc, code) => acc + (sourceStats.counts[code] || 0), 0);
            sources.push({ code: 'Other', name: 'Other Sources', badge: '...', count: otherCount });
        }

        return sources;
    }, [allData, notebooks, sourceStats]);

    // Compute Small Sources List for the Expanded View, sorted by count
    const expandedSmallSources = useMemo(() => {
        return sourceStats.smallSourceCodes.map(code => {
            // Find a representative entry to get full name? Or just use code if not efficient
            // We can find one entry in allData just to get the long name
            const sample = allData.find(d => d.Source === code);
            const name = sample?.Source_Long || code;
            return { code, name, count: sourceStats.counts[code] };
        }).sort((a, b) => b.count - a.count);
    }, [sourceStats, allData]);

    const otherGroupState = useMemo(() => {
        const smallCodes = sourceStats.smallSourceCodes;
        if (smallCodes.length === 0) return 'none';

        const activeCount = smallCodes.filter(c => filters[c] !== false).length;
        if (activeCount === 0) return 'none';
        if (activeCount === smallCodes.length) return 'all';
        return 'some';
    }, [sourceStats, filters]);

    const toggleAllSmallSources = () => {
        const newState = otherGroupState !== 'all'; // If all are checked, turn off. Otherwise turn on.
        setFilters(prev => {
            const next = { ...prev };
            sourceStats.smallSourceCodes.forEach(code => {
                next[code] = newState;
            });
            return next;
        });
    };

    const uniquePoS = useMemo(() => {
        const s = new Set<string>();
        s.add("All");
        allData.forEach(d => {
            if (d.PoS) s.add(d.PoS.trim());
        });
        return Array.from(s).sort();
    }, [allData]);

    const isEntrySearchable = (entry, config) => {
        const { searchLangs, searchScopes } = config;
        const isPersonal = !!notebooks[entry.Source];

        let hasTargetData = false;
        if (searchScopes.main) {
            if (searchLangs.translit && entry.Entry) hasTargetData = true;
            if (searchLangs.syllabary && entry.Syllabary) hasTargetData = true;
            if (searchLangs.english && entry.Definition) hasTargetData = true;
            if (searchLangs.tone && entry.Entry_Tone) hasTargetData = true;
        }
        if (!hasTargetData && searchScopes.sentences) {
            if (searchLangs.translit && entry.Sentence_Transliteration) hasTargetData = true;
            if (searchLangs.syllabary && entry.Sentence_Syllabary) hasTargetData = true;
            if (searchLangs.english && entry.Sentence_English) hasTargetData = true;
        }
        if (!hasTargetData && searchScopes.verbs) {
            if (searchLangs.translit && entry.Verb_1st_Present) hasTargetData = true;
            if (searchLangs.syllabary && entry.Verb_1st_Present_Syllabary) hasTargetData = true;
            if (searchLangs.tone && entry.Verb_1st_Present_Tone) hasTargetData = true;
        }
        if (!hasTargetData && searchScopes.plurals) {
            if (searchLangs.translit && entry.Plural) hasTargetData = true;
            if (searchLangs.syllabary && entry.Plural_Syllabary) hasTargetData = true;
            if (searchLangs.tone && entry.Plural_Tone) hasTargetData = true;
        }
        if (!hasTargetData && searchScopes.notes) {
            // CHANGE: For CSV words (not personal), IGNORE entry.Notes. Only use userNotes.
            const note = isPersonal ? entry.Notes : userNotes[entry.Index];
            if (note) hasTargetData = true;
        }
        return hasTargetData;
    };

    const searchableCount = useMemo(() => {
        return allData.reduce((acc, entry) => {
            // CHANGE: Check PoS Filter
            if (posFilter !== "All" && entry.PoS !== posFilter) return acc;

            return acc + (isEntrySearchable(entry, settings) ? 1 : 0);
        }, 0);
    }, [allData, settings, userNotes, posFilter]);

    const toggleFavorite = (idx) => setFavorites(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
    const toggleInList = (name, idx) => { if (name === 'Favorites') { toggleFavorite(idx); return; } setCustomLists(prev => { const l = prev[name] || []; return { ...prev, [name]: l.includes(idx) ? l.filter(i => i !== idx) : [...l, idx] }; }); };
    const createNewList = () => { if (!newListName.trim() || customLists[newListName] || newListName === 'Favorites') { showToast("Invalid Name"); return; } setCustomLists(prev => ({ ...prev, [newListName]: [] })); setCustomListOrder(prev => [...prev, newListName]); setNewListName(''); setShowNewListModal(false); };
    const deleteList = (name) => { const n = { ...customLists }; delete n[name]; setCustomLists(n); setCustomListOrder(prev => prev.filter(x => x !== name)); setListToDelete(null); };
    const moveList = (i, dir) => { const o = [...customListOrder]; if (dir === 'up' && i > 0) [o[i], o[i - 1]] = [o[i - 1], o[i]]; else if (dir === 'down' && i < o.length - 1) [o[i], o[i + 1]] = [o[i + 1], o[i]]; setCustomListOrder(o); };

    const createNotebook = () => { if (!newNotebookName.trim()) return; const id = 'nb_' + Date.now(); setNotebooks(p => ({ ...p, [id]: { id, name: newNotebookName, date: Date.now() } })); setNewNotebookName(''); setShowNewNotebookModal(false); showToast("Notebook created!", "success"); };
    const deleteNotebook = (id) => {
        const next = { ...notebooks }; delete next[id]; setNotebooks(next);
        setPersonalWords(prev => prev.filter(w => w.notebookId !== id));
        setActiveNotebookId(null);
        setNotebookToDelete(null); showToast("Notebook deleted");
    };

    const handleCreateList = () => {
        if (!renameData.value.trim()) return;
        const newListName = renameData.value.trim();

        if (renameData.type === 'list') {
            if (customLists[newListName]) {
                showToast("List already exists!");
                return;
            }
            const newList = renameData.initialEntryIndex ? [renameData.initialEntryIndex] : [];
            const newLists = { ...customLists, [newListName]: newList };
            setCustomLists(newLists);
            setCustomListOrder([...customListOrder, newListName]);
            localStorage.setItem('cherokee_app_custom_lists', JSON.stringify(newLists));
            localStorage.setItem('cherokee_app_custom_list_order', JSON.stringify([...customListOrder, newListName]));
            if (renameData.initialEntryIndex) {
                showToast(`Added to "${newListName}"`, 'success');
            }
        } else if (renameData.type === 'notebook') {
            // ... notebook logic
        }
        setShowNewListModal(false);
        setRenameData({ type: null, target: null, value: '', initialEntryIndex: null });
    };

    const handleRename = () => {
        const { type, target, value } = renameData;
        if (!value.trim() || !target) return;

        if (type === 'notebook') {
            setNotebooks(prev => ({
                ...prev,
                [target]: { ...prev[target], name: value }
            }));
            setShowNewNotebookModal(false);
            showToast("Notebook renamed", "success");
        } else if (type === 'list') {
            if (!target) { // This means it's a new list being created via rename modal
                handleCreateList();
                return;
            }
            if (customLists[value] || value === 'Favorites') {
                showToast("List already exists"); return;
            }
            const oldData = customLists[target];
            setCustomLists(prev => {
                const next = { ...prev };
                next[value] = oldData;
                delete next[target];
                return next;
            });
            setCustomListOrder(prev => prev.map(n => n === target ? value : n));
            setShowNewListModal(false);
            showToast("List renamed", "success");
        }
        setRenameData({ type: null, target: null, value: '', initialEntryIndex: null });
    };

    // Manual Upload Removed - Handled by CorpusContext
    // Manual Upload Removed - Handled by CorpusContext

    const handleExportNotebook = () => {
        if (!activeNotebookId) return;
        exportNotebookToCSV(activeNotebookId, notebooks[activeNotebookId].name, personalWords);
        showToast("CSV Exported", "success");
    };
    const handleImportNotebook = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importNotebookFromCSV(file, (importedWords) => {
            const newId = 'nb_' + Date.now();
            const newName = file.name.replace('.csv', '');
            setNotebooks(prev => ({ ...prev, [newId]: { id: newId, name: newName, date: Date.now() } }));

            const wordsWithId = importedWords.map((w, i) => ({ ...w, Index: newId + '_' + i, notebookId: newId, DateCreated: Date.now() }));
            setPersonalWords(prev => [...prev, ...wordsWithId]);
            showToast(`Imported ${newName}`, "success");
        });
        e.target.value = null;
    };
    const handleBackup = () => {
        const data = { favorites, customLists, customListOrder, notebooks, personalWords, userNotes, settings, searchHistory };
        downloadFile(JSON.stringify(data), `cherokee_backup_${Date.now()}.json`, 'application/json');
        showToast("Backup saved", "success");
    };
    const handleRestore = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (!e.target) return;
                const data = JSON.parse(e.target.result as string);
                if (data.favorites) setFavorites(data.favorites);
                if (data.customLists) setCustomLists(data.customLists);
                if (data.customListOrder) setCustomListOrder(data.customListOrder);
                if (data.notebooks) setNotebooks(data.notebooks);
                if (data.personalWords) setPersonalWords(data.personalWords);
                if (data.userNotes) setUserNotes(data.userNotes);
                if (data.userAudioMeta) setUserAudioMeta(data.userAudioMeta);
                if (data.settings) setSettings(data.settings);
                if (data.searchHistory) setSearchHistory(data.searchHistory);
                setActiveNotebookId(null);
                showToast("Data Restored!", "success");
                setShowBackupConfirm(false);
            } catch (err) { showToast("Invalid Backup File"); }
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const handleRestoreDefaults = () => {
        setSettings(DEFAULT_SETTINGS);
        setPosFilter("All");
        showToast("Settings restored to defaults", "success");
    };

    const openWordModal = (w: any = null) => { if (w) { setWordForm({ Entry: w.Entry || '', Syllabary: w.Syllabary || '', Definition: w.Definition || '', PoS: w.PoS || '', Entry_Tone: w.Entry_Tone || '', Notes: w.Notes || '' }); setEditingId(w.Index); } else { setWordForm({ Entry: '', Syllabary: '', Definition: '', PoS: '', Entry_Tone: '', Notes: '' }); setEditingId(null); } setShowWordModal(true); };
    const saveWord = () => {
        if ((!wordForm.Entry && !wordForm.Syllabary) || !wordForm.Definition) { showToast("Missing fields"); return; }
        let target = activeNotebookId;
        if (editingId) {
            const o = personalWords.find(w => w.Index === editingId);
            if (o) target = o.notebookId;
        }
        if (!target && !editingId) {
            const k = Object.keys(notebooks);
            if (k.length) target = k[0];
            else {
                const d = 'nb_' + Date.now();
                setNotebooks({ [d]: { id: d, name: "My Dictionary", date: Date.now() } });
                target = d;
            }
        }
        const nw = {
            ...wordForm,
            Index: editingId || Date.now().toString(),
            notebookId: target,
            DateCreated: editingId ? (personalWords.find(w => w.Index === editingId)?.DateCreated || Date.now()) : Date.now()
        };
        if (editingId) {
            setPersonalWords(p => p.map(w => w.Index === editingId ? nw : w));
            if (selectedEntry?.Index === editingId) setSelectedEntry({ ...nw, Source: nw.notebookId, Source_Long: notebooks[nw.notebookId!].name });
        } else {
            setPersonalWords(p => [nw, ...p]);
        }
        setShowWordModal(false);
        showToast("Saved", "success");
    };
    const confirmDeleteWord = () => {
        if (!wordToDelete) return;
        setPersonalWords(p => p.filter(w => w.Index !== wordToDelete));
        if (favorites.includes(wordToDelete)) toggleFavorite(wordToDelete);
        setCustomLists(prev => {
            const n: any = { ...prev };
            Object.keys(n).forEach(k => n[k] = n[k].filter((i: any) => i !== wordToDelete));
            return n;
        });
        setSelectedEntry(null);
        setWordToDelete(null);
        showToast("Deleted");
    };

    const openNotesModal = (entry, content, isPersonal) => {
        if (isPersonal) {
            openWordModal(entry);
        } else {
            setNoteTargetId(entry.Index); setCurrentNote(content || ''); setShowNotesModal(true);
        }
    };
    const saveNote = () => {
        if (!noteTargetId) return;
        const isP = personalWords.some(w => w.Index === noteTargetId);
        if (isP) {
            setPersonalWords(p => p.map(w => w.Index === noteTargetId ? { ...w, Notes: currentNote } : w));
            if (selectedEntry?.Index === noteTargetId) setSelectedEntry((p: any) => ({ ...p, Notes: currentNote }));
        } else {
            setUserNotes(p => ({ ...p, [noteTargetId]: currentNote }));
        }
        setShowNotesModal(false);
        showToast("Note saved", "success");
    };
    const addToHistory = (txt) => { if (!txt || txt.trim().length < 2) return; const c = txt.trim(); setSearchHistory(p => [c, ...p.filter(x => x !== c)].slice(0, 20)); };
    const deleteHistoryItem = (e, txt) => { e.stopPropagation(); setSearchHistory(p => p.filter(x => x !== txt)); };

    const openMoveModal = (wordIdx) => {
        setWordToMove(wordIdx);
        setShowMoveModal(true);
    };

    const handleMoveWord = (notebookId) => {
        if (!wordToMove) return;
        setPersonalWords(prev => prev.map(w => {
            if (w.Index === wordToMove) {
                return { ...w, notebookId: notebookId };
            }
            return w;
        }));
        if (selectedEntry && selectedEntry.Index === wordToMove) {
            const nb = notebooks[notebookId];
            setSelectedEntry((prev: any) => ({ ...prev, notebookId: notebookId, Source: notebookId, Source_Long: nb?.name }));
        }
        setShowMoveModal(false);
        setWordToMove(null);
        showToast("Word moved", "success");
    };

    const handleSaveAudio = async (entryIndex, blob, speaker) => {
        const audioId = 'ua_' + Date.now();
        try {
            await saveAudioToDB(audioId, blob);
            setUserAudioMeta(prev => {
                const currentList = prev[entryIndex] || [];
                return { ...prev, [entryIndex]: [...currentList, { id: audioId, speaker, date: Date.now() }] };
            });
            showToast("Audio saved", "success");
        } catch (e) {
            console.error(e);
            showToast("Failed to save audio");
        }
    };

    const handleDeleteAudio = async (entryIndex, audioId) => {
        try {
            await deleteAudioFromDB(audioId);
            setUserAudioMeta(prev => {
                const currentList = prev[entryIndex] || [];
                return { ...prev, [entryIndex]: currentList.filter(a => a.id !== audioId) };
            });
            showToast("Audio deleted");
        } catch (e) {
            console.error(e);
            showToast("Failed to delete audio");
        }
    };

    const sortedNotebookWords = useMemo(() => { if (!activeNotebookId) return []; const w = personalWords.filter(x => x.notebookId === activeNotebookId).map(x => ({ ...x, Source: activeNotebookId, Source_Long: notebooks[activeNotebookId]?.name })); if (pdSort === 'date') return w.sort((a, b) => b.DateCreated - a.DateCreated); if (pdSort === 'syllabary') return w.sort((a, b) => (a.Syllabary || '').localeCompare(b.Syllabary || '')); if (pdSort === 'translit') return w.sort((a, b) => (a.Entry || '').localeCompare(b.Entry || '')); return w.sort((a, b) => (a.Definition || '').localeCompare(b.Definition || '')); }, [personalWords, activeNotebookId, pdSort, notebooks]);

    // --- SEARCH ALGORITHM ---
    const searchResults = useMemo(() => {
        if (!query) return [];
        const lowerQuery = query.toLowerCase().trim();
        const queryWithTones = lowerQuery.replace(/[1234?]/g, m => ({ '1': '¹', '2': '²', '3': '³', '4': '⁴', '?': 'ʔ' }[m] || m));
        const { searchLangs, searchScopes } = settings;

        let regex: RegExp | null = null;
        if (settings.enableRegex) {
            try {
                const regexQuery = query.replace(/[1234]/g, m => ({ '1': '¹', '2': '²', '3': '³', '4': '⁴' }[m] || m));
                regex = new RegExp(regexQuery, 'i');
            } catch (e) { }
        }

        // SENTENCE MODE
        if (searchScope === 'sentences') {
            // 1. Text Match in Sentences
            const textMatches: any[] = sentences.map(s => {
                let score = 0;
                const fields: string[] = [];
                if (searchLangs.translit) fields.push(s.translit);
                if (searchLangs.syllabary) fields.push(s.syllabary);
                if (searchLangs.english) fields.push(s.english);

                for (const f of fields) {
                    if (!f) continue;
                    const fLower = f.toLowerCase();
                    if (fLower.includes(lowerQuery)) score = 50;
                }
                return { item: s, score, type: 'text' };
            }).filter(x => x.score > 0);

            // 2. Deep Search (Dictionary Links)
            // Find dictionary entries that match, then get their sentences
            const dictMatches = dictionary.filter(entry => {
                // Simplified dictionary search for deep linking
                const fields = [entry.Entry, entry.Syllabary, entry.Definition];
                return fields.some(f => f && f.toLowerCase().includes(lowerQuery));
            });

            const deepMatches: any[] = [];
            const seenSentences = new Set(textMatches.map(m => m.item.id));

            dictMatches.forEach(entry => {
                const linkedSentences = entryToSentencesMap.get(entry.id) || [];
                linkedSentences.forEach(sId => {
                    if (!seenSentences.has(sId)) {
                        const s = sentences.find(x => x.id === sId);
                        if (s) {
                            deepMatches.push({ item: s, score: 25, type: 'deep', via: entry });
                            seenSentences.add(sId);
                        }
                    }
                });
            });

            return [...textMatches, ...deepMatches].sort((a, b) => b.score - a.score);
        }

        // DICTIONARY MODE (Legacy Logic)
        return allData.map(entry => {
            let score = 0;

            if (posFilter !== "All") {
                if (entry.PoS !== posFilter) return { ...entry, score: 0 };
            }

            const fieldsToSearch: string[] = [];
            const isPersonal = !!notebooks[entry.Source];

            if (searchScopes.main) {
                if (searchLangs.translit && entry.Entry) fieldsToSearch.push(entry.Entry);
                if (searchLangs.syllabary && entry.Syllabary) fieldsToSearch.push(entry.Syllabary);
                if (searchLangs.english && entry.Definition) fieldsToSearch.push(entry.Definition);
                if (searchLangs.tone && entry.Entry_Tone) fieldsToSearch.push(entry.Entry_Tone);
            }
            if (searchScopes.verbs) {
                const verbCols = ['Verb_1st_Present', 'Verb_3rd_Past', 'Verb_3rd_Present_Habitual', 'Verb_2nd_Imperative', 'Verb_3rd_Infinitive'];
                verbCols.forEach(col => {
                    if (searchLangs.translit && entry[col]) fieldsToSearch.push(entry[col]);
                    if (searchLangs.syllabary && entry[col + '_Syllabary']) fieldsToSearch.push(entry[col + '_Syllabary']);
                    if (searchLangs.tone && entry[col + '_Tone']) fieldsToSearch.push(entry[col + '_Tone']);
                });
            }
            if (searchScopes.plurals) {
                if (searchLangs.translit && entry.Plural) fieldsToSearch.push(entry.Plural);
                if (searchLangs.syllabary && entry.Plural_Syllabary) fieldsToSearch.push(entry.Plural_Syllabary);
                if (searchLangs.tone && entry.Plural_Tone) fieldsToSearch.push(entry.Plural_Tone);
            }
            // REMOVED: searchScopes.sentences (Legacy column search)
            if (searchScopes.notes) {
                const note = isPersonal ? entry.Notes : userNotes[entry.Index];
                if (note) fieldsToSearch.push(note);
            }

            if (settings.enableRegex && regex) {
                if (fieldsToSearch.some(f => f && regex.test(f))) score = 100;
            } else {
                for (const field of fieldsToSearch) {
                    if (!field) continue;
                    const fLower = field.toLowerCase();
                    if (fLower === lowerQuery || fLower === queryWithTones) { score = 100; break; }
                    if (fLower.startsWith(lowerQuery) || fLower.startsWith(queryWithTones)) score = Math.max(score, 50);
                    else if (fLower.includes(lowerQuery) || fLower.includes(queryWithTones)) score = Math.max(score, 25);
                }
            }

            if (score > 0) {
                if (entry.Source === 'ced') score += 5;
                if (notebooks[entry.Source]) score += 10;
                if (entry.PoS && entry.PoS.toLowerCase().includes('v')) score += 1;
            }
            return { ...entry, score };
        })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score);
    }, [query, allData, notebooks, settings, userNotes, posFilter, searchScope, sentences, dictionary, entryToSentencesMap]);

    const filteredResults = useMemo(() => {
        if (!query && activeTab === 'search') return { active: [], inactive: [] };
        const active = searchResults.filter(item => {
            const src = item.Source?.toLowerCase();
            // REFACTOR: Don't check expandOthers here. Filter by the source value directly.
            if (notebooks[item.Source]) return filters[item.Source] !== false;
            return filters[src] !== false;
        });
        const inactive = searchResults.filter(item => {
            const src = item.Source?.toLowerCase();
            if (notebooks[item.Source]) return filters[item.Source] === false;
            return filters[src] === false;
        });
        return { active, inactive };
    }, [searchResults, filters, activeTab, query, notebooks]);

    const paginatedResults = useMemo(() => {
        const activeSlice = filteredResults.active.slice(0, resultLimit);
        const inactiveSlice = filteredResults.inactive.slice(0, Math.max(0, resultLimit - activeSlice.length));
        const hasMore = (filteredResults.active.length + filteredResults.inactive.length) > resultLimit;

        return { active: activeSlice, inactive: inactiveSlice, hasMore };
    }, [filteredResults, resultLimit]);


    const handleSearchTerm = (term) => {
        setInputValue(term);
        setQuery(term);
        setActiveTab('search');
        setSelectedEntry(null);
        updateUrl(null);
        addToHistory(term);
    };

    const handleEntryClick = (entry) => {
        if (activeTab === 'search' && query) addToHistory(query);
        setSelectedEntry(entry);
        updateUrl(entry);
    };

    // handleOpenNewListModal removed as unused




    // Manual Upload UI Removed
    // if (showManualUpload) ...
    // if (loading) ...

    return (
        <div className="h-screen w-full bg-[#F9F9F7] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col overflow-hidden relative">
            <header className="bg-white dark:bg-slate-900 px-4 py-3 shadow-sm z-10 flex items-center justify-between shrink-0 h-[60px]"><h1 className="font-noto-serif text-xl text-slate-800 dark:text-slate-100">ᏣᎳᎩ-English Dictionary</h1><button onClick={() => setShowSettingsModal(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300"><Menu size={24} strokeWidth={1.5} /></button></header>
            <main className="flex-1 overflow-hidden relative flex flex-col">
                {activeTab === 'search' && (
                    <div className="flex flex-col h-full">
                        <div className="p-4 bg-[#F9F9F7] dark:bg-slate-950">
                            <div className="relative">
                                <div className="absolute left-3 top-3.5 text-slate-400"><Search size={20} /></div>
                                <input type="text" className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 pl-10 pr-4 text-lg shadow-sm outline-none font-noto-serif text-slate-800 dark:text-slate-100" placeholder={settings.enableRegex ? "Regex Search..." : "Search..."} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addToHistory(query); }} />
                                {inputValue ? <button onClick={() => { setInputValue(''); setQuery(''); }} className="absolute right-3 top-3.5 text-slate-300"><X size={20} /></button> : null}
                            </div>
                            <div className="flex justify-end mt-2 items-center gap-4">
                                {/* Search Scope Toggle */}
                                <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex text-sm font-medium">
                                    <button
                                        onClick={() => setSearchScope('dictionary')}
                                        className={`px-3 py-1 rounded-md transition-all ${searchScope === 'dictionary' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                    >
                                        Dictionary
                                    </button>
                                    <button
                                        onClick={() => setSearchScope('sentences')}
                                        className={`px-3 py-1 rounded-md transition-all ${searchScope === 'sentences' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                    >
                                        Sentences
                                    </button>
                                </div>
                                <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-amber-700"><Filter size={12} /> Filter Sources</button>
                            </div>
                            {showFilters && (
                                <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2 animate-fade-in max-h-64 overflow-y-auto">
                                    {/* Source List */}
                                    {availableSources.map(src => {
                                        if (src.code === 'Other') {
                                            return (
                                                <div key="OtherGroup" className="flex flex-col">
                                                    <div className="flex items-center justify-between p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer flex-1">
                                                            {/* Tri-state Checkbox Implementation */}
                                                            <div onClick={(e) => { e.preventDefault(); toggleAllSmallSources(); }} className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-800 overflow-hidden">
                                                                {otherGroupState === 'all' && <div className="w-full h-full bg-amber-600 flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                                                                {otherGroupState === 'some' && <div className="w-full h-full bg-amber-600 flex items-center justify-center"><Minus size={12} className="text-white" /></div>}
                                                            </div>

                                                            <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">...</span>
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">Other Sources</span>
                                                            <span className="ml-auto text-xs text-slate-400 font-mono">({src.count})</span>
                                                        </label>
                                                        <button onClick={(e) => { e.preventDefault(); setExpandOthers(!expandOthers); }} className="p-1 ml-2 text-slate-400 hover:text-amber-600">
                                                            {expandOthers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    </div>

                                                    {/* Indented Small Sources */}
                                                    {expandOthers && (
                                                        <div className="ml-8 mt-1 border-l-2 border-slate-100 dark:border-slate-800 pl-2 space-y-1">
                                                            {expandedSmallSources.map(smallSrc => (
                                                                <label key={smallSrc.code} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                                    <input type="checkbox" checked={filters[smallSrc.code] !== false} onChange={() => setFilters(prev => ({ ...prev, [smallSrc.code]: !prev[smallSrc.code] }))} className="accent-amber-600 w-3 h-3 rounded" />
                                                                    <div className="flex-1 flex items-center min-w-0">
                                                                        <span className="truncate">{smallSrc.name}</span>
                                                                        <span className="ml-auto text-[10px] text-slate-300 font-mono">({smallSrc.count})</span>
                                                                    </div>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return (
                                            <label key={src.code} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                <input type="checkbox" checked={filters[src.code] !== false} onChange={() => setFilters(prev => ({ ...prev, [src.code]: !prev[src.code] }))} className="accent-amber-600 w-4 h-4 rounded" />
                                                <div className="flex-1 flex items-center min-w-0">
                                                    <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">{src.badge}</span>
                                                    <span className="truncate">{src.name}</span>
                                                    <span className="ml-auto text-xs text-slate-400 font-mono">({src.count})</span>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto">{query ? (<>{paginatedResults.active.length === 0 && paginatedResults.inactive.length === 0 && <div className="text-center mt-12 text-slate-400">No results found</div>}{paginatedResults.active.map(entry => <EntryCard key={entry.Index} entry={entry} notebooks={notebooks} userNotes={userNotes} userAudioMeta={userAudioMeta} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />)}{paginatedResults.inactive.length > 0 && <><div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 mt-4">Filtered</div>{paginatedResults.inactive.map(entry => <EntryCard key={entry.Index} entry={entry} notebooks={notebooks} userNotes={userNotes} userAudioMeta={userAudioMeta} favorites={favorites} customLists={customLists} onClick={handleEntryClick} isDimmed={true} showPos={settings.showPosInLists} />)}</>}
                            {paginatedResults.hasMore && (
                                <div className="p-4">
                                    <button onClick={() => setResultLimit(prev => prev + 50)} className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                                        Show More Results
                                    </button>
                                </div>
                            )}
                        </>) : (
                            <div className="p-4">
                                {searchHistory.length > 0 ? (
                                    <>
                                        <div className="flex items-center justify-between mb-2"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recent Searches</h3><button onClick={() => setSearchHistory([])} className="text-xs text-red-400 font-bold uppercase">Clear</button></div>
                                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                            {searchHistory.map((h, i) => (
                                                <div key={i} onClick={() => handleSearchTerm(h)} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                                                    <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300"><Clock size={16} className="text-slate-400" /><span>{h}</span></div>
                                                    <button onClick={(e) => deleteHistoryItem(e, h)} className="p-1 text-slate-300 hover:text-slate-500"><X size={16} /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-300 dark:text-slate-700"><Book size={48} strokeWidth={1} className="mb-4 opacity-20" /><p>Type to search the dictionary</p></div>
                                )}
                            </div>
                        )}</div></div>
                )}
                {activeTab === 'lists' && (<div className="flex flex-col h-full"><div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0"><h2 className="font-noto-serif text-2xl font-bold text-slate-800 dark:text-slate-100">My Lists</h2><button onClick={() => setIsReordering(!isReordering)} className={`text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors ${isReordering ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{isReordering ? 'Done' : 'Sort / Edit'}</button></div><div className="flex-1 overflow-y-auto p-4"><CollapsibleCard title="Favorites" count={favorites.length} icon={Star} defaultOpen={false} isReordering={false}>{favorites.length === 0 ? <div className="p-6 text-center text-slate-400 italic text-sm">No favorites yet.</div> : allData.filter(d => favorites.includes(d.Index)).map(entry => <EntryCard key={entry.Index} entry={entry} notebooks={notebooks} userNotes={userNotes} userAudioMeta={userAudioMeta} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />)}</CollapsibleCard>{customListOrder.map((listName, index) => (<CollapsibleCard key={listName} title={listName} count={customLists[listName]?.length || 0} icon={ListIcon} defaultOpen={false} onDelete={() => setListToDelete(listName)} onMoveUp={() => moveList(index, 'up')} onMoveDown={() => moveList(index, 'down')} isReordering={isReordering} onEdit={() => { setRenameData({ type: 'list', target: listName, value: listName }); setShowNewListModal(true); }}>{(!customLists[listName] || customLists[listName].length === 0) ? <div className="p-6 text-center text-slate-400 italic text-sm">Empty list.</div> : allData.filter(d => customLists[listName].includes(d.Index)).map(entry => <EntryCard key={entry.Index} entry={entry} notebooks={notebooks} userNotes={userNotes} userAudioMeta={userAudioMeta} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />)}</CollapsibleCard>))}</div></div>)}
                {activeTab === 'personal' && (!activeNotebookId ? (<div className="flex flex-col h-full"><div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0"><h2 className="font-noto-serif text-2xl font-bold text-slate-800 dark:text-slate-100">Notebooks</h2><button onClick={() => setShowNewNotebookModal(true)} className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md"><Plus size={20} /></button></div><div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">{Object.values(notebooks).map((nb: any) => (<div key={nb.id} onClick={() => setActiveNotebookId(nb.id)} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer h-32 justify-between"><Folder size={32} className="text-sky-800 dark:text-sky-400 opacity-80" /><div><h3 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{nb.name}</h3><p className="text-xs text-slate-400">{personalWords.filter(w => w.notebookId === nb.id).length} words</p></div></div>))}{Object.keys(notebooks).length === 0 && (<div className="col-span-2 text-center py-12 text-slate-400 flex flex-col items-center"><BookOpen size={48} className="mb-4 opacity-20" /><p>No notebooks yet.</p><button onClick={() => setShowNewNotebookModal(true)} className="mt-4 text-sky-600 dark:text-sky-400 font-bold">Create one</button></div>)}</div><div className="p-4 border-t border-slate-200 dark:border-slate-800"><label className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl cursor-pointer transition-colors"><Download size={20} /><span>Import CSV</span><input type="file" className="hidden" accept=".csv" onChange={handleImportNotebook} /></label></div></div>) : (<div className="flex flex-col h-full"><div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0"><button onClick={() => setActiveNotebookId(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full -ml-2"><ArrowLeft size={20} className="text-slate-500 dark:text-slate-400" /></button><div className="flex-1 flex items-center gap-2"><h2 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100">{notebooks[activeNotebookId]?.name}</h2><button onClick={() => { setRenameData({ type: 'notebook', target: activeNotebookId, value: notebooks[activeNotebookId].name }); setShowNewNotebookModal(true); }} className="p-1 text-slate-400 hover:text-sky-600 rounded-full"><Pencil size={14} /></button></div><div className="relative inline-block"><button onClick={() => setShowPdSortMenu(!showPdSortMenu)} className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Sort: {pdSort} <ChevronDown size={12} /></button>{showPdSortMenu && (<div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 w-40 overflow-hidden z-20 animate-fade-in"><button onClick={() => { setPdSort('date'); setShowPdSortMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">Date Added</button><button onClick={() => { setPdSort('translit'); setShowPdSortMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">A-Z Translit</button><button onClick={() => { setPdSort('english'); setShowPdSortMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">A-Z English</button></div>)}</div><div className="flex gap-2 ml-auto"><button onClick={handleExportNotebook} className="p-1.5 text-slate-400 hover:text-amber-600 rounded"><Share size={20} /></button><button onClick={() => setNotebookToDelete(activeNotebookId)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={20} /></button></div></div><div className="flex-1 overflow-y-auto p-4">{sortedNotebookWords.length === 0 ? <div className="text-center py-12 text-slate-400">Empty notebook.<br />Tap + to add a word.</div> : sortedNotebookWords.map(entry => <EntryCard key={entry.Index} entry={entry} notebooks={notebooks} userNotes={userNotes} userAudioMeta={userAudioMeta} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />)}</div><button onClick={() => openWordModal()} className="absolute bottom-6 right-6 bg-slate-900 dark:bg-slate-700 text-white p-4 rounded-full shadow-xl z-20 hover:scale-105 transition-transform"><Plus size={24} /></button></div>))}
            </main>
            <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between shrink-0 h-[80px] pb-5"><button onClick={() => { setActiveTab('search'); setIsReordering(false); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'search' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}><Search size={24} strokeWidth={2} /><span className="text-[10px] font-bold tracking-wide">Search</span></button><button onClick={() => { setActiveTab('lists'); setIsReordering(false); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'lists' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}><ListIcon size={24} strokeWidth={2} /><span className="text-[10px] font-bold tracking-wide">Lists</span></button><button onClick={() => { setActiveTab('personal'); setIsReordering(false); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'personal' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}><Book size={24} strokeWidth={2} /><span className="text-[10px] font-bold tracking-wide">Notebooks</span></button></nav>

            {/* DETAIL VIEW MOUNT */}
            {selectedEntry && (
                <EntryDetail
                    entry={selectedEntry}
                    notebooks={notebooks}
                    userNotes={userNotes}
                    userAudioMeta={userAudioMeta}
                    onSaveAudio={handleSaveAudio}
                    onDeleteAudio={handleDeleteAudio}
                    favorites={favorites}
                    customLists={customLists}
                    customListOrder={customListOrder}
                    onClose={() => { setSelectedEntry(null); updateUrl(null); }}
                    onEdit={(entry, content, isNote) => isNote ? openNotesModal(entry, content, false) : openWordModal(entry)}
                    onToggleFavorite={toggleFavorite}
                    onToggleList={toggleInList}
                    onDelete={(idx) => { setWordToDelete(idx); }}
                    onSearchTerm={handleSearchTerm}
                    onOpenNewListModal={() => setShowNewListModal(true)}
                    onMove={openMoveModal}
                />
            )}

            {/* MODALS */}
            {showSettingsModal && (
                <Modal title="Settings" onClose={() => setShowSettingsModal(false)}>
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                        <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Dark Mode</span><span className="text-xs text-slate-400">Toggle app theme</span></div><button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))} className={`transition-colors ${settings.darkMode ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'}`}>{settings.darkMode ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                        <hr className="border-slate-100 dark:border-slate-800" />
                        <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Enable Regex Search</span><span className="text-xs text-slate-400">Use regular expressions</span></div><button onClick={() => setSettings(s => ({ ...s, enableRegex: !s.enableRegex }))} className={`transition-colors ${settings.enableRegex ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'}`}>{settings.enableRegex ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                        <hr className="border-slate-100 dark:border-slate-800" />
                        <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Show PoS in Lists</span><span className="text-xs text-slate-400">Display Part of Speech in search/lists</span></div><button onClick={() => setSettings(s => ({ ...s, showPosInLists: !s.showPosInLists }))} className={`transition-colors ${settings.showPosInLists ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'}`}>{settings.showPosInLists ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                        <hr className="border-slate-100 dark:border-slate-800" />
                        <div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Search Languages</h4><div className="space-y-2">{[{ k: 'syllabary', l: 'ᏣᎳᎩ (Syllabary)' }, { k: 'translit', l: 'Jalagi (Translit)' }, { k: 'english', l: 'English' }, { k: 'tone', l: 'Tone' }].map(opt => (<label key={opt.k} className="flex items-center justify-between cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.l}</span><input type="checkbox" checked={settings.searchLangs[opt.k]} onChange={() => setSettings(s => ({ ...s, searchLangs: { ...s.searchLangs, [opt.k]: !s.searchLangs[opt.k] } }))} className="accent-amber-600 w-5 h-5 rounded" /></label>))}</div></div>
                        <hr className="border-slate-100 dark:border-slate-800" />
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Search Scope</h4>

                            {/* CHECKBOXES FIRST */}
                            <div className="space-y-2 mb-4">{[{ k: 'main', l: 'Main Entry' }, { k: 'verbs', l: 'Verb Forms' }, { k: 'plurals', l: 'Plurals' }, { k: 'sentences', l: 'Sentences' }, { k: 'notes', l: 'Notes' }].map(opt => (<label key={opt.k} className="flex items-center justify-between cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.l}</span><input type="checkbox" checked={settings.searchScopes[opt.k]} onChange={() => setSettings(s => ({ ...s, searchScopes: { ...s.searchScopes, [opt.k]: !s.searchScopes[opt.k] } }))} className="accent-amber-600 w-5 h-5 rounded" /></label>))}</div>

                            {/* POS FILTER Moved Here (Below Checkboxes) */}
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Filter by Part of Speech</label>
                                <select
                                    value={posFilter}
                                    onChange={(e) => setPosFilter(e.target.value)}
                                    className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm outline-none"
                                >
                                    {uniquePoS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="pt-2 text-center"><div className="text-[10px] font-bold text-slate-300 uppercase">Searchable Entries</div><div className="text-sm font-bold text-slate-400">{searchableCount}</div></div>
                        <hr className="border-slate-100 dark:border-slate-800" />
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Data Management</h4>
                            <div className="space-y-3">
                                <button onClick={handleBackup} className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700"><Download size={20} /> Backup Data (JSON)</button>
                                <label className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"><Share size={20} /><span>Restore Data</span><input type="file" className="hidden" accept=".json" onChange={(e) => { setShowSettingsModal(false); setShowBackupConfirm(true); restoreInputRef.current = e; }} /></label>
                            </div>
                        </div>

                        {/* RESTORE DEFAULTS */}
                        <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 text-center">
                            <button onClick={handleRestoreDefaults} className="text-xs font-bold text-red-400 uppercase tracking-wide hover:text-red-600">Restore Default Settings</button>
                        </div>
                    </div>
                </Modal>
            )}
            {/* REUSED MODAL FOR NEW LIST / NEW NOTEBOOK / RENAME */}
            {showNewListModal && (<Modal title={renameData.type === 'list' ? "Rename List" : "New List"} onClose={() => { setShowNewListModal(false); setRenameData({ type: null, target: null, value: '' }); }}><input type="text" autoFocus placeholder={renameData.type === 'list' ? "Rename list..." : "Enter list name..."} value={renameData.value || newListName} onChange={(e) => renameData.type === 'list' ? setRenameData({ ...renameData, value: e.target.value }) : setNewListName(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 transition-all dark:text-white" /><button onClick={renameData.type === 'list' ? handleRename : createNewList} disabled={!(renameData.type === 'list' ? renameData.value : newListName).trim()} className="w-full mt-4 bg-amber-600 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{renameData.type === 'list' ? "Rename" : "Create"}</button></Modal>)}
            {showNewNotebookModal && (<Modal title={renameData.type === 'notebook' ? "Rename Notebook" : "New Notebook"} onClose={() => { setShowNewNotebookModal(false); setRenameData({ type: null, target: null, value: '' }); }}><input type="text" autoFocus placeholder={renameData.type === 'notebook' ? "Rename notebook..." : "Enter notebook name..."} value={renameData.value || newNotebookName} onChange={(e) => renameData.type === 'notebook' ? setRenameData({ ...renameData, value: e.target.value }) : setNewNotebookName(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 transition-all dark:text-white" /><button onClick={renameData.type === 'notebook' ? handleRename : createNotebook} disabled={!(renameData.type === 'notebook' ? renameData.value : newNotebookName).trim()} className="w-full mt-4 bg-sky-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">{renameData.type === 'notebook' ? "Rename" : "Create"}</button></Modal>)}
            {listToDelete && (<Modal title="Delete List?" onClose={() => setListToDelete(null)}><p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete <strong>"{listToDelete}"</strong>? This action cannot be undone.</p><button onClick={() => deleteList(listToDelete)} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Delete</button></Modal>)}
            {wordToDelete && (<Modal title="Delete Word?" onClose={() => setWordToDelete(null)}><p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this word? This will remove it from all your lists.</p><button onClick={confirmDeleteWord} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Delete</button></Modal>)}
            {notebookToDelete && (<Modal title="Delete Notebook?" onClose={() => setNotebookToDelete(null)}><p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this notebook? All words inside it will be lost.</p><button onClick={() => deleteNotebook(notebookToDelete)} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Delete</button></Modal>)}
            {showBackupConfirm && (
                <Modal title="Restore Backup?" onClose={() => setShowBackupConfirm(false)}>
                    <p className="text-slate-600 dark:text-slate-300 mb-6">This will <strong>overwrite</strong> all your current notebooks, lists, and settings. This action cannot be undone.</p>
                    <button onClick={() => handleRestore(restoreInputRef.current)} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Yes, Overwrite Everything</button>
                </Modal>
            )}
            {showWordModal && (<Modal title={editingId ? "Edit Word" : "New Word"} onClose={() => setShowWordModal(false)}><div className="space-y-3"><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Syllabary (Cherokee)</label><input type="text" value={wordForm.Syllabary} onChange={e => setWordForm({ ...wordForm, Syllabary: e.target.value })} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-cherokee text-lg outline-none focus:border-amber-500 dark:text-white" /></div><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Transliteration (Cherokee)</label><input type="text" value={wordForm.Entry} onChange={e => setWordForm({ ...wordForm, Entry: e.target.value })} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white" /></div><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Definition</label><input type="text" value={wordForm.Definition} onChange={e => setWordForm({ ...wordForm, Definition: e.target.value })} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white" /></div><div className="flex gap-2"><div className="flex-1"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">PoS (Optional)</label><input type="text" value={wordForm.PoS} onChange={e => setWordForm({ ...wordForm, PoS: e.target.value })} placeholder="n, v, adj..." className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white" /></div><div className="flex-1"><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Tone (Optional)</label><input type="text" value={wordForm.Entry_Tone} onChange={e => setWordForm({ ...wordForm, Entry_Tone: formatToneInput(e.target.value) })} placeholder="Type 1-4 for tones" className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-sans dark:text-white" /></div></div><div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Notes</label><textarea value={wordForm.Notes} onChange={e => setWordForm({ ...wordForm, Notes: e.target.value })} rows={3} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 resize-none dark:text-white" placeholder="Add conjugations, examples, or extra info here..."></textarea></div></div><button onClick={saveWord} className="w-full mt-6 bg-amber-600 text-white font-bold py-3 rounded-lg">Save Word</button></Modal>)}
            {showNotesModal && (<Modal title="Edit Notes" onClose={() => setShowNotesModal(false)}><p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Add personal notes to this dictionary entry. These are saved only on this device.</p><textarea value={currentNote} onChange={e => setCurrentNote(e.target.value)} rows={6} autoFocus className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 resize-none font-sans dark:text-white" placeholder="Write your notes here..."></textarea><button onClick={saveNote} className="w-full mt-4 bg-amber-600 text-white font-bold py-3 rounded-lg">Save Note</button></Modal>)}

            {/* MOVE NOTEBOOK MODAL */}
            {showMoveModal && (
                <Modal title="Move to Notebook" onClose={() => setShowMoveModal(false)}>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {Object.values(notebooks).length === 0 && <p className="text-slate-400 italic">No notebooks available.</p>}
                        {Object.values(notebooks).map((nb: any) => (
                            <button key={nb.id} onClick={() => handleMoveWord(nb.id)} className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
                                <Folder size={20} className="text-sky-600 dark:text-sky-400" />
                                <span className="font-bold text-slate-700 dark:text-slate-200">{nb.name}</span>
                            </button>
                        ))}
                    </div>
                </Modal>
            )}

            <Toast show={toast.show} message={toast.message} type={toast.type} />
        </div>
    );
}

export default App;
