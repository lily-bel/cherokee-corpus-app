import React from 'react';

export const parseCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  const headers = lines[0].split(',').map(h => h.trim());
  const parseLine = (line) => {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += char; }
    }
    result.push(current); return result;
  };
  return lines.slice(1).map(line => {
    const values = parseLine(line); const entry = {};
    headers.forEach((header, index) => {
      let val = values[index] ? values[index].trim() : '';
      if (val.startsWith('"') && val.endsWith('"')) { val = val.slice(1, -1); }
      entry[header] = val;
    });
    return entry;
  });
};

export const renderStyledText = (text) => {
  if (!text) return null;
  const parts = text.split('*');
  if (parts.length % 2 === 0) { return text.replace(/\*/g, ''); }
  return parts.map((part, i) => i % 2 === 1 ? <span key={i} className="font-bold text-slate-900 dark:text-slate-200">{part}</span> : part);
};

export const formatToneInput = (value) => {
  const map = { '1': '¹', '2': '²', '3': '³', '4': '⁴', '?': 'ʔ' };
  return value.replace(/[1234?]/g, m => map[m]);
};

export const downloadFile = (content, filename, type) => {
  // Add BOM to content if type is CSV, else raw content
  const finalContent = type === 'text/csv' ? new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode(content)]) : content;
  const blob = new Blob([finalContent], { type: type + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

export const exportNotebookToCSV = (notebookId, name, words) => {
  const nbWords = words.filter(w => w.notebookId === notebookId);
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

export const importNotebookFromCSV = (file, callback) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result as string;
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
      alert("Import Failed: " + err.message);
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

export const saveToDB = async (data) => {
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

export const saveAudioToDB = async (id, blob) => {
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

export const getAudioFromDB = async (id) => {
  const db = await initDB() as IDBDatabase;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(AUDIO_STORE_NAME, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const deleteAudioFromDB = async (id) => {
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
export const performSearch = (query, allData, sentences, entryToSentencesMap, settings, notebooks, userNotes, posFilter, searchScope) => {
  if (!query) return [];
  const lowerQuery = query.toLowerCase().trim();
  const queryWithTones = lowerQuery.replace(/[1234?]/g, m => ({ '1': '¹', '2': '²', '3': '³', '4': '⁴', '?': 'ʔ' }[m] || m));
  const { searchLangs, searchScopes } = settings;

  let regex: RegExp | null = null;
  if (settings.enableRegex) {
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
      if (searchLangs.translit) fields.push(s.translit);
      if (searchLangs.syllabary) fields.push(s.syllabary);
      if (searchLangs.english) fields.push(s.english);

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

  // DICTIONARY MODE
  return allData.map(entry => {
    let score = 0;

    if (posFilter !== "All") {
      if (entry.PoS !== posFilter) return { ...entry, score: 0 };
    }

    const fieldsToSearch: string[] = [];
    const isPersonal = notebooks && notebooks[entry.Source];

    if (searchScopes.main) {
      if (searchLangs.translit && entry.Entry) fieldsToSearch.push(entry.Entry);
      if (searchLangs.syllabary && entry.Syllabary) fieldsToSearch.push(entry.Syllabary);
      if (searchLangs.english && entry.Definition) fieldsToSearch.push(entry.Definition);
      if (searchLangs.tone && entry.Entry_Tone) fieldsToSearch.push(entry.Entry_Tone);
    }
    if (searchScopes.verbs) {
      const verbCols = ['Verb_1st_Present', 'Verb_3rd_Past', 'Verb_3rd_Present_Habitual', 'Verb_2nd_Imperative', 'Verb_3rd_Infinitive'];
      verbCols.forEach(col => {
        if (searchLangs.translit && entry[col]) fieldsToSearch.push(entry[col]);
        if (searchLangs.syllabary && entry[col + '_Syllabary']) fieldsToSearch.push(entry[col + '_Syllabary']);
        if (searchLangs.tone && entry[col + '_Tone']) fieldsToSearch.push(entry[col + '_Tone']);
      });
    }
    if (searchScopes.plurals) {
      if (searchLangs.translit && entry.Plural) fieldsToSearch.push(entry.Plural);
      if (searchLangs.syllabary && entry.Plural_Syllabary) fieldsToSearch.push(entry.Plural_Syllabary);
      if (searchLangs.tone && entry.Plural_Tone) fieldsToSearch.push(entry.Plural_Tone);
    }
    if (searchScopes.notes) {
      const note = isPersonal ? entry.Notes : userNotes[entry.Index];
      if (note) fieldsToSearch.push(note);
    }

    if (settings.enableRegex && regex) {
      if (fieldsToSearch.some(f => f && regex.test(f))) score = 100;
    } else {
      for (const field of fieldsToSearch) {
        if (!field) continue;
        const fLower = field.toLowerCase();
        if (fLower === lowerQuery || fLower === queryWithTones) { score = 100; break; }
        if (fLower.startsWith(lowerQuery) || fLower.startsWith(queryWithTones)) score = Math.max(score, 50);
        else if (fLower.includes(lowerQuery) || fLower.includes(queryWithTones)) score = Math.max(score, 25);
      }
    }

    if (score > 0) {
      if (entry.Source === 'ced') score += 5;
      if (notebooks[entry.Source]) score += 10;
      if (entry.PoS && entry.PoS.toLowerCase().includes('v')) score += 1;
    }
    return { ...entry, score };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
};