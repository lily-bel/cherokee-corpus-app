import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

import { usePackageManager } from './PackageManagerContext';

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
    Source_Long?: string;
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
    breakdown_cherokee?: string;
    breakdown_english?: string;
    source: string; // "ced", "user", etc.
    id?: string; // Unique ID for deletion
}

export interface Notebook {
    id: string;
    name: string;
    date: number; // Timestamp
}

export interface PersonalWord {
    id: string;
    notebookId: string;
    syllabary: string;
    translit: string;
    definition: string;
    source: string; // "user"
    audio?: string;
    // Legacy fields
    Index?: string;
    Entry?: string;
    Syllabary?: string;
    Definition?: string;
    Source?: string;
    Entry_Tone?: string;
    PoS?: string;
    Notes?: string;
    DateCreated?: number;
}

interface CorpusContextType {
    dictionary: DictionaryEntry[];
    sentences: Sentence[];
    userSentences: Sentence[];
    glosses: Gloss[];
    loading: boolean;
    audioManifest: string[];

    // Maps
    glossMap: Map<string, Gloss[]>; // SentenceID -> Gloss[]
    entryToSentencesMap: Map<string, string[]>; // EntryID -> SentenceID[]
    dictionaryMap: Map<string, DictionaryEntry>; // EntryID -> Entry
    sentenceMap: Map<string, Sentence>; // SentenceID -> Sentence

    // User Data
    notebooks: Record<string, Notebook>;
    personalWords: PersonalWord[];
    setNotebooks: React.Dispatch<React.SetStateAction<Record<string, Notebook>>>;
    setPersonalWords: React.Dispatch<React.SetStateAction<PersonalWord[]>>;

    // Actions
    addUserGloss: (gloss: Gloss) => void;
    removeUserGloss: (glossId: string) => void;
    addUserSentence: (sentence: Sentence) => void;
    removeUserSentence: (id: string) => void;
    removeUserSentences: (ids: string[]) => void;
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
    const { packages, importedData } = usePackageManager();

    const [userGlosses, setUserGlosses] = useState<Gloss[]>([]);
    const [userSentences, setUserSentences] = useState<Sentence[]>([]);
    const [audioManifest, setAudioManifest] = useState<string[]>([]);

    const [notebooks, setNotebooks] = useState<Record<string, Notebook>>({});
    const [personalWords, setPersonalWords] = useState<PersonalWord[]>([]);

    const [loading, setLoading] = useState(true);

    // Load User Data from LocalStorage on mount
    useEffect(() => {
        try {
            const savedGlosses = localStorage.getItem('cherokee_app_user_glosses');
            if (savedGlosses) {
                const parsed = JSON.parse(savedGlosses);
                // Migration: Add IDs if missing
                const migrated = parsed.map((g: Gloss) => ({ ...g, id: g.id || crypto.randomUUID() }));
                setUserGlosses(migrated);
            }

            const savedSentences = localStorage.getItem('cherokee_app_user_sentences');
            if (savedSentences) setUserSentences(JSON.parse(savedSentences));

            // Load Notebooks and Personal Words
            const savedNotebooks = localStorage.getItem('cherokee_app_notebooks');
            const savedWords = localStorage.getItem('cherokee_app_personal_words');

            if (savedWords && !savedNotebooks) {
                // Migration for legacy data
                const words = JSON.parse(savedWords);
                const defaultNotebookId = 'nb_' + Date.now();
                setNotebooks({ [defaultNotebookId]: { id: defaultNotebookId, name: 'My Dictionary', date: Date.now() } });
                setPersonalWords(words.map((w: any) => ({ ...w, notebookId: defaultNotebookId })));
            } else {
                if (savedNotebooks) setNotebooks(JSON.parse(savedNotebooks));
                if (savedWords) setPersonalWords(JSON.parse(savedWords));
            }

        } catch (e) {
            console.error("Failed to load user data", e);
        }
    }, []);

