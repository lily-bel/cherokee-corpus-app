import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllPackagesFromDB, savePackageToDB, deletePackageFromDB } from '../utils';
import { parsePackageZip } from './packageParser';


// --- Types ---

export interface PackageMetadata {
    id: string;
    name: string;
    short_name?: string;
    author: string;
    date_created: number;
    description: string;
    app_version: string;
    stats: {
        words: number;
        sentences: number;
        audio_files: number;
        glosses: number;
        lists: number;
        notebooks?: number;
        notes?: number;
        word_forms?: number;
    };
    source_names?: Record<string, string>;
    source_meta?: Record<string, "prioritize" | "filter">;
    color?: string;
    locked?: string;
    editable?: string;
}

export interface Package {
    id: string;
    name: string;
    type: 'official' | 'user' | 'imported';
    status: 'active' | 'inactive';
    color: string;
    metadata: PackageMetadata;
}

export interface ImportedPackageData {
    dictionary: any[]; // Parsed CSV
    sentences: any[]; // Parsed CSV
    glosses: any[]; // Parsed CSV
    lists?: any[]; // ListData[]
    notes?: any[]; // [{ text, target_id, type }]
    word_forms?: any[]; // [{ word_index, order, form_name, syllabary, translit, tone, notes }]
}

interface PackageManagerContextType {
    packages: Package[];
    importedData: Record<string, ImportedPackageData>;
    installPackage: (pkg: Package, data: ImportedPackageData) => void;
    removePackage: (id: string) => void;
    togglePackage: (id: string) => void;
    updatePackageColor: (id: string, color: string) => void;
    getPackageColor: (sourceId: string) => string | undefined;
}

const PackageManagerContext = createContext<PackageManagerContextType | undefined>(undefined);

export const usePackageManager = () => {
    const context = useContext(PackageManagerContext);
    if (!context) {
        throw new Error('usePackageManager must be used within a PackageManagerProvider');
    }
    return context;
};

