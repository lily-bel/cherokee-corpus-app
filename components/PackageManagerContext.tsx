import React, { createContext, useContext, useState, useEffect } from 'react';


// --- Types ---

export interface PackageMetadata {
    id: string;
    name: string;
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
                const metaRes = await fetch('/data/metadata.json');
                if (!metaRes.ok) throw new Error('Failed to load official metadata');
                const metadata: PackageMetadata = await metaRes.json();

                // Fetch Data Files
                const [dictRes, sentRes, joinRes, conjRes, audioMapRes] = await Promise.all([
                    fetch('/data/base_forms.json').then(r => r.json()),
                    fetch('/data/sentences.json').then(r => r.json()),
                    fetch('/data/sentence_joins.json').then(r => r.json()),
                    fetch('/data/conjugations.json').then(r => r.json()),
                    fetch('/data/audio_mapping.json').then(r => r.json())
                ]);

                const dictionary = dictRes;
                const sentences = sentRes;
                const glosses = joinRes;
                const conjugations = conjRes;
                const audioMapping = audioMapRes;

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

                    const Source_Long = sourceKeys.map(k => metadata.source_names?.[k] || k).join(', ');

                    return {
                        ...d,
                        id: d.merged_id,
                        syllabary,
                        translit,
                        definition,
                        source: sourceStr,
                        audio: audioByBaseForm[d.merged_id] || '',
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
                    } else if (!source || source.trim() === '') {
                        if (d['source file'] === 'cn-app-dictionary.csv') {
                            source = 'ced';
                        } else if (d['source file'] === 'learning-to-use-the-cherokee-verb.csv') {
                            source = 'ltu';
                        }
                    }

                    return {
                        id: d.sentence_id,
                        syllabary: d.syllabary,
                        translit: d.phonetic,
                        english: d.english,
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
                    const key = `${d.sentence_id}_${d.base_id}`;
                    if (!mergedGlossesMap.has(key)) {
                        let wordIndex: string | undefined = undefined;
                        const matchSent = sentLookup.get(d.sentence_id);
                        if (matchSent) {
                            const txt = matchSent.phonetic || matchSent.syllabary || '';
                            const parts = txt.split(' ');
                            const idx = parts.findIndex((p: string) => p.includes('*'));
                            if (idx !== -1) {
                                wordIndex = idx.toString();
                            }
                        }

                        let source = d.source;
                        if (source === 'Cherokee Dictionary 1975 Durbin Feeling') {
                            source = 'ced';
                        } else if (!source || source.trim() === '') {
                            if (d['source file'] === 'cn-app-dictionary.csv') {
                                source = 'ced';
                            } else if (d['source file'] === 'learning-to-use-the-cherokee-verb.csv') {
                                source = 'ltu';
                            }
                        }

                        mergedGlossesMap.set(key, {
                            sentence_id: d.sentence_id,
                            word_index: wordIndex,
                            entry_id: d.base_id,
                            source: source,
                            gloss_syllabary: d.gloss_syllabary,
                            gloss_phonetic: d.gloss_phonetic,
                            gloss_english: d.gloss_english
                        });
                    }
                });
                const normalizedGlosses = Array.from(mergedGlossesMap.values());

                const normalizedWordForms = conjugations.map((c: any) => {
                    let source = '';
                    if (c['cn-app-dictionary.csv_Practical'] || c['cn-app-dictionary.csv_Syllabary']) source = 'ced';
                    else if (c['learning-to-use-the-cherokee-verb.csv_Cherokee']) source = 'ltu';
                    else if (c['kirk-book-data.csv_Cherokee']) source = 'kirk';
                    else if (c['lily-dict.csv_Cherokee'] || c['lily-dict.csv_Syllabary']) source = 'lily';

                    return {
                        word_index: c.merged_id,
                        form_name: c.normalized_key,
                        syllabary: c['cn-app-dictionary.csv_Syllabary'] || c['lily-dict.csv_Syllabary'] || c['learning-to-use-the-cherokee-verb.csv_Syllabary'] || '',
                        translit: c['cn-app-dictionary.csv_Practical'] || c['lily-dict.csv_Cherokee'] || c['kirk-book-data.csv_Cherokee'] || c['learning-to-use-the-cherokee-verb.csv_Cherokee'] || '',
                        tone: c['cn-app-dictionary.csv_Tone and length 1'] || c['lily-dict.csv_Tone'] || c['kirk-book-data.csv_Tone'] || '',
                        notes: c['cn-app-dictionary.csv_Translations'] || c['learning-to-use-the-cherokee-verb.csv_English'] || c['kirk-book-data.csv_English'] || '',
                        source: source,
                        audio: audioByConjugation[`${c.merged_id}_${c.normalized_key}`] || ''
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

                setImportedData(prev => ({ 
                    ...prev, 
                    [officialPackage.id]: { 
                        dictionary: normalizedDictionary, 
                        sentences: normalizedSentences, 
                        glosses: normalizedGlosses,
                        word_forms: normalizedWordForms
                    } 
                }));

                setPackages(prev => {
                    // Avoid duplicates if already loaded
                    if (prev.find(p => p.id === officialPackage.id)) return prev;

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
                            description: 'My personal collection.',
                            app_version: '1.0',
                            stats: { words: 0, sentences: 0, audio_files: 0, glosses: 0, lists: 0 }
                        }
                    };

                    return [officialPackage, userPkg, ...prev.filter(p => p.type === 'imported')];
                });

            } catch (err) {
                console.error("Failed to load official data", err);
            }
        };

        loadOfficialData();
    }, []);

    const installPackage = (pkg: Package, data: ImportedPackageData) => {
        setPackages(prev => [...prev, pkg]);
        setImportedData(prev => ({ ...prev, [pkg.id]: data }));
    };

    const removePackage = (id: string) => {
        setPackages(prev => prev.filter(p => p.id !== id));
        setImportedData(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const togglePackage = (id: string) => {
        setPackages(prev => prev.map(p => p.id === id ? { ...p, status: p.status === 'active' ? 'inactive' : 'active' } : p));
    };

    const updatePackageColor = (id: string, color: string) => {
        setPackages(prev => prev.map(p => p.id === id ? { ...p, color } : p));
    };

    const getPackageColor = (sourceId: string) => {
        // 1. Check if sourceId matches a package ID directly
        const pkg = packages.find(p => p.id === sourceId);
        if (pkg) return pkg.color;

        // 2. Check if sourceId is a shorthand in a package's source_names
        // This is a bit more complex because multiple packages might have the same shorthand key if not careful,
        // but usually shorthands are unique per package scope?
        // Actually, the app seems to use 'source' field in data which might be a shorthand.
        // Let's iterate packages and check metadata.source_names
        for (const p of packages) {
            if (p.metadata.source_names && p.metadata.source_names[sourceId]) {
                return p.color;
            }
            // Also check if the sourceId matches the package name or ID logic used elsewhere
            if (p.id === sourceId) return p.color;
        }

        // 3. Fallback for specific known IDs if they aren't in packages list yet or are special
        if (sourceId === 'official-cherokee-data') return 'slate'; // Should be in packages though
        if (sourceId === 'user') return 'amber';

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