    // Save User Data to LocalStorage when changed
    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_glosses', JSON.stringify(userGlosses));
        } catch (e) { console.error("Failed to save user glosses", e); }
    }, [userGlosses]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_sentences', JSON.stringify(userSentences));
        } catch (e) { console.error("Failed to save user sentences", e); }
    }, [userSentences]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_notebooks', JSON.stringify(notebooks));
        } catch (e) { console.error("Failed to save notebooks", e); }
    }, [notebooks]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_personal_words', JSON.stringify(personalWords));
        } catch (e) { console.error("Failed to save personal words", e); }
    }, [personalWords]);

    // Load Audio Manifest
    useEffect(() => {
        fetch('/data/audio_manifest.json')
            .then(r => r.ok ? r.json() : [])
            .then(setAudioManifest)
            .catch(e => console.error("Failed to load audio manifest", e))
            .finally(() => setLoading(false));
    }, []);

    // Combine Base Data with Active Packages
    const { dictionary, sentences, combinedGlosses } = useMemo(() => {
        const activeIds = packages.filter(p => p.status === 'active' && (p.type === 'imported' || p.type === 'official')).map(p => p.id);

        let d: DictionaryEntry[] = [];
        let s: Sentence[] = [];
        let g: Gloss[] = [];

        activeIds.forEach(id => {
            const data = importedData[id];
            if (data) {
                if (data.dictionary) d = [...d, ...data.dictionary];
                if (data.sentences) s = [...s, ...data.sentences];
                if (data.glosses) g = [...g, ...data.glosses];
            }
        });

        return { dictionary: d, sentences: s, combinedGlosses: g };
    }, [packages, importedData]);

    // Derived State: Maps
    const { glossMap, entryToSentencesMap, dictionaryMap, sentenceMap, allGlosses } = useMemo(() => {
        const allGlosses = [...combinedGlosses, ...userGlosses];

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
        [...sentences, ...userSentences].forEach(s => {
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
    }, [dictionary, sentences, combinedGlosses, userGlosses, userSentences]);


    // Actions
    const addUserGloss = (gloss: Gloss) => {
        setUserGlosses(prev => {
            // If ID is provided, try to update existing
            if (gloss.id) {
                const existingIndex = prev.findIndex(g => g.id === gloss.id);
                if (existingIndex >= 0) {
                    const newGlosses = [...prev];
                    newGlosses[existingIndex] = { ...gloss, source: 'user' };
                    return newGlosses;
                }
            }
            // Append new gloss
            const newGloss = { ...gloss, source: 'user', id: gloss.id || crypto.randomUUID() };
            return [...prev, newGloss];
        });
    };

    const removeUserGloss = (glossId: string) => {
        setUserGlosses(prev => prev.filter(g => g.id !== glossId));
    };

    const addUserSentence = (sentence: Sentence) => {
        setUserSentences(prev => {
            const index = prev.findIndex(s => s.id === sentence.id);
            if (index >= 0) {
                const newSentences = [...prev];
                newSentences[index] = { ...sentence, source: sentence.source || 'user' };
                return newSentences;
            }
            return [...prev, { ...sentence, source: sentence.source || 'user' }];
        });
    };

    const removeUserSentence = (id: string) => {
        setUserSentences(prev => prev.filter(s => s.id !== id));
    };

    const removeUserSentences = (ids: string[]) => {
        const idsSet = new Set(ids);
        setUserSentences(prev => prev.filter(s => !idsSet.has(s.id)));
    };

    return (
        <CorpusContext.Provider value={{
            dictionary,
            sentences,
            userSentences,
            glosses: allGlosses,
            loading,
            audioManifest,
            glossMap,
            entryToSentencesMap,
            dictionaryMap,
            sentenceMap,
            addUserGloss,
            removeUserGloss,
            addUserSentence,
            removeUserSentence,
            removeUserSentences,
            notebooks,
            personalWords,
            setNotebooks,
            setPersonalWords
        }}>
            {children}
        </CorpusContext.Provider>
    );
};