export const PackageManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [importedData, setImportedData] = useState<Record<string, ImportedPackageData>>({});

    // Initialize Default Packages
    // Initialize Default Packages & Load Official Data
    useEffect(() => {
        const loadOfficialData = async () => {
            try {
                // Fetch Metadata
                const metaRes = await fetch(`${import.meta.env.BASE_URL}data/metadata.json`);
                if (!metaRes.ok) throw new Error('Failed to load official metadata');
                const metadata: PackageMetadata = await metaRes.json();

                // Fetch Data Files
                const base = import.meta.env.BASE_URL;
                const [dictRes, sentRes, joinRes, conjRes, audioMapRes, officialListRes] = await Promise.all([
                    fetch(`${base}data/base_forms.json`).then(r => r.json()),
                    fetch(`${base}data/sentences.json`).then(r => r.json()),
                    fetch(`${base}data/sentence_joins.json`).then(r => r.json()),
                    fetch(`${base}data/conjugations.json`).then(r => r.json()),
                    fetch(`${base}data/audio_mapping.json`).then(r => r.json()),
                    fetch(`${base}data/lists/official_lists_ced_verbs.json`).then(r => r.ok ? r.json() : null).catch(() => null)
                ]);

                const dictionary = dictRes;
                const sentences = sentRes;
                const glosses = joinRes;
                const conjugations = conjRes;
                const audioMapping = audioMapRes;

                const officialLists: any[] = [];
                if (officialListRes && officialListRes.name) {
                    const items = [
                        ...(officialListRes.words || []),
                        ...(officialListRes.sentences || []).map((id: string) => `s_${id}`)
                    ];
                    officialLists.push({
                        id: 'official_list_ced_verbs',
                        name: officialListRes.name,
                        items: items,
                        type: 'imported',
                        packageId: 'official-cherokee-data',
                        color: 'slate'
                    });
                }

                const audioByBaseForm: Record<string, string> = {};
                const audioBySentence: Record<string, string> = {};
                const audioByConjugation: Record<string, string> = {};

                Object.values(audioMapping).forEach((mapping: any) => {
                    if (mapping.type === 'base_form' && mapping.merged_id) {
                        audioByBaseForm[mapping.merged_id] = mapping.audio_file;
                    } else if (mapping.type === 'sentence' && mapping.sentence_id) {
                        audioBySentence[mapping.sentence_id] = mapping.audio_file;
                    } else if (mapping.type === 'conjugation' && mapping.merged_id && mapping.normalized_key) {
                        audioByConjugation[`${mapping.merged_id}_${mapping.normalized_key}`] = mapping.audio_file;
                    }
                });

                // Update metadata stats with actual counts
                metadata.stats.words = dictionary.length;
                metadata.stats.sentences = sentences.length;
                metadata.stats.glosses = glosses.length;
                metadata.stats.word_forms = conjugations.length;
                metadata.stats.lists = metadata.stats.lists || 0;
                metadata.stats.notes = metadata.stats.notes || 0;

                // Normalize Dictionary Data
                const normalizedDictionary = dictionary.map((d: any) => {
                    let translit = '';
                    let syllabary = '';
                    let definition = '';
                    let PoS = '';
                    let Entry_Tone = '';

                    const sources = d.sources || {};
                    let sourceKeys = Object.keys(sources);

                    let sourceStr = '';
                    if (sources['cn-app-dictionary.csv']) sourceStr = 'ced';
                    else if (sources['lily-dict.csv']) {
                        const s = sources['lily-dict.csv'];
                        sourceStr = s['Source'] || 'lily';
                    }
                    else if (sources['kirk-book-data.csv']) sourceStr = 'kirk';
                    else if (sources['learning-to-use-the-cherokee-verb.csv']) sourceStr = 'ltu';
                    else if (sources['hierarchical-dict.json']) sourceStr = 'ced';
                    else if (sourceKeys.length > 0) sourceStr = sourceKeys[0];

                    if (sources['cn-app-dictionary.csv']) {
                        const s = sources['cn-app-dictionary.csv'];
                        translit = s['Practical'] || s['Entry'] || '';
                        syllabary = s['Syllabary'] || '';
                        definition = s['Translations'] || '';
                        PoS = s['Part of speech'] || s['Part of speech ch'] || '';
                        Entry_Tone = s['Tone and length 1'] || s['Tone and length 2'] || '';
                    } else if (sources['lily-dict.csv']) {
                        const s = sources['lily-dict.csv'];
                        translit = s['Entry'] || '';
                        syllabary = s['Syllabary'] || '';
                        definition = s['Definition'] || '';
                        PoS = s['PoS'] || '';
                        Entry_Tone = s['Entry_Tone'] || '';
                    } else if (sources['kirk-book-data.csv']) {
                        const s = sources['kirk-book-data.csv'];
                        translit = s['Cherokee'] || '';
                        definition = s['English'] || '';
                        Entry_Tone = s['Tone'] || '';
                    } else if (sources['learning-to-use-the-cherokee-verb.csv']) {
                        const s = sources['learning-to-use-the-cherokee-verb.csv'];
                        translit = s['Cherokee'] || '';
                        syllabary = s['Syllabary'] || '';
                        definition = s['English'] || '';
                    } else if (sources['hierarchical-dict.json']) {
                        const s = sources['hierarchical-dict.json'];
                        translit = s['practical'] || '';
                        definition = s['definition'] || '';
                    }

                    const surfaceSpelling = d.surface_spelling || sources['hierarchical-dict.json']?.surface_spelling || sources['hierarchical-dict.json']?.practical || '';
                    if (!translit && surfaceSpelling) translit = surfaceSpelling;
                    if (!definition && sources['hierarchical-dict.json']?.definition) definition = sources['hierarchical-dict.json'].definition;

                    const Source_Long = sourceKeys.map(k => metadata.source_names?.[k] || k).join(', ');
                    const slug = d.slug || d.root_slug || sources['hierarchical-dict.json']?.slug || sources['hierarchical-dict.json']?.root_slug;
                    const root_slug = d.root_slug || d.slug || sources['hierarchical-dict.json']?.root_slug || sources['hierarchical-dict.json']?.slug;

                    return {
                        ...d,
                        id: d.merged_id,
                        slug: slug || undefined,
                        root_slug: root_slug || undefined,
                        syllabary,
                        translit,
                        definition,
                        source: sourceStr,
                        audio: audioByBaseForm[d.merged_id] || '',
                        surface_spelling: surfaceSpelling || undefined,
                        surface_forms: d.surface_forms,
                        surface_segments: d.surface_segments,
                        // Legacy
                        Index: d.merged_id,
                        Entry: translit,
                        Syllabary: syllabary,
                        Definition: definition,
                        Source: sourceStr,
                        Entry_Tone,
                        PoS: PoS || 'Noun',
                        Source_Long: Source_Long || sourceStr
                    };
                });

                const normalizedSentences = sentences.map((d: any) => {
                    let source = d.source;
                    if (source === 'Cherokee Dictionary 1975 Durbin Feeling') {
                        source = 'ced';
                    } else if (source === 'Cherokee New Testament' || source === 'CNT') {
                        source = 'cnt';
                    } else if (!source || (typeof source === 'string' && source.trim() === '')) {
                        const file = d['source file'] || (Array.isArray(d.sources) && d.sources[0]) || '';
                        if (file === 'cn-app-dictionary.csv') {
                            source = 'ced';
                        } else if (file === 'learning-to-use-the-cherokee-verb.csv') {
                            source = 'ltu';
                        } else if (file === 'cherokee-new-testament.csv') {
                            source = 'cnt';
                        } else if (file === 'lily-dict.csv') {
                            source = 'rrd';
                        } else if (file && typeof file === 'string') {
                            source = file.replace(/\.csv$/i, '');
                        } else {
                            source = 'official';
                        }
                    }

                    if (!source || typeof source !== 'string' || source.trim() === '') {
                        source = 'official';
                    }

                    return {
                        id: d.sentence_id || d.id || '',
                        syllabary: d.syllabary || '',
                        translit: d.phonetic || d.translit || '',
                        english: d.english || '',
                        source: source,
                        audio: audioBySentence[d.sentence_id] || d.audio || '',
                        // Reader fields
                        story: d.story || undefined,
                        chapter: d.chapter || undefined,
                        line: d.line ? parseInt(d.line, 10) : undefined,
                        story_order: d.story_order !== undefined ? parseInt(d.story_order, 10) : undefined,
                        author: d.author || undefined,
                        speaker: d.speaker || undefined,
                        tone: d.tone || undefined,
                    };
                });

                const sentLookup = new Map<string, any>();
                sentences.forEach((s: any) => {
                    if (s.sentence_id) sentLookup.set(s.sentence_id, s);
                });

                const mergedGlossesMap = new Map<string, any>();
                glosses.forEach((d: any) => {
                    const baseId = d.base_form_id || d.base_id || d.entry_id || d.merged_id;
                    const wordIdx = d.word_index !== undefined ? String(d.word_index) : undefined;
                    const key = `${d.sentence_id}_${baseId}_${wordIdx !== undefined ? wordIdx : ''}`;
                    if (!mergedGlossesMap.has(key)) {
                        let wordIndex = wordIdx;
                        if (wordIndex === undefined) {
                            const matchSent = sentLookup.get(d.sentence_id);
                            if (matchSent) {
                                const txt = matchSent.phonetic || matchSent.syllabary || '';
                                const parts = txt.split(' ');
                                const idx = parts.findIndex((p: string) => p.includes('*'));
                                if (idx !== -1) {
                                    wordIndex = idx.toString();
                                }
                            }
                        }

                        let source = d.source;
                        if (source === 'Cherokee Dictionary 1975 Durbin Feeling') {
                            source = 'ced';
                        } else if (source === 'Cherokee New Testament' || source === 'CNT') {
                            source = 'cnt';
                        } else if (!source || (typeof source === 'string' && source.trim() === '')) {
                            const file = d['source file'] || (Array.isArray(d.sources) && d.sources[0]) || '';
                            if (file === 'cn-app-dictionary.csv') {
                                source = 'ced';
                            } else if (file === 'learning-to-use-the-cherokee-verb.csv') {
                                source = 'ltu';
                            } else if (file === 'cherokee-new-testament.csv') {
                                source = 'cnt';
                            } else if (file === 'lily-dict.csv') {
                                source = 'rrd';
                            } else if (file && typeof file === 'string') {
                                source = file.replace(/\.csv$/i, '');
                            } else {
                                source = 'ced';
                            }
                        }

                        if (!source || typeof source !== 'string' || source.trim() === '') {
                            source = 'ced';
                        }

                        mergedGlossesMap.set(key, {
                            sentence_id: d.sentence_id,
                            word_index: wordIndex,
                            entry_id: baseId,
                            base_id: baseId,
                            source: source,
                            gloss_syllabary: d.gloss_syllabary,
                            gloss_phonetic: d.gloss_phonetic,
                            gloss_english: d.gloss_english
                        });
                    }
                });
                const normalizedGlosses = Array.from(mergedGlossesMap.values());

                const normalizedWordForms = conjugations.map((c: any) => {
                    const surfaceSpelling = c['hierarchical-dict.json_surface_spelling'] || c['hierarchical-dict.json_practical'] || c.surface_spelling || undefined;
                    let translit = c['cn-app-dictionary.csv_Practical'] || c['lily-dict.csv_Cherokee'] || c['kirk-book-data.csv_Cherokee'] || c['learning-to-use-the-cherokee-verb.csv_Cherokee'] || '';
                    if (!translit && surfaceSpelling) translit = surfaceSpelling;
                    if (!translit && c['hierarchical-dict.json_Cherokee']) translit = c['hierarchical-dict.json_Cherokee'].replace(/[-–—>]/g, '');

                    let source = '';
                    if (c['cn-app-dictionary.csv_Practical'] || c['cn-app-dictionary.csv_Syllabary']) source = 'ced';
                    else if (c['learning-to-use-the-cherokee-verb.csv_Cherokee']) source = 'ltu';
                    else if (c['kirk-book-data.csv_Cherokee']) source = 'kirk';
                    else if (c['lily-dict.csv_Cherokee'] || c['lily-dict.csv_Syllabary']) source = 'lily';
                    else if (surfaceSpelling || c['hierarchical-dict.json_Cherokee']) source = 'ced';

                    let surfaceSegments = c['hierarchical-dict.json_surface_segments'] || c.surface_segments || undefined;
                    if (typeof surfaceSegments === 'string' && surfaceSegments.trim()) {
                        try {
                            surfaceSegments = JSON.parse(surfaceSegments);
                        } catch {
                            surfaceSegments = undefined;
                        }
                    }

                    return {
                        word_index: c.merged_id,
                        form_name: c.normalized_key,
                        syllabary: c['cn-app-dictionary.csv_Syllabary'] || c['lily-dict.csv_Syllabary'] || c['learning-to-use-the-cherokee-verb.csv_Syllabary'] || '',
                        translit: translit,
                        surface_spelling: surfaceSpelling,
                        tone: c['cn-app-dictionary.csv_Tone and length 1'] || c['lily-dict.csv_Tone'] || c['kirk-book-data.csv_Tone'] || '',
                        tone2: c['cn-app-dictionary.csv_Tone and length 2'] || c.tone2 || undefined,
                        tone1: c['cn-app-dictionary.csv_Tone and length 1'] || c.tone1 || undefined,
                        notes: c['cn-app-dictionary.csv_Translations'] || c['learning-to-use-the-cherokee-verb.csv_English'] || c['kirk-book-data.csv_English'] || '',
                        source: source,
                        audio: audioByConjugation[`${c.merged_id}_${c.normalized_key}`] || '',
                        root_slug: c.root_slug || c.slug || undefined,
                        slug: c.slug || c.root_slug || undefined,
                        segmented_form: c['hierarchical-dict.json_Cherokee'] || c.segmented_form || undefined,
                        segmented_name: c['hierarchical-dict.json_Segmented Form'] || c.segmented_name || undefined,
                        surface_segments: surfaceSegments
                    };
                });

                const officialPackage: Package = {
                    id: 'official-cherokee-data',
                    name: metadata.name,
                    type: 'official',
                    status: 'active',
                    color: metadata.color || 'slate',
                    metadata: metadata
                };

                // Load persisted packages from IndexedDB
                let loadedImportedPkgs: Package[] = [];
                const loadedImportedData: Record<string, ImportedPackageData> = {};

                try {
                    const persisted = await getAllPackagesFromDB();
                    persisted.forEach(({ pkg, data }) => {
                        if (pkg && pkg.id) {
                            loadedImportedPkgs.push(pkg);
                            loadedImportedData[pkg.id] = data;
                        }
                    });
                } catch (e) {
                    console.error("Failed to load packages from IndexedDB", e);
                }

                // Check user-uninstalled default packages
                let uninstalledPackages: string[] = [];
                try {
                    const raw = localStorage.getItem('cherokee_app_uninstalled_packages');
                    if (raw) uninstalledPackages = JSON.parse(raw);
                } catch (e) {}

                // Auto-install packages marked with autoInstall in catalog
                try {
                    const catalogRes = await fetch(`${import.meta.env.BASE_URL}packages/catalog.json`);
                    if (catalogRes.ok) {
                        const catalog = await catalogRes.json();
                        if (Array.isArray(catalog)) {
                            for (const item of catalog) {
                                if (item.autoInstall && !loadedImportedPkgs.some(p => p.id === item.id) && !uninstalledPackages.includes(item.id)) {
                                    const pkgRes = await fetch(`${import.meta.env.BASE_URL}packages/${item.packageFile}`);
                                    if (pkgRes.ok) {
                                        const blob = await pkgRes.blob();
                                        const parsed = await parsePackageZip(blob, item.color);
                                        loadedImportedPkgs.push(parsed.pkg);
                                        loadedImportedData[parsed.pkg.id] = parsed.data;
                                        await savePackageToDB(parsed.pkg, parsed.data);
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('Failed to auto-install packages from catalog', e);
                }

                const userPkg: Package = {
                    id: 'user',
                    name: 'My Library',
                    type: 'user',
                    status: 'active',
                    color: '#f59e0b', // Amber-500
                    metadata: {
                        id: 'user',
                        name: 'My Library',
                        author: 'Me',
                        date_created: Date.now(),
                        description: 'Your custom data.',
                        app_version: '1.0',
                        stats: { words: 0, sentences: 0, audio_files: 0, glosses: 0, lists: 0 }
                    }
                };

                setImportedData({
                    [officialPackage.id]: {
                        dictionary: normalizedDictionary,
                        sentences: normalizedSentences,
                        glosses: normalizedGlosses,
                        word_forms: normalizedWordForms,
                        lists: officialLists
                    },
                    ...loadedImportedData
                });

                setPackages([officialPackage, userPkg, ...loadedImportedPkgs]);

            } catch (err) {
                console.error("Failed to load official data", err);
            }
        };

        loadOfficialData();
    }, []);

    const installPackage = (pkg: Package, data: ImportedPackageData) => {
        setPackages(prev => {
            const filtered = prev.filter(p => p.id !== pkg.id);
            return [...filtered, pkg];
        });
        setImportedData(prev => ({ ...prev, [pkg.id]: data }));
        savePackageToDB(pkg, data);

        // Remove from uninstalled packages list if previously uninstalled
        try {
            const raw = localStorage.getItem('cherokee_app_uninstalled_packages');
            if (raw) {
                const uninstalled: string[] = JSON.parse(raw);
                const updated = uninstalled.filter(id => id !== pkg.id);
                localStorage.setItem('cherokee_app_uninstalled_packages', JSON.stringify(updated));
            }
        } catch (e) {}
    };

    const removePackage = (id: string) => {
        setPackages(prev => prev.filter(p => p.id !== id));
        setImportedData(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
        deletePackageFromDB(id);

        // Mark as uninstalled so default packages don't auto-install on reload
        try {
            const raw = localStorage.getItem('cherokee_app_uninstalled_packages');
            const uninstalled: string[] = raw ? JSON.parse(raw) : [];
            if (!uninstalled.includes(id)) {
                uninstalled.push(id);
                localStorage.setItem('cherokee_app_uninstalled_packages', JSON.stringify(uninstalled));
            }
        } catch (e) {}
    };

    const togglePackage = (id: string) => {
        setPackages(prev => {
            const next = prev.map(p => p.id === id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } as Package : p);
            const updatedPkg = next.find(p => p.id === id);
            if (updatedPkg && updatedPkg.type === 'imported' && importedData[id]) {
                savePackageToDB(updatedPkg, importedData[id]);
            }
            return next;
        });
    };

    const updatePackageColor = (id: string, color: string) => {
        setPackages(prev => {
            const next = prev.map(p => p.id === id ? { ...p, color } : p);
            const updatedPkg = next.find(p => p.id === id);
            if (updatedPkg && updatedPkg.type === 'imported' && importedData[id]) {
                savePackageToDB(updatedPkg, importedData[id]);
            }
            return next;
        });
    };

    const getPackageColor = (sourceId: string) => {
        if (!sourceId) return undefined;
        const norm = sourceId.trim().toLowerCase();

        // 1. Check if source matches package ID directly
        const pkg = packages.find(p => p.id.toLowerCase() === norm);
        if (pkg) return pkg.color;

        // 2. Check if sourceId matches package metadata short_name or source_names
        // Prioritize imported and user packages so specific package colors take precedence over official package
        const sortedPackages = [...packages].sort((a, b) => {
            if (a.type === 'imported' && b.type !== 'imported') return -1;
            if (a.type !== 'imported' && b.type === 'imported') return 1;
            return 0;
        });

        for (const p of sortedPackages) {
            if (p.metadata?.short_name && p.metadata.short_name.toLowerCase() === norm) {
                return p.color;
            }
            if (p.metadata?.source_names) {
                for (const k of Object.keys(p.metadata.source_names)) {
                    if (k.toLowerCase() === norm) {
                        return p.color;
                    }
                }
            }
        }

        if (norm === 'official-cherokee-data' || norm === 'ced') return 'slate';
        if (norm === 'user') return '#f59e0b';

        return undefined;
    };

    return (
        <PackageManagerContext.Provider value={{
            packages,
            importedData,
            installPackage,
            removePackage,
            togglePackage,
            updatePackageColor,
            getPackageColor
        }}>
            {children}
        </PackageManagerContext.Provider>
    );
};
