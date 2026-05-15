const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Papa = require('papaparse');

const CSV_FILENAME = 'cherokee-new-testament.csv';
const JSON_FILENAME = 'sentences.json';

const publicCsvPath = path.join(__dirname, `../public/data/${CSV_FILENAME}`);
const publicJsonPath = path.join(__dirname, `../public/data/${JSON_FILENAME}`);
const distJsonPath = path.join(__dirname, `../dist/data/${JSON_FILENAME}`);

function processFile(csvPath, jsonPath) {
    if (!fs.existsSync(csvPath)) {
        console.error(`Could not find CSV at ${csvPath}`);
        return;
    }
    if (!fs.existsSync(jsonPath)) {
        console.error(`Could not find JSON at ${jsonPath}`);
        return;
    }

    console.log(`Processing:\n  CSV: ${csvPath}\n  JSON: ${jsonPath}`);
    
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
    
    let sentences = [];
    try {
        sentences = JSON.parse(jsonContent);
    } catch (e) {
        console.error(`Error parsing JSON from ${jsonPath}:`, e.message);
        return;
    }

    Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log(`Parsed ${results.data.length} rows from CSV.`);
            
            // Build a story order map based on first appearance in CSV
            const storyOrderMap = new Map();
            let orderCounter = 0;
            results.data.forEach(row => {
                const storyName = row.Story ? row.Story.trim() : "";
                if (storyName && !storyOrderMap.has(storyName)) {
                    storyOrderMap.set(storyName, orderCounter++);
                }
            });
            console.log(`Found ${storyOrderMap.size} unique books in canonical order.`);

            const newSentences = results.data.map(row => {
                const syllabary = row.Syllabary ? row.Syllabary.trim() : "";
                if (!syllabary) return null;
                
                // Generate deterministic sentence ID using fields
                const rawStr = `${row.Story || ""}_${row.Chapter || ""}_${row.Line || ""}_${syllabary}`;
                const sentence_id = crypto.createHash('md5')
                    .update(rawStr)
                    .digest('hex')
                    .substring(0, 12);
                
                const english = row.English ? row.English.trim() : "";
                const phonetic = row.Transliteration ? row.Transliteration.trim() : "";
                const audio = row.Audio ? row.Audio.trim() : "";
                
                const storyName = row.Story ? row.Story.trim() : "";
                const chapterNum = row.Chapter ? row.Chapter.trim() : "";
                const lineNum = row.Line ? row.Line.trim() : "";

                const meta = [];
                if (row['Line Name']) meta.push(row['Line Name']);
                const notes = meta.join(', ');

                return {
                    sentence_id: sentence_id,
                    syllabary: syllabary,
                    phonetic: phonetic,
                    english: english,
                    audio: audio,
                    speaker: "",
                    notes: notes,
                    source: "Cherokee New Testament",
                    "source file": CSV_FILENAME,
                    // Reader fields for book/chapter/verse grouping
                    story: storyName || undefined,
                    chapter: chapterNum || undefined,
                    line: lineNum || undefined,
                    story_order: storyOrderMap.has(storyName) ? storyOrderMap.get(storyName) : undefined
                };
            }).filter(Boolean);

            console.log(`Processing ${newSentences.length} valid verses.`);

            // Remove any existing NT entries so we can replace them with the corrected format
            const before = sentences.length;
            sentences = sentences.filter(s => s['source file'] !== CSV_FILENAME);
            const removed = before - sentences.length;
            if (removed > 0) {
                console.log(`Removed ${removed} existing NT entries to re-add with corrected format.`);
            }

            // Add all NT entries
            const sentenceIds = new Set(sentences.map(s => s.sentence_id));
            let addedCount = 0;

            for (const ns of newSentences) {
                if (!sentenceIds.has(ns.sentence_id)) {
                    sentences.push(ns);
                    sentenceIds.add(ns.sentence_id);
                    addedCount++;
                }
            }

            console.log(`Added ${addedCount} new entries. Total entries now: ${sentences.length}`);
            
            fs.writeFileSync(jsonPath, JSON.stringify(sentences, null, 2));
            console.log(`Successfully updated ${jsonPath}`);
        }
    });
}

// Run for public
processFile(publicCsvPath, publicJsonPath);

// Run for dist if it exists
if (fs.existsSync(distJsonPath)) {
    console.log("\nUpdating dist copy too...");
    processFile(publicCsvPath, distJsonPath);
}
