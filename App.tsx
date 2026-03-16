
import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Book, Menu, X, Filter, Clock, ListIcon, Folder, BookOpen, Download, ArrowLeft, Pencil, ChevronDown, Share, Trash2, Plus, ChevronUp, Minus, Check, ToggleLeft, ToggleRight, Box, Layout } from './components/Icons';
import { Toast, Modal } from './components/UI';
import EntryCard from './components/EntryCard';
import EntryDetail from './components/EntryDetail';

import PackageManagerTab from './components/PackageManagerTab';
import { useCorpus } from './components/CorpusContext';
import { downloadFile, exportDictionaryToCSV, importDictionaryFromCSV, performSearch } from './utils';
import { SentenceCard } from './components/SentenceCard';
import WidgetsTab from './components/WidgetsTab';

import { usePackageManager } from './components/PackageManagerContext';
import ListsTab, { ListData } from './components/ListsTab';
import { WordModal } from './components/WordModal';
import { AdditionalFormsModal } from './components/AdditionalFormsModal';
import { RainbowGradient } from './components/Icons';
import { ReaderTab } from './components/ReaderTab';
import { ReaderView } from './components/ReaderView';
import { TextImporter } from './components/TextImporter';
import { useReader } from './components/ReaderContext';

const DEFAULT_SETTINGS = {
    darkMode: false,
    enableRegex: false,
    showPosInLists: false,
    searchLangs: { syllabary: true, translit: true, english: true, tone: false },
    searchScopes: { main: true, otherForms: true, sentences: false, notes: false },
};

