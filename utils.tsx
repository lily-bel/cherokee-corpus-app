
export const parseCSV = (csvText: string) => {
  const lines: string[] = csvText.split('\n').filter((line: string) => line.trim() !== '');
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const parseLine = (line: string) => {
    const result: string[] = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += char; }
    }
    result.push(current); return result;
  };
  return lines.slice(1).map(line => {
    const values = parseLine(line); const entry: any = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : '';
      if (val.startsWith('"') && val.endsWith('"')) { val = val.slice(1, -1); }
      entry[header] = val;
    });
    return entry;
  });
};

export const renderStyledText = (text: string) => {
  if (!text) return null;
  // If an even number of asterisks, parts.length is odd.
  // If an odd number of asterisks, parts.length is even.
  const parts = text.split('*');
  
  return parts.map((part, i) => {
    // If it's an odd index, it's inside asterisks, BUT only if it's not the last part of an even-length array (mismatched)
    if (i % 2 === 1) {
        if (i === parts.length - 1) {
            // Mismatched trailing asterisk, just return the text
            return part;
        }
        return <span key={i} className="font-bold text-slate-900 dark:text-slate-200">{part}</span>;
    }
    return part;
  });
};

export const formatToneInput = (value: string) => {
  const map: Record<string, string> = { '1': '¹', '2': '²', '3': '³', '4': '⁴', '?': 'ʔ' };
  return value.replace(/[1234?]/g, m => map[m]);
};

const PRONOUN_MAP: Record<string, string> = {
    '1s': '1st person singular',
    '2s': '2nd person singular',
    '3s': '3rd person singular',
    '1p': '1st person plural',
    '1p-in': '1st person plural inclusive',
    '1p-ex': '1st person plural exclusive',
    '1d-in': '1st person dual inclusive',
    '1d-ex': '1st person dual exclusive',
    '2p': '2nd person plural',
    '2d': '2nd person dual',
    '3p': '3rd person plural',
    '3a': '3rd person animate',
    '3i': '3rd person inanimate'
};

const OBJ_MAP: Record<string, string> = {
    '1s': '1st person singular',
    '2s': '2nd person singular',
    '3s': 'singular',
    '3p': 'plural',
    '3a': 'animate',
    '3i': 'inanimate',
    '1p': '1st person plural',
    '2p': '2nd person plural',
    '1d-in': '1st person dual inclusive',
    '1d-ex': '1st person dual exclusive',
    '1p-in': '1st person plural inclusive',
    '1p-ex': '1st person plural exclusive',
};

export const getFriendlyLabel = (key: string, showObject = false) => {
    if (!key) return '';
    const parts = key.split('|');
    if (parts.length >= 3) {
        if (parts[0] === 'noun') {
            return parts[1] === 'singular' ? 'Singular' : 'Plural';
        }
        
        const subj = PRONOUN_MAP[parts[0]] || parts[0];
        const tense = parts[2];
        
        let label = `${subj} ${tense}`;
        if (showObject && parts[1] && parts[1] !== 'none') {
            const objStr = OBJ_MAP[parts[1]] || parts[1];
            label += ` (${objStr} object)`;
        }
        return label;
    }
    
    // Fallback
    if (key === 'noun|singular|') return 'Singular';
    if (key === 'noun|plural|') return 'Plural';
    return key;
};

export const processFormsContextually = (forms: any[]) => {
    const subjectTenseMap = new Map<string, Set<string>>();
    
    forms.forEach(f => {
        const key = f.form_name;
        if (!key) return;
        const parts = key.split('|');
        if (parts.length >= 3 && parts[0] !== 'noun') {
            const subjTense = `${parts[0]}|${parts[2]}`;
            if (!subjectTenseMap.has(subjTense)) subjectTenseMap.set(subjTense, new Set());
            subjectTenseMap.get(subjTense)!.add(parts[1]);
        }
    });

    return forms.map(f => {
        const key = f.form_name;
        if (!key) return { ...f, displayLabel: key };
        
        const parts = key.split('|');
        let showObject = false;
        if (parts.length >= 3 && parts[0] !== 'noun') {
            const subjTense = `${parts[0]}|${parts[2]}`;
            const objects = subjectTenseMap.get(subjTense);
            if (objects && objects.size > 1 && parts[1] && parts[1] !== 'none') {
                showObject = true;
            }
        }
        
        return { ...f, displayLabel: getFriendlyLabel(key, showObject) };
    });
};


