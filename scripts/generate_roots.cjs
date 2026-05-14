const fs = require('fs');
const path = require('path');

const DICT_CSV = path.join(__dirname, '../public/data/dictionary.csv');
const HEIRARCHICAL_JSON = path.join(__dirname, '../public/data/hierarchical-dict.json');
const OUTPUT_JSON = path.join(__dirname, '../public/data/roots.json');

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    
    const parseLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const entry = {};
        headers.forEach((header, index) => {
            let val = values[index] ? values[index].trim() : '';
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1);
            }
            entry[header] = val;
        });
        return entry;
    });
}

console.log('Reading dictionary.csv...');
const dictData = parseCSV(fs.readFileSync(DICT_CSV, 'utf8'));

// Map Source_ID (part before .) to Index
const entryNoToIdMap = new Map();
dictData.forEach(entry => {
    if (entry.Source_ID) {
        const entryNo = parseInt(entry.Source_ID.split('.')[0]);
        if (!isNaN(entryNo)) {
            entryNoToIdMap.set(entryNo, entry.Index);
        }
    }
});

console.log(`Mapped ${entryNoToIdMap.size} entry numbers to IDs.`);

console.log('Reading hierarchical-dict.json...');
const hierarchicalData = JSON.parse(fs.readFileSync(HEIRARCHICAL_JSON, 'utf8'));

const flattenedVerbs = [];

hierarchicalData.forEach(root => {
    const rootData = {
        root_h: root.h_grade_root,
        root_g: root.glottal_grade_root,
        root_slug: root.slug
    };

    root.classes.forEach(cls => {
        cls.verbs.forEach(verb => {
            const entry_id = entryNoToIdMap.get(verb.entry_no);
            if (entry_id) {
                flattenedVerbs.push({
                    entry_id: entry_id,
                    ...rootData,
                    ...verb
                });
            } else {
                console.warn(`Could not find entry_id for entry_no ${verb.entry_no} (${verb.definition})`);
            }
            
            // Handle derivations
            if (verb.derivations && verb.derivations.length > 0) {
                verb.derivations.forEach(deriv => {
                    const deriv_entry_id = entryNoToIdMap.get(deriv.entry_no);
                    if (deriv_entry_id) {
                        flattenedVerbs.push({
                            entry_id: deriv_entry_id,
                            ...rootData,
                            ...deriv,
                            is_derivation: true,
                            parent_entry_no: verb.entry_no
                        });
                    }
                });
            }
        });
    });
});

console.log(`Flattened ${flattenedVerbs.length} verbs.`);

fs.writeFileSync(OUTPUT_JSON, JSON.stringify(flattenedVerbs, null, 2));
console.log(`Saved to ${OUTPUT_JSON}`);
