import JSZip from 'jszip';
import { Package, PackageMetadata, ImportedPackageData } from './PackageManagerContext';
import { ListData } from './ListsTab';
import { saveAudioToDB } from '../utils';

const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};

export async function parsePackageZip(
    zipInput: Blob | File | ArrayBuffer,
    color: string
): Promise<{ pkg: Package; data: ImportedPackageData; audioMeta: Record<string, any[]> }> {
    // Step 1: Validate ZIP file
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(zipInput);
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
        const listFiles: { path: string; file: JSZip.JSZipObject }[] = [];
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
        const files: { path: string; file: JSZip.JSZipObject }[] = [];
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
        let source = d.source || d.Source || (meta as any).short_name || meta.id;
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
        let source = d.source || d.Source || (meta as any).short_name || meta.id;
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
            breakdown_cherokee: d.breakdown_cherokee || d.Breakdown_Cherokee || '',
            breakdown_english: d.breakdown_english || d.Breakdown_English || '',
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
                source: source || (meta as any).short_name || meta.id,
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
        notes: importedNotes.length,
        notebooks: meta.stats?.notebooks !== undefined ? meta.stats.notebooks : (normalizedDictionary.length === 0 ? 0 : undefined)
    };

    const pkg: Package = {
        id: meta.id,
        name: meta.name,
        type: 'imported',
        status: 'active',
        color: color || meta.color || '#ef4444',
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

    return { pkg, data, audioMeta: newAudioMeta };
}

export function parsePackageJsonData(
    packageData: any,
    color?: string
): { pkg: Package; data: ImportedPackageData; audioMeta: Record<string, any[]> } {
    if (!packageData || typeof packageData !== 'object') {
        throw new Error("Invalid package data: Root content must be an object");
    }

    const meta: PackageMetadata = packageData.metadata || {
        id: packageData.id || generateId(),
        name: packageData.name || 'Untitled Package',
        author: 'Unknown',
        date_created: Date.now(),
        description: '',
        app_version: '1.0',
        stats: { words: 0, sentences: 0, audio_files: 0, glosses: 0, lists: 0 }
    };

    const rawBaseForms: any[] = Array.isArray(packageData.base_forms) ? packageData.base_forms : [];
    const rawSentences: any[] = Array.isArray(packageData.sentences) ? packageData.sentences : [];
    const rawGlosses: any[] = Array.isArray(packageData.sentence_joins) ? packageData.sentence_joins : [];
    const rawConjugations: any[] = Array.isArray(packageData.conjugations) ? packageData.conjugations : [];
    
    let importedNotes: any[] = [];
    let importedWordFormsFromEntryData: any[] = [];
    if (packageData.entry_data && typeof packageData.entry_data === 'object') {
        if (Array.isArray(packageData.entry_data.notes)) importedNotes = packageData.entry_data.notes;
        if (Array.isArray(packageData.entry_data.word_forms)) importedWordFormsFromEntryData = packageData.entry_data.word_forms;
    }

    const lists: ListData[] = [];
    if (Array.isArray(packageData.lists)) {
        packageData.lists.forEach((l: any) => {
            const items = [...(l.words || []), ...(l.sentences || []).map((id: string) => `s_${id}`)];
            lists.push({
                id: l.id || generateId(),
                name: l.name || 'Untitled List',
                items: items,
                type: 'imported',
                packageId: meta.id,
                color: color || meta.color || '#ef4444'
            });
        });
    }

    const audioByBaseForm: Record<string, string> = {};
    const audioBySentence: Record<string, string> = {};
    const audioByConjugation: Record<string, string> = {};
    const newAudioMeta: Record<string, any[]> = {};

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
        let source = d.source || d.Source || (meta as any).short_name || meta.id;
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
        let source = d.source || d.Source || (meta as any).short_name || meta.id;
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
            breakdown_cherokee: d.breakdown_cherokee || d.Breakdown_Cherokee || '',
            breakdown_english: d.breakdown_english || d.Breakdown_English || '',
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
                source: source || (meta as any).short_name || meta.id,
                audio: audioByConjugation[`${wordIdx}_${formKey}`] || c.audio || ''
            };
        }),
        ...importedWordFormsFromEntryData
    ];

    meta.stats = {
        words: normalizedDictionary.length,
        sentences: normalizedSentences.length,
        audio_files: 0,
        glosses: normalizedGlosses.length,
        lists: lists.length,
        word_forms: normalizedWordForms.length,
        notes: importedNotes.length,
        notebooks: meta.stats?.notebooks !== undefined ? meta.stats.notebooks : (normalizedDictionary.length === 0 ? 0 : undefined)
    };

    const pkg: Package = {
        id: meta.id,
        name: meta.name,
        type: 'imported',
        status: 'active',
        color: color || meta.color || '#ef4444',
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

    return { pkg, data, audioMeta: newAudioMeta };
}