export const downloadFile = (content: any, filename: string, type: string) => {
  // Add BOM to content if type is CSV, else raw content
  const finalContent = type === 'text/csv' ? new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode(content)]) : content;
  const blob = new Blob([finalContent], { type: type + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export const exportDictionaryToCSV = (dictionaryId: string, name: string, words: any[]) => {
  const nbWords = words.filter(w => w.customDictionaryId === dictionaryId);
  const headers = ['Syllabary', 'Transliteration', 'Definition', 'PoS', 'Tone', 'Notes'];
  const rows = [headers.join(',')];
  nbWords.forEach(w => {
    const row = [
      `"${(w.Syllabary || '').replace(/"/g, '""')}"`,
      `"${(w.Entry || '').replace(/"/g, '""')}"`,
      `"${(w.Definition || '').replace(/"/g, '""')}"`,
      `"${(w.PoS || '').replace(/"/g, '""')}"`,
      `"${(w.Entry_Tone || '').replace(/"/g, '""')}"`,
      `"${(w.Notes || '').replace(/"/g, '""')}"`
    ];
    rows.push(row.join(','));
  });
  downloadFile(rows.join('\n'), `${name.replace(/[^a-z0-9]/gi, '_')}.csv`, 'text/csv');
};

export const importDictionaryFromCSV = (file: File, callback: (data: any[]) => void) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = (e.target as FileReader).result as string;
    try {
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      if (!headers.includes('Syllabary') || !headers.includes('Transliteration')) {
        throw new Error("Invalid CSV format. Must contain Syllabary, Transliteration, Definition headers.");
      }
      const rawData = parseCSV(text);
      const mappedWords = rawData.map(r => ({
        Entry: r.Transliteration || r.Entry,
        Syllabary: r.Syllabary,
        Definition: r.Definition,
        PoS: r.PoS,
        Entry_Tone: r.Tone || r.Entry_Tone,
        Notes: r.Notes
      }));
      callback(mappedWords);
    } catch (err) {
      alert("Import Failed: " + (err as Error).message);
    }
  };
  reader.readAsText(file);
};

// --- IndexedDB Helpers ---
const DB_NAME = 'cherokee_dict_db';
const STORE_NAME = 'files';
const AUDIO_STORE_NAME = 'user_audio';
const CSV_KEY = 'dictionary_csv';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME);
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const saveToDB = async (data: any) => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data, CSV_KEY);
    request.onsuccess = () => resolve(true);
    request.onerror = (e: any) => reject(e.target.error);
  });
};

export const getFromDB = async () => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(CSV_KEY);
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const saveAudioToDB = async (id: string, blob: Blob) => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE_NAME);
    // ID is now expected to be in format: speaker_W-123_1 or speaker_S-123_1
    const request = store.put(blob, id);
    request.onsuccess = () => resolve(true);
    request.onerror = (e: any) => reject(e.target.error);
  });
};

export const getAudioFromDB = async (id: string) => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteAudioFromDB = async (id: string) => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(AUDIO_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve(true);
    request.onerror = (e: any) => reject(e.target.error);
  });
};

