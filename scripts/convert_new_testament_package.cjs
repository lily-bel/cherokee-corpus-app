const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');
const JSZip = require('jszip');

const CSV_PATH = path.join(__dirname, '../public/data/cherokee-new-testament.csv');
const PACKAGES_DIR = path.join(__dirname, '../public/packages');
const DIST_PACKAGES_DIR = path.join(__dirname, '../dist/packages');
const PUBLIC_SENTENCES_JSON = path.join(__dirname, '../public/data/sentences.json');
const DIST_SENTENCES_JSON = path.join(__dirname, '../dist/data/sentences.json');

if (!fs.existsSync(PACKAGES_DIR)) fs.mkdirSync(PACKAGES_DIR, { recursive: true });
if (!fs.existsSync(DIST_PACKAGES_DIR)) fs.mkdirSync(DIST_PACKAGES_DIR, { recursive: true });

if (!fs.existsSync(CSV_PATH)) {
    console.error(`Could not find CSV at ${CSV_PATH}`);
    process.exit(1);
}

const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

console.log(`Processing Cherokee New Testament CSV (${parsed.data.length} rows)...`);

// Build story order map based on first appearance in CSV
const storyOrderMap = new Map();
let orderCounter = 0;
parsed.data.forEach(row => {
    const storyName = row.Story ? row.Story.trim() : '';
    if (storyName && !storyOrderMap.has(storyName)) {
        storyOrderMap.set(storyName, orderCounter++);
    }
});
console.log(`Found ${storyOrderMap.size} books in canonical order.`);

const sentences = parsed.data.map((row, rowIdx) => {
    const syllabary = row.Syllabary ? row.Syllabary.trim() : '';
    if (!syllabary) return null;

    const rawStr = `${row.Story || ''}_${row.Chapter || ''}_${row.Line || ''}_${syllabary}`;
    const sentence_id = crypto.createHash('md5')
        .update(rawStr)
        .digest('hex')
        .substring(0, 12);

    const english = row.English ? row.English.trim() : '';
    const phonetic = row.Transliteration ? row.Transliteration.trim() : '';
    const audio = row.Audio ? row.Audio.trim() : '';

    const storyName = row.Story ? row.Story.trim() : '';
    const chapterNum = row.Chapter ? row.Chapter.trim() : '1';
    const lineNum = row.Line ? parseInt(row.Line.trim(), 10) : (rowIdx + 1);

    const meta = [];
    if (row['Line Name']) meta.push(row['Line Name']);
    const notes = meta.join(', ');

    return {
        sentence_id: sentence_id,
        syllabary: syllabary,
        phonetic: phonetic,
        english: english,
        audio: audio,
        speaker: '',
        notes: notes,
        source: 'BIBLE',
        'source file': 'cherokee-new-testament.csv',
        story: storyName,
        chapter: chapterNum,
        line: lineNum,
        author: 'Cherokee New Testament',
        story_order: storyOrderMap.get(storyName) ?? 0
    };
}).filter(Boolean);

console.log(`Generated ${sentences.length} valid verses.`);

const metadata = {
    id: 'cherokee-new-testament',
    name: 'Cherokee New Testament',
    short_name: 'BIBLE',
    author: 'American Bible Society',
    date_created: 1740000000000,
    description: 'Full text of the Cherokee New Testament (27 books, 260 chapters).',
    app_version: '1.0',
    stats: {
        words: 0,
        sentences: sentences.length,
        audio_files: 0,
        glosses: 0,
        lists: 0,
        word_forms: 0,
        notes: 0,
        notebooks: 0
    },
    source_names: {
        BIBLE: 'Cherokee New Testament'
    },
    source_meta: {
        BIBLE: 'other'
    },
    color: '#ef4444',
    locked: 'no',
    editable: 'No'
};

const readmeText = 'Cherokee New Testament (Bible Package)\n' +
'======================================\n' +
'Source: Cherokee New Testament (1860 / American Bible Society)\n' +
'Format: 27 Books, 260 Chapters, ' + sentences.length + ' Verses\n\n' +
'Contains the full Cherokee New Testament corpus with:\n' +
'- Syllabary text\n' +
'- Phonetic Roman transliteration\n' +
'- English translation\n' +
'- Structured for Reader by Book, Chapter, and Verse\n';

const zip = new JSZip();
zip.file('metadata.json', JSON.stringify(metadata, null, 2));
zip.file('sentences.json', JSON.stringify(sentences, null, 2));
zip.file('README.txt', readmeText);

zip.generateAsync({ type: 'nodebuffer' }).then(buf => {
    const zipPath = path.join(PACKAGES_DIR, 'cherokee_new_testament.zip');
    fs.writeFileSync(zipPath, buf);
    console.log(`Saved package ZIP to ${zipPath} (${buf.length} bytes)`);

    if (fs.existsSync(DIST_PACKAGES_DIR)) {
        const distZipPath = path.join(DIST_PACKAGES_DIR, 'cherokee_new_testament.zip');
        fs.writeFileSync(distZipPath, buf);
        console.log(`Saved package ZIP to dist: ${distZipPath}`);
    }

    // Update catalog.json
    const catalogPath = path.join(PACKAGES_DIR, 'catalog.json');
    let existingCatalog = [];
    if (fs.existsSync(catalogPath)) {
        try { existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')); } catch (e) {}
    }

    const bibleCatalogItem = {
        id: 'cherokee-new-testament',
        name: 'Cherokee New Testament',
        short_name: 'BIBLE',
        author: 'American Bible Society',
        description: 'Full text of the Cherokee New Testament (27 books, 260 chapters).',
        packageFile: 'cherokee_new_testament.zip',
        stats: {
            sentences: sentences.length,
            stories: storyOrderMap.size,
            glosses: 0
        },
        color: '#ef4444',
        autoInstall: true
    };

    const updatedCatalog = existingCatalog.filter(c => c.id !== bibleCatalogItem.id);
    // Put bible first or keep order
    updatedCatalog.unshift(bibleCatalogItem);

    fs.writeFileSync(path.join(PACKAGES_DIR, 'catalog.json'), JSON.stringify(updatedCatalog, null, 2));
    console.log(`Updated ${path.join(PACKAGES_DIR, 'catalog.json')}`);

    if (fs.existsSync(DIST_PACKAGES_DIR)) {
        fs.writeFileSync(path.join(DIST_PACKAGES_DIR, 'catalog.json'), JSON.stringify(updatedCatalog, null, 2));
        console.log(`Updated dist catalog.json`);
    }

    // Now remove NT sentences from public/data/sentences.json
    function cleanCoreSentences(filePath) {
        if (!fs.existsSync(filePath)) return;
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            const beforeCount = data.length;
            const isNT = (s) => s['source file'] === 'cherokee-new-testament.csv' || (Array.isArray(s.sources) && s.sources.includes('cherokee-new-testament.csv'));
            const cleaned = data.filter(s => !isNT(s));
            const removed = beforeCount - cleaned.length;
            if (removed > 0) {
                fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2));
                console.log(`Removed ${removed} NT verses from ${filePath}. Remaining core sentences: ${cleaned.length}`);
            } else {
                console.log(`No NT verses to remove from ${filePath}.`);
            }
        } catch (e) {
            console.error(`Error cleaning sentences at ${filePath}:`, e.message);
        }
    }

    cleanCoreSentences(PUBLIC_SENTENCES_JSON);
    cleanCoreSentences(DIST_SENTENCES_JSON);
});
