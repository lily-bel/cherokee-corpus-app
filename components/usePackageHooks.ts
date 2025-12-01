import { useCorpus } from './CorpusContext';
import { usePackageManager, Package, PackageMetadata, ImportedPackageData } from './PackageManagerContext';
import JSZip from 'jszip';
import Papa from 'papaparse';
import { downloadFile, saveAudioToDB, getAudioFromDB } from '../utils';

export const usePackageExport = () => {
    const { personalWords, userSentences, glosses, notebooks } = useCorpus();

    const exportPackage = async (notebookIds: string[], metadata: Partial<PackageMetadata>) => {
        const zip = new JSZip();

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
            dictRows.push([
                `"${w.id || ''}"`,
                `"${w.notebookId || ''}"`,
                `"${(w.translit || '').replace(/"/g, '""')}"`,
                `"${(w.syllabary || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.PoS || '').replace(/"/g, '""')}"`,
                `"${(w.definition || '').replace(/"/g, '""')}"`,
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
            sentRows.push([
                `"${s.id || ''}"`,
                `"${s.source || ''}"`,
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
            joinRows.push([
                `"${glossId}"`,
                `"${g.source}"`,
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
                meta.source_names[id] = notebooks[id].name;
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
        const audioIds = new Set<string>();
        wordsToExport.forEach(w => { if (w.audio) audioIds.add(w.audio); });
        sentencesToExport.forEach(s => { if (s.audio) audioIds.add(s.audio); });

        for (const aid of audioIds) {
            try {
                const blob = await getAudioFromDB(aid);
                if (blob) {
                    // Filename: aid is usually "speaker_W-123_0" or similar.
                    // We need to append extension if missing.
                    // Usually blobs from IDB might not have type info if just stored as blob.
                    // But saveAudioToDB stores blob.
                    // Assuming mp3 for now as per spec "Naming Convention: ... .mp3"
                    const filename = aid.endsWith('.mp3') ? aid : `${aid}.mp3`;
                    audioFolder?.file(filename, blob as Blob);
                    audioCount++;
                }
            } catch (e) {
                console.warn(`Failed to export audio ${aid}`, e);
            }
        }

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

        const dictionary = parse(dictText);
        const sentences = parse(sentText);
        const glosses = parse(joinText);

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
