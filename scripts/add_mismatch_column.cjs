const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const csvPath = path.join(__dirname, '../public/data/Cherokee Narratives.csv');
const rawContent = fs.readFileSync(csvPath, 'utf-8');

// Parse with PapaParse preserving headers and quotes
const parsed = Papa.parse(rawContent, {
    header: true,
    skipEmptyLines: true
});

function calculateMismatch(row) {
    const sylTokens = (row['Syllabary'] || '').trim().split(/\s+/).filter(Boolean);
    const trTokens = (row['Transliteration'] || '').trim().split(/\s+/).filter(Boolean);
    const cmTokens = (row['Cherokee Morphemes'] || '').trim().split(/\s+/).filter(Boolean);
    
    const egRaw = (row['English Morphemes (Gloss)'] || '').trim();
    const wlRaw = (row['Word-by-word Literal Translation'] || '').trim();

    const egTokens = egRaw ? egRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const wlTokens = wlRaw ? wlRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

    const syl = sylTokens.length;
    const tr = trTokens.length;
    const cm = cmTokens.length;
    const eg = egTokens.length;
    const wl = wlTokens.length;

    const allCounts = [syl, tr, cm, eg, wl];
    const unique = new Set(allCounts);

    // If all token counts are identical
    if (unique.size === 1) {
        return '';
    }

    const diffs = [];
    if (syl !== tr) {
        diffs.push(`Syllabary (${syl}) vs Transliteration (${tr})`);
    }
    if (cm !== syl && cm !== tr) {
        diffs.push(`Cherokee Morphemes (${cm}) vs Text (${syl})`);
    }
    if (eg !== cm) {
        diffs.push(`English Morphemes (${eg}) vs Cherokee Morphemes (${cm})`);
    }
    if (wl !== syl && wl !== cm) {
        diffs.push(`Literal Translation (${wl}) vs Words (${syl})`);
    }

    return `Mismatch: ${diffs.join('; ')} [Counts: Syl=${syl}, Tr=${tr}, CM=${cm}, EG=${eg}, WL=${wl}]`;
}

// Add the 'Mismatch' field to each row
const updatedData = parsed.data.map(row => {
    const mismatchInfo = calculateMismatch(row);
    return {
        ...row,
        'Mismatch': mismatchInfo
    };
});

// Unparse back to CSV with proper quoting
const outputCsv = Papa.unparse(updatedData, {
    quotes: false,
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ",",
    header: true,
    newline: "\r\n"
});

fs.writeFileSync(csvPath, outputCsv, 'utf-8');
console.log('Successfully updated Cherokee Narratives.csv with Mismatch column!');

// Also print stats
let count = 0;
updatedData.forEach((r, idx) => {
    if (r['Mismatch']) {
        count++;
        if (count <= 5) {
            console.log(`L${r.Line || idx+1} (${r.Story}): ${r['Mismatch']}`);
        }
    }
});
console.log(`Total mismatched rows marked: ${count} / ${updatedData.length}`);
