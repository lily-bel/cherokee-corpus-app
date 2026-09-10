import { useCorpus } from './CorpusContext';
import { usePackageManager, PackageMetadata } from './PackageManagerContext';
import { ListData } from './ListsTab';
import JSZip from 'jszip';
import { downloadFile, getAudioFromDB } from '../utils';
import { parsePackageZip, parsePackageJsonData } from './packageParser';
import { auth, DictionaryDB } from '../firebase';

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
        exportAllNotesAndForms: boolean = false,
        shareViaLink: boolean = false,
        updateOf: string | null = null
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
            const exportedListsPayload: any[] = [];

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
                    exportedListsPayload.push({
                        id: list.id,
                        name: list.name,
                        words: wIds,
                        sentences: sIds
                    });
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
                    root_slug: (w as any).root_slug || (w as any).slug || undefined,
                    slug: (w as any).slug || (w as any).root_slug || undefined,
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

            let publicUrl = '';
            if (shareViaLink) {
                if (!auth.currentUser) {
                    throw new Error("You must be logged in to share a package via public link.");
                }

                const origin = window.location.origin;
                const base = import.meta.env.BASE_URL || '/';
                const cleanBase = base.endsWith('/') ? base : `${base}/`;
                publicUrl = `${origin}${cleanBase}${meta.id}`;

                const cloudPackagePayload = {
                    public: true,
                    updateOf: updateOf || null,
                    metadata: meta,
                    base_forms: baseFormsExport,
                    sentences: sentencesExport,
                    sentence_joins: joinsExport,
                    conjugations: formsExport,
                    entry_data: notesExport.length > 0 ? { notes: notesExport } : null,
                    lists: exportedListsPayload,
                    date_exported: Date.now()
                };

                await DictionaryDB.saveUserPackage(auth.currentUser.uid, meta.id, cloudPackagePayload);
                await DictionaryDB.setPublicPackagePointer(meta.id, auth.currentUser.uid);
                await DictionaryDB.setInstalledPackage(auth.currentUser.uid, meta.id, true);
            }

            return {
                packageId: meta.id,
                name: meta.name,
                publicUrl,
                shared: !!shareViaLink
            };
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
        const { pkg, data, audioMeta } = await parsePackageZip(file, color);
        if (audioMeta && Object.keys(audioMeta).length > 0) {
            importAudioMeta(audioMeta);
        }
        installPackage(pkg, data);
        if (auth.currentUser) {
            await DictionaryDB.setInstalledPackage(auth.currentUser.uid, pkg.id, true);
        }
        return pkg;
    };

    const importPackageFromJson = async (packageData: any, color?: string) => {
        const { pkg, data, audioMeta } = parsePackageJsonData(packageData, color);
        if (audioMeta && Object.keys(audioMeta).length > 0) {
            importAudioMeta(audioMeta);
        }
        installPackage(pkg, data);
        if (auth.currentUser) {
            await DictionaryDB.setInstalledPackage(auth.currentUser.uid, pkg.id, true);
        }
        return pkg;
    };

    const importPackageFromLinkOrId = async (linkOrId: string, color?: string) => {
        let pkgId = linkOrId.trim();
        // If it's a full URL, extract the ID from the end of path or query
        if (pkgId.includes('/')) {
            const clean = pkgId.split('?')[0].split('#')[0].replace(/\/+$/, '');
            pkgId = clean.split('/').pop() || pkgId;
        }
        if (linkOrId.includes('package=')) {
            const m = linkOrId.match(/[?&]package=([^&]+)/);
            if (m) pkgId = m[1];
        }

        const result = await DictionaryDB.getPublicPackageWithData(pkgId);
        if (!result) {
            throw new Error(`Package "${pkgId}" was not found or has not been made public.`);
        }

        return await importPackageFromJson(result.packageData, color);
    };

    return { importPackage, importPackageFromJson, importPackageFromLinkOrId };
};
