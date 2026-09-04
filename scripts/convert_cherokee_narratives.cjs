const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');
const JSZip = require('jszip');

const CSV_PATH = path.join(__dirname, '../public/data/Cherokee Narratives.csv');
const PACKAGES_DIR = path.join(__dirname, '../public/packages');
const DIST_PACKAGES_DIR = path.join(__dirname, '../dist/packages');

if (!fs.existsSync(PACKAGES_DIR)) fs.mkdirSync(PACKAGES_DIR, { recursive: true });
if (!fs.existsSync(DIST_PACKAGES_DIR)) fs.mkdirSync(DIST_PACKAGES_DIR, { recursive: true });

const content = fs.readFileSync(CSV_PATH, 'utf-8');
const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });

console.log('Processing Cherokee Narratives CSV...');

const storyOrderMap = new Map();
let orderCounter = 0;
parsed.data.forEach(row => {
    const storyName = row.Story ? row.Story.trim() : '';
    if (storyName && !storyOrderMap.has(storyName)) {
        storyOrderMap.set(storyName, orderCounter++);
    }
});

const sentences = [];
const glosses = [];

parsed.data.forEach((row, rowIdx) => {
    const syllabary = (row.Syllabary || '').trim();
    if (!syllabary) return;

    const storyName = (row.Story || '').trim() || 'Cherokee Narrative';
    const chapterNum = '1';
    const lineNum = row.Line ? parseInt(row.Line.trim(), 10) : (rowIdx + 1);

    const rawStr = storyName + '_' + chapterNum + '_' + lineNum + '_' + syllabary;
    const sentence_id = crypto.createHash('md5')
        .update(rawStr)
        .digest('hex')
        .substring(0, 12);

    const phonetic = (row.Transliteration || '').trim();
    const english = (row.English || '').trim();
    const author = (row.Author || '').trim() || 'Durbin Feeling';

    const sentObj = {
        sentence_id: sentence_id,
        syllabary: syllabary,
        phonetic: phonetic,
        english: english,
        audio: '',
        speaker: '',
        notes: '',
        source: 'NARR',
        'source file': 'cherokee-narratives.csv',
        story: storyName,
        chapter: chapterNum,
        line: lineNum,
        author: author,
        story_order: storyOrderMap.get(storyName) ?? 0
    };
    sentences.push(sentObj);

    // Extract word-level glosses
    const sylTokens = syllabary.split(/\s+/).filter(Boolean);
    const trTokens = phonetic.split(/\s+/).filter(Boolean);
    const cmTokens = (row['Cherokee Morphemes'] || '').trim().split(/\s+/).filter(Boolean);
    
    const eg = (row['English Morphemes (Gloss)'] || '').trim();
    const wl = (row['Word-by-word Literal Translation'] || '').trim();

    const egTokens = eg ? eg.split(',').map(s => s.trim()) : [];
    const wlTokens = wl ? wl.split(',').map(s => s.trim()) : [];

    const numWords = Math.max(sylTokens.length, trTokens.length);

    for (let i = 0; i < numWords; i++) {
        const sylWord = sylTokens[i] || '';
        const trWord = trTokens[i] || '';
        const cmWord = cmTokens[i] || '';
        const egWord = egTokens[i] || '';
        const wlWord = wlTokens[i] || '';

        if (cmWord || egWord || wlWord || sylWord) {
            glosses.push({
                sentence_id: sentence_id,
                word_index: String(i),
                entry_id: '',
                source: 'NARR',
                'source file': 'cherokee-narratives.csv',
                gloss_syllabary: sylWord,
                gloss_phonetic: trWord,
                gloss_english: wlWord,
                breakdown_cherokee: cmWord,
                breakdown_english: egWord
            });
        }
    }
});

console.log('Generated ' + sentences.length + ' sentences and ' + glosses.length + ' glosses across ' + storyOrderMap.size + ' stories.');

const metadata = {
    id: 'cherokee-narratives',
    name: 'Cherokee Narratives',
    short_name: 'NARR',
    author: 'Durbin Feeling, et al.',
    date_created: 1740000000000,
    description: 'Stories from Cherokee Narratives (edited by Durbin Feeling).',
    app_version: '1.0',
    stats: {
        words: 0,
        sentences: sentences.length,
        audio_files: 0,
        glosses: glosses.length,
        lists: 0,
        word_forms: 0,
        notes: 0,
        notebooks: 0
    },
    source_names: {
        NARR: 'Cherokee Narratives'
    },
    source_meta: {
        NARR: 'other'
    },
    color: '#14b8a6',
    locked: 'no',
    editable: 'Yes'
};

const readmeText = 'Cherokee Narratives (Supplementary Materials)\n' +
'==============================================\n' +
'Author: Durbin Feeling, et al.\n' +
'Source: Cherokee Narratives Corpus\n\n' +
'Stories from Cherokee Narratives (edited by Durbin Feeling).\n\n' +
'Features:\n' +
'- Full Syllabary, Transliteration, and English translations.\n' +
'- Word-by-word literal translations.\n' +
'- Full Interlinear Glossed Text (IGT) morpheme breakdowns.\n' +
'- Structured into 17 stories for the Cherokee Corpus Reader.\n';

const zip = new JSZip();
zip.file('metadata.json', JSON.stringify(metadata, null, 2));
zip.file('sentences.json', JSON.stringify(sentences, null, 2));
zip.file('sentence_joins.json', JSON.stringify(glosses, null, 2));
zip.file('README.txt', readmeText);

zip.generateAsync({ type: 'nodebuffer' }).then(buf => {
    const zipPath = path.join(PACKAGES_DIR, 'cherokee_narratives.zip');
    fs.writeFileSync(zipPath, buf);
    console.log('Saved package ZIP to ' + zipPath + ' (' + buf.length + ' bytes)');

    if (fs.existsSync(DIST_PACKAGES_DIR)) {
        const distZipPath = path.join(DIST_PACKAGES_DIR, 'cherokee_narratives.zip');
        fs.writeFileSync(distZipPath, buf);
        console.log('Saved package ZIP to dist: ' + distZipPath);
    }

    const catalogPath = path.join(PACKAGES_DIR, 'catalog.json');
    let existingCatalog = [];
    if (fs.existsSync(catalogPath)) {
        try { existingCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')); } catch (e) {}
    }
    const narrCatalogItem = {
        id: 'cherokee-narratives',
        name: 'Cherokee Narratives',
        short_name: 'NARR',
        author: 'Durbin Feeling, et al.',
        description: 'Stories from Cherokee Narratives (edited by Durbin Feeling).',
        packageFile: 'cherokee_narratives.zip',
        stats: {
            sentences: sentences.length,
            stories: storyOrderMap.size,
            glosses: glosses.length
        },
        color: '#14b8a6'
    };
    const catalog = existingCatalog.filter(c => c.id !== narrCatalogItem.id);
    catalog.push(narrCatalogItem);

    fs.writeFileSync(path.join(PACKAGES_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
    if (fs.existsSync(DIST_PACKAGES_DIR)) {
        fs.writeFileSync(path.join(DIST_PACKAGES_DIR, 'catalog.json'), JSON.stringify(catalog, null, 2));
    }
    console.log('Saved catalog.json');
});