export const getAllUserAudioKeys = async () => {
  const db = await initDB() as IDBDatabase;
  return new Promise<string[]>((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE_NAME);
    const request = store.getAllKeys();
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

// --- SEARCH ALGORITHM ---
export const performSearch = (query: string, allData: any[], sentences: any[], entryToSentencesMap: Map<string, string[]>, settings: any, customDictionaries: any, userNotes: any, posFilter: string, searchScope: string, prioritizedSources: string[] = [], importedData: any = {}) => {
  if (!query) return [];
  const lowerQuery = query.toLowerCase().trim();
  const queryWithTones = lowerQuery.replace(/[1234?]/g, m => ({ '1': '¹', '2': '²', '3': '³', '4': '⁴', '?': 'ʔ' }[m] || m));
  
  // Bulletproof Settings Fallback
  const searchLangs = settings?.searchLangs || {};
  const searchScopes = settings?.searchScopes || {};
  
  let activeLangs = {
      translit: searchLangs.translit !== false,
      syllabary: searchLangs.syllabary !== false,
      english: searchLangs.english !== false,
      tone: !!searchLangs.tone
  };

  // CRITICAL FAIL-SAFE: If all primary languages are false (corrupted settings), 
  // we MUST force them to true, otherwise search yields mathematically zero results!
  if (!activeLangs.translit && !activeLangs.syllabary && !activeLangs.english) {
      activeLangs.translit = true;
      activeLangs.syllabary = true;
      activeLangs.english = true;
  }

  const activeScopes = {
      main: searchScopes.main !== false,
      otherForms: searchScopes.otherForms !== false,
      notes: !!searchScopes.notes,
      sentences: !!searchScopes.sentences
  };


  let regex: RegExp | null = null;
  if (settings?.enableRegex) {
    try {
      const regexQuery = query.replace(/[1234]/g, m => ({ '1': '¹', '2': '²', '3': '³', '4': '⁴' }[m] || m));
      regex = new RegExp(regexQuery, 'i');
    } catch (e) { }
  }

  // SENTENCE MODE
  if (searchScope === 'sentences') {
    // 1. Text Match in Sentences
    const textMatches: any[] = sentences.map(s => {
      let score = 0;
      const fields: string[] = [];
      if (activeLangs.translit) fields.push(s.translit);
      if (activeLangs.syllabary) fields.push(s.syllabary);
      if (activeLangs.english) fields.push(s.english);

      for (const f of fields) {
        if (!f) continue;
        const fLower = f.toLowerCase();
        if (fLower.includes(lowerQuery)) score = 50;
      }
      return { item: s, score, type: 'text' };
    }).filter(x => x.score > 0);

    // 2. Deep Search (Dictionary Links)
    // Find dictionary entries that match, then get their sentences
    const dictMatches = allData.filter(entry => {
      // Simplified dictionary search for deep linking
      const fields = [entry.Entry, entry.Syllabary, entry.Definition];
      return fields.some(f => f && f.toLowerCase().includes(lowerQuery));
    });

    const deepMatches: any[] = [];
    const seenSentences = new Set(textMatches.map(m => m.item.id));

    dictMatches.forEach(entry => {
      const linkedSentences = entryToSentencesMap.get(entry.id) || [];
      linkedSentences.forEach(sId => {
        if (!seenSentences.has(sId)) {
          const s = sentences.find(x => x.id === sId);
          if (s) {
            deepMatches.push({ item: s, score: 25, type: 'deep', via: entry });
            seenSentences.add(sId);
          }
        }
      });
    });

    return [...textMatches, ...deepMatches].sort((a, b) => b.score - a.score);
  }

  // --- DICTIONARY MODE PERFORMANCE OPTIMIZATION ---
  // PRE-COMPUTE a flat word forms lookup Map ONCE per search! O(W) where W is number of word forms.
  // This eliminates the catastrophic N^2 nested filtration inside the .map(entry) loop.
  const wordFormsLookupMap = new Map<string, any[]>();
  if (searchScope !== 'sentences' && activeScopes.otherForms) {
      Object.values(importedData).forEach((pkgData: any) => {
          if (pkgData?.word_forms) {
              pkgData.word_forms.forEach((f: any) => {
                  if (f.word_index != null) {
                      const idStr = String(f.word_index);
                      let arr = wordFormsLookupMap.get(idStr);
                      if (!arr) {
                          arr = [];
                          wordFormsLookupMap.set(idStr, arr);
                      }
                      arr.push(f);
                  }
              });
          }
      });
  }

  // DICTIONARY MODE LOOP: O(N) where N is number of base entries.
  return allData.map(entry => {
    let score = 0;

    if (posFilter !== "All") {
      if (entry.PoS !== posFilter) return { ...entry, score: 0 };
    }

    const fieldsToSearch: string[] = [];
    const isPersonal = customDictionaries && customDictionaries[entry.Source];

    if (activeScopes.main) {
      if (activeLangs.translit && entry.Entry) fieldsToSearch.push(entry.Entry);
      if (activeLangs.syllabary && entry.Syllabary) fieldsToSearch.push(entry.Syllabary);
      if (activeLangs.english && entry.Definition) fieldsToSearch.push(entry.Definition);
      if (activeLangs.tone && entry.Entry_Tone) fieldsToSearch.push(entry.Entry_Tone);
    }

    // OTHER FORMS SEARCH (Replaces Verbs/Plurals)
    if (activeScopes.otherForms) {
        // 1. Check Legacy Other_Forms
        if (entry.Other_Forms) {
          const forms = entry.Other_Forms.split('|');
          forms.forEach((form: string) => {
            const parts = form.split(':');
            if (parts.length > 1) {
              const values = parts[1].split('^');
              if (activeLangs.translit && values[0]) fieldsToSearch.push(values[0]);
              if (activeLangs.syllabary && values[1]) fieldsToSearch.push(values[1]);
              if (activeLangs.tone && values[2]) fieldsToSearch.push(values[2]);
            }
          });
        }
        
        // 2. Check New Imported word_forms using our optimized map lookup! O(1) vs previous O(W).
        const id1 = entry.id != null ? String(entry.id) : null;
        const id2 = entry.Index != null ? String(entry.Index) : null;

        const extractMatchedForms = (idStr: string | null) => {
            if (!idStr) return;
            const entryForms = wordFormsLookupMap.get(idStr);
            if (entryForms) {
                entryForms.forEach((f: any) => {
                    if (activeLangs.translit && f.translit) fieldsToSearch.push(f.translit);
                    if (activeLangs.syllabary && f.syllabary) fieldsToSearch.push(f.syllabary);
                    if (activeLangs.tone && f.tone) fieldsToSearch.push(f.tone);
                });
            }
        };

        extractMatchedForms(id1);
        if (id2 && id2 !== id1) {
            extractMatchedForms(id2);
        }
    }

    if (activeScopes.notes) {
      const note = isPersonal ? entry.Notes : userNotes[entry.Index];
      if (note) fieldsToSearch.push(note);
    }

    if (settings?.enableRegex && regex) {
      if (fieldsToSearch.some(f => f && regex.test(f))) score = 100;
    } else {
      for (const field of fieldsToSearch) {
        if (!field) continue;
        const fLower = field.toLowerCase();
        
        let currentScore = 0;
        if (fLower === lowerQuery || fLower === queryWithTones) {
            currentScore = 100;
        } else if (fLower.startsWith(lowerQuery) || fLower.startsWith(queryWithTones)) {
            currentScore = 50;
        } else if (fLower.includes(lowerQuery) || fLower.includes(queryWithTones)) {
            currentScore = 25;
        }

        if (currentScore > 0) {
            // Boost shorter matches based on how much of the field matches the query
            // This grants up to 40 bonus points, keeping it below the +60 priority source boost
            const ratio = lowerQuery.length / field.length;
            currentScore += (ratio * 40);
            
            if (currentScore > score) {
                score = currentScore;
            }
        }
      }
    }

    if (score > 0) {
      const entryId = parseInt(entry.Index || entry.id || "0");

      if (customDictionaries[entry.Source]) score += 60;
      else if (entryId >= 100000) score += 60;
      if (entry.Source && prioritizedSources.includes(entry.Source.toLowerCase())) score += 60;

      // Gold standard sources boost
      if (entry.sources) {
          if (entry.sources['cn-app-dictionary.csv']) score += 60;
          if (entry.sources['hierarchical-dict.json']) score += 60;
      }

      if (entry.PoS && entry.PoS.toLowerCase().startsWith('v')) score += 30;
    }
    return { ...entry, score };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
};