function App() {
    const { packages, importedData } = usePackageManager();
    const { dictionary, sentences, userSentences, glosses, loading, entryToSentencesMap, addUserSentence, removeUserSentence, removeUserSentences, removeUserGloss, customDictionaries, personalWords, setCustomDictionaries, setPersonalWords, userAudioMeta, saveAudio, deleteAudio, sentenceMap, userWordForms, setUserWordForms, userNotes, setUserNotes } = useCorpus();
    const { findBookAndChapterForSentence } = useReader();

    // Legacy state replacements
    const csvData = dictionary; // Map dictionary to csvData for compatibility


    const [dictionaryMode, setDictionaryMode] = useState<'words' | 'sentences'>('words');

    // const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
    // const [showManualUpload, setShowManualUpload] = useState(false);


    const [activeTab, setActiveTab] = useState<string>('search');
    const [searchScope, setSearchScope] = useState<'dictionary' | 'sentences'>('dictionary');
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [activeDictionaryId, setActiveDictionaryId] = useState<string | null>(null);
    const [activeListId, setActiveListId] = useState<string | null>(null);
    const [listsView, setListsView] = useState<'all' | 'detail'>('all');

    // Reader state
    const [readerView, setReaderView] = useState<'list' | 'reading' | 'importing'>('list');
    const [activeBookId, setActiveBookId] = useState<string | null>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [scrollToSentenceId, setScrollToSentenceId] = useState<string | undefined>(undefined);
    const [importerDictionaryId, setImporterDictionaryId] = useState<string | undefined>(undefined);

    // Search & Input States
    const [inputValue, setInputValue] = useState('');
    const [query, setQuery] = useState('');
    const [resultLimit, setResultLimit] = useState(50);
    const [posFilter, setPosFilter] = useState("All");

    const [filters, setFilters] = useState<Record<string, boolean>>({}); // Dictionary Filters
    const [sentenceFilters, setSentenceFilters] = useState<Record<string, boolean>>({}); // Sentence Filters
    const [showFilters, setShowFilters] = useState(false);
    const [expandOthers, setExpandOthers] = useState(false);
    const [expandedSmallSources, setExpandedSmallSources] = useState(false);

    const [favorites, setFavorites] = useState<string[]>([]);
    const [customLists, setCustomLists] = useState<Record<string, ListData | string[]>>({});
    const [customListOrder, setCustomListOrder] = useState<string[]>([]);
    const [searchHistory, setSearchHistory] = useState<string[]>([]);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState('');
    const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
    const [showWordModal, setShowWordModal] = useState(false);
    const [wordForm, setWordForm] = useState({ Entry: '', Syllabary: '', Definition: '', PoS: '', Entry_Tone: '', Notes: '', customDictionaryId: '' });
    const [isSentenceMode, setIsSentenceMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [pdSort] = useState('date');
    const [showNotesModal, setShowNotesModal] = useState(false);
    const [currentNote, setCurrentNote] = useState('');
    const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
    const [wordToDelete, setWordToDelete] = useState<string | null>(null);
    const [showNewDictionaryModal, setShowNewDictionaryModal] = useState(false);
    const [newDictionaryName, setNewDictionaryName] = useState('');
    const [dictionaryToDelete, setDictionaryToDelete] = useState<string | null>(null);
    const [showBackupConfirm, setShowBackupConfirm] = useState(false);
    const restoreInputRef = useRef<any>(null);

    const [renameData, setRenameData] = useState<{ type: string | null; target: string | null; value: string; initialEntryIndex?: string | null }>({ type: null, target: null, value: '', initialEntryIndex: null });

    const [showMoveModal, setShowMoveModal] = useState(false);
    const [wordToMove, setWordToMove] = useState<string | null>(null);

    const [showAdditionalFormsModal, setShowAdditionalFormsModal] = useState(false);
    const [additionalFormsTargetId, setAdditionalFormsTargetId] = useState<string | null>(null);
    const [currentAdditionalForms, setCurrentAdditionalForms] = useState('');

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
                const savedSettings = localStorage.getItem('cherokee_app_settings');
                const savedHistory = localStorage.getItem('cherokee_app_history');

                if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
                if (savedSettings) {
                    const parsed = JSON.parse(savedSettings);
                    setSettings(prev => ({
                        ...prev, ...parsed,
                        searchLangs: { ...prev.searchLangs, ...parsed.searchLangs },
                        searchScopes: { ...prev.searchScopes, ...parsed.searchScopes }
                    }));
                }


                const savedFavs = localStorage.getItem('cherokee_app_favorites'); if (savedFavs) setFavorites(JSON.parse(savedFavs));
                const savedLists = localStorage.getItem('cherokee_app_custom_lists');
                let parsedLists: Record<string, any> = {};

                if (savedLists) {
                    parsedLists = JSON.parse(savedLists);

                    // MIGRATION: Convert Array<string> to ListData
                    // We can just set it as is, and the type safety allows string[], 
                    // BUT let's aggressively migrate on load if possible or just handle mixed types.
                    // Actually, let's migrate right here to ensure clean state.
                    let migrated = false;
                    Object.keys(parsedLists).forEach(key => {
                        const val = parsedLists[key];
                        if (Array.isArray(val)) {
                            parsedLists[key] = {
                                id: key, // Use name as ID for legacy
                                name: key,
                                items: val,
                                type: 'user',
                                color: 'gold'
                            };
                            migrated = true;
                        }
                    });

                    setCustomLists(parsedLists);

                    if (migrated) {
                        try {
                            localStorage.setItem('cherokee_app_custom_lists', JSON.stringify(parsedLists));
                        } catch (e) { }
                    }
                }

                const savedOrder = localStorage.getItem('cherokee_app_list_order');
                // Ensure default built-in lists are present in order
                let order = savedOrder ? JSON.parse(savedOrder) : Object.keys(parsedLists);
                const required = ['favorites', 'builtin_audio', 'builtin_notes', 'builtin_glosses', 'builtin_entries'];
                required.forEach(key => {
                    if (!order.includes(key)) order.push(key);
                });

                setCustomListOrder(order);

            } catch (e) {
                console.warn("LocalStorage access failed:", e);
            }
        };

        initLoad();
    }, []);

    // Migration for Sentence Notes
    useEffect(() => {
        if (!loading && sentenceMap.size > 0 && Object.keys(userNotes).length > 0) {
            let migrated = false;
            const newNotes = { ...userNotes };

            Object.keys(newNotes).forEach(key => {
                // If key is a sentence ID (and not already prefixed)
                if (!key.startsWith('s_') && sentenceMap.has(key)) {
                    // Check if it's already migrated (don't overwrite if s_key exists?)
                    // But if it exists as plain key, it's ambiguous.
                    // Assuming legacy notes were saved with plain ID.
                    // We migrate to s_ID.
                    const newKey = `s_${key}`;
                    if (!newNotes[newKey]) {
                        newNotes[newKey] = newNotes[key];
                        delete newNotes[key];
                        migrated = true;
                    }
                }
            });

            if (migrated) {
                setUserNotes(newNotes);
                console.log("Migrated sentence notes to prefixed keys.");
            }
        }
    }, [loading, sentenceMap]);

    // Initialize Filters when Data Loads to fix "first click" bug and set defaults
    useEffect(() => {
        if (csvData.length > 0) {
            setFilters(prev => {
                const newFilters: Record<string, boolean> = { ...prev };
                const sources = new Set(csvData.map(d => d.Source));

                // Build Source Meta Map from all active packages
                const sourceMeta: Record<string, "prioritize" | "filter"> = {};
                packages.forEach(p => {
                    if (p.status === 'active' && p.metadata.source_meta) {
                        Object.assign(sourceMeta, p.metadata.source_meta);
                    }
                });

                sources.forEach((s) => {
                    const src = s as string;
                    if (!src) return;
                    if (newFilters[src] === undefined) {
                        // Default to true unless metadata says "filter"
                        newFilters[src] = sourceMeta[src] !== 'filter';
                    }
                });
                return newFilters;
            });
        }
    }, [csvData, packages]);

    // Initialize Sentence Filters
    useEffect(() => {
        if (sentences.length > 0) {
            setSentenceFilters(prev => {
                const newFilters: Record<string, boolean> = { ...prev };
                const sources = new Set([...sentences, ...userSentences].map(s => s.source));
                sources.forEach((s) => {
                    if (!s) return;
                    if (newFilters[s] === undefined) {
                        // Default CED and CNT (Cherokee New Testament) to false for sentences if desired, or all true
                        // User said: "filter out sentence sources such as CED and Cherokee New Testament when you are on the sentence tab"
                        // This implies they want to be ABLE to filter them, or maybe default them to false?
                        // "read from the sentences csv... so we can filter out sentence sources... when you are on the sentence tab"
                        // I'll default all to true for now, unless user specified defaults.
                        newFilters[s] = true;
                    }
                });
                return newFilters;
            });
        }
    }, [sentences, userSentences]);


    useEffect(() => { try { localStorage.setItem('cherokee_app_settings', JSON.stringify(settings)); } catch (e) { } }, [settings]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_history', JSON.stringify(searchHistory)); } catch (e) { } }, [searchHistory]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_favorites', JSON.stringify(favorites)); } catch (e) { } }, [favorites]);
    useEffect(() => { try { localStorage.setItem('cherokee_app_custom_lists', JSON.stringify(customLists)); localStorage.setItem('cherokee_app_list_order', JSON.stringify(customListOrder)); } catch (e) { } }, [customLists, customListOrder]);
    useEffect(() => {
        const keys = Object.keys(customLists);
        const missing = keys.filter(k => !customListOrder.includes(k)); if (missing.length) setCustomListOrder(prev => [...prev, ...missing]);

        const importedListIds = packages.flatMap(p => importedData[p.id]?.lists?.map(l => l.id) || []);
        const valid = customListOrder.filter(k =>
            keys.includes(k) ||
            k === 'favorites' ||
            k.startsWith('builtin_') ||
            importedListIds.includes(k)
        );
        if (valid.length !== customListOrder.length) setCustomListOrder(valid);
    }, [customLists, packages, importedData]);

    const allData = useMemo(() => {
        const isUserLibraryActive = packages.find(p => p.id === 'user')?.status === 'active';
        const dictionaryEntries = isUserLibraryActive
            ? personalWords.map(w => ({ ...w, id: w.Index, Source: w.customDictionaryId, Source_Long: customDictionaries[w.customDictionaryId || '']?.name || 'Custom Dictionary' }))
            : [];
        return [...dictionaryEntries, ...csvData];
    }, [csvData, personalWords, customDictionaries, packages]);

    const updateUrl = (entry) => {
        try {
            const url = new URL(window.location.href);
            if (entry) {
                if (entry.Index) url.searchParams.set('word', entry.Index);
                else if (entry.id) url.searchParams.set('sentence', entry.id);
            } else {
                url.searchParams.delete('word');
                url.searchParams.delete('sentence');
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
            const sId = params.get('sentence');
            if (idx) {
                const found = allData.find(d => d.Index === idx);
                if (found) setSelectedEntry(found);
            } else if (sId) {
                const found = [...sentences, ...userSentences].find(s => s.id === sId);
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
            const sId = params.get('sentence');
            if (idx && !selectedEntry) {
                const found = allData.find(d => d.Index === idx);
                if (found) setSelectedEntry(found);
            } else if (sId && !selectedEntry) {
                const found = [...sentences, ...userSentences].find(s => s.id === sId);
                if (found) setSelectedEntry(found);
            }
        }
    }, [loading, allData]);


    const sourceStats = useMemo(() => {
        const counts = {};
        allData.forEach(d => {
            const src = d.Source;
            if (src) counts[src] = (counts[src] || 0) + 1;
        });

        // Identify "Small Sources" based on Metadata
        const smallSourceCodes: string[] = [];

        // Build Metadata Map
        const sourceMeta: Record<string, string> = {};
        packages.forEach(p => {
            if (p.status === 'active' && p.metadata.source_meta) {
                Object.assign(sourceMeta, p.metadata.source_meta);
            }
        });

        Object.keys(counts).forEach(src => {
            if (src.startsWith('nb_') || src === 'pd') return; // Always main

            const meta = sourceMeta[src];
            if (meta === 'other') {
                smallSourceCodes.push(src);
            }
        });

        return { counts, smallSourceCodes };
    }, [allData, packages]);

    const availableSources = useMemo(() => {
        const unique = new Map();
        const sources: { code: string; name: string; badge: string; count: number; packageId?: string; packageDate?: number }[] = [];

        // Build Source Name Map from all active packages
        const sourceNames: Record<string, string> = {};
        packages.forEach(p => {
            if (p.status === 'active' && p.metadata.source_names) {
                Object.assign(sourceNames, p.metadata.source_names);
            }
        });

        allData.forEach(d => {
            if (d.Source && !unique.has(d.Source)) {
                unique.set(d.Source, true);

                if (sourceStats.smallSourceCodes.includes(d.Source)) return;

                let code = d.Source;
                let name = d.Source_Long || sourceNames[code] || d.Source.toUpperCase();
                let badge = code.substring(0, 3).toUpperCase();
                let packageId: string | undefined = undefined;
                let packageDate = 0;

                if (code.startsWith('nb_') || code === 'pd') {
                    name = customDictionaries[code]?.name || d.Source_Long || 'Imported Dictionary';
                    badge = (name || '??').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                    packageDate = Date.now(); // User data always on top
                } else {
                    badge = code.toUpperCase();
                    // Find which package this source belongs to (heuristic: check metadata)
                    const pkg = packages.find(p => p.status === 'active' && p.metadata.source_names && p.metadata.source_names[code]);
                    if (pkg) {
                        packageId = pkg.id;
                        packageDate = pkg.metadata.date_created || 0;
                    }
                }
                sources.push({ code, name, badge, count: sourceStats.counts[code] || 0, packageId, packageDate });
            }
        });

        // Custom Sort
        sources.sort((a, b) => {
            // 1. Custom Dictionaries/Personal Data First
            const isNbA = a.code.startsWith('nb_') || a.code === 'pd';
            const isNbB = b.code.startsWith('nb_') || b.code === 'pd';
            if (isNbA && !isNbB) return -1;
            if (!isNbA && isNbB) return 1;

            // 2. Sort by Package Date (Recent first, 0 last)
            if (a.packageDate !== b.packageDate) {
                // If one is 0 (official), push to bottom
                if (a.packageDate === 0) return 1;
                if (b.packageDate === 0) return -1;
                return b.packageDate! - a.packageDate!;
            }

            // 3. Sort by Metadata Order (for official sources)
            const sourceOrder: string[] = [];
            packages.forEach(p => {
                if (p.status === 'active' && p.metadata.source_names) {
                    sourceOrder.push(...Object.keys(p.metadata.source_names));
                }
            });

            const idxA = sourceOrder.indexOf(a.code);
            const idxB = sourceOrder.indexOf(b.code);

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return 1; // If A is not in order, put it after B (if B is in order)
            if (idxB !== -1) return -1;

            // 4. Alphabetical by Name (Fallback)
            return a.name.localeCompare(b.name);
        });

        // Always add "Other" if small sources exist
        if (sourceStats.smallSourceCodes.length > 0) {
            const otherCount = sourceStats.smallSourceCodes.reduce((acc, code) => acc + (sourceStats.counts[code] || 0), 0);
            sources.push({ code: 'Other', name: 'Other Sources', badge: '...', count: otherCount });
        }

        return sources;
    }, [allData, customDictionaries, sourceStats, packages]);

    // SENTENCE SOURCES
    const availableSentenceSources = useMemo(() => {
        const counts: Record<string, number> = {};
        const combined = [...sentences, ...userSentences];
        combined.forEach(s => {
            const src = s.source;
            if (src) counts[src] = (counts[src] || 0) + 1;
        });

        const sortedSources = Object.entries(counts).map(([code, count]) => {
            // Try to find name in customDictionaries
            let name = customDictionaries[code]?.name;
            let badge = '';

            if (name) {
                // It's a user custom dictionary
                badge = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            } else {
                // Try to find in packages - Check by source_names shorthand
                const pkgBySource = packages.find(p => p.status === 'active' && p.metadata.source_names && p.metadata.source_names[code]);
                // Check by Package ID direct match
                const pkgById = packages.find(p => p.status === 'active' && p.id === code);

                if (pkgBySource) {
                    name = pkgBySource.metadata.source_names?.[code] || code;
                    badge = code.substring(0, 3).toUpperCase();
                } else if (pkgById) {
                    name = pkgById.name;
                    // Use initials for badge
                    const parts = pkgById.name.split(' ');
                    if (parts.length >= 2) badge = (parts[0][0] + parts[1][0]).toUpperCase();
                    else badge = pkgById.name.substring(0, 2).toUpperCase();
                } else if (code === 'user') {
                    name = 'My Library';
                    badge = 'MY';
                } else {
                    // Fallback
                    name = code;
                    badge = code.substring(0, 3).toUpperCase();
                }
            }

            return { code, name, count, badge };
        }).sort((a, b) => {
            // User sentences/customDictionaries first
            const isUserA = a.code === 'user' || !!customDictionaries[a.code];
            const isUserB = b.code === 'user' || !!customDictionaries[b.code];
            if (isUserA && !isUserB) return -1;
            if (!isUserA && isUserB) return 1;
            if (isUserA && isUserB) return a.name.localeCompare(b.name); // Sort user sources by name

            // Sort by Metadata Order
            const sourceOrder: string[] = [];
            packages.forEach(p => {
                if (p.status === 'active' && p.metadata.source_names) {
                    sourceOrder.push(...Object.keys(p.metadata.source_names));
                }
            });

            const idxA = sourceOrder.indexOf(a.code);
            const idxB = sourceOrder.indexOf(b.code);

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return 1;
            if (idxB !== -1) return -1;

            // Then sort by count descending for other sources (Fallback)
            return b.count - a.count;
        });

        // Split into Main and Other based on Metadata
        const mainSources: any[] = [];
        const otherSources: any[] = [];

        // Build Metadata Map
        const sourceMeta: Record<string, string> = {};
        packages.forEach(p => {
            if (p.status === 'active' && p.metadata.source_meta) {
                Object.assign(sourceMeta, p.metadata.source_meta);
            }
        });

        sortedSources.forEach(s => {
            if (s.code === 'user' || customDictionaries[s.code]) {
                mainSources.push(s);
                return;
            }

            const meta = sourceMeta[s.code];
            if (meta === 'other') {
                s.name = `[${s.code}] ${s.name}`;
                otherSources.push(s);
            } else {
                mainSources.push(s);
            }
        });

        // Ensure we don't have too many main sources (Legacy check removed as per user request to rely on metadata)
        // if (mainSources.length > 10) { ... }

        if (otherSources.length > 0) {
            // Sort otherSources by metadata order
            const sourceOrder: string[] = [];
            packages.forEach(p => {
                if (p.status === 'active' && p.metadata.source_names) {
                    sourceOrder.push(...Object.keys(p.metadata.source_names));
                }
            });

            otherSources.sort((a, b) => {
                const idxA = sourceOrder.indexOf(a.code);
                const idxB = sourceOrder.indexOf(b.code);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return b.count - a.count;
            });

            mainSources.push({ code: 'other_group', name: 'Other Sources', count: otherSources.length, badge: '...' });
        }

        return { mainSources, otherSources };
    }, [sentences, userSentences, customDictionaries, packages]);


    const sourceMap = useMemo(() => {
        const map: Record<string, string> = {};
        availableSources.forEach(s => map[s.code] = s.name);
        availableSentenceSources.mainSources.forEach(s => map[s.code] = s.name);
        availableSentenceSources.otherSources.forEach(s => map[s.code] = s.name);
        return map;
    }, [availableSources, availableSentenceSources]);

    // Compute Small Sources List for the Expanded View, sorted by metadata order
    const expandedSmallSourcesDict = useMemo(() => {
        // Get source order from metadata
        const sourceOrder: string[] = [];
        packages.forEach(p => {
            if (p.status === 'active' && p.metadata.source_names) {
                sourceOrder.push(...Object.keys(p.metadata.source_names));
            }
        });

        return sourceStats.smallSourceCodes.map(code => {
            const sample = allData.find(d => d.Source === code);
            const name = sample?.Source_Long || code;
            return { code, name, count: sourceStats.counts[code] };
        }).sort((a, b) => {
            const idxA = sourceOrder.indexOf(a.code);
            const idxB = sourceOrder.indexOf(b.code);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return b.count - a.count; // Fallback to count
        });
    }, [sourceStats, allData, packages]);

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

    const sentenceOtherGroupState = useMemo(() => {
        const smallCodes = availableSentenceSources.otherSources.map(s => s.code);
        if (smallCodes.length === 0) return 'none';

        const activeCount = smallCodes.filter(c => sentenceFilters[c] !== false).length;
        if (activeCount === 0) return 'none';
        if (activeCount === smallCodes.length) return 'all';
        return 'some';
    }, [availableSentenceSources, sentenceFilters]);

    const toggleAllSentenceSmallSources = () => {
        const newState = sentenceOtherGroupState !== 'all';
        setSentenceFilters(prev => {
            const next = { ...prev };
            availableSentenceSources.otherSources.forEach(s => {
                next[s.code] = newState;
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
        const isPersonal = !!customDictionaries[entry.Source];

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
    const toggleInList = (listId, idx) => {
        if (listId === 'Favorites') { toggleFavorite(idx); return; }
        setCustomLists(prev => {
            const list = prev[listId];
            if (!list) return prev;

            let items = Array.isArray(list) ? list : (list.items || []);
            const newItems = items.includes(idx) ? items.filter(i => i !== idx) : [...items, idx];

            if (Array.isArray(list)) {
                return { ...prev, [listId]: newItems };
            } else {
                return {
                    ...prev,
                    [listId]: { ...list, items: newItems }
                };
            }
        });
    };

    const handleReadInContext = (sentenceId: string) => {
        const location = findBookAndChapterForSentence(sentenceId);
        if (location) {
            setSelectedEntry(null);
            updateUrl(null);
            setActiveBookId(location.bookId);
            setActiveChapterId(location.chapterId);
            setScrollToSentenceId(sentenceId);
            setReaderView('reading');
            setActiveTab('reader');
        }
    };

    const createNewList = () => {
        if (!newListName.trim() || newListName === 'Favorites') { showToast("Invalid Name"); return; }
        const exists = Object.values(customLists).some((l: any) => l.name === newListName);
        if (exists) { showToast("A list with this name already exists"); return; }

        const id = 'list_' + Date.now();
        const newList: ListData = {
            id: id,
            name: newListName,
            items: [],
            type: 'user',
            color: 'gold'
        };
        setCustomLists(prev => ({ ...prev, [id]: newList }));
        setCustomListOrder(prev => [...prev, id]);
        setNewListName('');
        setShowNewListModal(false);
        showToast("List created", "success");
    };


    const createDictionary = () => { if (!newDictionaryName.trim()) return; const id = 'nb_' + Date.now(); setCustomDictionaries(p => ({ ...p, [id]: { id, name: newDictionaryName, date: Date.now(), type: 'notebook' } })); setNewDictionaryName(''); setShowNewDictionaryModal(false); showToast("Dictionary created!", "success"); };
    const deleteDictionary = (id) => {
        const next = { ...customDictionaries }; delete next[id]; setCustomDictionaries(next);
        setPersonalWords(prev => prev.filter(w => w.customDictionaryId !== id));

        // Cascade Delete: Sentences and Glosses
        const sentencesToDelete = userSentences.filter(s => s.source === id);

        // 1. Delete associated glosses
        sentencesToDelete.forEach(s => {
            const glossesToDelete = glosses.filter(g => g.sentence_id === s.id && g.source === 'user');
            glossesToDelete.forEach(g => { if (g.id) removeUserGloss(g.id); });
        });

        // 2. Delete sentences (batch)
        const sentenceIds = sentencesToDelete.map(s => s.id);
        if (sentenceIds.length > 0) {
            removeUserSentences(sentenceIds);
        }

        setActiveDictionaryId(null);
        setDictionaryToDelete(null); showToast("Dictionary deleted");
    };

    const handleCreateList = () => {
        if (!renameData.value.trim()) return;
        const name = renameData.value.trim();

        if (renameData.type === 'list') {
            const exists = Object.values(customLists).some((l: any) => l.name === name);
            if (exists) {
                showToast("List already exists!");
                return;
            }
            const id = 'list_' + Date.now();
            const newList: ListData = {
                id,
                name,
                items: renameData.initialEntryIndex ? [renameData.initialEntryIndex] : [],
                type: 'user',
                color: 'gold'
            };
            setCustomLists(prev => ({ ...prev, [id]: newList }));
            setCustomListOrder(prev => [...prev, id]);

            if (renameData.initialEntryIndex) {
                showToast(`Added to "${name}"`, 'success');
            }
        } else if (renameData.type === 'dictionary') {
            // ... dictionary logic
        }
        setShowNewListModal(false);
        setRenameData({ type: null, target: null, value: '', initialEntryIndex: null });
    };

    const handleRename = () => {
        const { type, target, value } = renameData;
        if (!value.trim() || !target) return;

        if (type === 'dictionary') {
            setCustomDictionaries(prev => ({
                ...prev,
                [target]: { ...prev[target], name: value }
            }));
            setShowNewDictionaryModal(false);
            showToast("Dictionary renamed", "success");
        } else if (type === 'list') {
            if (!target) { // This means it's a new list being created via rename modal
                handleCreateList();
                return;
            }

            const exists = Object.values(customLists).some((l: any) => l.name === value && l.id !== target);
            if (exists || value === 'Favorites') {
                showToast("List name already exists"); return;
            }

            setCustomLists(prev => ({
                ...prev,
                [target]: {
                    ...prev[target],
                    name: value
                }
            }));
            setShowNewListModal(false);
            showToast("List renamed", "success");
        }
        setRenameData({ type: null, target: null, value: '', initialEntryIndex: null });
    };

    // Manual Upload Removed - Handled by CorpusContext
    // Manual Upload Removed - Handled by CorpusContext

    const handleExportDictionary = () => {
        if (!activeDictionaryId) return;
        exportDictionaryToCSV(activeDictionaryId, customDictionaries[activeDictionaryId].name, personalWords);
        showToast("CSV Exported", "success");
    };
    const handleImportDictionary = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        importDictionaryFromCSV(file, (importedWords) => {
            const newId = 'nb_' + Date.now();
            const newName = file.name.replace('.csv', '');
            setCustomDictionaries(prev => ({ ...prev, [newId]: { id: newId, name: newName, date: Date.now() } }));

            const wordsWithId = importedWords.map((w, i) => ({ ...w, Index: newId + '_' + i, customDictionaryId: newId, DateCreated: Date.now() }));
            setPersonalWords(prev => [...prev, ...wordsWithId]);
            showToast(`Imported ${newName} `, "success");
        });
        e.target.value = null;
    };
    const handleBackup = () => {
        const data = { favorites, customLists, customListOrder, customDictionaries, personalWords, userNotes, settings, searchHistory };
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
                if (data.customDictionaries || data.notebooks) setCustomDictionaries(data.customDictionaries || data.notebooks);
                if (data.personalWords) setPersonalWords(data.personalWords);
                if (data.userNotes) setUserNotes(data.userNotes);
                // Audio meta is now managed by CorpusContext and IDB scanning, but if backup has it, maybe we should restore?
                // The restore logic for audio meta is tricky because it depends on files in IDB.
                // If we restore backup, we assume audio files are also restored or present?
                // For now, let's skip restoring audio meta state directly as it auto-rebuilds.
                if (data.settings) setSettings(data.settings);
                if (data.searchHistory) setSearchHistory(data.searchHistory);
                setActiveDictionaryId(null);
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

    const openWordModal = (w: any = null, forceMode?: 'word' | 'sentence') => {
        // If opening for a new item (w is null), respect the current dictionaryMode OR forceMode
        if (!w) {
            // Priority: forceMode > dictionaryMode > default
            const mode = forceMode || (activeTab === 'search' ? (searchScope === 'sentences' ? 'sentence' : 'word') : (dictionaryMode === 'sentences' ? 'sentence' : 'word'));
            setIsSentenceMode(mode === 'sentence');
            // Default dictionary: activeDictionaryId, or first available, or empty (to force selection if we want, but user said "force the user to choose", implying we can default but they must see it)
            // Actually, "give a 2nd modal that forces the user to choose" -> or just a dropdown in the same modal.
            // I'll put it in the same modal for better UX, but make it prominent.
            const defaultNb = activeDictionaryId || (Object.keys(customDictionaries).length > 0 ? Object.keys(customDictionaries)[0] : '');

            setWordForm({ Entry: '', Syllabary: '', Definition: '', PoS: '', Entry_Tone: '', Notes: '', customDictionaryId: defaultNb });
            setEditingId(null);
        } else {
            // Editing existing item
            setIsSentenceMode(false); // Default to word, handleEditSentence will override if needed
            setWordForm({
                Entry: w.Entry || '',
                Syllabary: w.Syllabary || '',
                Definition: w.Definition || '',
                PoS: w.PoS || '',
                Entry_Tone: w.Entry_Tone || '',
                Notes: w.Notes || '',
                customDictionaryId: w.customDictionaryId || w.source || '' // Handle both word and sentence source
            });
            setEditingId(w.Index || w.id);
        }
        setShowWordModal(true);
    };
    const saveWord = (data: any) => {
        if ((!data.Entry && !data.Syllabary) || !data.Definition) { showToast("Missing fields"); return; }

        if (isSentenceMode) {
            // Auto-create "My Custom Dictionary" if no customDictionaries exist
            let targetSource = activeDictionaryId || 'user';

            if (!activeDictionaryId && Object.keys(customDictionaries).length === 0) {
                const newDictionaryId = 'nb_' + Date.now();
                const newDictionary = { id: newDictionaryId, name: "My Custom Dictionary", date: Date.now(), type: 'notebook' };
                setCustomDictionaries({ [newDictionaryId]: newDictionary });
                targetSource = newDictionaryId;
            }

            const newSentence = {
                id: editingId || 'us_' + Date.now(),
                syllabary: data.Syllabary,
                translit: data.Entry,
                english: data.Definition,
                source: targetSource,
                audio: ''
            };
            addUserSentence(newSentence);
            setShowWordModal(false);
            showToast("Sentence saved", "success");
            return;
        }

        let target = activeDictionaryId;
        if (editingId) {
            const o = personalWords.find(w => w.Index === editingId);
            if (o) target = o.customDictionaryId;
        }
        if (!target && !editingId) {
            const k = Object.keys(customDictionaries);
            if (k.length) target = k[0];
            else {
                const d = 'nb_' + Date.now();
                setCustomDictionaries({ [d]: { id: d, name: "My Custom Dictionary", date: Date.now(), type: 'notebook' } });
                target = d;
            }
        }

        // Ensure data.customDictionaryId is used if set (from modal dropdown)
        if (data.customDictionaryId) target = data.customDictionaryId;

        const nw = {
            ...data,
            Index: editingId || Date.now().toString(),
            customDictionaryId: target!,
            DateCreated: editingId ? (personalWords.find(w => w.Index === editingId)?.DateCreated || Date.now()) : Date.now(),
            // Standard Fields
            id: editingId || Date.now().toString(),
            syllabary: data.Syllabary,
            translit: data.Entry,
            definition: data.Definition,
            source: 'user',
            Other_Forms: data.Other_Forms // Ensure Other_Forms is saved
        };
        if (editingId) {
            setPersonalWords(p => p.map(w => w.Index === editingId ? nw : w));
            if (selectedEntry?.Index === editingId) setSelectedEntry({ ...nw, Source: nw.customDictionaryId, Source_Long: customDictionaries[nw.customDictionaryId!].name });
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
            const targetId = entry.Index || (entry.id ? 's_' + entry.id : null);
            if (!targetId) return;
            setNoteTargetId(targetId);
            setCurrentNote(content || '');
            setShowNotesModal(true);
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

    const handleEditSentenceNote = (id: string, note: string) => {
        setNoteTargetId('s_' + id);
        setCurrentNote(note);
        setShowNotesModal(true);
    };

    const handleEditSentence = (id: string) => {
        const s = userSentences.find(x => x.id === id);
        if (s) {
            setWordForm({ Entry: s.translit, Syllabary: s.syllabary, Definition: s.english, PoS: '', Entry_Tone: '', Notes: userNotes['s_' + s.id] || '', customDictionaryId: s.source });
            setEditingId(s.id);
            setIsSentenceMode(true);
            setShowWordModal(true);
        }
    };

    const handleDeleteSentence = (id: string) => {
        if (window.confirm("Delete this sentence?")) {
            removeUserSentence(id);
            showToast("Sentence deleted");
        }
    };
    const addToHistory = (txt) => { if (!txt || txt.trim().length < 2) return; const c = txt.trim(); setSearchHistory(p => [c, ...p.filter(x => x !== c)].slice(0, 20)); };
    const deleteHistoryItem = (e, txt) => { e.stopPropagation(); setSearchHistory(p => p.filter(x => x !== txt)); };


    const openMoveModal = (wordIdx) => {
        setWordToMove(wordIdx);
        setShowMoveModal(true);
    };

    const handleMoveWord = (customDictionaryId) => {
        if (!wordToMove) return;
        setPersonalWords(prev => prev.map(w => {
            if (w.Index === wordToMove) {
                return { ...w, customDictionaryId: customDictionaryId };
            }
            return w;
        }));
        if (selectedEntry && selectedEntry.Index === wordToMove) {
            const nb = customDictionaries[customDictionaryId];
            setSelectedEntry((prev: any) => ({ ...prev, customDictionaryId: customDictionaryId, Source: customDictionaryId, Source_Long: nb?.name }));
        }
        setShowMoveModal(false);
        setWordToMove(null);
        showToast("Word moved", "success");
    };

    const handleManageForms = (entry: any) => {
        setAdditionalFormsTargetId(entry.Index);
        // If it's a personal word, we load its Other_Forms.
        // If it's an official word, we load from userWordForms.
        const personalEntry = personalWords.find(w => w.Index === entry.Index);

        if (personalEntry) {
            setCurrentAdditionalForms(personalEntry.Other_Forms || '');
        } else {
            setCurrentAdditionalForms(userWordForms[entry.Index] || '');
        }
        setShowAdditionalFormsModal(true);
    };

    const saveAdditionalForms = (formsString: string) => {
        if (!additionalFormsTargetId) return;

        const personalEntry = personalWords.find(w => w.Index === additionalFormsTargetId);

        if (personalEntry) {
            // Update personal word
            setPersonalWords(prev => prev.map(w => w.Index === additionalFormsTargetId ? { ...w, Other_Forms: formsString } : w));
            if (selectedEntry?.Index === additionalFormsTargetId) {
                setSelectedEntry(prev => ({ ...prev, Other_Forms: formsString }));
            }
        } else {
            // Update userWordForms for official word
            setUserWordForms(prev => ({ ...prev, [additionalFormsTargetId]: formsString }));
            // We don't update selectedEntry.Other_Forms because EntryDetail merges them.
            // But we might need to force a re-render or ensure EntryDetail picks up the change via context.
            // EntryDetail uses `userWordForms` from props, so it should be fine.
        }
        setShowAdditionalFormsModal(false);
        showToast("Forms saved", "success");
    };

    // Audio Logic Moved to CorpusContext

    const dictionaryList = useMemo(() => {
        const list: any[] = Object.values(customDictionaries)
            .filter((nb: any) => nb.type !== 'book') // Hide books from Custom Dictionaries tab
            .map((nb: any) => ({
                id: nb.id,
                name: nb.name,
                date: nb.date,
                type: 'user',
                countWords: personalWords.filter(w => w.customDictionaryId === nb.id).length,
                countSentences: userSentences.filter(s => s.source === nb.id).length,
                color: 'amber'
            }));

        packages.forEach(p => {
            if (p.type === 'imported' && p.status === 'active') {
                if (p.metadata.source_names) {
                    Object.entries(p.metadata.source_names).forEach(([code, name]) => {
                        list.push({
                            id: code,
                            name: name,
                            date: p.metadata.date_created,
                            type: 'imported',
                            packageId: p.id,
                            color: p.color,
                            countWords: allData.filter(d => d.Source === code).length,
                            countSentences: sentences.filter(s => s.source === code).length
                        });
                    });
                }
            }
        });

        return list.sort((a, b) => {
            if (a.type === 'user' && b.type !== 'user') return -1;
            if (a.type !== 'user' && b.type === 'user') return 1;
            return (b.date || 0) - (a.date || 0);
        });
    }, [customDictionaries, packages, personalWords, userSentences, allData, sentences]);

    const sortedDictionaryWords = useMemo(() => {
        if (!activeDictionaryId) return [];
        let w: any[] = [];
        if (customDictionaries[activeDictionaryId]) {
            w = personalWords.filter(x => x.customDictionaryId === activeDictionaryId).map(x => ({ ...x, Source: activeDictionaryId, Source_Long: customDictionaries[activeDictionaryId]?.name }));
        } else {
            w = allData.filter(x => x.Source === activeDictionaryId);
        }

        if (pdSort === 'date') return w.sort((a, b) => ((b.DateCreated || 0) - (a.DateCreated || 0)));
        if (pdSort === 'syllabary') return w.sort((a, b) => (a.Syllabary || '').localeCompare(b.Syllabary || ''));
        if (pdSort === 'translit') return w.sort((a, b) => (a.Entry || '').localeCompare(b.Entry || ''));
        return w.sort((a, b) => (a.Definition || '').localeCompare(b.Definition || ''));
    }, [personalWords, activeDictionaryId, pdSort, customDictionaries, allData]);

    const prioritizedSources = useMemo(() => {
        const prioritized = new Set<string>();
        packages.forEach(p => {
            if (p.metadata.source_meta) {
                Object.entries(p.metadata.source_meta).forEach(([src, action]) => {
                    if (action === 'prioritize') prioritized.add(src);
                });
            }
        });
        return Array.from(prioritized);
    }, [packages]);

    const usedFormLabels = useMemo(() => {
        const labels = new Set<string>();
        allData.forEach((entry: any) => {
            if (entry.Other_Forms) {
                entry.Other_Forms.split('|').forEach(form => {
                    const parts = form.split(':');
                    if (parts[0]) labels.add(parts[0].trim());
                });
            }
        });
        return Array.from(labels).sort();
    }, [allData]);

    // --- SEARCH ALGORITHM ---
    const searchResults = useMemo(() => {
        const isUserLibraryActive = packages.find(p => p.id === 'user')?.status === 'active';
        // Include user sentences in search if scope is sentences AND user library is active
        const combinedSentences = [...sentences, ...(isUserLibraryActive ? userSentences : [])];
        return performSearch(query, allData, combinedSentences, entryToSentencesMap, settings, customDictionaries, userNotes, posFilter, searchScope, prioritizedSources);
    }, [query, allData, customDictionaries, settings, userNotes, posFilter, searchScope, sentences, userSentences, entryToSentencesMap, prioritizedSources, packages]);

    const filteredResults = useMemo(() => {
        if (!query && activeTab === 'search') return { active: [], inactive: [] };

        const activeFilters = searchScope === 'sentences' ? sentenceFilters : filters;

        const active = searchResults.filter(item => {
            // If item is a sentence (has .id), use sentenceFilters
            // If item is entry (has .Index), use filters
            // But searchScope already separates them mostly.
            // However, performSearch returns mixed if scope is mixed? No, scope is strict here.

            const srcKey = searchScope === 'sentences' ? (item.item?.source) : (item.Source || item.source);

            if (customDictionaries[srcKey]) return activeFilters[srcKey] !== false;
            return activeFilters[srcKey] !== false; // Case sensitivity? keys in filters are as-is from source
        });
        const inactive = searchResults.filter(item => {
            const srcKey = searchScope === 'sentences' ? (item.item?.source) : (item.Source || item.source);
            if (customDictionaries[srcKey]) return activeFilters[srcKey] === false;
            return activeFilters[srcKey] === false;
        });
        return { active, inactive };
    }, [searchResults, filters, sentenceFilters, activeTab, query, customDictionaries, searchScope]);

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
            <RainbowGradient />
            {!selectedEntry && (
                <header className="bg-white dark:bg-slate-900 px-4 py-3 shadow-sm z-10 flex items-center justify-between shrink-0 h-[60px]">
                    <h1 className="font-noto-serif text-xl text-slate-800 dark:text-slate-100">ᏣᎳᎩ-English Dictionary</h1>
                    <button onClick={() => setShowSettingsModal(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
                        <Menu size={24} strokeWidth={1.5} />
                    </button>
                </header>
            )}
            <main className={`flex-1 overflow-hidden relative flex flex-col ${selectedEntry ? 'z-50' : 'z-0'}`}>
                {selectedEntry ? (
                    <EntryDetail
                        entry={selectedEntry}
                        customDictionaries={customDictionaries}
                        userNotes={userNotes}
                        userAudioMeta={userAudioMeta}
                        userWordForms={userWordForms}
                        onSaveAudio={saveAudio}
                        onDeleteAudio={deleteAudio}
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
                        personalWords={personalWords}
                        onEditSentence={handleEditSentence}
                        onDeleteSentence={handleDeleteSentence}
                        onCreateWord={() => openWordModal(null)}
                        onManageForms={handleManageForms}
                        onReadInContext={handleReadInContext}
                        onShowSettings={() => setShowSettingsModal(true)}
                    />
                ) : (
                    <>
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
                                                className={`px-3 py-1 rounded-md transition-all ${searchScope === 'dictionary' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} `}
                                            >
                                                Dictionary
                                            </button>
                                            <button
                                                onClick={() => setSearchScope('sentences')}
                                                className={`px-3 py-1 rounded-md transition-all ${searchScope === 'sentences' ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'} `}
                                            >
                                                Sentences
                                            </button>
                                        </div>
                                        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide hover:text-amber-700"><Filter size={12} /> Filter Sources</button>
                                    </div>
                                    {showFilters && (
                                        <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col gap-2 animate-fade-in max-h-64 overflow-y-auto">
                                            {/* Source List */}
                                            {searchScope === 'dictionary' && availableSources.map(src => {
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
                                                                    {expandedSmallSourcesDict.map(smallSrc => (
                                                                        <label key={smallSrc.code} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={filters[smallSrc.code] !== false}
                                                                                onChange={() => setFilters(prev => ({ ...prev, [smallSrc.code]: !prev[smallSrc.code] }))}
                                                                                className="accent-amber-600 w-4 h-4 rounded"
                                                                            />
                                                                            <div className="flex-1 flex items-center min-w-0">
                                                                                <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">{smallSrc.code}</span>
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

                                            {/* Sentence Sources */}
                                            {searchScope === 'sentences' && (
                                                <>
                                                    {availableSentenceSources.mainSources.map(src => {
                                                        if (src.code === 'other_group') {
                                                            return (
                                                                <div key="other_group" className="flex flex-col">
                                                                    <div className="flex items-center justify-between p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                                        <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer flex-1">
                                                                            {/* Tri-state Checkbox Implementation */}
                                                                            <div onClick={(e) => { e.preventDefault(); toggleAllSentenceSmallSources(); }} className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-800 overflow-hidden">
                                                                                {sentenceOtherGroupState === 'all' && <div className="w-full h-full bg-amber-600 flex items-center justify-center"><Check size={12} className="text-white" /></div>}
                                                                                {sentenceOtherGroupState === 'some' && <div className="w-full h-full bg-amber-600 flex items-center justify-center"><Minus size={12} className="text-white" /></div>}
                                                                            </div>

                                                                            <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">...</span>
                                                                            <span className="font-bold text-slate-600 dark:text-slate-400">Other Sources</span>
                                                                            <span className="ml-auto text-xs text-slate-400 font-mono">({availableSentenceSources.otherSources.length})</span>
                                                                        </label>
                                                                        <button onClick={(e) => { e.preventDefault(); setExpandedSmallSources(!expandedSmallSources); }} className="p-1 ml-2 text-slate-400 hover:text-amber-600">
                                                                            {expandedSmallSources ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                                        </button>
                                                                    </div>

                                                                    {expandedSmallSources && (
                                                                        <div className="ml-8 mt-1 border-l-2 border-slate-100 dark:border-slate-800 pl-2 space-y-1">
                                                                            {availableSentenceSources.otherSources.map(smallSrc => (
                                                                                <label key={smallSrc.code} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300 cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={sentenceFilters[smallSrc.code] !== false}
                                                                                        onChange={() => setSentenceFilters(prev => ({ ...prev, [smallSrc.code]: !prev[smallSrc.code] }))}
                                                                                        className="accent-amber-600 w-4 h-4 rounded"
                                                                                    />
                                                                                    <div className="flex-1 flex items-center min-w-0">
                                                                                        <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">{smallSrc.code}</span>
                                                                                        <span className="truncate">{smallSrc.name.replace(`[${smallSrc.code}] `, '')}</span>
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
                                                                <input type="checkbox" checked={sentenceFilters[src.code] !== false} onChange={() => setSentenceFilters(prev => ({ ...prev, [src.code]: !prev[src.code] }))} className="accent-amber-600 w-4 h-4 rounded" />
                                                                <div className="flex-1 flex items-center min-w-0">
                                                                    <span className="font-bold uppercase text-xs text-slate-500 dark:text-slate-400 mr-2 min-w-[3rem] shrink-0 text-center bg-slate-100 dark:bg-slate-800 rounded px-1">{src.badge}</span>
                                                                    <span className="truncate">{src.name}</span>
                                                                    <span className="ml-auto text-xs text-slate-400 font-mono">({src.count})</span>
                                                                </div>
                                                            </label>
                                                        )
                                                    })}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto">{query ? (<>{paginatedResults.active.length === 0 && paginatedResults.inactive.length === 0 && <div className="text-center mt-12 text-slate-400">No results found</div>}{paginatedResults.active.map(item => {
                                    // Check if it's a Sentence (either wrapped in .item or direct with .id but no .Index)
                                    const isSentence = item.item || (item.id && !item.Index);
                                    const data = item.item || item;

                                    return isSentence ? (
                                        <SentenceCard key={data.id} sentence={data} onClick={() => handleEntryClick(data)} customDictionaries={customDictionaries} userNotes={userNotes} onEditNote={handleEditSentenceNote} onEditSentence={handleEditSentence} onDeleteSentence={handleDeleteSentence} sourceMap={sourceMap} onSaveAudio={saveAudio} userAudioMeta={userAudioMeta} personalWords={personalWords} onCreateWord={() => openWordModal(null)}
                                            favorites={favorites}
                                            customLists={customLists}
                                            onToggleFavorite={toggleFavorite}
                                            onToggleList={toggleInList}
                                            onOpenNewListModal={() => setShowNewListModal(true)}
                                            onReadInContext={handleReadInContext}
                                        />
                                    ) : (
                                        <EntryCard key={item.Index} entry={item} customDictionaries={customDictionaries} userNotes={userNotes} userAudioMeta={userAudioMeta} userWordForms={userWordForms} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />
                                    );
                                })}



                                    {paginatedResults.inactive.length > 0 && <><div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-widest border-y border-slate-100 dark:border-slate-800 mt-4">Filtered</div>{paginatedResults.inactive.map(entry => {
                                        if (entry.item && (entry.type === 'text' || entry.type === 'deep')) {
                                            return <SentenceCard key={entry.item.id} sentence={entry.item} onClick={() => handleEntryClick(entry.item)} isDimmed={true} customDictionaries={customDictionaries} userNotes={userNotes} onEditNote={handleEditSentenceNote} onEditSentence={handleEditSentence} onDeleteSentence={handleDeleteSentence} sourceMap={sourceMap} onSaveAudio={saveAudio} userAudioMeta={userAudioMeta} personalWords={personalWords} onCreateWord={() => openWordModal(null)}
                                                favorites={favorites}
                                                customLists={customLists}
                                                onToggleFavorite={toggleFavorite}
                                                onToggleList={toggleInList}
                                                onOpenNewListModal={() => setShowNewListModal(true)}
                                                onReadInContext={handleReadInContext}
                                            />;
                                        }
                                        return <EntryCard key={entry.Index} entry={entry} customDictionaries={customDictionaries} userNotes={userNotes} userAudioMeta={userAudioMeta} userWordForms={userWordForms} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} isDimmed={true} />;
                                    })}</>}
                                    {paginatedResults.hasMore && (
                                        <div className="p-4">
                                            <button onClick={() => setResultLimit(prev => prev + 50)} className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                                                Show More Results
                                            </button>
                                        </div>
                                    )}
                                    {/* Create New Button - MOVED HERE */}
                                    <div className="p-4 pt-0">
                                        <button
                                            onClick={() => openWordModal(null)}
                                            className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold rounded-xl hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-700 dark:hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Plus size={20} /> Create New {searchScope === 'sentences' ? 'Sentence' : 'Word'}
                                        </button>
                                    </div>
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
                        )
                        }
                        {activeTab === 'lists' && (
                            <ListsTab
                                customLists={customLists}
                                setCustomLists={setCustomLists}
                                customListOrder={customListOrder}
                                setCustomListOrder={setCustomListOrder}
                                favorites={favorites}
                                setFavorites={setFavorites}
                                allData={allData}
                                customDictionaries={customDictionaries}
                                userNotes={userNotes}
                                userAudioMeta={userAudioMeta}
                                onEntryClick={handleEntryClick}
                                onPerformSearch={(q, scope) => {
                                    const isModal = scope === 'modal';
                                    const isModalSentences = scope === 'modal_sentences';
                                    const activeSettings = (isModal || isModalSentences) ? {
                                        searchLangs: { syllabary: true, translit: true, english: true, tone: false },
                                        searchScopes: { main: isModal, otherForms: isModal, sentences: isModalSentences, notes: false },
                                        enableRegex: false
                                    } : settings;
                                    const activePos = (isModal || isModalSentences) ? "All" : posFilter;
                                    const activeNotes = (isModal || isModalSentences) ? {} : userNotes;
                                    const activePrioritized = (isModal || isModalSentences) ? [] : prioritizedSources;

                                    return performSearch(q, allData, [...sentences, ...userSentences], entryToSentencesMap, activeSettings, customDictionaries, activeNotes, activePos, isModalSentences ? 'sentences' : (isModal ? 'dictionary' : (scope || 'dictionary')), activePrioritized);
                                }}
                                settings={settings}
                                openWordModal={openWordModal}
                                sentences={sentences}
                                userSentences={userSentences}
                                activeListId={activeListId}
                                setActiveListId={setActiveListId}
                                view={listsView}
                                setView={setListsView}
                                onReadInContext={handleReadInContext}
                            />
                        )}
                        {activeTab === 'widgets' && <WidgetsTab />}
                        {activeTab === 'reader' && (
                            readerView === 'importing' ? (
                                <TextImporter
                                    onBack={() => { setReaderView('list'); setImporterDictionaryId(undefined); }}
                                    onComplete={(_storyId) => {
                                        setReaderView('list');
                                        setImporterDictionaryId(undefined);
                                    }}
                                    customDictionaries={customDictionaries}
                                    preselectedDictionaryId={importerDictionaryId}
                                />
                            ) : readerView === 'reading' && activeBookId && activeChapterId ? (
                                <ReaderView
                                    bookId={activeBookId}
                                    chapterId={activeChapterId}
                                    scrollToSentenceId={scrollToSentenceId}
                                    onBack={() => {
                                        setReaderView('list');
                                        setActiveBookId(null);
                                        setActiveChapterId(null);
                                        setScrollToSentenceId(undefined);
                                    }}
                                    customDictionaries={customDictionaries}
                                    onCreateWord={openWordModal}
                                />
                            ) : (
                                <ReaderTab
                                    customDictionaries={customDictionaries}
                                    onNavigateToReader={(bookId, chapterId, sentenceId) => {
                                        setActiveBookId(bookId);
                                        setActiveChapterId(chapterId);
                                        setScrollToSentenceId(sentenceId);
                                        setReaderView('reading');
                                    }}
                                    onOpenImporter={(dictionaryId) => {
                                        setImporterDictionaryId(dictionaryId);
                                        setReaderView('importing');
                                    }}
                                />
                            )
                        )}
                        {activeTab === 'packages' && <PackageManagerTab
                            customLists={customLists}
                            onReadInContext={handleReadInContext}
                            onNavigate={(type, payload) => {
                                if (type === 'dictionary') {
                                    setActiveTab('personal');
                                    setActiveDictionaryId(payload);
                                } else if (type === 'list') {
                                    setActiveTab('lists');
                                    setActiveListId(payload);
                                    setListsView('detail');
                                } else if (type === 'word' || type === 'sentence') {
                                    handleEntryClick(payload);
                                }
                            }}
                            onShowSettings={() => setShowSettingsModal(true)}
                        />}
                        {
                            activeTab === 'personal' && (!activeDictionaryId ? (<div className="flex flex-col h-full"><div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0"><h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Custom Dictionaries</h1><button onClick={() => setShowNewDictionaryModal(true)} className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-full shadow-md"><Plus size={20} /></button></div><div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4 content-start">{dictionaryList.map((nb: any) => {
                                const isImported = nb.type === 'imported';
                                const colorClass = isImported ? `text-${nb.color === 'amber' ? 'amber' : (nb.color === 'slate' ? 'slate' : nb.color)}-600 dark:text-${nb.color === 'amber' ? 'amber' : (nb.color === 'slate' ? 'slate' : nb.color)}-400` : 'text-amber-500 hover:text-amber-600';
                                // Handle hex colors
                                const style = (isImported && nb.color.startsWith('#')) ? { color: nb.color } : {};

                                return (<div key={nb.id} onClick={() => setActiveDictionaryId(nb.id)} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer h-32 justify-between"><Folder size={32} className={isImported && nb.color.startsWith('#') ? "" : (isImported ? colorClass : "text-amber-500")} style={style} /><div><h3 className="font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{nb.name}</h3><p className="text-xs text-slate-400">{nb.countWords} words, {nb.countSentences} sentences</p></div></div>);
                            })}{dictionaryList.length === 0 && (<div className="col-span-2 text-center py-12 text-slate-400 flex flex-col items-center"><BookOpen size={48} className="mb-4 opacity-20" /><p>No custom dictionaries yet.</p><button onClick={() => setShowNewDictionaryModal(true)} className="mt-4 text-sky-600 dark:text-sky-400 font-bold">Create one</button></div>)}</div><div className="p-4 border-t border-slate-200 dark:border-slate-800"><label className="w-full flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl cursor-pointer transition-colors"><Download size={20} /><span>Import CSV</span><input type="file" className="hidden" accept=".csv" onChange={handleImportDictionary} /></label></div></div>) : (<div className="flex flex-col h-full"><div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-3 shrink-0">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveDictionaryId(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full -ml-2"><ArrowLeft size={20} className="text-slate-500 dark:text-slate-400" /></button>
                                    <div className="flex-1 flex items-center gap-2"><h2 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100">{customDictionaries[activeDictionaryId]?.name || dictionaryList.find(n => n.id === activeDictionaryId)?.name || 'Custom Dictionary'}</h2>
                                        {customDictionaries[activeDictionaryId] && <button onClick={() => { setRenameData({ type: 'dictionary', target: activeDictionaryId, value: customDictionaries[activeDictionaryId].name }); setShowNewDictionaryModal(true); }} className="p-1 text-slate-400 hover:text-sky-600 rounded-full"><Pencil size={14} /></button>}
                                    </div>
                                    <div className="flex gap-2 ml-auto"><button onClick={handleExportDictionary} className="p-1.5 text-slate-400 hover:text-amber-600 rounded"><Share size={20} /></button><button onClick={() => setDictionaryToDelete(activeDictionaryId)} className="p-1.5 text-slate-400 hover:text-red-500 rounded"><Trash2 size={20} /></button></div>
                                </div>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    <button onClick={() => setDictionaryMode('words')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${dictionaryMode === 'words' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'} `}>Words</button>
                                    <button onClick={() => setDictionaryMode('sentences')} className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${dictionaryMode === 'sentences' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'} `}>Sentences</button>
                                </div>
                            </div>
                                <div className="flex-1 overflow-y-auto p-4" key={activeDictionaryId + '-' + dictionaryMode}>
                                    {dictionaryMode === 'words' ? (
                                        sortedDictionaryWords.length === 0 ? <div className="text-center py-12 text-slate-400">Empty dictionary.<br />Tap + to add a word.</div> : sortedDictionaryWords.map(entry => <EntryCard key={entry.Index} entry={entry} customDictionaries={customDictionaries} userNotes={userNotes} userAudioMeta={userAudioMeta} userWordForms={userWordForms} favorites={favorites} customLists={customLists} onClick={handleEntryClick} showPos={settings.showPosInLists} />)
                                    ) : (
                                        (customDictionaries[activeDictionaryId] ? userSentences : sentences).filter(s => s.source === activeDictionaryId).length === 0 ? <div className="text-center py-12 text-slate-400">No sentences yet.<br />Tap + to add one.</div> : (customDictionaries[activeDictionaryId] ? userSentences : sentences).filter(s => s.source === activeDictionaryId).map(s => <SentenceCard key={s.id} sentence={s} customDictionaries={customDictionaries} userNotes={userNotes} onEditNote={handleEditSentenceNote} onEditSentence={handleEditSentence} onDeleteSentence={handleDeleteSentence} sourceMap={sourceMap} personalWords={personalWords} onSaveAudio={saveAudio} userAudioMeta={userAudioMeta} onDeleteAudio={deleteAudio}
                                            favorites={favorites}
                                            customLists={customLists}
                                            onToggleFavorite={toggleFavorite}
                                            onToggleList={toggleInList}
                                            onOpenNewListModal={() => setShowNewListModal(true)}
                                            onReadInContext={handleReadInContext}
                                        />)
                                    )}
                                </div>{customDictionaries[activeDictionaryId] && <button onClick={() => openWordModal()} className="absolute bottom-6 right-6 bg-slate-900 dark:bg-slate-700 text-white p-4 rounded-full shadow-xl z-20 hover:scale-105 transition-transform"><Plus size={24} /></button>}</div>))

                        }
                    </>
                )}
            </main >
            <nav className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 flex justify-between shrink-0 h-[80px] pb-5">
                <button onClick={() => { setActiveTab('search'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'search' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <Search size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Search</span>
                </button>
                <button onClick={() => { if (activeTab === 'lists') setListsView('all'); setActiveTab('lists'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'lists' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <ListIcon size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Lists</span>
                </button>
                <button onClick={() => { if (activeTab === 'reader') setReaderView('list'); setActiveTab('reader'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'reader' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <BookOpen size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Reader</span>
                </button>
                <button onClick={() => { if (activeTab === 'personal') setActiveDictionaryId(null); setActiveTab('personal'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'personal' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <Book size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Dictionaries</span>
                </button>
                <button onClick={() => { setActiveTab('packages'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'packages' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <Box size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Packages</span>
                </button>
                <button onClick={() => { setActiveTab('widgets'); }} className={`flex flex-col items-center gap-1 p-2 rounded-lg w-16 transition-colors ${activeTab === 'widgets' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    <Layout size={24} strokeWidth={2} />
                    <span className="text-[10px] font-bold tracking-wide">Widgets</span>
                </button>
            </nav>



            {/* MODALS */}
            {
                showSettingsModal && (
                    <Modal title="Settings" onClose={() => setShowSettingsModal(false)}>
                        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                            <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Dark Mode</span><span className="text-xs text-slate-400">Toggle app theme</span></div><button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))} className={`transition - colors ${settings.darkMode ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'} `}>{settings.darkMode ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Enable Regex Search</span><span className="text-xs text-slate-400">Use regular expressions</span></div><button onClick={() => setSettings(s => ({ ...s, enableRegex: !s.enableRegex }))} className={`transition - colors ${settings.enableRegex ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'} `}>{settings.enableRegex ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div className="flex items-center justify-between"><div className="flex flex-col"><span className="text-sm font-bold text-slate-700 dark:text-slate-200">Show PoS in Lists</span><span className="text-xs text-slate-400">Display Part of Speech in search/lists</span></div><button onClick={() => setSettings(s => ({ ...s, showPosInLists: !s.showPosInLists }))} className={`transition - colors ${settings.showPosInLists ? 'text-amber-600 dark:text-amber-400' : 'text-slate-300'} `}>{settings.showPosInLists ? <ToggleRight size={32} className="fill-amber-100 dark:fill-amber-900" /> : <ToggleLeft size={32} />}</button></div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div><h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Search Languages</h4><div className="space-y-2">{[{ k: 'syllabary', l: 'ᏣᎳᎩ (Syllabary)' }, { k: 'translit', l: 'Jalagi (Translit)' }, { k: 'english', l: 'English' }, { k: 'tone', l: 'Tone' }].map(opt => (<label key={opt.k} className="flex items-center justify-between cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.l}</span><input type="checkbox" checked={settings.searchLangs[opt.k]} onChange={() => setSettings(s => ({ ...s, searchLangs: { ...s.searchLangs, [opt.k]: !s.searchLangs[opt.k] } }))} className="accent-amber-600 w-5 h-5 rounded" /></label>))}</div></div>
                            <hr className="border-slate-100 dark:border-slate-800" />
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Search Scope</h4>

                                {/* CHECKBOXES FIRST */}
                                <div className="space-y-2 mb-4">{[{ k: 'main', l: 'Main Entry' }, { k: 'otherForms', l: 'Other Word Forms' }, { k: 'sentences', l: 'Sentences' }, { k: 'notes', l: 'Notes' }].map(opt => (<label key={opt.k} className="flex items-center justify-between cursor-pointer p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt.l}</span><input type="checkbox" checked={settings.searchScopes[opt.k]} onChange={() => setSettings(s => ({ ...s, searchScopes: { ...s.searchScopes, [opt.k]: !s.searchScopes[opt.k] } }))} className="accent-amber-600 w-5 h-5 rounded" /></label>))}</div>

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

                            <div className="mt-8 text-center opacity-30">
                                <span className="text-[10px] font-mono tracking-widest text-slate-500 dark:text-slate-400 uppercase">Version 1.0.2</span>
                            </div>
                        </div>
                    </Modal>
                )
            }
            {/* REUSED MODAL FOR NEW LIST / NEW DICTIONARY / RENAME */}
            {showNewListModal && (<Modal title={renameData.type === 'list' ? "Rename List" : "New List"} onClose={() => { setShowNewListModal(false); setRenameData({ type: null, target: null, value: '' }); }}><input type="text" autoFocus placeholder={renameData.type === 'list' ? "Rename list..." : "Enter list name..."} value={renameData.value || newListName} onChange={(e) => renameData.type === 'list' ? setRenameData({ ...renameData, value: e.target.value }) : setNewListName(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 transition-all dark:text-white" /><button onClick={renameData.type === 'list' ? handleRename : createNewList} disabled={!(renameData.type === 'list' ? renameData.value : newListName).trim()} className="w-full mt-4 bg-amber-600 text-white font-bold py-3 rounded-lg">Save</button></Modal>)}
            {showNewDictionaryModal && (<Modal title={renameData.type === 'dictionary' ? "Rename Custom Dictionary" : "New Custom Dictionary"} onClose={() => { setShowNewDictionaryModal(false); setRenameData({ type: null, target: null, value: '' }); }}><input type="text" autoFocus placeholder={renameData.type === 'dictionary' ? "Rename dictionary..." : "Enter dictionary name..."} value={renameData.value || newDictionaryName} onChange={(e) => renameData.type === 'dictionary' ? setRenameData({ ...renameData, value: e.target.value }) : setNewDictionaryName(e.target.value)} className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-4 py-3 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 transition-all dark:text-white" /><button onClick={renameData.type === 'dictionary' ? handleRename : createDictionary} disabled={!(renameData.type === 'dictionary' ? renameData.value : newDictionaryName).trim()} className="w-full mt-4 bg-sky-700 text-white font-bold py-3 rounded-lg">{renameData.type === 'dictionary' ? "Rename" : "Create"}</button></Modal>)}

            {wordToDelete && (<Modal title="Delete Word?" onClose={() => setWordToDelete(null)}><p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this word? This will remove it from all your lists.</p><button onClick={confirmDeleteWord} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Delete</button></Modal>)}
            {dictionaryToDelete && (<Modal title="Delete Custom Dictionary?" onClose={() => setDictionaryToDelete(null)}><p className="text-slate-600 dark:text-slate-300 mb-6">Are you sure you want to delete this dictionary? All words inside it will be lost.</p><button onClick={() => deleteDictionary(dictionaryToDelete)} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Delete</button></Modal>)}
            {
                showBackupConfirm && (
                    <Modal title="Restore Backup?" onClose={() => setShowBackupConfirm(false)}>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">This will <strong>overwrite</strong> all your current custom dictionaries, lists, and settings. This action cannot be undone.</p>
                        <button onClick={() => handleRestore(restoreInputRef.current)} className="w-full bg-red-600 text-white font-bold py-3 rounded-lg">Yes, Overwrite Everything</button>
                    </Modal>
                )
            }
            {
                showWordModal && (
                    <WordModal
                        isOpen={showWordModal}
                        onClose={() => setShowWordModal(false)}
                        onSave={saveWord}
                        initialData={wordForm}
                        isSentenceMode={isSentenceMode}
                        editingId={editingId}
                        customDictionaries={customDictionaries}
                        usedFormLabels={usedFormLabels}
                    />
                )
            }
            {showNotesModal && (<Modal title="Edit Notes" onClose={() => setShowNotesModal(false)}><p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Add personal notes to this dictionary entry. These are saved only on this device.</p><textarea value={currentNote} onChange={e => setCurrentNote(e.target.value)} rows={6} autoFocus className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 resize-none font-sans dark:text-white" placeholder="Write your notes here..."></textarea><button onClick={saveNote} className="w-full mt-4 bg-amber-600 text-white font-bold py-3 rounded-lg">Save Note</button></Modal>)}

            {
                showAdditionalFormsModal && (
                    <AdditionalFormsModal
                        isOpen={showAdditionalFormsModal}
                        onClose={() => setShowAdditionalFormsModal(false)}
                        onSave={saveAdditionalForms}
                        initialForms={currentAdditionalForms}
                        usedFormLabels={usedFormLabels}
                    />
                )
            }

            {/* MOVE DICTIONARY MODAL */}
            {
                showMoveModal && (
                    <Modal title="Move to Custom Dictionary" onClose={() => setShowMoveModal(false)}>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                            {Object.values(customDictionaries).length === 0 && <p className="text-slate-400 italic">No custom dictionaries available.</p>}
                            {Object.entries(customDictionaries).map(([id, dictionary]) => (
                                <button key={id} onClick={() => handleMoveWord(id)} className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
                                    <Folder size={20} className="text-sky-600 dark:text-sky-400" />
                                    <span className="font-bold text-slate-700 dark:text-slate-200">{dictionary.name || 'Unknown Dictionary'}</span>
                                </button>
                            ))}
                        </div>
                    </Modal>
                )
            }

            <Toast show={toast.show} message={toast.message} type={toast.type} />
        </div >
    );
}

export default App;
