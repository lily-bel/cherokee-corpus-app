import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';

// --- Types ---

export interface DictionaryEntry {
    id: string;
    syllabary: string;
    translit: string;
    definition: string;
    source: string;
    audio?: string;
    // Legacy fields for compatibility
    Index?: string;
    Entry?: string;
    Syllabary?: string;
    Definition?: string;
    Source?: string;
    Entry_Tone?: string;
    PoS?: string;
}

export interface Sentence {
    id: string;
    syllabary: string;
    translit: string;
    english: string;
    audio?: string;
    source: string;
}

export interface Gloss {
    sentence_id: string;
    word_index: string; // "0,1"
    entry_id: string;
    notes?: string;
    source: string; // "ced", "user", etc.
}

interface CorpusContextType {
    dictionary: DictionaryEntry[];
    sentences: Sentence[];
    glosses: Gloss[];
    loading: boolean;
    error: string | null;

    // Maps
    glossMap: Map<string, Gloss[]>; // SentenceID -> Gloss[]
    entryToSentencesMap: Map<string, string[]>; // EntryID -> SentenceID[]
    dictionaryMap: Map<string, DictionaryEntry>; // EntryID -> Entry
    sentenceMap: Map<string, Sentence>; // SentenceID -> Sentence

    // Actions
    addUserGloss: (gloss: Gloss) => void;
    removeUserGloss: (sentenceId: string, wordIndex: string) => void;
}

const CorpusContext = createContext<CorpusContextType | undefined>(undefined);

export const useCorpus = () => {
    const context = useContext(CorpusContext);
    if (!context) {
        throw new Error('useCorpus must be used within a CorpusProvider');
    }
    return context;
};

export const CorpusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [dictionary, setDictionary] = useState<DictionaryEntry[]>([]);
    const [sentences, setSentences] = useState<Sentence[]>([]);
    const [staticGlosses, setStaticGlosses] = useState<Gloss[]>([]);
    const [userGlosses, setUserGlosses] = useState<Gloss[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Load User Glosses from LocalStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('cherokee_app_user_glosses');
            if (saved) {
                setUserGlosses(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load user glosses", e);
        }
    }, []);

    // Save User Glosses to LocalStorage when changed
    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_glosses', JSON.stringify(userGlosses));
        } catch (e) {
            console.error("Failed to save user glosses", e);
        }
    }, [userGlosses]);

    // Load CSVs
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const fetchCsv = async (path: string) => {
                    console.log(`Fetching ${path}...`);
                    const res = await fetch(path);
                    if (!res.ok) {
                        throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
                    }
                    const text = await res.text();
                    console.log(`Fetched ${path}: ${text.length} bytes`);
                    return text;
                };

                const [dictRes, sentRes, joinRes] = await Promise.all([
                    fetchCsv('/data/dictionary.csv'),
                    fetchCsv('/data/sentences.csv'),
                    fetchCsv('/data/join_table.csv')
                ]);

                Papa.parse(dictRes, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        console.log("Dictionary Parsed:", results.data.length, "entries");
                        if (results.errors.length) console.error("Dictionary Parse Errors:", results.errors);

                        // Normalize keys and map to legacy fields
                        const mapped = results.data.map((d: any) => ({
                            ...d,
                            // New Standard Fields
                            id: d.Index,
                            syllabary: d.Syllabary,
                            translit: d.Entry,
                            definition: d.Definition,
                            source: d.Source,
                            audio: d.Audio,

                            // Legacy Compatibility
                            Index: d.Index,
                            Entry: d.Entry,
                            Syllabary: d.Syllabary,
                            Definition: d.Definition,
                            Source: d.Source,
                            Entry_Tone: d.Entry_Tone || d.Entry, // Fallback
                            PoS: d.PoS || d.Part_of_Speech || 'Noun' // Default or missing
                        }));
                        console.log("Dictionary Mapped (First 5):", mapped.slice(0, 5));
                        setDictionary(mapped as DictionaryEntry[]);
                    }
                });

                Papa.parse(sentRes, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        console.log("Sentences Parsed:", results.data.length, "entries");
                        const mapped = results.data.map((d: any) => ({
                            id: d.ID,
                            syllabary: d.Syllabary,
                            translit: d.Transliteration,
                            english: d.English,
                            source: d.Source,
                            audio: d.Audio
                        }));
                        setSentences(mapped as Sentence[]);
                    }
                });

                Papa.parse(joinRes, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        console.log("Join Table Parsed:", results.data.length, "entries");
                        const mapped = results.data.map((d: any) => ({
                            sentence_id: d.Sentence_ID,
                            word_index: d.Word_Index,
                            entry_id: d.Entry_ID,
                            notes: d.Notes,
                            source: d.Source
                        }));
                        setStaticGlosses(mapped as Gloss[]);
                    }
                });

            } catch (err) {
                console.error("Failed to load corpus data", err);
                setError("Failed to load data. Please ensure CSVs are in /public/data/");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    // Derived State: Maps
    const { glossMap, entryToSentencesMap, dictionaryMap, sentenceMap, allGlosses } = useMemo(() => {
        const allGlosses = [...staticGlosses, ...userGlosses];

        const gMap = new Map<string, Gloss[]>();
        const eToSMap = new Map<string, Set<string>>(); // Use Set to avoid duplicates
        const dMap = new Map<string, DictionaryEntry>();
        const sMap = new Map<string, Sentence>();

        // Index Dictionary
        dictionary.forEach(d => {
            const id = d.id || d.Index;
            if (id) dMap.set(id, d);
        });

        // Index Sentences
        sentences.forEach(s => {
            if (s.id) sMap.set(s.id, s);
        });

        // Process Glosses
        allGlosses.forEach(g => {
            // 1. Gloss Map (Sentence -> Glosses)
            if (!gMap.has(g.sentence_id)) {
                gMap.set(g.sentence_id, []);
            }
            gMap.get(g.sentence_id)!.push(g);

            // 2. Reverse Map (Entry -> Sentences)
            if (g.entry_id) {
                if (!eToSMap.has(g.entry_id)) {
                    eToSMap.set(g.entry_id, new Set());
                }
                eToSMap.get(g.entry_id)!.add(g.sentence_id);
            }
        });

        // Convert Set to Array for the final map
        const finalEToSMap = new Map<string, string[]>();
        eToSMap.forEach((val, key) => {
            finalEToSMap.set(key, Array.from(val));
        });

        return {
            glossMap: gMap,
            entryToSentencesMap: finalEToSMap,
            dictionaryMap: dMap,
            sentenceMap: sMap,
            allGlosses
        };
    }, [dictionary, sentences, staticGlosses, userGlosses]);


    // Actions
    const addUserGloss = (gloss: Gloss) => {
        setUserGlosses(prev => {
            // If replacing a user gloss for the exact same index:
            const filtered = prev.filter(g => !(g.sentence_id === gloss.sentence_id && g.word_index === gloss.word_index));
            return [...filtered, { ...gloss, source: 'user' }];
        });
    };

    const removeUserGloss = (sentenceId: string, wordIndex: string) => {
        setUserGlosses(prev => prev.filter(g => !(g.sentence_id === sentenceId && g.word_index === wordIndex)));
    };

    return (
        <CorpusContext.Provider value={{
            dictionary,
            sentences,
            glosses: allGlosses,
            loading,
            error,
            glossMap,
            entryToSentencesMap,
            dictionaryMap,
            sentenceMap,
            addUserGloss,
            removeUserGloss
        }}>
            {children}
        </CorpusContext.Provider>
    );
};
