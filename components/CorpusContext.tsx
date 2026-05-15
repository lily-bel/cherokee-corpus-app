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
    Other_Forms?: string;
    Entry_Audio?: string;
    Sentence_Syllabary?: string;
    Sentence_Transliteration?: string;
    Sentence_English?: string;
    Sentence_Audio?: string;
    Definition_Long?: string;
    Cross_Reference?: string;
}

export interface Sentence {
    id: string;
    syllabary: string;
    translit: string;
    english: string;
    audio?: string;
    source: string;
    // Reader fields
    story?: string;      // Book/story title for grouping
    chapter?: string;    // Chapter name within story
    line?: number;       // Line number for ordering within chapter
    story_order?: number; // Canonical ordering of stories within a source
    author?: string;     // Author attribution
    speaker?: string;    // Speaker name for audio
    tone?: string;       // Tonal transcription
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
    gloss_syllabary?: string;
    gloss_phonetic?: string;
    gloss_english?: string;
}

export interface CustomDictionary {
    id: string;
    name: string;
    date: number; // Timestamp
    type?: 'book' | 'notebook';
}

export interface PersonalWord {
    id: string;
    customDictionaryId: string;
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
    Other_Forms?: string;
}

export interface RootEntry {
    entry_id: string;
    root_h: string;
    root_g: string;
    root_slug: string;
    definition: string;
    class_name: string;
    is_derivation?: boolean;
    parent_entry_no?: number;
    segmented_forms?: {
        present: string;
        present_1sg: string;
        imperfective: string;
        perfective: string;
        imperative: string;
        infinitive: string;
    };
    config?: {
        pre?: {
            distributive?: boolean;
            translocutive?: boolean;
        };
        pron?: {
            set_type?: string;
        };
    };
    [key: string]: any;
}

interface CorpusContextType {
    dictionary: DictionaryEntry[];
    sentences: Sentence[];
    userSentences: Sentence[];
    glosses: Gloss[];
    roots: RootEntry[];
    loading: boolean;


    // Maps
    glossMap: Map<string, Gloss[]>; // SentenceID -> Gloss[]
    entryToSentencesMap: Map<string, string[]>; // EntryID -> SentenceID[]
    dictionaryMap: Map<string, DictionaryEntry>; // EntryID -> Entry
    sentenceMap: Map<string, Sentence>; // SentenceID -> Sentence
    rootMap: Map<string, RootEntry>; // EntryID -> RootEntry
    groupedRootsMap: Map<string, RootEntry[]>; // RootSlug -> RootEntry[]

    // User Data
    customDictionaries: Record<string, CustomDictionary>;
    personalWords: PersonalWord[];
    setCustomDictionaries: React.Dispatch<React.SetStateAction<Record<string, CustomDictionary>>>;
    setPersonalWords: React.Dispatch<React.SetStateAction<PersonalWord[]>>;

    // Actions
    addUserGloss: (gloss: Gloss) => void;
    removeUserGloss: (glossId: string) => void;
    addUserSentence: (sentence: Sentence) => void;
    removeUserSentence: (id: string) => void;
    removeUserSentences: (ids: string[]) => void;

    // Audio
    userAudioMeta: Record<string, any[]>;
    saveAudio: (targetId: string, blob: Blob, speaker: string, formIndex?: number) => Promise<void>; // Updated signature
    deleteAudio: (targetId: string, audioId: string) => Promise<void>;
    importAudioMeta: (newMeta: Record<string, any[]>) => void;
    removePackageAudio: (packageId: string) => Promise<void>;
    usedSpeakers: string[];

    // Custom Forms
    userWordForms: Record<string, string>;
    setUserWordForms: React.Dispatch<React.SetStateAction<Record<string, string>>>;

    // User Notes
    userNotes: Record<string, string>;
    setUserNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
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
    const [userAudioMeta, setUserAudioMeta] = useState<Record<string, any[]>>({});
    const [userWordForms, setUserWordForms] = useState<Record<string, string>>({}); // EntryID -> pipe-separated forms
    const [userNotes, setUserNotes] = useState<Record<string, string>>({});



    const [customDictionaries, setCustomDictionaries] = useState<Record<string, CustomDictionary>>({});
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

            // Load Custom Dictionaries and Personal Words
            const savedDictionaries = localStorage.getItem('cherokee_app_notebooks');
            const savedWords = localStorage.getItem('cherokee_app_personal_words');

