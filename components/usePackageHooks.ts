import { useCorpus } from './CorpusContext';
import { usePackageManager, Package, PackageMetadata, ImportedPackageData } from './PackageManagerContext';
import { ListData } from './ListsTab';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { downloadFile, saveAudioToDB, getAudioFromDB } from '../utils';

const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};

export const usePackageExport = () => {
    const { personalWords, userSentences, glosses, customDictionaries, userAudioMeta, userNotes, userWordForms } = useCorpus();

    const exportPackage = async (
        customDictionaryIds: string[],
        metadata: Partial<PackageMetadata>,
        listsToExport: { list: ListData, includeDependencies: boolean }[] = [],
        dependencyAudioIds: string[] = [],
        dependencyEntryIds: string[] = [],
        exportAllNotesAndForms: boolean = false
    ) => {
        try {
            const zip = new JSZip();

            // 0. Generate Shorthands
            const shorthandMap: Record<string, string> = {};
            const usedShorthands = new Set<string>();

            // 0.1 Package Shorthand (for glosses on official sentences)
            let pkgBase = (metadata.name || 'Package').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
            if (pkgBase.length === 0) pkgBase = 'PKG';

            const packageShorthand = pkgBase;
            usedShorthands.add(packageShorthand);

            customDictionaryIds.forEach(id => {
                const nb = customDictionaries[id];
                if (!nb) return;

                let base = (nb.name || 'NB').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
                if (base.length === 0) base = 'NB';

                let shorthand = base;
                let counter = 1;
                while (usedShorthands.has(shorthand)) {
                    counter++;
                    shorthand = `${base}${counter}`;
                }

                usedShorthands.add(shorthand);
                shorthandMap[id] = shorthand;
            });

                    // 1. Filter Data (Dictionaries)
                    let wordsToExport = personalWords.filter(w => customDictionaryIds.includes(w.customDictionaryId));
                    let sentencesToExport = userSentences.filter(s => customDictionaryIds.includes(s.source));
                        // 1.2 Add Dependency Entries
            if (dependencyEntryIds.length > 0) {
                const depSet = new Set(dependencyEntryIds);

                // Find words
                const depWords = personalWords.filter(w => depSet.has(w.id) && !customDictionaryIds.includes(w.customDictionaryId));
                wordsToExport = [...wordsToExport, ...depWords];

                // Find sentences
                const depSentences = userSentences.filter(s => depSet.has(s.id) && !customDictionaryIds.includes(s.source));
                sentencesToExport = [...sentencesToExport, ...depSentences];
            }

            // 1.3 Collect Target IDs for Custom Data (Notes/Forms/Audio)
            const relevantTargetIds = new Set<string>();
            wordsToExport.forEach(w => {
                if (w.id) relevantTargetIds.add(w.id);
                if (w.Index) relevantTargetIds.add(w.Index);
            });
            sentencesToExport.forEach(s => {
                if (s.id) relevantTargetIds.add(s.id);
            });

            // 1.1 Process Lists & Dependencies
            const extraAudioIds = new Set<string>();
            const extraGlossSentenceIds = new Set<string>();

            const listsFolder = zip.folder('lists');
            let exportedListCount = 0;

            listsToExport.forEach(({ list, includeDependencies }) => {
                // 1. Export JSON for USER lists (not built-in)
                if (list.type === 'user' && list.items) {
                    const wIds: string[] = [];
                    const sIds: string[] = [];

                    list.items.forEach(id => {
                        if (id.startsWith('s_')) sIds.push(id.replace('s_', ''));
                        else wIds.push(id);
                    });

                    const listJson = {
                        name: list.name,
                        words: wIds,
                        sentences: sIds
                    };

                    listsFolder?.file(`${list.name.replace(/[^a-z0-9\-_]/gi, '_')}.json`, JSON.stringify(listJson, null, 2));
                    exportedListCount++;
                }

                // 2. Collect Dependencies
                if (list.items) {
                    list.items.forEach(id => {
                        let targetId = id;
                        let type: 'word' | 'sentence' = 'word';

                        if (id.startsWith('s_')) {
                            targetId = id.replace('s_', '');
                            type = 'sentence';
                        }

                        if (includeDependencies) {
                            relevantTargetIds.add(targetId);

                            // Audio Check
                            const audioKey = type === 'sentence' ? `${targetId}_sentence` : targetId;
                            const audioList = userAudioMeta[audioKey];
                            if (audioList) {
                                audioList.forEach(a => {
                                    if (!a.isOfficial) extraAudioIds.add(a.id);
                                });
                            }

                            // Gloss Check (only for sentences)
                            if (type === 'sentence') {
                                extraGlossSentenceIds.add(targetId);
                            }
                        }
                    });
                }
            });

            const sentenceIds = new Set(sentencesToExport.map(s => s.id));

            // Include glosses
            const glossesToExport = glosses.filter(g => {
                if (g.source !== 'user') return false;
                if (sentenceIds.has(g.sentence_id)) return true;
                if (extraGlossSentenceIds.has(g.sentence_id)) return true;
                return false;
            });

            
            // 2. Generate JSONs
            const baseFormsExport = wordsToExport.map(w => {
                return {
                    merged_id: w.id || w.Index,
                    sources: {
                        "user generated": [{
                            "Practical": w.translit || w.Entry || '',
                            "Syllabary": w.syllabary || w.Syllabary || '',
                            "Translations": w.definition || w.Definition || '',
                            "Part of speech": w.PoS || '',
                            "Tone and length 1": w.Entry_Tone || ''
                        }]
                    }
                };
            });

            const sentencesExport = sentencesToExport.map(s => {
                return {
                    sentence_id: s.id,
                    syllabary: s.syllabary || '',
                    phonetic: s.translit || '',
                    english: s.english || '',
                    "source file": "user generated",
                    Story: (s as any).story || '',
                    Chapter: (s as any).chapter || '',
                    Line: (s as any).line || '',
                    Author: (s as any).author || '',
                    Speaker: (s as any).speaker || ''
                };
            });

            const joinsExport = glossesToExport.map(g => {
                return {
                    sentence_id: g.sentence_id,
                    base_id: g.entry_id,
                    word_index: g.word_index,
                    notes: g.notes || '',
                    "source file": "user generated",
                    gloss_syllabary: g.gloss_syllabary || '',
                    gloss_phonetic: g.gloss_phonetic || '',
                    gloss_english: g.gloss_english || ''
                };
            });

            // --- EXPORT CUSTOM NOTES & WORD FORMS ---
            const notesExport: any[] = [];
            const formsExport: any[] = [];

            // Notes
            Object.entries(userNotes).forEach(([key, note]) => {
                let id = key;
                let type = 'W';
                if (key.startsWith('s_')) {
                    id = key.substring(2);
                    type = 'S';
                }

                if (exportAllNotesAndForms || relevantTargetIds.has(id) || relevantTargetIds.has(key)) {
                    notesExport.push({
                        text: note,
                        target_id: id,
                        type: type
                    });
                }
            });

            // Word Forms
            Object.entries(userWordForms).forEach(([key, val]) => {
                if (exportAllNotesAndForms || relevantTargetIds.has(key)) {
                    const parts = val.split('|');
                    parts.forEach((raw) => {
                        const [label, content] = raw.split(':');
                        if (label && content) {
                            const values = content.split('^');
                            formsExport.push({
                                merged_id: key,
                                normalized_key: label,
                                "user generated_Practical": values[0] || '',
                                "user generated_Syllabary": values[1] || '',
                                "user generated_Tone and length 1": values[2] || '',
                                "user generated_Notes": values[3] || ''
                            });
                        }
                    });
                }
            });

            zip.file('base_forms.json', JSON.stringify(baseFormsExport, null, 2));
            zip.file('sentences.json', JSON.stringify(sentencesExport, null, 2));
            zip.file('sentence_joins.json', JSON.stringify(joinsExport, null, 2));
            zip.file('conjugations.json', JSON.stringify(formsExport, null, 2));

            if (notesExport.length > 0) {
                zip.file('entry_data.json', JSON.stringify({
                    notes: notesExport
                }, null, 2));
            }

            // 3. Metadata
            const meta: PackageMetadata = {
                id: generateId(),
                name: metadata.name || 'Untitled Package',
                author: metadata.author || 'Unknown',
                date_created: Date.now(),
                description: metadata.description || '',
                app_version: '1.0',
                stats: {
                    words: wordsToExport.length,
                    sentences: sentencesToExport.length,
                    audio_files: 0,
                    glosses: glossesToExport.length,
                    lists: exportedListCount
                },
                source_names: {}
            };

            const hasOrphans = wordsToExport.some(w => !shorthandMap[w.customDictionaryId]) || sentencesToExport.some(s => !shorthandMap[s.source]);
            if (hasOrphans) {
                if (!meta.source_names) meta.source_names = {};
                meta.source_names[packageShorthand] = metadata.name || 'Untitled Package';
            }

        // Populate source_names from actual dictionary names
        customDictionaryIds.forEach(id => {
            if (customDictionaries[id]) {
                const short = shorthandMap[id];
                if (short) {
                    if (!meta.source_names) meta.source_names = {};
                    meta.source_names[short] = customDictionaries[id].name;
                }
            }
        });


            zip.file('metadata.json', JSON.stringify(meta, null, 2));

            // 4. README
            try {
                const res = await fetch('/src/data/DEFAULT_README.txt');
                if (res.ok) {
                    const text = await res.text();
                    zip.file('README.txt', text);
                } else {
                    zip.file('README.txt', "");
                }
            } catch (e) {
                zip.file('README.txt', "");
            }

            // 5. Audio
            const audioFolder = zip.folder('audio');
            let audioCount = 0;

            const exportAudioItems: { id: string, speaker: string, targetId: string, type: 'W' | 'S' }[] = [];

            const addAudioForTarget = (targetId: string, type: 'W' | 'S') => {
                const key = type === 'W' ? targetId : `${targetId}_sentence`;
                const meta = userAudioMeta[key];
                if (meta && Array.isArray(meta)) {
                    meta.forEach(a => {
                        if (!a.isOfficial) {
                            exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId, type });
                        }
                    });
                }
            };

            wordsToExport.forEach(w => addAudioForTarget(w.id, 'W'));
            sentencesToExport.forEach(s => addAudioForTarget(s.id, 'S'));

            if (extraAudioIds.size > 0 || dependencyAudioIds.length > 0) {
                const allDepIds = new Set([...Array.from(extraAudioIds), ...dependencyAudioIds]);
                Object.entries(userAudioMeta).forEach(([key, audioList]) => {
                    if (Array.isArray(audioList)) {
                        audioList.forEach(a => {
                            if (allDepIds.has(a.id) && !a.isOfficial) {
                                let type: 'W' | 'S' = 'W';
                                let targetId = key;
                                if (key.endsWith('_sentence')) {
                                    type = 'S';
                                    targetId = key.replace('_sentence', '');
                                }
                                exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId, type });
                            }
                        });
                    }
                });
            }

            const audioByTarget: Record<string, typeof exportAudioItems> = {};
            const processedAudioIds = new Set<string>();

            exportAudioItems.forEach(item => {
                if (processedAudioIds.has(item.id)) return;
                processedAudioIds.add(item.id);

                const k = `${item.type}-${item.targetId}`;
                if (!audioByTarget[k]) audioByTarget[k] = [];
                audioByTarget[k].push(item);
            });

            for (const key in audioByTarget) {
                const items = audioByTarget[key];
                items.sort((a, b) => (a.id || '').localeCompare(b.id || ''));

                const speakerCounts: Record<string, number> = {};

                for (const item of items) {
                    const speaker = item.speaker || 'User';
                    const idx = speakerCounts[speaker] || 0;
                    speakerCounts[speaker] = idx + 1;

                    const safeSpeaker = speaker.replace(/[^a-zA-Z0-9 ]/g, '').trim(); // Trim to avoid leading/trailing spaces in filename

                    // Extract the full ID section from the original ID to preserve sub-IDs (e.g. 10.2)
                    // Original ID format: Speaker_Type-ID_Timestamp
                    // We want to capture the 'ID' part which might be '10' or '10.2'
                    let idPart = item.targetId;
                    const idMatch = item.id.match(/_[WS]-([0-9a-zA-Z\.\-]+)_\d+/);
                    if (idMatch) {
                        idPart = idMatch[1];
                    }

                    const newFilename = `${safeSpeaker}_${item.type}-${idPart}_${idx}.mp3`;

                    try {
                        const blob = await getAudioFromDB(item.id);
                        if (blob) {
                            audioFolder?.file(newFilename, blob as Blob);
                            audioCount++;
                        }
                    } catch (e) {
                        console.warn(`Failed to export audio ${item.id}`, e);
                    }
                }
            }

            meta.stats.audio_files = audioCount;
            zip.file('metadata.json', JSON.stringify(meta, null, 2));

            const content = await zip.generateAsync({ type: 'blob' });
            downloadFile(content, `${(meta.name || 'export').replace(/[^a-z0-9]/gi, '_')}.zip`, 'application/zip');
        } catch (e) {
            console.error("Export Failed Critical", e);
            throw e;
        }
    };

    return { exportPackage };
};

