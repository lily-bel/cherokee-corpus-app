import { useCorpus } from './CorpusContext';
import { usePackageManager, Package, PackageMetadata, ImportedPackageData } from './PackageManagerContext';
import { ListData } from './ListsTab';
import JSZip from 'jszip';
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

                const depWords = personalWords.filter(w => depSet.has(w.id) && !customDictionaryIds.includes(w.customDictionaryId));
                wordsToExport = [...wordsToExport, ...depWords];

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

            // 1.4 Process Lists & Dependencies
            const extraAudioIds = new Set<string>();
            const extraGlossSentenceIds = new Set<string>();

            const listsFolder = zip.folder('lists');
            let exportedListCount = 0;

            listsToExport.forEach(({ list, includeDependencies }) => {
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

                            const audioKey = type === 'sentence' ? `${targetId}_sentence` : targetId;
                            const audioList = userAudioMeta[audioKey];
                            if (audioList) {
                                audioList.forEach(a => {
                                    if (!a.isOfficial) extraAudioIds.add(a.id);
                                });
                            }

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

            // 2. Generate JSON Data Matching public/data Format
            // 2.1 base_forms.json
            const baseFormsExport = wordsToExport.map(w => {
                const dictId = w.customDictionaryId || 'default';
                const shorthand = shorthandMap[dictId] || packageShorthand;
                const sourceKey = `${shorthand.toLowerCase()}.csv`;

                return {
                    merged_id: w.id || w.Index,
                    sources: {
                        [sourceKey]: {
                            "Practical": w.translit || w.Entry || '',
                            "Syllabary": w.syllabary || w.Syllabary || '',
                            "Translations": w.definition || w.Definition || '',
                            "Part of speech": w.PoS || '',
                            "Tone and length 1": w.Entry_Tone || '',
                            "source file": sourceKey,
                            "base_id": w.id || w.Index
                        }
                    }
                };
            });

            // 2.2 sentences.json
            const sentencesExport = sentencesToExport.map(s => {
                const dictId = s.source || 'default';
                const shorthand = shorthandMap[dictId] || packageShorthand;
                const sourceKey = `${shorthand.toLowerCase()}.csv`;

                return {
                    sentence_id: s.id,
                    syllabary: s.syllabary || '',
                    phonetic: s.translit || '',
                    english: s.english || '',
                    audio: s.audio || '',
                    source: shorthand.toLowerCase(),
                    "source file": sourceKey,
                    speaker: (s as any).speaker || '',
                    notes: (s as any).notes || '',
                    story: (s as any).story || '',
                    chapter: (s as any).chapter || '',
                    line: (s as any).line !== undefined ? (s as any).line : '',
                    story_order: (s as any).story_order !== undefined ? (s as any).story_order : '',
                    chapter_order: (s as any).chapter_order !== undefined ? (s as any).chapter_order : '',
                    author: (s as any).author || '',
                    tone: (s as any).tone || ''
                };
            });

            // 2.3 sentence_joins.json
            const joinsExport = glossesToExport.map(g => {
                return {
                    sentence_id: g.sentence_id,
                    base_id: g.entry_id,
                    word_index: g.word_index || '',
                    source: g.source || packageShorthand.toLowerCase(),
                    "source file": "sentence_joins.csv",
                    gloss_syllabary: g.gloss_syllabary || '',
                    gloss_phonetic: g.gloss_phonetic || '',
                    gloss_english: g.gloss_english || '',
                    notes: g.notes || '',
                    form_name: g.form_name || '',
                    form_syllabary: g.form_syllabary || '',
                    form_translit: g.form_translit || ''
                };
            });

            // 2.4 conjugations.json
            const formsExport: any[] = [];
            Object.entries(userWordForms).forEach(([key, val]) => {
                if (exportAllNotesAndForms || relevantTargetIds.has(key)) {
                    const parts = val.split('|');
                    parts.forEach((raw) => {
                        const [label, content] = raw.split(':');
                        if (label && content) {
                            const values = content.split('^');
                            const targetWord = wordsToExport.find(w => w.id === key || w.Index === key);
                            const dictId = targetWord?.customDictionaryId || 'default';
                            const shorthand = shorthandMap[dictId] || packageShorthand;
                            const srcPrefix = `${shorthand.toLowerCase()}.csv`;

                            formsExport.push({
                                merged_id: key,
                                normalized_key: label,
                                [`${srcPrefix}_Practical`]: values[0] || '',
                                [`${srcPrefix}_Syllabary`]: values[1] || '',
                                [`${srcPrefix}_Tone and length 1`]: values[2] || '',
                                [`${srcPrefix}_Translations`]: values[3] || ''
                            });
                        }
                    });
                }
            });

            // 2.5 entry_data.json (Notes)
            const notesExport: any[] = [];
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

            // Add JSON files to zip
            if (baseFormsExport.length > 0) {
                zip.file('base_forms.json', JSON.stringify(baseFormsExport, null, 2));
            }
            if (sentencesExport.length > 0) {
                zip.file('sentences.json', JSON.stringify(sentencesExport, null, 2));
            }
            if (joinsExport.length > 0) {
                zip.file('sentence_joins.json', JSON.stringify(joinsExport, null, 2));
            }
            if (formsExport.length > 0) {
                zip.file('conjugations.json', JSON.stringify(formsExport, null, 2));
            }
            if (notesExport.length > 0) {
                zip.file('entry_data.json', JSON.stringify({ notes: notesExport }, null, 2));
            }

            // 3. Audio & audio_mapping.json
            const audioFolder = zip.folder('audio');
            let audioCount = 0;
            const audioMapping: any[] = [];
            const exportAudioItems: { id: string, speaker: string, targetId: string, type: 'W' | 'S', formIndex?: number }[] = [];

            const addAudioForTarget = (targetId: string | undefined, type: 'W' | 'S') => {
                if (!targetId) return;
                const key = type === 'W' ? targetId : `${targetId}_sentence`;
                const metaList = userAudioMeta[key];
                if (metaList && Array.isArray(metaList)) {
                    metaList.forEach(a => {
                        if (!a.isOfficial) {
                            let formIndex: number | undefined = undefined;
                            const fMatch = a.id.match(/(?:_F|\.)(\d+)_/);
                            if (fMatch) formIndex = parseInt(fMatch[1]);
                            exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId, type, formIndex });
                        }
                    });
                }
            };

            wordsToExport.forEach(w => addAudioForTarget(w.id || w.Index, 'W'));
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
                                let formIndex: number | undefined = undefined;
                                const fMatch = a.id.match(/(?:_F|\.)(\d+)_/);
                                if (fMatch) formIndex = parseInt(fMatch[1]);
                                exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId, type, formIndex });
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

                    const safeSpeaker = speaker.replace(/[^a-zA-Z0-9]/g, '').trim() || 'User';

                    let idPart = item.targetId;
                    const idMatch = item.id.match(/(?:_[WS]|-)([0-9a-zA-Z\.\-]+)_\d+/);
                    if (idMatch) {
                        idPart = idMatch[1];
                    }

                    let wordSlug = 'audio';
                    if (item.type === 'W') {
                        const wordObj = wordsToExport.find(w => (w.id === item.targetId || w.Index === item.targetId));
                        if (wordObj) {
                            wordSlug = (wordObj.translit || wordObj.Entry || wordObj.syllabary || wordObj.Syllabary || 'word')
                                .toLowerCase().replace(/[^a-z0-9]/g, '') || 'word';
                        }
                    } else {
                        const sentObj = sentencesToExport.find(s => s.id === item.targetId);
                        if (sentObj) {
                            wordSlug = (sentObj.translit || sentObj.english || 'sentence')
                                .toLowerCase().replace(/[^a-z0-9]/g, '') || 'sentence';
                        }
                    }

                    const formSegment = item.formIndex !== undefined ? `_F${item.formIndex}` : '';
                    const newFilename = `cherokee_audio_${item.type}_${idPart}${formSegment}_${wordSlug}_${safeSpeaker}_${idx}.mp3`;

                    try {
                        const blob = await getAudioFromDB(item.id);
                        if (blob) {
                            audioFolder?.file(newFilename, blob as Blob);
                            audioCount++;

                            audioMapping.push({
                                audio_file: newFilename,
                                target_id: item.targetId,
                                merged_id: item.targetId,
                                sentence_id: item.type === 'S' ? item.targetId : undefined,
                                type: item.type === 'W' ? (item.formIndex !== undefined ? 'conjugation' : 'base_form') : 'sentence',
                                normalized_key: item.formIndex !== undefined ? `Form_${item.formIndex}` : undefined,
                                speaker: speaker,
                                word_slug: wordSlug
                            });
                        }
                    } catch (e) {
                        console.warn(`Failed to export audio ${item.id}`, e);
                    }
                }
            }

            if (audioMapping.length > 0) {
                zip.file('audio_mapping.json', JSON.stringify(audioMapping, null, 2));
            }

            // 4. Metadata
            const sourceNamesMap: Record<string, string> = {};
            const sourceMetaMap: Record<string, "prioritize" | "filter" | "other"> = {};

            customDictionaryIds.forEach(id => {
                if (customDictionaries[id]) {
                    const short = shorthandMap[id];
                    if (short) {
                        const code = short.toLowerCase();
                        sourceNamesMap[code] = customDictionaries[id].name;
                        sourceMetaMap[code] = 'other';
                    }
                }
            });

            const hasOrphans = wordsToExport.some(w => !shorthandMap[w.customDictionaryId]) || sentencesToExport.some(s => !shorthandMap[s.source]);
            if (hasOrphans && !sourceNamesMap[packageShorthand.toLowerCase()]) {
                sourceNamesMap[packageShorthand.toLowerCase()] = metadata.name || 'Untitled Package';
                sourceMetaMap[packageShorthand.toLowerCase()] = 'other';
            }

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
                    audio_files: audioCount,
                    glosses: glossesToExport.length,
                    lists: exportedListCount,
                    word_forms: formsExport.length,
                    notes: notesExport.length
                },
                source_names: sourceNamesMap,
                source_meta: sourceMetaMap as any,
                color: metadata.color || '#f59e0b',
                locked: 'no',
                editable: 'No'
            };

            zip.file('metadata.json', JSON.stringify(meta, null, 2));

            try {
                const res = await fetch(`${import.meta.env.BASE_URL}data/DEFAULT_README.txt`);
                if (res.ok) {
                    const text = await res.text();
                    zip.file('README.txt', text);
                } else {
                    zip.file('README.txt', `${meta.name}\n${meta.description}\nAuthor: ${meta.author}`);
                }
            } catch {
                zip.file('README.txt', `${meta.name}\n${meta.description}\nAuthor: ${meta.author}`);
            }

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
        // Step 1: Validate ZIP file
        let zip: JSZip;
        try {
            zip = await JSZip.loadAsync(file);
        } catch (e: any) {
            throw new Error(`Corrupted or invalid ZIP archive (${e?.message || 'cannot read zip file'})`);
        }

        // Step 2: Validate metadata.json
        const metaFile = zip.file('metadata.json');
        if (!metaFile) {
            throw new Error("Missing required file: metadata.json");
        }

        let meta: PackageMetadata;
        try {
            const metaText = await metaFile.async('string');
            meta = JSON.parse(metaText);
        } catch (e: any) {
            throw new Error(`Corrupted metadata.json: Invalid JSON syntax (${e?.message || 'parse error'})`);
        }

        if (!meta || typeof meta !== 'object') {
            throw new Error("Invalid metadata.json: Root content must be a JSON object");
        }
        if (!meta.id || !meta.name) {
            throw new Error("metadata.json is missing required 'id' or 'name' fields");
        }

        // Step 3: Parse and Validate optional data JSON files
        // 3.1 base_forms.json
        const baseFormsFile = zip.file('base_forms.json');
        let rawBaseForms: any[] = [];
        if (baseFormsFile) {
            try {
                const text = await baseFormsFile.async('string');
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    throw new Error("Root content must be a JSON array");
                }
                rawBaseForms = parsed;
            } catch (e: any) {
                throw new Error(`Corrupted base_forms.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.2 sentences.json
        const sentFile = zip.file('sentences.json');
        let rawSentences: any[] = [];
        if (sentFile) {
            try {
                const text = await sentFile.async('string');
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    throw new Error("Root content must be a JSON array");
                }
                rawSentences = parsed;
            } catch (e: any) {
                throw new Error(`Corrupted sentences.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.3 sentence_joins.json
        const joinFile = zip.file('sentence_joins.json');
        let rawGlosses: any[] = [];
        if (joinFile) {
            try {
                const text = await joinFile.async('string');
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    throw new Error("Root content must be a JSON array");
                }
                rawGlosses = parsed;
            } catch (e: any) {
                throw new Error(`Corrupted sentence_joins.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.4 conjugations.json
        const conjFile = zip.file('conjugations.json');
        let rawConjugations: any[] = [];
        if (conjFile) {
            try {
                const text = await conjFile.async('string');
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    throw new Error("Root content must be a JSON array");
                }
                rawConjugations = parsed;
            } catch (e: any) {
                throw new Error(`Corrupted conjugations.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.5 entry_data.json / notes.json
        const entryDataFile = zip.file('entry_data.json') || zip.file('notes.json');
        let importedNotes: any[] = [];
        let importedWordFormsFromEntryData: any[] = [];
        if (entryDataFile) {
            try {
                const text = await entryDataFile.async('string');
                const parsed = JSON.parse(text);
                if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.notes)) importedNotes = parsed.notes;
                    if (Array.isArray(parsed.word_forms)) importedWordFormsFromEntryData = parsed.word_forms;
                }
            } catch (e: any) {
                throw new Error(`Corrupted entry_data.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.6 audio_mapping.json
        const audioMappingFile = zip.file('audio_mapping.json');
        let audioMappingList: any[] = [];
        if (audioMappingFile) {
            try {
                const text = await audioMappingFile.async('string');
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) {
                    throw new Error("Root content must be a JSON array");
                }
                audioMappingList = parsed;
            } catch (e: any) {
                throw new Error(`Corrupted audio_mapping.json: Invalid JSON format (${e?.message || 'parse error'})`);
            }
        }

        // 3.7 lists/ directory
        const listsFolder = zip.folder('lists');
        const lists: ListData[] = [];
        if (listsFolder) {
            const listFiles: { path: string, file: JSZip.JSZipObject }[] = [];
            listsFolder.forEach((path, file) => {
                if (!file.dir && path.endsWith('.json')) {
                    listFiles.push({ path, file });
                }
            });

            for (const { path, file } of listFiles) {
                try {
                    const text = await file.async('string');
                    const l = JSON.parse(text);
                    const items = [...(l.words || []), ...(l.sentences || []).map((id: string) => `s_${id}`)];

                    lists.push({
                        id: generateId(),
                        name: l.name || path.replace('.json', ''),
                        items: items,
                        type: 'imported',
                        packageId: meta.id,
                        color: color
                    });
                } catch (e: any) {
                    throw new Error(`Corrupted list file in lists/${path}: Invalid JSON syntax (${e?.message || 'parse error'})`);
                }
            }
        }

        // Step 4: Process Audio
        const audioByBaseForm: Record<string, string> = {};
        const audioBySentence: Record<string, string> = {};
        const audioByConjugation: Record<string, string> = {};
        const audioMapByFile: Record<string, any> = {};

        audioMappingList.forEach((m: any) => {
            if (m.audio_file) {
                audioMapByFile[m.audio_file] = m;
                const basename = m.audio_file.split('/').pop() || m.audio_file;
                audioMapByFile[basename] = m;
            }
            if (m.type === 'base_form' && m.merged_id) {
                audioByBaseForm[m.merged_id] = m.audio_file;
            } else if (m.type === 'sentence' && (m.sentence_id || m.merged_id)) {
                audioBySentence[m.sentence_id || m.merged_id] = m.audio_file;
            } else if (m.type === 'conjugation' && m.merged_id && m.normalized_key) {
                audioByConjugation[`${m.merged_id}_${m.normalized_key}`] = m.audio_file;
            }
        });

        const audioFolder = zip.folder('audio');
        const newAudioMeta: Record<string, any[]> = {};

        if (audioFolder) {
            const files: { path: string, file: JSZip.JSZipObject }[] = [];
            audioFolder.forEach((path, file) => {
                if (!file.dir) files.push({ path, file });
            });

            for (const { path, file } of files) {
                const blob = await file.async('blob');
                const filename = path.split('/').pop() || path;
                const id = filename.replace(/\.(mp3|webm|m4a|wav|ogg)$/i, '');

                await saveAudioToDB(id, blob);

                const mapItem = audioMapByFile[filename] || audioMapByFile[path];
                if (mapItem) {
                    const targetId = String(mapItem.target_id || mapItem.merged_id || mapItem.sentence_id);
                    const isSentence = mapItem.type === 'sentence' || mapItem.type === 'S';
                    const type = isSentence ? 'S' : 'W';
                    const metaKey = type === 'W' ? targetId : `${targetId}_sentence`;

                    if (!newAudioMeta[metaKey]) newAudioMeta[metaKey] = [];
                    newAudioMeta[metaKey].push({
                        id: id,
                        speaker: mapItem.speaker || 'User',
                        date: Date.now(),
                        packageId: meta.id
                    });
                } else {
                    const match = id.match(/^(?:cherokee_audio_|.*?)([^\_]+)_([WS])-(.+)_\d+$/i) || id.match(/^([^_]+)_([WS])-(.+)_\d+$/);
                    if (match) {
                        const speaker = match[1];
                        const type = match[2];
                        let baseId = match[3];
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
                    } else {
                        const cMatch = id.match(/^cherokee_audio_([WS])_([^_]+)(?:_F(\d+))?_(?:.+)$/i);
                        if (cMatch) {
                            const type = cMatch[1];
                            const baseId = cMatch[2];
                            const metaKey = type === 'W' ? baseId : `${baseId}_sentence`;

                            if (!newAudioMeta[metaKey]) newAudioMeta[metaKey] = [];
                            newAudioMeta[metaKey].push({
                                id: id,
                                speaker: 'User',
                                date: Date.now(),
                                packageId: meta.id
                            });
                        }
                    }
                }
            }
        }

        if (Object.keys(newAudioMeta).length > 0) {
            importAudioMeta(newAudioMeta);
        }

        // Step 5: Normalize Data to Application Architecture
        // 5.1 Dictionary normalization
        const normalizedDictionary = rawBaseForms.map((d: any) => {
            let translit = '';
            let syllabary = '';
            let definition = '';
            let PoS = '';
            let Entry_Tone = '';

            const sources = d.sources || {};
            const sourceKeys = Object.keys(sources);
            let sourceStr = sourceKeys.length > 0 ? sourceKeys[0].replace(/\.csv$/i, '') : meta.id;

            for (const key of sourceKeys) {
                const s = sources[key];
                if (!s) continue;
                if (!translit) translit = s.Practical || s.Entry || s.practical || s.Cherokee || s.translit || '';
                if (!syllabary) syllabary = s.Syllabary || s.syllabary || s.Headword || '';
                if (!definition) definition = s.Translations || s.Definition || s.definition || s.English || '';
                if (!PoS) PoS = s['Part of speech'] || s['Part of speech ch'] || s.PoS || s.Part_of_Speech || '';
                if (!Entry_Tone) Entry_Tone = s['Tone and length 1'] || s['Tone and length 2'] || s.Entry_Tone || s.Tone || '';
            }

            // Direct field fallbacks
            if (!translit) translit = d.translit || d.Entry || d.practical || d.Cherokee || '';
            if (!syllabary) syllabary = d.syllabary || d.Syllabary || '';
            if (!definition) definition = d.definition || d.Definition || d.Translations || d.english || '';
            if (!PoS) PoS = d.PoS || d.pos || d['Part of speech'] || 'Noun';
            if (!Entry_Tone) Entry_Tone = d.Entry_Tone || d.tone || d['Tone and length 1'] || '';

            const id = d.merged_id || d.id || d.Index || generateId();
            const Source_Long = sourceKeys.map(k => meta.source_names?.[k.replace(/\.csv$/i, '')] || meta.source_names?.[k] || k).join(', ') || meta.name;

            return {
                ...d,
                id: id,
                merged_id: id,
                syllabary,
                translit,
                definition,
                source: sourceStr,
                audio: audioByBaseForm[id] || d.audio || '',
                Index: id,
                Entry: translit,
                Syllabary: syllabary,
                Definition: definition,
                Source: sourceStr,
                Entry_Tone,
                PoS: PoS || 'Noun',
                Source_Long: Source_Long || sourceStr,
                sources: d.sources || {}
            };
        });

        // 5.2 Sentences normalization
        const normalizedSentences = rawSentences.map((d: any) => {
            const id = d.sentence_id || d.id || d.ID || generateId();
            let source = d.source || d.Source || meta.id;
            if (source.endsWith('.csv')) source = source.replace(/\.csv$/i, '');

            return {
                id: id,
                sentence_id: id,
                syllabary: d.syllabary || d.Syllabary || '',
                translit: d.phonetic || d.translit || d.Transliteration || '',
                english: d.english || d.English || '',
                source: source,
                audio: audioBySentence[id] || d.audio || d.Audio || '',
                speaker: d.speaker || d.Speaker || undefined,
                notes: d.notes || d.Notes || undefined,
                story: d.story || d.Story || undefined,
                chapter: d.chapter || d.Chapter || undefined,
                line: d.line !== undefined && d.line !== '' ? parseInt(String(d.line), 10) : (d.Line ? parseInt(String(d.Line), 10) : undefined),
                story_order: d.story_order !== undefined && d.story_order !== '' ? parseInt(String(d.story_order), 10) : undefined,
                chapter_order: d.chapter_order !== undefined && d.chapter_order !== '' ? parseInt(String(d.chapter_order), 10) : undefined,
                author: d.author || d.Author || undefined,
                tone: d.tone || d.Tone || undefined,
                ID: id,
                Syllabary: d.syllabary || d.Syllabary || '',
                Transliteration: d.phonetic || d.translit || d.Transliteration || '',
                English: d.english || d.English || '',
                Source: source
            };
        });

        // 5.3 Glosses normalization
        const normalizedGlosses = rawGlosses.map((d: any) => {
            let source = d.source || d.Source || meta.id;
            if (source.endsWith('.csv')) source = source.replace(/\.csv$/i, '');

            return {
                sentence_id: d.sentence_id || d.Sentence_ID,
                base_id: d.base_id || d.entry_id || d.Entry_ID,
                entry_id: d.base_id || d.entry_id || d.Entry_ID,
                word_index: d.word_index !== undefined ? String(d.word_index) : (d.Word_Index !== undefined ? String(d.Word_Index) : undefined),
                notes: d.notes || d.Notes || '',
                source: source,
                gloss_syllabary: d.gloss_syllabary || d.Gloss_Syllabary || '',
                gloss_phonetic: d.gloss_phonetic || d.Gloss_Phonetic || '',
                gloss_english: d.gloss_english || d.Gloss_English || '',
                form_name: d.form_name || d.Form_Name || '',
                form_syllabary: d.form_syllabary || d.Form_Syllabary || '',
                form_translit: d.form_translit || d.Form_Translit || '',
                Sentence_ID: d.sentence_id || d.Sentence_ID,
                Word_Index: d.word_index || d.Word_Index,
                Entry_ID: d.base_id || d.entry_id || d.Entry_ID,
                Notes: d.notes || d.Notes || '',
                Source: source
            };
        });

        // 5.4 Word forms normalization
        const normalizedWordForms = [
            ...rawConjugations.map((c: any) => {
                let source = '';
                let syllabary = '';
                let translit = '';
                let tone = '';
                let notes = '';

                Object.keys(c).forEach(k => {
                    if (k.endsWith('_Syllabary') && c[k] && !syllabary) {
                        syllabary = c[k];
                        source = k.replace('_Syllabary', '').replace(/\.csv$/i, '');
                    }
                    if ((k.endsWith('_Practical') || k.endsWith('_Cherokee')) && c[k] && !translit) {
                        translit = c[k];
                    }
                    if ((k.endsWith('_Tone and length 1') || k.endsWith('_Tone')) && c[k] && !tone) {
                        tone = c[k];
                    }
                    if ((k.endsWith('_Translations') || k.endsWith('_English') || k.endsWith('_Notes')) && c[k] && !notes) {
                        notes = c[k];
                    }
                });

                if (!syllabary && c.syllabary) syllabary = c.syllabary;
                if (!translit && (c.translit || c.phonetic)) translit = c.translit || c.phonetic;
                if (!tone && c.tone) tone = c.tone;
                if (!notes && (c.notes || c.definition)) notes = c.notes || c.definition;
                if (!source && c.source) source = c.source;

                const wordIdx = c.merged_id || c.word_index;
                const formKey = c.normalized_key || c.form_name;

                return {
                    word_index: wordIdx,
                    merged_id: wordIdx,
                    form_name: formKey,
                    normalized_key: formKey,
                    syllabary,
                    translit,
                    tone,
                    notes,
                    source: source || meta.id,
                    audio: audioByConjugation[`${wordIdx}_${formKey}`] || c.audio || ''
                };
            }),
            ...importedWordFormsFromEntryData
        ];

        // Step 6: Update stats
        meta.stats = {
            words: normalizedDictionary.length,
            sentences: normalizedSentences.length,
            audio_files: Object.keys(newAudioMeta).length,
            glosses: normalizedGlosses.length,
            lists: lists.length,
            word_forms: normalizedWordForms.length,
            notes: importedNotes.length
        };

        const pkg: Package = {
            id: meta.id,
            name: meta.name,
            type: 'imported',
            status: 'active',
            color: color,
            metadata: meta
        };

        const data: ImportedPackageData = {
            dictionary: normalizedDictionary,
            sentences: normalizedSentences,
            glosses: normalizedGlosses,
            lists,
            notes: importedNotes,
            word_forms: normalizedWordForms
        };

        installPackage(pkg, data);
    };

    return { importPackage };
};
