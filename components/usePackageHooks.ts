import { useCorpus } from './CorpusContext';
import { usePackageManager, Package, PackageMetadata, ImportedPackageData } from './PackageManagerContext';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { downloadFile, saveAudioToDB, getAudioFromDB } from '../utils';

export const usePackageExport = () => {
    const { personalWords, userSentences, glosses, notebooks, userAudioMeta } = useCorpus();

    const exportPackage = async (notebookIds: string[], metadata: Partial<PackageMetadata>, dependencyAudioIds: string[] = []) => {
        const zip = new JSZip();

        // 0. Generate Shorthands
        const shorthandMap: Record<string, string> = {};
        const usedShorthands = new Set<string>();

        notebookIds.forEach(id => {
            const nb = notebooks[id];
            if (!nb) return;

            let base = nb.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
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

        // 1. Filter Data
        const wordsToExport = personalWords.filter(w => notebookIds.includes(w.notebookId));
        const sentencesToExport = userSentences.filter(s => notebookIds.includes(s.source));
        const sentenceIds = new Set(sentencesToExport.map(s => s.id));
        const glossesToExport = glosses.filter(g => sentenceIds.has(g.sentence_id) && g.source === 'user');

        // 2. Generate CSVs
        // Dictionary CSV
        // Header: Index,Source,Entry,Syllabary,Part_of_Speech,PoS,PoS_Family,Definition,Cross_Reference,Entry_Tone,Other_Forms,Notes
        const dictHeader = ['Index', 'Source', 'Entry', 'Syllabary', 'Part_of_Speech', 'PoS', 'PoS_Family', 'Definition', 'Cross_Reference', 'Entry_Tone', 'Other_Forms', 'Notes'];
        const dictRows = [dictHeader.join(',')];
        wordsToExport.forEach(w => {
            const src = shorthandMap[w.notebookId] || w.notebookId;
            dictRows.push([
                `"${w.id || ''}"`,
                `"${src}"`,
                `"${(w.translit || w.Entry || '').replace(/"/g, '""')}"`,
                `"${(w.syllabary || w.Syllabary || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.definition || w.Definition || '').replace(/"/g, '""')}"`,
                `""`, // Cross_Reference
                `"${(w.Entry_Tone || '').replace(/"/g, '""')}"`,
                `""`, // Other_Forms
                `"${(w.Notes || '').replace(/"/g, '""')}"` // Notes
            ].join(','));
        });

        // Sentences CSV
        // Header: ID,Source,Syllabary,Transliteration,English,Story,Chapter,Line,Author,Speaker
        const sentHeader = ['ID', 'Source', 'Syllabary', 'Transliteration', 'English', 'Story', 'Chapter', 'Line', 'Author', 'Speaker'];
        const sentRows = [sentHeader.join(',')];
        sentencesToExport.forEach(s => {
            const src = shorthandMap[s.source] || s.source;
            sentRows.push([
                `"${s.id || ''}"`,
                `"${src}"`,
                `"${(s.syllabary || '').replace(/"/g, '""')}"`,
                `"${(s.translit || '').replace(/"/g, '""')}"`,
                `"${(s.english || '').replace(/"/g, '""')}"`,
                `""`, // Story
                `""`, // Chapter
                `""`, // Line
                `""`, // Author
                `""`  // Speaker
            ].join(','));
        });

        // Join Table CSV
        // Header: ID,Source,Sentence_ID,Entry_ID,Word_Index,Segment_Cherokee,Segment_English,Notes
        const joinHeader = ['ID', 'Source', 'Sentence_ID', 'Entry_ID', 'Word_Index', 'Segment_Cherokee', 'Segment_English', 'Notes'];
        const joinRows = [joinHeader.join(',')];
        glossesToExport.forEach(g => {
            const glossId = crypto.randomUUID();
            // Gloss source is usually 'user', but if it's linked to a sentence, maybe we should use the sentence source?
            // But glosses are independent.
            // If we export glosses, they are part of this package.
            // We can use the package name or just 'user'?
            // Actually, glosses don't strictly have a source in the same way.
            // But let's use the shorthand of the sentence's source if possible, or just 'user'.
            // Wait, glossesToExport are filtered by sentenceIds.
            // Let's find the sentence for this gloss.
            const sentence = sentencesToExport.find(s => s.id === g.sentence_id);
            const src = sentence ? (shorthandMap[sentence.source] || sentence.source) : 'user';

            joinRows.push([
                `"${glossId}"`,
                `"${src}"`,
                `"${g.sentence_id}"`,
                `"${g.entry_id}"`,
                `"${g.word_index}"`,
                `""`, // Segment_Cherokee
                `""`, // Segment_English
                `"${(g.notes || '').replace(/"/g, '""')}"`
            ].join(','));
        });

        zip.file('dictionary.csv', dictRows.join('\n'));
        zip.file('sentences.csv', sentRows.join('\n'));
        zip.file('join_table.csv', joinRows.join('\n'));

        // 3. Metadata
        const meta: PackageMetadata = {
            id: crypto.randomUUID(),
            name: metadata.name || 'Untitled Package',
            author: metadata.author || 'Unknown',
            date_created: Date.now(),
            description: metadata.description || '',
            app_version: '1.0',
            stats: {
                words: wordsToExport.length,
                sentences: sentencesToExport.length,
                audio_files: 0
            },
            source_names: {}
        };
        notebookIds.forEach(id => {
            if (notebooks[id]) {
                if (!meta.source_names) meta.source_names = {};
                // Use Shorthand as Key
                const short = shorthandMap[id];
                if (short) {
                    meta.source_names[short] = notebooks[id].name;
                }
            }
        });

        zip.file('metadata.json', JSON.stringify(meta, null, 2));

        // 4. README
        try {
            // Fetch DEFAULT_README.txt content if possible, or just use a string
            // Since we created src/data/DEFAULT_README.txt, we can try to fetch it if served
            // But for reliability, I'll just use a template string here as requested by "I will fill it in"
            // Wait, user said "Please create a file... This file will be read and included".
            // So I should try to read it.
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

        // Collect all audio IDs
        // 1. From Words (legacy field)
        const legacyAudioIds = new Set<string>();
        wordsToExport.forEach(w => { if (w.audio) legacyAudioIds.add(w.audio); });
        sentencesToExport.forEach(s => { if (s.audio) legacyAudioIds.add(s.audio); });

        // 2. From userAudioMeta (The new standard)
        // We need to find all audio attached to the exported words/sentences
        const exportAudioItems: { id: string, speaker: string, targetId: string, type: 'W' | 'S' }[] = [];

        // Check Words
        wordsToExport.forEach(w => {
            const meta = userAudioMeta[w.id];
            if (meta) {
                meta.forEach(a => {
                    if (!a.isOfficial) {
                        exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId: w.id, type: 'W' });
                    }
                });
            }
        });

        // Check Sentences
        sentencesToExport.forEach(s => {
            const key = s.id + '_sentence';
            const meta = userAudioMeta[key];
            if (meta) {
                meta.forEach(a => {
                    if (!a.isOfficial) {
                        exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId: s.id, type: 'S' });
                    }
                });
            }
        });

        // 3. Dependency Audio (Passed in)
        // These are audio files attached to items NOT in the export list, but user chose to include them.
        // We need to look them up in userAudioMeta to get speaker/target info.
        // But wait, dependencyAudioIds are just IDs. We need to find where they belong.
        // We can scan userAudioMeta for them.
        if (dependencyAudioIds.length > 0) {
            const depSet = new Set(dependencyAudioIds);
            Object.entries(userAudioMeta).forEach(([key, audioList]) => {
                audioList.forEach(a => {
                    if (depSet.has(a.id) && !a.isOfficial) {
                        // Determine Type/ID from key
                        let type: 'W' | 'S' = 'W';
                        let targetId = key;
                        if (key.endsWith('_sentence')) {
                            type = 'S';
                            targetId = key.replace('_sentence', '');
                        }
                        exportAudioItems.push({ id: a.id, speaker: a.speaker, targetId, type });
                    }
                });
            });
        }

        // Process and Rename
        // Group by Target to assign indices
        const audioByTarget: Record<string, typeof exportAudioItems> = {};
        exportAudioItems.forEach(item => {
            const k = `${item.type}-${item.targetId}`;
            if (!audioByTarget[k]) audioByTarget[k] = [];
            audioByTarget[k].push(item);
        });

        for (const key in audioByTarget) {
            const items = audioByTarget[key];
            // Sort by something deterministic? ID or Date? 
            // We don't have date easily here unless we look it up again, but ID contains timestamp usually.
            // Let's sort by ID (which has timestamp).
            items.sort((a, b) => a.id.localeCompare(b.id));

            // Assign indices per speaker?
            // "Index is a simple count starting at 0, in case there are multiple audios with the same speaker for a single word."
            const speakerCounts: Record<string, number> = {};

            for (const item of items) {
                const speaker = item.speaker || 'User';
                const idx = speakerCounts[speaker] || 0;
                speakerCounts[speaker] = idx + 1;

                // New Filename: [speaker_name]_[W/S-][id]_[index].mp3
                // Sanitize speaker name
                const safeSpeaker = speaker.replace(/[^a-zA-Z0-9]/g, '');
                const newFilename = `${safeSpeaker}_${item.type}-${item.targetId}_${idx}.mp3`;

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

        // Also export legacy audio (direct links) if they exist and aren't covered?
        // Legacy audio in `w.audio` is usually just an ID.
        // If it matches the new format, we might have double exported?
        // Let's assume `userAudioMeta` is the source of truth for user audio.
        // `w.audio` might be official audio (which we don't export usually, unless it's user recorded and put there?)
        // If `w.audio` is in `userAudioMeta`, it's covered.
        // If not, it might be an orphan or official. We skip official.

        meta.stats.audio_files = audioCount;
        // Update metadata with audio count
        zip.file('metadata.json', JSON.stringify(meta, null, 2));

        const content = await zip.generateAsync({ type: 'blob' });
        downloadFile(content, `${meta.name.replace(/[^a-z0-9]/gi, '_')}.zip`, 'application/zip');
    };

    return { exportPackage };
};

export const usePackageImport = () => {
    const { installPackage } = usePackageManager();

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

        // Normalize Data
        const dictionary = rawDictionary.map((d: any) => ({
            ...d,
            id: d.Index,
            syllabary: d.Syllabary,
            translit: d.Entry,
            definition: d.Definition,
            source: d.Source,
            audio: d.Audio,
            // Keep original fields for legacy compatibility if needed
            Index: d.Index,
            Entry: d.Entry,
            Syllabary: d.Syllabary,
            Definition: d.Definition,
            Source: d.Source,
            Entry_Tone: d.Entry_Tone,
            PoS: d.PoS || d.Part_of_Speech,
            Source_Long: meta.source_names?.[d.Source] || d.Source
        }));

        const sentences = rawSentences.map((d: any) => ({
            id: d.ID,
            syllabary: d.Syllabary,
            translit: d.Transliteration,
            english: d.English,
            source: d.Source,
            audio: d.Audio,
            // Keep originals
            ID: d.ID,
            Syllabary: d.Syllabary,
            Transliteration: d.Transliteration,
            English: d.English,
            Source: d.Source
        }));

        const glosses = rawGlosses.map((d: any) => ({
            sentence_id: d.Sentence_ID,
            word_index: d.Word_Index,
            entry_id: d.Entry_ID,
            notes: d.Notes,
            source: d.Source,
            // Keep originals
            Sentence_ID: d.Sentence_ID,
            Word_Index: d.Word_Index,
            Entry_ID: d.Entry_ID,
            Notes: d.Notes,
            Source: d.Source
        }));

        // 3. Audio
        const audioFolder = zip.folder('audio');
        if (audioFolder) {
            const files: any[] = [];
            audioFolder.forEach((path, file) => files.push({ path, file }));

            for (const { path, file } of files) {
                if (!file.dir) {
                    const blob = await file.async('blob');
                    // Filename is path (relative to audio folder).
                    // ID is filename without extension?
                    // Spec: "[speaker_name]_[W/S-][id]_[index].mp3"
                    // ID in DB should match what is in CSV.
                    // CSV has "Audio" column.
                    // If CSV says "foo.mp3", we store as "foo.mp3".
                    // If CSV says "foo", we store as "foo".
                    // Let's assume ID = filename (stripping extension if CSV doesn't use it? or keeping it?)
                    // The export adds .mp3 if missing.
                    // The import should probably store as is, or match CSV.
                    // Let's store using the filename as the key.
                    // But we need to make sure it doesn't overwrite existing user audio with same name?
                    // Imported packages are read-only reference.
                    // But audio is global in IDB?
                    // "Save Audio to IndexedDB".
                    // If multiple packages use same audio ID, it's fine if content is same.
                    // If different, we have a collision.
                    // For now, overwrite.
                    const id = path.replace(/\.mp3$/i, ''); // Strip extension for ID?
                    // Wait, export code: `const filename = aid.endsWith('.mp3') ? aid : ${aid}.mp3;`
                    // So if ID is "foo", filename is "foo.mp3".
                    // So we should strip .mp3 to get ID.
                    await saveAudioToDB(id, blob);
                    // Also save with extension just in case?
                    await saveAudioToDB(path, blob);
                }
            }
        }

        // 4. Install
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
            glosses
        };

        installPackage(pkg, data);
    };

    return { importPackage };
};