            if (savedWords && !savedDictionaries) {
                // Migration for legacy data
                const words = JSON.parse(savedWords);
                const defaultDictionaryId = 'nb_' + Date.now();
                setCustomDictionaries({ [defaultDictionaryId]: { id: defaultDictionaryId, name: 'My Custom Dictionary', date: Date.now(), type: 'notebook' } });
                setPersonalWords(words.map((w: any) => ({ ...w, customDictionaryId: defaultDictionaryId })));
            } else {
                if (savedDictionaries) setCustomDictionaries(JSON.parse(savedDictionaries));
                if (savedWords) setPersonalWords(JSON.parse(savedWords));
            }

            const savedAudioMeta = localStorage.getItem('cherokee_app_user_audio_meta');
            if (savedAudioMeta) setUserAudioMeta(JSON.parse(savedAudioMeta));

            const savedWordForms = localStorage.getItem('cherokee_app_user_word_forms');
            if (savedWordForms) setUserWordForms(JSON.parse(savedWordForms));

            const savedNotes = localStorage.getItem('cherokee_app_user_notes');
            if (savedNotes) setUserNotes(JSON.parse(savedNotes));

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
            localStorage.setItem('cherokee_app_notebooks', JSON.stringify(customDictionaries));
        } catch (e) { console.error("Failed to save custom dictionaries", e); }
    }, [customDictionaries]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_personal_words', JSON.stringify(personalWords));
        } catch (e) { console.error("Failed to save personal words", e); }
    }, [personalWords]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_audio_meta', JSON.stringify(userAudioMeta));
        } catch (e) { console.error("Failed to save audio meta", e); }
    }, [userAudioMeta]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_word_forms', JSON.stringify(userWordForms));
        } catch (e) { console.error("Failed to save user word forms", e); }
    }, [userWordForms]);

    useEffect(() => {
        try {
            localStorage.setItem('cherokee_app_user_notes', JSON.stringify(userNotes));
        } catch (e) { console.error("Failed to save user notes", e); }
    }, [userNotes]);

    // Load Audio Manifest
    useEffect(() => {
        setLoading(false);

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
    const { glossMap, entryToSentencesMap, dictionaryMap, sentenceMap, allGlosses, rootMap, groupedRootsMap, derivedRoots } = useMemo(() => {
        const allGlosses = [...combinedGlosses, ...userGlosses];

        const gMap = new Map<string, Gloss[]>();
        const eToSMap = new Map<string, Set<string>>(); // Use Set to avoid duplicates
        const dMap = new Map<string, DictionaryEntry>();
        const sMap = new Map<string, Sentence>();
        const rMap = new Map<string, RootEntry>();
        const grMap = new Map<string, RootEntry[]>();
        const rootsArr: RootEntry[] = [];

        // Index Dictionary & Extract Roots
        dictionary.forEach(d => {
            const id = d.id || d.Index;
            if (id) dMap.set(id, d);

            // Also index by lily-dict Index for root mapping
            const lilyIndex = (d as any).sources?.['lily-dict.csv']?.Index;
            if (lilyIndex) dMap.set(lilyIndex, d);

            // Extract Root Info from hierarchical-dict
            const hd = (d as any).sources?.['hierarchical-dict.json'];
            if (hd && (hd.class_name || hd.h_grade_root || hd.glottal_grade_root)) {
                const rootSlug = hd.h_grade_root || hd.glottal_grade_root || hd.class_name;
                
                const rootEntry: RootEntry = {
                    entry_id: id || lilyIndex || '',
                    root_h: hd.h_grade_root || '',
                    root_g: hd.glottal_grade_root || '',
                    root_slug: rootSlug,
                    definition: hd.definition || d.Definition || '',
                    class_name: hd.class_name || '',
                    segmented_forms: {
                        present: hd['segmented_forms.present'] || '',
                        present_1sg: hd['segmented_forms.present_1sg'] || '',
                        imperfective: hd['segmented_forms.imperfective'] || '',
                        perfective: hd['segmented_forms.perfective'] || '',
                        imperative: hd['segmented_forms.imperative'] || '',
                        infinitive: hd['segmented_forms.infinitive'] || ''
                    },
                    config: {
                        pre: {
                            distributive: hd['config.pre.distributive'] === true || hd['config.pre.distributive'] === 'true',
                            translocutive: hd['config.pre.translocutive'] === true || hd['config.pre.translocutive'] === 'true'
                        },
                        pron: {
                            set_type: hd['config.pron.set_type'] || ''
                        }
                    }
                };
                
                rootsArr.push(rootEntry);
                rMap.set(rootEntry.entry_id, rootEntry);
                if (lilyIndex && lilyIndex !== id) {
                    rMap.set(lilyIndex, rootEntry);
                }
                
                if (!grMap.has(rootSlug)) {
                    grMap.set(rootSlug, []);
                }
                grMap.get(rootSlug)!.push(rootEntry);
            }
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
            allGlosses,
            rootMap: rMap,
            groupedRootsMap: grMap,
            derivedRoots: rootsArr
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
            const newGloss = { ...gloss, source: 'user', id: gloss.id || Date.now().toString() };
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
            return [...prev, { ...sentence, source: sentence.source || 'user', id: sentence.id || Date.now().toString() }];
        });
    };

    const removeUserSentence = (id: string) => {
        setUserSentences(prev => prev.filter(s => s.id !== id));
    };

    const removeUserSentences = (ids: string[]) => {
        const idsSet = new Set(ids);
        setUserSentences(prev => prev.filter(s => !idsSet.has(s.id)));
    };

    // Audio Actions
    const saveAudio = async (targetId: string, blob: Blob, speaker: string, formIndex?: number) => {
        const { saveAudioToDB } = await import('../utils');

        let type = 'W';
        let id = targetId;

        if (targetId.endsWith('_sentence')) {
            type = 'S';
            id = targetId.replace('_sentence', '');
        }

        const index = Date.now();
        // Construct ID: Speaker_Type-ID[_FormIndex]_Timestamp
        let audioId = '';
        if (formIndex !== undefined) {
            audioId = `${speaker}_${type}-${id}.${formIndex}_${index}`;
        } else {
            audioId = `${speaker}_${type}-${id}_${index}`;
        }

        await saveAudioToDB(audioId, blob);

        setUserAudioMeta(prev => {
            const newMeta = { ...prev };
            if (!newMeta[targetId]) newMeta[targetId] = [];
            newMeta[targetId].push({ id: audioId, speaker, date: Date.now() });
            return newMeta;
        });
    };

    const deleteAudio = async (targetId: string, audioId: string) => {
        const { deleteAudioFromDB } = await import('../utils');
        try {
            await deleteAudioFromDB(audioId);
            setUserAudioMeta(prev => {
                const newMeta = { ...prev };
                if (newMeta[targetId]) {
                    newMeta[targetId] = newMeta[targetId].filter(a => a.id !== audioId);
                }
                return newMeta;
            });
        } catch (e) {
            console.error("Failed to delete audio", e);
        }
    };

    const importAudioMeta = (newMeta: Record<string, any[]>) => {
        setUserAudioMeta(prev => {
            const updated = { ...prev };
            Object.entries(newMeta).forEach(([key, list]) => {
                if (!updated[key]) updated[key] = [];
                // Avoid duplicates based on ID
                const existingIds = new Set(updated[key].map(a => a.id));
                list.forEach(item => {
                    if (!existingIds.has(item.id)) {
                        updated[key].push(item);
                        existingIds.add(item.id);
                    }
                });
            });
            return updated;
        });
    };

    const removePackageAudio = async (packageId: string) => {
        const newMeta = { ...userAudioMeta };
        let hasChanges = false;

        for (const entryIndex in newMeta) {
            const audios = newMeta[entryIndex];
            const filtered = audios.filter(a => a.packageId !== packageId);

            if (filtered.length !== audios.length) {
                hasChanges = true;
                const removed = audios.filter(a => a.packageId === packageId);
                for (const audio of removed) {
                    await deleteAudio(entryIndex, audio.id);
                }

                if (filtered.length === 0) {
                    delete newMeta[entryIndex];
                } else {
                    newMeta[entryIndex] = filtered;
                }
            }
        }

        if (hasChanges) {
            setUserAudioMeta(newMeta);
            localStorage.setItem('cherokee_user_audio_meta', JSON.stringify(newMeta));
        }
    };

    return (
        <CorpusContext.Provider value={{
            dictionary,
            sentences,
            userSentences,
            glosses: allGlosses,
            roots: derivedRoots,
            loading,
            glossMap,
            entryToSentencesMap,
            dictionaryMap,
            sentenceMap,
            rootMap,
            groupedRootsMap,
            addUserGloss,
            removeUserGloss,
            addUserSentence,
            removeUserSentence,
            removeUserSentences,
            customDictionaries,
            personalWords,
            setCustomDictionaries,
            setPersonalWords,
            userAudioMeta,
            saveAudio,
            deleteAudio,
            importAudioMeta,
            removePackageAudio,
            usedSpeakers: useMemo(() => {
                const s = new Set<string>();
                Object.values(userAudioMeta).forEach(list => {
                    list.forEach(item => {
                        if (item.speaker) s.add(item.speaker);
                    });
                });
                return Array.from(s).sort();
            }, [userAudioMeta]),
            userWordForms,
            setUserWordForms,
            userNotes,
            setUserNotes
        }}>
            {children}
        </CorpusContext.Provider>
    );
};
