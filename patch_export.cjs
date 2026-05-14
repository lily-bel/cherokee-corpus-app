const fs = require('fs');

let content = fs.readFileSync('components/usePackageHooks.ts', 'utf8');

const regex = /\/\/ 2\. Generate CSVs[\s\S]*?(?=\/\/ 3\. Metadata)/;

const newLogic = `
            // 2. Generate JSONs
            const baseFormsExport = wordsToExport.map(w => {
                return {
                    merged_id: w.id || w.Index,
                    sources: {
                        "user generated": [{
                            "Practical": w.translit || w.Entry || '',
                            "Syllabary": w.syllabary || w.Syllabary || '',
                            "Translations": w.definition || w.Definition || '',
                            "Part of speech": w.PoS || '',
                            "Tone and length 1": w.Entry_Tone || ''
                        }]
                    }
                };
            });

            const sentencesExport = sentencesToExport.map(s => {
                return {
                    sentence_id: s.id,
                    syllabary: s.syllabary || '',
                    phonetic: s.translit || '',
                    english: s.english || '',
                    "source file": "user generated",
                    Story: (s as any).story || '',
                    Chapter: (s as any).chapter || '',
                    Line: (s as any).line || '',
                    Author: (s as any).author || '',
                    Speaker: (s as any).speaker || ''
                };
            });

            const joinsExport = glossesToExport.map(g => {
                return {
                    sentence_id: g.sentence_id,
                    base_id: g.entry_id,
                    word_index: g.word_index,
                    notes: g.notes || '',
                    "source file": "user generated"
                };
            });

            // --- EXPORT CUSTOM NOTES & WORD FORMS ---
            const notesExport = [];
            const formsExport = [];

            // Notes
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

            // Word Forms
            Object.entries(userWordForms).forEach(([key, val]) => {
                if (exportAllNotesAndForms || relevantTargetIds.has(key)) {
                    const parts = val.split('|');
                    parts.forEach((raw, idx) => {
                        const [label, content] = raw.split(':');
                        if (label && content) {
                            const values = content.split('^');
                            formsExport.push({
                                merged_id: key,
                                normalized_key: label,
                                "user generated_Practical": values[0] || '',
                                "user generated_Syllabary": values[1] || '',
                                "user generated_Tone and length 1": values[2] || '',
                                "user generated_Notes": values[3] || ''
                            });
                        }
                    });
                }
            });

            zip.file('base_forms.json', JSON.stringify(baseFormsExport, null, 2));
            zip.file('sentences.json', JSON.stringify(sentencesExport, null, 2));
            zip.file('sentence_joins.json', JSON.stringify(joinsExport, null, 2));
            zip.file('conjugations.json', JSON.stringify(formsExport, null, 2));

            if (notesExport.length > 0) {
                zip.file('entry_data.json', JSON.stringify({
                    notes: notesExport
                }, null, 2));
            }

            `;

content = content.replace(regex, newLogic);
fs.writeFileSync('components/usePackageHooks.ts', content);