export const usePackageImport = () => {
    const { installPackage } = usePackageManager();
    const { importAudioMeta } = useCorpus();

    const importPackage = async (file: File, color: string) => {
        const zip = await JSZip.loadAsync(file);

        // 1. Metadata
        const metaFile = zip.file('metadata.json');
        if (!metaFile) throw new Error("Invalid Package: Missing metadata.json");
        const metaText = await metaFile.async('string');
        const meta: PackageMetadata = JSON.parse(metaText);

        // 2. CSVs
        const dictFile = zip.file('dictionary.csv');
        const sentFile = zip.file('sentences.csv');
        const joinFile = zip.file('join_table.csv');

        if (!dictFile || !sentFile || !joinFile) throw new Error("Invalid Package: Missing CSV files");

        const dictText = await dictFile.async('string');
        const sentText = await sentFile.async('string');
        const joinText = await joinFile.async('string');

        const parse = (csv: string) => Papa.parse(csv, { header: true, skipEmptyLines: true }).data;

        const rawDictionary = parse(dictText);
        const rawSentences = parse(sentText);
        const rawGlosses = parse(joinText);

        // --- IMPORT CUSTOM NOTES & WORD FORMS ---
        const entryDataFile = zip.file('entry_data.json');
        let importedNotes: any[] = [];
        let importedForms: any[] = [];

        if (entryDataFile) {
            try {
                const json = JSON.parse(await entryDataFile.async('string'));
                importedNotes = json.notes || [];
                importedForms = json.word_forms || [];
            } catch (e) {
                console.warn("Failed to parse entry_data.json", e);
            }
        }

        // 2.1 Lists
        const listsFolder = zip.folder('lists');
        const lists: ListData[] = [];
        if (listsFolder) {
            const filePromises: Promise<any>[] = [];
            listsFolder.forEach((path, file) => {
                if (!file.dir && path.endsWith('.json')) {
                    filePromises.push(file.async('string').then(text => {
                        try {
                            const json = JSON.parse(text);
                            return json;
                        } catch { return null; }
                    }));
                }
            });

            const loadedLists = await Promise.all(filePromises);
            loadedLists.filter(Boolean).forEach(l => {
                const items = [...(l.words || []), ...(l.sentences || []).map((id: string) => `s_${id}`)];

                lists.push({
                    id: generateId(),
                    name: l.name,
                    items: items,
                    type: 'imported',
                    packageId: meta.id,
                    color: color
                });
            });
        }

        // Normalize Data
        const dictionary = rawDictionary.map((d: any) => ({
            ...d,
            id: d.Index,
            syllabary: d.Syllabary,
            translit: d.Entry,
            definition: d.Definition,
            source: d.Source === 'user' ? meta.id : d.Source,
            audio: d.Audio,
            Index: d.Index,
            Entry: d.Entry,
            Syllabary: d.Syllabary,
            Definition: d.Definition,
            Source: d.Source === 'user' ? meta.id : d.Source,
            Entry_Tone: d.Entry_Tone,
            PoS: d.PoS || d.Part_of_Speech,
            Source_Long: meta.source_names?.[d.Source] || d.Source
        }));

        const sentences = rawSentences.map((d: any) => ({
            id: d.ID,
            syllabary: d.Syllabary,
            translit: d.Transliteration,
            english: d.English,
            source: d.Source === 'user' ? meta.id : d.Source,
            audio: d.Audio,
            // Reader fields
            story: d.Story || undefined,
            chapter: d.Chapter || undefined,
            line: d.Line ? parseInt(d.Line, 10) : undefined,
            author: d.Author || undefined,
            speaker: d.Speaker || undefined,
            tone: d.Tone || undefined,
            // Legacy fields
            ID: d.ID,
            Syllabary: d.Syllabary,
            Transliteration: d.Transliteration,
            English: d.English,
            Source: d.Source === 'user' ? meta.id : d.Source
        }));

        const glosses = rawGlosses.map((d: any) => ({
            sentence_id: d.Sentence_ID || d.sentence_id,
            word_index: d.Word_Index || d.word_index,
            entry_id: d.Entry_ID || d.entry_id,
            notes: d.Notes || d.notes,
            source: d.Source === 'user' ? meta.id : d.Source,
            gloss_syllabary: d.Gloss_Syllabary || d.gloss_syllabary,
            gloss_phonetic: d.Gloss_Phonetic || d.gloss_phonetic,
            gloss_english: d.Gloss_English || d.gloss_english,
            // Legacy
            Sentence_ID: d.Sentence_ID || d.sentence_id,
            Word_Index: d.Word_Index || d.word_index,
            Entry_ID: d.Entry_ID || d.entry_id,
            Notes: d.Notes || d.notes,
            Source: d.Source === 'user' ? meta.id : d.Source
        }));

        // 3. Audio
        const audioFolder = zip.folder('audio');
        const newAudioMeta: Record<string, any[]> = {};

        if (audioFolder) {
            const files: any[] = [];
            audioFolder.forEach((path, file) => files.push({ path, file }));

            for (const { path, file } of files) {
                if (!file.dir) {
                    const blob = await file.async('blob');
                    const filename = path.split('/').pop() || path;
                    const id = filename.replace(/\.mp3$/i, '');

                    await saveAudioToDB(id, blob);

                    const match = id.match(/^([^_]+)_([WS])-(.+)_\d+$/);
                    if (match) {
                        const speaker = match[1];
                        const type = match[2];
                        const fullTargetId = match[3]; // e.g. "10" or "10.2"

                        // For the dictionary key (metaKey), we need the base ID (e.g. "10")
                        // so that EntryDetail can find it under userAudioMeta[e.Index]
                        let baseId = fullTargetId;
                        if (baseId.includes('.')) {
                            baseId = baseId.split('.')[0];
                        }

                        const metaKey = type === 'W' ? baseId : `${baseId}_sentence`;

                        if (!newAudioMeta[metaKey]) newAudioMeta[metaKey] = [];
                        newAudioMeta[metaKey].push({
                            id: id,
                            speaker: speaker,
                            date: Date.now(),
                            packageId: meta.id
                        });
                    }
                }
            }
        }

        if (Object.keys(newAudioMeta).length > 0) {
            importAudioMeta(newAudioMeta);
        }

        if (!meta.stats) {
            meta.stats = {
                words: dictionary.length,
                sentences: sentences.length,
                audio_files: Object.keys(newAudioMeta).length,
                glosses: glosses.length,
                lists: lists.length,
                word_forms: importedForms.length,
                notes: importedNotes.length
            };
        } else {
            meta.stats.words = dictionary.length;
            meta.stats.sentences = sentences.length;
            meta.stats.glosses = glosses.length;
            meta.stats.lists = lists.length;
            meta.stats.word_forms = importedForms.length;
            meta.stats.notes = importedNotes.length;
        }

        const pkg: Package = {
            id: meta.id,
            name: meta.name,
            type: 'imported',
            status: 'active',
            color: color,
            metadata: meta
        };

        const data: ImportedPackageData = {
            dictionary,
            sentences,
            glosses,
            lists,
            notes: importedNotes,
            word_forms: importedForms
        };

        installPackage(pkg, data);
    };

    return { importPackage };
};
