import React, { createContext, useContext, useState, useEffect } from 'react';
import Papa from 'papaparse';


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
    };
    source_names?: Record<string, string>;
    source_meta?: Record<string, "prioritize" | "filter">;
    color?: string;
    locked?: string;
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
                const [dictRes, sentRes, joinRes] = await Promise.all([
                    fetch('/data/dictionary.csv').then(r => r.text()),
                    fetch('/data/sentences.csv').then(r => r.text()),
                    fetch('/data/join_table.csv').then(r => r.text())
                ]);

                // Parse CSVs
                const parseCSV = (csv: string) => {
                    return new Promise<any[]>((resolve) => {
                        Papa.parse(csv, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => resolve(results.data)
                        });
                    });
                };

                const [dictionary, sentences, glosses] = await Promise.all([
                    parseCSV(dictRes),
                    parseCSV(sentRes),
                    parseCSV(joinRes)
                ]);

                // Normalize Dictionary Data (Map legacy fields if needed)
                const normalizedDictionary = dictionary.map((d: any) => ({
                    ...d,
                    id: d.Index,
                    syllabary: d.Syllabary,
                    translit: d.Entry,
                    definition: d.Definition,
                    source: d.Source,
                    audio: d.Audio,
                    // Legacy
                    Index: d.Index,
                    Entry: d.Entry,
                    Syllabary: d.Syllabary,
                    Definition: d.Definition,
                    Source: d.Source,
                    Entry_Tone: d.Entry_Tone || d.Entry,
                    PoS: d.PoS || d.Part_of_Speech || 'Noun',
                    Source_Long: metadata.source_names?.[d.Source] || d.Source
                }));

                const normalizedSentences = sentences.map((d: any) => ({
                    id: d.ID,
                    syllabary: d.Syllabary,
                    translit: d.Transliteration,
                    english: d.English,
                    source: d.Source,
                    audio: d.Audio,
                }));

                const normalizedGlosses = glosses.map((d: any) => ({
                    sentence_id: d.Sentence_ID,
                    word_index: d.Word_Index,
                    entry_id: d.Entry_ID,
                    notes: d.Notes,
                    source: d.Source
                }));


                const officialPackage: Package = {
                    id: 'official-cherokee-data',
                    name: metadata.name,
                    type: 'official',
                    status: 'active',
                    color: metadata.color || 'slate',
                    metadata: metadata
                };

                setImportedData(prev => ({ ...prev, [officialPackage.id]: { dictionary: normalizedDictionary, sentences: normalizedSentences, glosses: normalizedGlosses } }));

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
                            stats: { words: 0, sentences: 0, audio_files: 0 }
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
