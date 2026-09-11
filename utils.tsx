import React, { useContext } from 'react';
import { CorpusContext, type SurfaceSegment } from './components/CorpusContext';

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

export const parseListName = (fullName: string): { folder: string | null; name: string } => {
  if (!fullName) return { folder: null, name: '' };
  const parts = fullName.split('|');
  if (parts.length > 1) {
    const folder = parts[0].trim();
    const name = parts.slice(1).join('|').trim();
    return { folder: folder || null, name: name || fullName };
  }
  return { folder: null, name: fullName };
};

export const formatListName = (folder: string | null | undefined, name: string): string => {
  const cleanFolder = folder ? folder.replace(/\|/g, '').trim() : '';
  const cleanName = name.replace(/\|/g, '').trim();
  return cleanFolder ? `${cleanFolder}|${cleanName}` : cleanName;
};

export const sanitizeListName = (input: string): string => {
  return input.replace(/\|/g, '').trim();
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

export const getFriendlyLabel = (key: string, showObject = false, hasAnimateContrast = false) => {
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
            let objStr = OBJ_MAP[parts[1]] || parts[1];
            if (hasAnimateContrast) {
                if (parts[1] === '3s') objStr = 'inanimate';
                else if (parts[1] === '3p') objStr = 'inanimate plural';
            }
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
        let hasAnimateContrast = false;
        if (parts.length >= 3 && parts[0] !== 'noun') {
            const subjTense = `${parts[0]}|${parts[2]}`;
            const objects = subjectTenseMap.get(subjTense);
            if (objects && objects.size > 1 && parts[1] && parts[1] !== 'none') {
                showObject = true;
                if (objects.has('3a') || objects.has('3pa')) {
                    hasAnimateContrast = true;
                }
            }
        }
        
        return { ...f, displayLabel: getFriendlyLabel(key, showObject, hasAnimateContrast) };
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
const PACKAGE_STORE_NAME = 'packages_data';
const CSV_KEY = 'dictionary_csv';

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE_NAME)) {
        db.createObjectStore(AUDIO_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
        db.createObjectStore(PACKAGE_STORE_NAME);
      }
    };
    request.onsuccess = (event: any) => resolve(event.target.result);
    request.onerror = (event: any) => reject(event.target.error);
  });
};

export const savePackageToDB = async (pkg: any, data: any): Promise<boolean> => {
  try {
    const db = await initDB() as IDBDatabase;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PACKAGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(PACKAGE_STORE_NAME);
      const request = store.put({ pkg, data }, pkg.id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e: any) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to save package to IndexedDB', e);
    return false;
  }
};

export const getAllPackagesFromDB = async (): Promise<{ pkg: any, data: any }[]> => {
  try {
    const db = await initDB() as IDBDatabase;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PACKAGE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(PACKAGE_STORE_NAME);
      const request = store.getAll();
      request.onsuccess = (event: any) => resolve(event.target.result || []);
      request.onerror = (event: any) => reject(event.target.error);
    });
  } catch (e) {
    console.error('Failed to get packages from IndexedDB', e);
    return [];
  }
};

export const deletePackageFromDB = async (pkgId: string): Promise<boolean> => {
  try {
    const db = await initDB() as IDBDatabase;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(PACKAGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(PACKAGE_STORE_NAME);
      const request = store.delete(pkgId);
      request.onsuccess = () => resolve(true);
      request.onerror = (e: any) => reject(e.target.error);
    });
  } catch (e) {
    console.error('Failed to delete package from IndexedDB', e);
    return false;
  }
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

// Helper to normalize strings for robust matching (ignores tone numbers, glottal stops, apostrophes, colons, accents, spaces, punctuation)
export const cleanStr = (s?: string) => {
  if (!s) return '';
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[1234¹²³⁴ʔ’'ʼ\s\-:_.,!?;:"()\[\]]/g, '');
};

// --- SEARCH ALGORITHM ---
export const performSearch = (query: string, allData: any[], sentences: any[], entryToSentencesMap: Map<string, string[]>, settings: any, customDictionaries: any, userNotes: any, posFilter: string, searchScope: string, prioritizedSources: string[] = [], rootMap: Map<string, any> = new Map(), wordFormsLookupMap: Map<string, any[]> = new Map()) => {
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
      sentences: !!searchScopes.sentences,
      roots: !!searchScopes.roots
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
      const linkedSentences = Array.from(new Set([
        ...(entryToSentencesMap.get(entry.id) || []),
        ...(entryToSentencesMap.get(entry.Index) || []),
        ...(entryToSentencesMap.get((entry as any).merged_id) || []),
        ...((entry as any).sources?.['lily-dict.csv']?.Index ? (entryToSentencesMap.get((entry as any).sources['lily-dict.csv'].Index) || []) : [])
      ]));
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

  const normQuery = cleanStr(query);

  // --- DICTIONARY MODE LOOP: O(N) where N is number of base entries. ---
  const sortedResults = allData.map(entry => {
    let score = 0;
    let matchedForm: { syllabary?: string; translit?: string; label?: string } | null = null;
    let mainMatchScore = 0;
    let otherFormMatchScore = 0;
    const isPersonal = customDictionaries && customDictionaries[entry.Source];

    if (posFilter !== "All") {
      if (entry.PoS !== posFilter) return { ...entry, score: 0 };
    }

    const testMatchScore = (str?: string) => {
      if (!str) return 0;
      if (regex && regex.test(str)) return 100;
      
      const fLower = str.toLowerCase();
      const normF = cleanStr(str);
      let s = 0;

      // 1. Exact Match (Exact case or normalized tone/punctuation match)
      if (fLower === lowerQuery || fLower === queryWithTones || (normF.length > 0 && normF === normQuery)) {
        s = 120;
      }
      // 2. Starts With Match
      else if (fLower.startsWith(lowerQuery) || fLower.startsWith(queryWithTones) || (normF.length > 0 && normF.startsWith(normQuery))) {
        s = 70;
      }
      // 3. Contains Substring Match
      else if (fLower.includes(lowerQuery) || fLower.includes(queryWithTones) || (normF.length > 0 && normF.includes(normQuery))) {
        s = 15;
      }

      if (s > 0) {
        // Boost shorter matching strings (ratio of query length to target string length)
        const targetLen = Math.max(str.length, normF.length || 1);
        const queryLen = Math.max(lowerQuery.length, normQuery.length || 1);
        const ratio = Math.min(1.0, queryLen / targetLen);
        s += (ratio * 35);
      }
      return s;
    };

    // 1. Check Main Entry Fields
    if (activeScopes.main) {
      if (activeLangs.translit) {
        if (entry.Entry) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.Entry));
        if (entry.translit) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.translit));
        if (entry.surface_spelling) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.surface_spelling));
        if (entry.practical) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.practical));
        if (entry.surface_forms) {
          for (const val of Object.values(entry.surface_forms)) {
            if (typeof val === 'string') mainMatchScore = Math.max(mainMatchScore, testMatchScore(val));
          }
        }
        if (entry.sources) {
          for (const s of Object.values(entry.sources as Record<string, any>)) {
            if (s.Practical) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Practical));
            if (s.Entry) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Entry));
            if (s.Cherokee) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Cherokee));
            if (s.practical) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.practical));
            if (s.surface_spelling) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.surface_spelling));
            if (s.Simple_phonetics) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Simple_phonetics));
          }
        }
      }
      if (activeLangs.syllabary) {
        if (entry.Syllabary) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.Syllabary));
        if (entry.syllabary) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.syllabary));
        if (entry.sources) {
          for (const s of Object.values(entry.sources as Record<string, any>)) {
            if (s.Syllabary) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Syllabary));
            if (s.Headword) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Headword));
          }
        }
      }
      if (activeLangs.english) {
        if (entry.Definition) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.Definition));
        if (entry.definition) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.definition));
        if (entry.Definition_Long) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.Definition_Long));
        if (entry.sources) {
          for (const s of Object.values(entry.sources as Record<string, any>)) {
            if (s.Translations) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Translations));
            if (s.Definition) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Definition));
            if (s.English) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.English));
            if (s['English gloss 1']) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s['English gloss 1']));
            if (s['English gloss 2']) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s['English gloss 2']));
          }
        }
      }
      if (activeLangs.tone) {
        if (entry.Entry_Tone) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.Entry_Tone));
        if (entry.tone) mainMatchScore = Math.max(mainMatchScore, testMatchScore(entry.tone));
        if (entry.sources) {
          for (const s of Object.values(entry.sources as Record<string, any>)) {
            if (s['Tone and length 1']) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s['Tone and length 1']));
            if (s['Tone and length 2']) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s['Tone and length 2']));
            if (s.Entry_Tone) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Entry_Tone));
            if (s.Tone) mainMatchScore = Math.max(mainMatchScore, testMatchScore(s.Tone));
          }
        }
      }
    }

    // 2. Check Other Forms (Inflections / Conjugations)
    if (activeScopes.otherForms) {
      // Legacy Other_Forms
      if (entry.Other_Forms) {
        const forms = entry.Other_Forms.split('|');
        forms.forEach((form: string) => {
          const parts = form.split(':');
          if (parts.length > 1) {
            const label = parts[0];
            const values = parts[1].split('^');
            const translit = values[0];
            const syllabary = values[1];
            const tone = values[2];

            let fScore = 0;
            if (activeLangs.translit && translit) fScore = Math.max(fScore, testMatchScore(translit));
            if (activeLangs.syllabary && syllabary) fScore = Math.max(fScore, testMatchScore(syllabary));
            if (activeLangs.tone && tone) fScore = Math.max(fScore, testMatchScore(tone));

            if (fScore > otherFormMatchScore) {
              otherFormMatchScore = fScore;
              matchedForm = { translit, syllabary, label };
            }
          }
        });
      }

      // Imported word_forms
      const idSet = new Set<string>();
      if (entry.id != null) idSet.add(String(entry.id));
      if (entry.Index != null) idSet.add(String(entry.Index));
      if ((entry as any).merged_id != null) idSet.add(String((entry as any).merged_id));
      if ((entry as any).sources?.['lily-dict.csv']?.Index != null) idSet.add(String((entry as any).sources['lily-dict.csv'].Index));

      const extractMatchedForms = (idStr: string | null) => {
        if (!idStr) return;
        const entryForms = wordFormsLookupMap.get(idStr);
        if (entryForms) {
          entryForms.forEach((f: any) => {
            let fScore = 0;
            if (activeLangs.translit) {
              if (f.translit) fScore = Math.max(fScore, testMatchScore(f.translit));
              if (f.surface_spelling) fScore = Math.max(fScore, testMatchScore(f.surface_spelling));
              if (f.segmented_form) fScore = Math.max(fScore, testMatchScore(f.segmented_form.replace(/[-–—>]/g, '')));
            }
            if (activeLangs.syllabary && f.syllabary) fScore = Math.max(fScore, testMatchScore(f.syllabary));
            if (activeLangs.tone) {
              if (f.tone) fScore = Math.max(fScore, testMatchScore(f.tone));
              if (f.tone1) fScore = Math.max(fScore, testMatchScore(f.tone1));
              if (f.tone2) fScore = Math.max(fScore, testMatchScore(f.tone2));
            }

            if (fScore > otherFormMatchScore) {
              otherFormMatchScore = fScore;
              matchedForm = { translit: f.surface_spelling || f.translit, syllabary: f.syllabary, label: f.form_name || f.label || f.name };
            }
          });
        }
      };

      idSet.forEach(idStr => extractMatchedForms(idStr));
    }

    // 3. Notes & Roots
    let notesScore = 0;
    if (activeScopes.notes) {
      const note = isPersonal ? entry.Notes : userNotes[entry.Index];
      if (note) notesScore = Math.max(notesScore, testMatchScore(note));
    }

    let rootScore = 0;
    if (activeScopes.roots) {
      const id = entry.id || entry.Index || entry.merged_id;
      const rootEntry = rootMap.get(id);
      if (rootEntry) {
        if (activeLangs.translit) {
          if (isEmptyRoot(rootEntry)) {
            rootScore = Math.max(rootScore, testMatchScore('∅'));
          }
          if (rootEntry.root_h) rootScore = Math.max(rootScore, testMatchScore(rootEntry.root_h));
          if (rootEntry.root_g) rootScore = Math.max(rootScore, testMatchScore(rootEntry.root_g));
          if (rootEntry.root_slug) rootScore = Math.max(rootScore, testMatchScore(rootEntry.root_slug));
          if (rootEntry.slug && rootEntry.slug !== rootEntry.root_slug) rootScore = Math.max(rootScore, testMatchScore(rootEntry.slug));
        }
        if (activeLangs.english && rootEntry.definition) {
          rootScore = Math.max(rootScore, testMatchScore(rootEntry.definition));
        }
      }
    }

    const getMatchTier = (s: number) => {
      if (s >= 120) return 3; // Exact match tier
      if (s >= 70) return 2;  // Starts with tier
      if (s >= 15) return 1;  // Contains tier
      return 0;
    };

    const mainTier = getMatchTier(mainMatchScore);
    const otherFormTier = getMatchTier(otherFormMatchScore);

    // Assume user is typing base form if base form matches within same or higher priority segment tier
    const baseFormHasPriority = mainTier > 0 && mainTier >= otherFormTier;

    if (baseFormHasPriority) {
      score = Math.max(mainMatchScore, notesScore, rootScore);
    } else {
      score = Math.max(mainMatchScore, otherFormMatchScore, notesScore, rootScore);
    }

    let activeMatchedForm: { syllabary?: string; translit?: string; label?: string } | null = null;
    if (!baseFormHasPriority && otherFormMatchScore > 0) {
      const mf: any = matchedForm;
      if (mf) {
        const matchedT = mf.translit;
        const matchedS = mf.syllabary;
        const isIdenticalToMain = 
          (matchedT && (
            (entry.Entry && cleanStr(matchedT) === cleanStr(entry.Entry)) ||
            (entry.surface_spelling && cleanStr(matchedT) === cleanStr(entry.surface_spelling)) ||
            (entry.translit && cleanStr(matchedT) === cleanStr(entry.translit))
          )) ||
          (matchedS && (
            (entry.Syllabary && cleanStr(matchedS) === cleanStr(entry.Syllabary)) ||
            (entry.syllabary && cleanStr(matchedS) === cleanStr(entry.syllabary))
          ));
        if (!isIdenticalToMain) {
          activeMatchedForm = mf;
        }
      }
    }

    if (score > 0) {
      const entryId = parseInt(entry.Index || entry.id || "0");
      const srcLower = (entry.Source || entry.source || "").toLowerCase();

      // Priority CED Source boost
      if (srcLower === 'ced' || srcLower.includes('durbin feeling') || srcLower.includes('cherokee nation')) {
        score += 80;
      }

      if (customDictionaries[entry.Source]) score += 60;
      else if (entryId >= 100000) score += 60;
      if (entry.Source && prioritizedSources.includes(entry.Source.toLowerCase())) score += 60;

      // Gold standard sources boost
      if (entry.sources) {
        if (entry.sources['cn-app-dictionary.csv']) score += 60;
        if (entry.sources['hierarchical-dict.json']) score += 60;
      }

      if (entry.PoS && entry.PoS.toLowerCase().startsWith('v')) score += 30;

      // Primary length tie-breaker: shorter entry strings rank higher within same score tier
      const primaryLength = entry.Entry?.length || entry.Syllabary?.length || 0;
      score -= primaryLength * 0.001;
    }
    return { ...entry, score, matchedForm: activeMatchedForm };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) > 0.05) {
        return scoreDiff;
      }
      // Tie-breaker: sort by shorter word length first
      const lenA = a.Entry?.length || a.Syllabary?.length || 999;
      const lenB = b.Entry?.length || b.Syllabary?.length || 999;
      return lenA - lenB;
    });

  // Task 2.3: Deduplicate cards sharing identical surface strings and definition targets
  const deduplicatedResults: any[] = [];
  const seenKeys = new Set<string>();

  for (const item of sortedResults) {
    const dispSyllabary = cleanStr(item.matchedForm?.syllabary || item.Syllabary);
    const dispTranslit = cleanStr(item.matchedForm?.translit || item.Entry);
    const dispDef = cleanStr(item.Definition);

    // If all surface fields are blank, don't deduplicate
    if (!dispSyllabary && !dispTranslit && !dispDef) {
      deduplicatedResults.push(item);
      continue;
    }

    const key = `${dispSyllabary}|${dispTranslit}|${dispDef}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduplicatedResults.push(item);
    }
  }

  return deduplicatedResults;
};

// --- TRANSLITERATION & SYLLABARY CONVERSION UTILITIES ---

export type TransliterationStyle = 'classic' | 'aspiration' | 'reverse_aspiration';

export const SYLLABARY_MAP: [string, string][] = [
    ["hna", "Ꮏ"], ["nah", "Ꮐ"], ["qua", "Ꮖ"], ["que", "Ꮗ"], ["qui", "Ꮘ"],
    ["quo", "Ꮙ"], ["quu", "Ꮚ"], ["quv", "Ꮛ"], ["dla", "Ꮬ"], ["tla", "Ꮭ"],
    ["tle", "Ꮮ"], ["tli", "Ꮯ"], ["tlo", "Ꮰ"], ["tlu", "Ꮱ"], ["tlv", "Ꮲ"],
    ["tsa", "Ꮳ"], ["tse", "Ꮴ"], ["tsi", "Ꮵ"], ["tso", "Ꮶ"], ["tsu", "Ꮷ"],
    ["tsv", "Ꮸ"],
    
    ["ga", "Ꭶ"], ["ka", "Ꭷ"], ["ge", "Ꭸ"], ["gi", "Ꭹ"], ["go", "Ꭺ"],
    ["gu", "Ꭻ"], ["gv", "Ꭼ"], ["ha", "Ꭽ"], ["he", "Ꭾ"], ["hi", "Ꭿ"],
    ["ho", "Ꮀ"], ["hu", "Ꮁ"], ["hv", "Ꮂ"], ["la", "Ꮃ"], ["le", "Ꮄ"],
    ["li", "Ꮅ"], ["lo", "Ꮆ"], ["lu", "Ꮇ"], ["lv", "Ꮈ"], ["ma", "Ꮉ"],
    ["me", "Ꮊ"], ["mi", "Ꮋ"], ["mo", "Ꮌ"], ["mu", "Ꮍ"], ["mv", "Ᏽ"],
    ["na", "Ꮎ"], ["ne", "Ꮑ"], ["ni", "Ꮒ"], ["no", "Ꮓ"], ["nu", "Ꮔ"],
    ["nv", "Ꮕ"], ["sa", "Ꮜ"], ["se", "Ꮞ"], ["si", "Ꮟ"], ["so", "Ꮠ"],
    ["su", "Ꮡ"], ["sv", "Ꮢ"], ["da", "Ꮣ"], ["ta", "Ꮤ"], ["de", "Ꮥ"],
    ["te", "Ꮦ"], ["di", "Ꮧ"], ["ti", "Ꮨ"], ["do", "Ꮩ"], ["du", "Ꮪ"],
    ["dv", "Ꮫ"], ["wa", "Ꮹ"], ["we", "Ꮺ"], ["wi", "Ꮻ"], ["wo", "Ꮼ"],
    ["wu", "Ꮽ"], ["wv", "Ꮾ"], ["ya", "Ꮿ"], ["ye", "Ᏸ"], ["yi", "Ᏹ"],
    ["yo", "Ᏺ"], ["yu", "Ᏻ"], ["yv", "Ᏼ"],
    
    ["a", "Ꭰ"], ["e", "Ꭱ"], ["i", "Ꭲ"], ["o", "Ꭳ"], ["u", "Ꭴ"],
    ["v", "Ꭵ"], ["s", "Ꮝ"],

    ["dle", "Ꮮ"], ["dli", "Ꮯ"], ["dlo", "Ꮰ"], ["dlu", "Ꮱ"], ["dlv", "Ꮲ"],
    ["kwa", "Ꮖ"], ["kwe", "Ꮗ"], ["kwi", "Ꮘ"], ["kwo", "Ꮙ"], ["kwu", "Ꮚ"], ["kwv", "Ꮛ"],
    ["gwa", "Ꮖ"], ["gwe", "Ꮗ"], ["gwi", "Ꮘ"], ["gwo", "Ꮙ"], ["gwu", "Ꮚ"], ["gwv", "Ꮛ"],
    ["hla", "Ꮭ"], ["hle", "Ꮮ"], ["hli", "Ꮯ"], ["hlo", "Ꮰ"], ["hlu", "Ꮱ"], ["hlv", "Ꮲ"],
    ["ke", "Ꭸ"], ["ki", "Ꭹ"], ["ko", "Ꭺ"], ["ku", "Ꭻ"], ["kv", "Ꭼ"],
    ["to", "Ꮩ"], ["tu", "Ꮪ"], ["tv", "Ꮫ"],
    ["ja", "Ꭸ"], ["je", "Ꭹ"], ["ji", "Ꭺ"], ["jo", "Ꭻ"], ["ju", "Ꭼ"], ["jv", "Ꭼ"]
];

export const REVERSE_SYLLABARY_MAP: Record<string, string> = (() => {
    const map: Record<string, string> = {};
    SYLLABARY_MAP.forEach(([latin, syllabary]) => {
        if (!map[syllabary]) {
            map[syllabary] = latin;
        }
    });
    return map;
})();

export function applyAspirationMode(text: string): string {
    let s = text;
    s = s.replace(/t(?!s)/g, "th");

    const rules: [string, string][] = [
        ["d", "t"], ["k", "kh"], ["g", "k"], ["j", "ts"],
        ["ch", "tsh"], ["hn", "nh"], ["hl", "lh"], ["hy", "yh"],
        ["hw", "wh"], ["?", "'"], ["’", "'"], ["qu", "kw"]
    ];

    rules.forEach(([oldChar, newChar]) => {
        s = s.split(oldChar).join(newChar);
    });

    s = s.replace(/sl(?=[aeiouv])/g, "slh");
    s = s.replace(/([^ht])s/g, "$1hs");
    return s;
}

export function applyReverseAspirationMode(text: string): string {
    let s = applyAspirationMode(text);

    const rules: [string, string][] = [
        ["kw", "gw"],
        ["ts", "j"], ["k", "g"], ["t", "d"]
    ];

    rules.forEach(([oldChar, newChar]) => {
        s = s.split(oldChar).join(newChar);
    });

    return s;
}

export function reverseAspirationToClassic(text: string): string {
    let s = text;

    s = s.replace(/hs/g, "s");
    s = s.replace(/slh/g, "sl");

    const rules: [string, string][] = [
        ["kw", "qu"],
        ["wh", "hw"], ["yh", "hy"], ["lh", "hl"], ["nh", "hn"],
        ["tsh", "ch"], ["ts", "j"], ["'", "?"]
    ];
    rules.forEach(([oldChar, newChar]) => {
        s = s.split(oldChar).join(newChar);
    });

    s = s.replace(/t(?!h)/g, "d");
    s = s.replace(/th/g, "t");

    s = s.replace(/k(?!h)/g, "g");
    s = s.replace(/kh/g, "k");

    return s;
}

export function reverseReverseAspirationToClassic(text: string): string {
    let s = text;

    const rules: [string, string][] = [
        ["gw", "kw"],
        ["j", "ts"], ["g", "k"], ["d", "t"]
    ];
    rules.forEach(([oldChar, newChar]) => {
        s = s.split(oldChar).join(newChar);
    });

    return reverseAspirationToClassic(s);
}

export function normalizeTransliterationToClassic(text: string, style: TransliterationStyle): string {
    if (!text) return '';
    let classic = text.toLowerCase();
    if (style === 'aspiration') {
        classic = reverseAspirationToClassic(classic);
    } else if (style === 'reverse_aspiration') {
        classic = reverseReverseAspirationToClassic(classic);
    }
    return classic;
}

export function convertTransliterationStyle(text: string, fromStyle: TransliterationStyle, toStyle: TransliterationStyle): string {
    if (!text || fromStyle === toStyle) return text;
    const classic = normalizeTransliterationToClassic(text, fromStyle);
    if (toStyle === 'aspiration') {
        return applyAspirationMode(classic);
    } else if (toStyle === 'reverse_aspiration') {
        return applyReverseAspirationMode(classic);
    }
    return classic;
}

export function transliterateToSyllabary(inputText: string, style: TransliterationStyle = 'classic'): string {
    if (!inputText) return '';

    let classicText = normalizeTransliterationToClassic(inputText, style);

    let result = "";
    let i = 0;

    while (i < classicText.length) {
        let matched = false;

        for (let j = 0; j < SYLLABARY_MAP.length; j++) {
            const [latinKey, syllabaryChar] = SYLLABARY_MAP[j];
            
            if (classicText.startsWith(latinKey, i)) {
                result += syllabaryChar;
                i += latinKey.length;
                matched = true;
                break;
            }
        }
        
        if (!matched) {
            result += classicText[i];
            i++;
        }
    }

    return result;
}

export function syllabaryToTransliteration(inputText: string, style: TransliterationStyle = 'classic'): string {
    if (!inputText) return '';
    let classicResult = "";
    for (let i = 0; i < inputText.length; i++) {
        let char = inputText[i];
        classicResult += REVERSE_SYLLABARY_MAP[char] || char;
    }

    if (style === 'aspiration') {
        return applyAspirationMode(classicResult);
    } else if (style === 'reverse_aspiration') {
        return applyReverseAspirationMode(classicResult);
    }
    return classicResult;
}

export interface EntryFormItem {
    label: string;
    translit: string;
    syllabary: string;
    tone?: string;
    notes?: string;
    type?: 'official' | 'imported' | 'custom' | 'base';
    color?: string;
}

export function buildWordFormsLookupMap(importedData: any = {}, userWordForms: Record<string, any> = {}): Map<string, any[]> {
    const map = new Map<string, any[]>();
    Object.values(importedData || {}).forEach((pkgData: any) => {
        if (pkgData?.word_forms) {
            pkgData.word_forms.forEach((f: any) => {
                if (f.word_index != null) {
                    const idStr = String(f.word_index);
                    let arr = map.get(idStr);
                    if (!arr) {
                        arr = [];
                        map.set(idStr, arr);
                    }
                    arr.push(f);
                }
            });
        }
    });
    if (userWordForms) {
        Object.entries(userWordForms).forEach(([wIdx, formsVal]) => {
            if (typeof formsVal === 'string') {
                formsVal.split('|').forEach((form: string) => {
                    const parts = form.split(':');
                    if (parts.length >= 2) {
                        const values = parts[1].split('^');
                        let arr = map.get(wIdx);
                        if (!arr) {
                            arr = [];
                            map.set(wIdx, arr);
                        }
                        arr.push({
                            word_index: wIdx,
                            form_name: parts[0],
                            translit: values[0] || '',
                            syllabary: values[1] || '',
                            tone: values[2] || '',
                            notes: values[3] || '',
                            color: 'amber'
                        });
                    }
                });
            } else if (Array.isArray(formsVal)) {
                let arr = map.get(wIdx);
                if (!arr) {
                    arr = [];
                    map.set(wIdx, arr);
                }
                arr.push(...formsVal);
            }
        });
    }
    return map;
}

export function getAllFormsForEntry(
    entry: any,
    wordFormsLookupMap?: Map<string, any[]>,
    userWordForms?: Record<string, any>,
    packages?: any[],
    importedData?: any
): EntryFormItem[] {
    if (!entry) return [];
    const forms: EntryFormItem[] = [];

    // 1. Official forms from Other_Forms string
    if (entry.Other_Forms) {
        entry.Other_Forms.split('|').forEach((form: string) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                forms.push({
                    type: 'official',
                    label: parts[0],
                    translit: values[0] || '',
                    syllabary: values[1] || '',
                    tone: values[2] || '',
                    notes: values[3] || '',
                    color: 'slate'
                });
            }
        });
    }

    // 2. Imported Forms from packages / wordFormsLookupMap
    const id = entry.id != null ? String(entry.id) : (entry.Index != null ? String(entry.Index) : null);
    if (id && wordFormsLookupMap) {
        const lookup = wordFormsLookupMap.get(id);
        if (lookup) {
            lookup.forEach((f: any) => {
                if (!forms.some(existing => existing.syllabary === f.syllabary && existing.translit === f.translit && existing.label === (f.form_name || f.label))) {
                    forms.push({
                        type: 'imported',
                        label: f.form_name || f.label || f.displayLabel || 'Form',
                        translit: f.translit || '',
                        syllabary: f.syllabary || '',
                        tone: f.tone || '',
                        notes: f.notes || '',
                        color: f.color || 'sky'
                    });
                }
            });
        }
    } else if (id && packages && importedData) {
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                const pForms = importedData[p.id].word_forms.filter((f: any) => String(f.word_index) === id);
                pForms.forEach((f: any) => {
                    if (!forms.some(existing => existing.syllabary === f.syllabary && existing.translit === f.translit && existing.label === f.form_name)) {
                        forms.push({
                            type: 'imported',
                            label: f.form_name || f.label || 'Form',
                            translit: f.translit || '',
                            syllabary: f.syllabary || '',
                            tone: f.tone || '',
                            notes: f.notes || '',
                            color: p.color
                        });
                    }
                });
            }
        });
    }

    // 3. Custom forms from userWordForms
    if (userWordForms && id && userWordForms[id] && typeof userWordForms[id] === 'string') {
        userWordForms[id].split('|').forEach((form: string) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                if (!forms.some(existing => existing.syllabary === values[1] && existing.translit === values[0] && existing.label === parts[0])) {
                    forms.push({
                        type: 'custom',
                        label: parts[0],
                        translit: values[0] || '',
                        syllabary: values[1] || '',
                        tone: values[2] || '',
                        notes: values[3] || '',
                        color: 'amber'
                    });
                }
            }
        });
    }

    // 4. Ensure base entry is included in the forms list if not already present
    const baseTranslit = (entry.translit || entry.Entry || '').trim();
    const baseSyllabary = (entry.syllabary || entry.Syllabary || '').trim();

    if (baseTranslit || baseSyllabary) {
        const alreadyHasBase = forms.some(f => 
            (f.syllabary && cleanStr(f.syllabary) === cleanStr(baseSyllabary)) ||
            (f.translit && cleanStr(f.translit) === cleanStr(baseTranslit))
        );
        if (!alreadyHasBase) {
            const isVerb = entry.PoS && entry.PoS.toLowerCase().startsWith('v');
            const defaultLabel = forms.length === 0 ? 'Base Form' : (isVerb ? 'Present 3sg' : 'Base Form');
            forms.unshift({
                type: 'base',
                label: defaultLabel,
                translit: baseTranslit,
                syllabary: baseSyllabary,
                tone: entry.tone || entry.Entry_Tone || '',
                notes: entry.notes || entry.Notes || '',
                color: 'slate'
            });
        }
    }

    // If only 1 form total, ensure its label is 'Base Form'
    if (forms.length === 1 && (!forms[0].label || forms[0].label === 'Form')) {
        forms[0].label = 'Base Form';
    }

    return forms;
}

// --- Cherokee Word Segmentation & Colorization Helpers ---

export const POST_ROOT_MORPHEME_SYMBOLS = new Set([
  'change-out',
  'change-out[flexible]',
  'change-alt',
  'leaving',
  'long',
  'long[no-a]',
  'hitting',
  'hitting[il]',
  'hitting[hil]',
  'iterative',
  'iterative[no-i]',
  'repetitive',
  'be-at',
  'spin',
  'hit-on',
  'hit-on[t]',
  'hit-on[no-t]',
  'become-long',
  'become-long[a]',
  'become-long[i]',
  'become-long[o]',
  'in'
]);

export interface PostRootMorphemeData {
  name: string;
  subcase: string | null;
  key: string;
  form: string;
  classes: string[];
}

export const POST_ROOT_MORPHEMES: PostRootMorphemeData[] = [
  { name: 'change-out', subcase: null, key: 'change-out', form: 'iy', classes: ['v-vhs'] },
  { name: 'change-out', subcase: 'flexible', key: 'change-out[flexible]', form: "a'iy", classes: ['v-vhs'] },
  { name: 'change-alt', subcase: null, key: 'change-alt', form: 'hs', classes: ['ih-vh[inf2]', 'ih-vh[imperf2-inf2]'] },
  { name: 'leaving', subcase: null, key: 'leaving', form: 'iy', classes: ['a'] },
  { name: 'long', subcase: null, key: 'long', form: 'at', classes: ['i-a-i'] },
  { name: 'long', subcase: 'no-a', key: 'long[no-a]', form: 't', classes: ['i-a-i'] },
  { name: 'hitting', subcase: 'il', key: 'hitting[il]', form: 'vn', classes: ['ih-il'] },
  { name: 'hitting', subcase: 'hil', key: 'hitting[hil]', form: 'vn', classes: ['hih-hil', 'hih-hil[imp2]'] },
  { name: 'iterative', subcase: null, key: 'iterative', form: 'ihs', classes: ['ih-ohd[perf2]'] },
  { name: 'iterative', subcase: 'no-i', key: 'iterative[no-i]', form: 'hs', classes: ['ih-ohd[perf2]'] },
  { name: 'repetitive', subcase: null, key: 'repetitive', form: 'il', classes: ['o'] },
  { name: 'be-at', subcase: null, key: 'be-at', form: 'it', classes: ['oh-ol-a'] },
  { name: 'spin', subcase: null, key: 'spin', form: 'tey', classes: ['oh-ol', 'oh-ol[inf2]', 'oh-ol[inf3]'] },
  { name: 'hit-on', subcase: 't', key: 'hit-on[t]', form: 'telu', classes: ['hvsg-hn'] },
  { name: 'hit-on', subcase: 'no-t', key: 'hit-on[no-t]', form: 'elu', classes: ['hvsg-hn'] },
  { name: 'become-long', subcase: 'a', key: 'become-long[a]', form: 'a', classes: ['g-ts[*]'] },
  { name: 'become-long', subcase: 'i', key: 'become-long[i]', form: 'i', classes: ['g-ts[*]'] },
  { name: 'become-long', subcase: 'o', key: 'become-long[o]', form: 'o', classes: ['g-ts[*]'] },
  { name: 'in', subcase: null, key: 'in', form: 'in', classes: ['eg-vs'] }
];

const POST_ROOT_MORPHEMES_MAP = new Map<string, PostRootMorphemeData>();
POST_ROOT_MORPHEMES.forEach(m => {
  POST_ROOT_MORPHEMES_MAP.set(m.key.toLowerCase(), m);
  if (!POST_ROOT_MORPHEMES_MAP.has(m.name.toLowerCase())) {
    POST_ROOT_MORPHEMES_MAP.set(m.name.toLowerCase(), m);
  }
});

export function getPostRootMorpheme(keyOrName: string): { form: string; name: string } | null {
  if (!keyOrName) return null;
  const clean = keyOrName.trim();
  const lower = clean.toLowerCase();
  const found = POST_ROOT_MORPHEMES_MAP.get(lower);
  if (found) {
    return { form: found.form, name: clean };
  }
  const baseName = lower.split('[')[0];
  const byBase = POST_ROOT_MORPHEMES_MAP.get(baseName);
  if (byBase) {
    return { form: byBase.form, name: clean };
  }
  return { form: '', name: clean };
}

export function unrespellConsonants(s: string): string {
  if (!s) return '';
  const trimmed = s.trim().toLowerCase();
  if (POST_ROOT_MORPHEME_SYMBOLS.has(trimmed)) {
    return s;
  }

  // Protect symbols occurring inside s
  const placeholders: { [ph: string]: string } = {};
  let processed = s;
  let phIndex = 0;
  const sortedSymbols = Array.from(POST_ROOT_MORPHEME_SYMBOLS).sort((a, b) => b.length - a.length);
  for (const sym of sortedSymbols) {
    const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![a-zA-Z])${escaped}(?![a-zA-Z])`, 'gi');
    if (regex.test(processed)) {
      processed = processed.replace(regex, (match) => {
        const ph = `__PRMSYM_${phIndex++}__`;
        placeholders[ph.toLowerCase()] = match;
        return ph;
      });
    }
  }

  processed = processed.toLowerCase();
  processed = processed.replace(/(^|[aeiouv])hs/g, '$1s');
  const rules: [string, string][] = [
    ['tsh', 'ch'], ['ts', 'j'], ['k', 'g'], ['gh', 'k'],
    ['t', 'd'], ['dh', 't'], ['nh', 'hn'], ['lh', 'hl'],
    ['yh', 'hy'], ['wh', 'hw'], ['slh', 'sl']
  ];
  for (const [oldStr, rep] of rules) {
    processed = processed.split(oldStr).join(rep);
  }

  for (const [ph, orig] of Object.entries(placeholders)) {
    processed = processed.split(ph).join(orig);
  }

  return processed;
}

export function preventGlottalCluster(s: string): string {
  return s ? s.replace(/([^aeiouv']+)'/g, "'$1") : '';
}

export interface SegmentGroup {
  role: number; // 0: root, 1: pronoun, 2: aspect, 3: prepronominal, 4: final, 5: post_root
  roleType: 'root' | 'pronoun' | 'aspect' | 'prepronominal' | 'final' | 'post_root';
  text: string;
}

export function segmentVerbForm(
  segForm: string | undefined,
  formName: string = 'present',
  config?: any,
  className?: string
): SegmentGroup[] | null {
  if (!segForm || segForm === '---') return null;
  const parts = segForm.split(/(->|-)/);
  const segments = parts.filter((_, i) => i % 2 === 0);

  let numPre = (config?.pre?.translocutive ? 1 : 0) + (config?.pre?.partitive ? 1 : 0) + (config?.pre?.distributive ? 1 : 0);
  if (formName === 'imperative' && config?.pre?.translocutiveImpOnly && !config?.pre?.translocutive) numPre++;

  // Defensive check: if prepronominal prefix exists in segments but not in config
  if (numPre === 0 && segments.length > 3 && /^(w|wi|te|de|ti|ni)$/i.test(segments[0])) {
    numPre = 1;
  }

  const pronounIdx = numPre;
  let aspectIdx: number | null = formName === 'imperative' ? segments.length - 1 : segments.length - 2;
  if (className === 'stative') aspectIdx = null;

  // Check if there is an empty root segment between pronoun and aspect
  let emptyRootIdx = -1;
  for (let i = pronounIdx + 1; i < (aspectIdx !== null ? aspectIdx : segments.length); i++) {
    if (segments[i] === '') {
      emptyRootIdx = i;
      break;
    }
  }

  const chars: { char: string; role: number; roleType: 'root' | 'pronoun' | 'aspect' | 'prepronominal' | 'final' | 'post_root' }[] = [];
  segments.forEach((seg, i) => {
    let role = 0;
    let roleType: 'root' | 'pronoun' | 'aspect' | 'prepronominal' | 'final' | 'post_root' = 'root';
    if (i < pronounIdx) { role = 3; roleType = 'prepronominal'; }
    else if (i === pronounIdx) { role = 1; roleType = 'pronoun'; }
    else if (aspectIdx !== null && i === aspectIdx) { role = 2; roleType = 'aspect'; }
    else if (aspectIdx !== null && i > aspectIdx) { role = 4; roleType = 'final'; }
    else if (emptyRootIdx !== -1) {
      if (i === emptyRootIdx) {
        role = 0;
        roleType = 'root';
      } else if (i > emptyRootIdx) {
        role = 5;
        roleType = 'post_root';
      }
    }
    for (const c of seg) chars.push({ char: c, role, roleType });
  });

  // Drop dropped phones
  let i = 0;
  while (i < chars.length) {
    if (chars[i].char === '>') {
      chars.splice(i, 2);
      continue;
    }
    i++;
  }
  i = 0;
  while (i < chars.length) {
    if (chars[i].char === '@') {
      chars.splice(i, 1);
      if (i > 0) { chars.splice(i - 1, 1); i--; }
      if (i > 0) { chars.splice(i - 1, 1); i--; }
      continue;
    }
    i++;
  }
  i = 0;
  while (i < chars.length) {
    if (chars[i].char === '*') {
      chars.splice(i, 1);
      if (i > 0) { chars.splice(i - 1, 1); i--; }
      continue;
    }
    i++;
  }
  i = 0;
  while (i < chars.length) {
    if (chars[i].char === ':') {
      chars.splice(i, 1);
      continue;
    }
    i++;
  }

  const groups: { role: number; roleType: 'root' | 'pronoun' | 'aspect' | 'prepronominal' | 'final' | 'post_root'; text: string }[] = [];
  chars.forEach(item => {
    if (groups.length > 0 && groups[groups.length - 1].role === item.role) {
      groups[groups.length - 1].text += item.char;
    } else {
      groups.push({ role: item.role, roleType: item.roleType, text: item.char });
    }
  });

  return groups.map(g => ({
    role: g.role,
    roleType: g.roleType,
    text: unrespellConsonants(preventGlottalCluster(g.text))
  }));
}

export function normalizeForMatch(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f:0-9\.\'\?]/g, '')
    .toLowerCase()
    .replace(/t/g, 'd')
    .replace(/k/g, 'g')
    .replace(/p/g, 'b')
    .replace(/ch/g, 'j')
    .replace(/ts/g, 'j')
    .replace(/hw|wh/g, 'w')
    .replace(/hl|lh/g, 'l')
    .replace(/hn|nh/g, 'n')
    .replace(/hy|yh/g, 'y');
}

export interface ColorChunk {
  role: number;
  roleType: 'root' | 'pronoun' | 'aspect' | 'prepronominal' | 'final' | 'post_root';
  text: string;
}

export function colorizeSurface(surface: string, groups: SegmentGroup[] | null): ColorChunk[] {
  if (!groups || groups.length === 0 || !surface) {
    return [{ role: 0, roleType: 'root', text: surface || '' }];
  }

  const normGroups = groups.map(g => normalizeForMatch(g.text));
  const cleanChar = (c: string) => normalizeForMatch(c);

  let groupIdx = 0;
  let charInGroup = 0;
  const result: ColorChunk[] = [];
  let curRole = groups[0].role;
  let curRoleType = groups[0].roleType;
  let curChunk = '';

  for (let i = 0; i < surface.length; i++) {
    const rawChar = surface[i];
    const c = cleanChar(rawChar);

    if (!c) {
      curChunk += rawChar;
      continue;
    }

    while (groupIdx < groups.length && charInGroup >= normGroups[groupIdx].length) {
      groupIdx++;
      charInGroup = 0;
    }

    if (groupIdx < groups.length) {
      const expected = normGroups[groupIdx][charInGroup];
      if (c === expected) {
        if (groups[groupIdx].role !== curRole) {
          if (curChunk) result.push({ role: curRole, roleType: curRoleType, text: curChunk });
          curRole = groups[groupIdx].role;
          curRoleType = groups[groupIdx].roleType;
          curChunk = '';
        }
        curChunk += rawChar;
        charInGroup++;
      } else {
        curChunk += rawChar;
      }
    } else {
      curChunk += rawChar;
    }
  }

  if (curChunk) result.push({ role: curRole, roleType: curRoleType, text: curChunk });
  return result;
}

export function getFormPronominalSet(key: string, verbConfig?: any): 'A' | 'B' | 'P2P' {
  if (!key) return (verbConfig?.pron?.set_type === 'b' || verbConfig?.pron?.set_type === 'B') ? 'B' : 'A';
  const k = key.toLowerCase();
  if (k.includes('3a') || k.includes('1s|2') || k.includes('2s|1') || k.includes('animate')) {
    return 'P2P';
  }
  if (k.includes('infinitive') || k.includes('past') || k.includes('perfective')) {
    return 'B';
  }
  if (verbConfig?.pron?.set_type === 'b' || verbConfig?.pron?.set_type === 'B') {
    return 'B';
  }
  return 'A';
}

export function deriveSegmentedForm(
  form: any,
  _allForms: any[] = [],
  rootEntry?: any
): string | undefined {
  if (form?.segmented_form) return form.segmented_form;
  if (!rootEntry || !rootEntry.segmented_forms) return undefined;

  const key = (form?.normalized_key || form?.form_name || form?.label || '').toLowerCase();
  if (key === '3s|3s|present' || key === '3s|present' || key.includes('3rd person singular present') || key === 'present') {
    return rootEntry.segmented_forms.present || undefined;
  }

  return undefined;
}

// Consonant equivalences in Cherokee for phonetic alignment
const equivMap = new Map([
  ['t', new Set(['d', 't'])],
  ['d', new Set(['t', 'd'])],
  ['k', new Set(['g', 'k'])],
  ['g', new Set(['k', 'g'])],
  ['p', new Set(['b', 'p'])],
  ['b', new Set(['p', 'b'])],
  ['j', new Set(['j', 's', 'ts', 'ch'])],
  ['s', new Set(['s', 'j', 'ts'])],
  ['w', new Set(['w', 'v', 'wh', 'hw'])],
  ['v', new Set(['v', 'w'])],
  ['\'', new Set(['\'', '?', 'h'])],
  ['?', new Set(['\'', '?', 'h'])],
  ['h', new Set(['h', '\'', '?'])]
]);

function isToneMarkOrPunct(ch: string): boolean {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (ch === '¹' || ch === '²' || ch === '³' || ch === '⁴') return true;
  if (code >= 48 && code <= 57) return true;
  if (/[\.\:\?\-_\s\',\"\u0241\u0242\u0294]/.test(ch)) return true;
  if (code >= 0x0300 && code <= 0x036f) return true;
  return false;
}

function charMatchScore(r: string, t: string): number {
  const rNorm = r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tNorm = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (rNorm === tNorm) return 3;
  if (equivMap.get(rNorm)?.has(tNorm)) return 2;
  return -2;
}

/**
 * Projects morphological segments (or groups) onto a surface tone string,
 * transferring the segment boundaries, roles, and colors to the tone representation
 * while preserving all diacritics, superscripts, numbers, and punctuation.
 */
export function projectSegmentsOntoTone(
  segments: SurfaceSegment[] | null | undefined,
  tone: string | undefined
): SurfaceSegment[] {
  if (!tone) return [];
  if (!segments || segments.length === 0) {
    return [{ role: 'root', text: tone }];
  }
  if (segments.length === 1) {
    return [{ ...segments[0], text: tone }];
  }

  // Build regular characters with segment indices
  const regChars: { char: string; segIdx: number }[] = [];
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const text = segments[sIdx].text || '';
    for (let cIdx = 0; cIdx < text.length; cIdx++) {
      regChars.push({
        char: text[cIdx],
        segIdx: sIdx
      });
    }
  }

  if (regChars.length === 0) {
    return segments.map((s, idx) => ({ ...s, text: idx === 0 ? tone : '' }));
  }

  const M = regChars.length;
  const N = tone.length;

  const dp = Array.from({ length: M + 1 }, () => new Int32Array(N + 1));
  const traceback = Array.from({ length: M + 1 }, () => new Int8Array(N + 1));

  // Initialize DP
  for (let i = 1; i <= M; i++) {
    dp[i][0] = dp[i - 1][0] - 2;
    traceback[i][0] = 2;
  }
  for (let j = 1; j <= N; j++) {
    const isPunct = isToneMarkOrPunct(tone[j - 1]);
    dp[0][j] = dp[0][j - 1] + (isPunct ? 0 : -2);
    traceback[0][j] = 3;
  }

  for (let i = 1; i <= M; i++) {
    const rChar = regChars[i - 1].char;
    for (let j = 1; j <= N; j++) {
      const tChar = tone[j - 1];
      const isPunct = isToneMarkOrPunct(tChar);

      if (isPunct) {
        // Tone mark, superscript, diacritic, or punct attaches to current alignment at zero penalty
        dp[i][j] = dp[i][j - 1];
        traceback[i][j] = 3;
        continue;
      }

      const scoreMatch = dp[i - 1][j - 1] + charMatchScore(rChar, tChar);
      const scoreDelReg = dp[i - 1][j] - 2;
      const scoreInsTone = dp[i][j - 1] - 2;

      let best = scoreMatch;
      let tb = 1;
      if (scoreDelReg > best) {
        best = scoreDelReg;
        tb = 2;
      }
      if (scoreInsTone > best) {
        best = scoreInsTone;
        tb = 3;
      }

      dp[i][j] = best;
      traceback[i][j] = tb;
    }
  }

  // Backtrack to assign each character in tone to a segment
  const toneSegAssignments = new Int32Array(N);
  let i = M;
  let j = N;
  let lastAssignedSeg = segments.length - 1;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && traceback[i][j] === 1) {
      lastAssignedSeg = regChars[i - 1].segIdx;
      toneSegAssignments[j - 1] = lastAssignedSeg;
      i--;
      j--;
    } else if (j > 0 && (i === 0 || traceback[i][j] === 3)) {
      const seg = (i > 0) ? regChars[i - 1].segIdx : (i === 0 ? 0 : lastAssignedSeg);
      toneSegAssignments[j - 1] = seg;
      lastAssignedSeg = seg;
      j--;
    } else if (i > 0) {
      lastAssignedSeg = regChars[i - 1].segIdx;
      i--;
    } else {
      j--;
    }
  }

  const result: SurfaceSegment[] = segments.map(s => ({ ...s, text: '' }));
  for (let k = 0; k < N; k++) {
    const sIdx = Math.max(0, Math.min(segments.length - 1, toneSegAssignments[k]));
    result[sIdx].text += tone[k];
  }

  return result;
}

export function segmentGroupsToSegments(
  groups: SegmentGroup[] | null | undefined,
  pronominalSet: 'A' | 'B' | 'P2P' | string = 'A'
): SurfaceSegment[] {
  if (!groups || groups.length === 0) return [];
  return groups.map(g => ({
    role: (g.role === 3 || g.roleType === 'prepronominal') ? 'prepronominal'
        : (g.role === 1 || g.roleType === 'pronoun') ? 'pronoun'
        : (g.role === 5 || g.roleType === 'post_root') ? 'post_root'
        : (g.role === 2 || g.roleType === 'aspect') ? 'aspect'
        : (g.role === 4 || g.roleType === 'final') ? 'final'
        : 'root',
    text: g.text,
    set: (pronominalSet === 'B' ? 'B' : pronominalSet === 'P2P' ? 'P2P' : 'A') as any
  }));
}

export function renderColorizedCherokee(
  surface: string | undefined,
  groups: SegmentGroup[] | null | undefined,
  pronominalSet: 'A' | 'B' | 'P2P' | string = 'A',
  isColored: boolean = true
): React.ReactNode {
  if (!surface) return null;
  if (!isColored || !groups || groups.length === 0) {
    return <span className="font-bold">{surface}</span>;
  }

  const segments = segmentGroupsToSegments(groups, pronominalSet);
  const projected = projectSegmentsOntoTone(segments, surface);
  return renderSegmentedSurface(projected, isColored);
}

export function renderSegmentedSurface(
  segments: SurfaceSegment[] | null | undefined,
  isColored: boolean = true
): React.ReactNode {
  if (!segments || segments.length === 0) return null;
  const fullText = segments.map(s => s.text).join('');
  if (!isColored) {
    return <span className="font-bold">{fullText}</span>;
  }

  return (
    <span className="font-bold">
      {segments.map((seg, idx) => {
        if (!seg.text) return null;
        if (seg.role === 'prepronominal') {
          return (
            <span key={idx} className="text-emerald-500 dark:text-emerald-300 font-bold" title="Prepronominal prefix">
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'pronoun') {
          const setType = seg.set || (seg.color === 'RoyalBlue' ? 'B' : seg.color === 'Purple' ? 'P2P' : 'A');
          let colorClass = "text-red-600 dark:text-red-400 font-bold";
          if (setType === 'B') {
            colorClass = "text-blue-600 dark:text-blue-400 font-bold";
          } else if (setType === 'P2P') {
            colorClass = "text-purple-600 dark:text-purple-400 font-bold";
          }
          return (
            <span key={idx} className={colorClass} title={`Pronoun (${setType})`}>
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'middle_voice') {
          return (
            <span key={idx} className="text-slate-700 dark:text-slate-300 font-bold" title="Middle voice">
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'root') {
          return (
            <span key={idx} className="text-slate-700 dark:text-slate-300 font-bold underline underline-offset-2" title="Root">
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'post_root') {
          return (
            <span key={idx} className="text-slate-700 dark:text-slate-300 font-bold" title="Post-root morpheme">
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'aspect') {
          return (
            <span key={idx} className="text-emerald-500 dark:text-emerald-300 font-bold" title="Aspect suffix / Class ending">
              {seg.text}
            </span>
          );
        }
        if (seg.role === 'final') {
          return (
            <span key={idx} className="text-slate-700 dark:text-slate-300 font-bold" title="Final suffix">
              {seg.text}
            </span>
          );
        }
        return (
          <span key={idx} className="text-inherit font-bold">
            {seg.text}
          </span>
        );
      })}
    </span>
  );
}

export function resolveHdFormName(keyOrLabel: string | undefined): string | null {
  if (!keyOrLabel) return null;
  const k = keyOrLabel.toLowerCase().trim();

  // 1. Present 3sg / Base
  if (
    k === 'present' ||
    k === '3s|3s|present' ||
    k === '3s|present' ||
    k === 'present 3sg' ||
    k === 'base' ||
    k === 'base form' ||
    k === '3rd person singular present' ||
    k === '3rd person present' ||
    k === '3rd present'
  ) {
    return 'present';
  }

  // 2. Present 1sg
  if (
    k === 'present_1sg' ||
    k === '1s|3s|present' ||
    k === '1s|present' ||
    k === '1st present' ||
    k.includes('1st person singular present') ||
    k.includes('1st person singular with inanimate')
  ) {
    return 'present_1sg';
  }

  // 3. Imperfective / Habitual
  if (
    k === 'imperfective' ||
    k === 'habitual' ||
    k === '3s|3s|habitual' ||
    k === '3s|habitual' ||
    k === '3rd habitual' ||
    k.includes('present habitual') ||
    k.includes('habitual') ||
    k.includes('imperfective')
  ) {
    return 'imperfective';
  }

  // 4. Perfective / Past
  if (
    k === 'perfective' ||
    k === 'past' ||
    k === '3s|3s|past' ||
    k === '3s|past' ||
    k === '3s|3s|completive past' ||
    k === 'completive past' ||
    k === '3rd past' ||
    k.includes('remote past') ||
    k.includes('completive past') ||
    k.includes('perfective') ||
    (k.includes('past') && !k.includes('habitual past'))
  ) {
    return 'perfective';
  }

  // 5. Imperative
  if (
    k === 'imperative' ||
    k === '2s|3s|imperative' ||
    k === '2s|imperative' ||
    k === '2nd imperative' ||
    k.includes('immediate imperative') ||
    k.includes('2nd person singular imperative') ||
    k.includes('2nd person imperative') ||
    k.includes('imperative')
  ) {
    if (!k.includes('3a') && !k.includes('animate')) {
      return 'imperative';
    }
  }

  // 6. Infinitive
  if (
    k === 'infinitive' ||
    k === '3s|3s|infinitive' ||
    k === '3s|infinitive' ||
    k === '3rd infinitive' ||
    k.includes('infinitive') ||
    k.includes('deverbative')
  ) {
    return 'infinitive';
  }

  return null;
}

export function getColorWordSegmentsSetting(settings?: any): boolean {
  if (settings?.colorWordSegments !== undefined) {
    return settings.colorWordSegments !== false;
  }
  try {
    const s = localStorage.getItem('cherokee_app_settings');
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed.colorWordSegments !== undefined) {
        return parsed.colorWordSegments !== false;
      }
    }
  } catch {
    // Ignore localStorage errors
  }
  return true;
}

export interface ColorizedCherokeeWordProps {
  word?: string;
  form?: any;
  formKey?: string;
  entry?: any;
  rootEntry?: any;
  allForms?: any[];
  isColored?: boolean;
  settings?: any;
  className?: string;
}

export const ColorizedCherokeeWord: React.FC<ColorizedCherokeeWordProps> = ({
  word,
  form,
  formKey,
  entry,
  rootEntry,
  allForms,
  isColored,
  settings,
  className = ""
}) => {
  const corpus = useContext(CorpusContext);
  const rootMap = corpus?.rootMap;

  const text = word ?? form?.translit ?? form?.tone ?? entry?.translit ?? entry?.Entry ?? '';
  if (!text) return null;

  const colored = isColored !== undefined
    ? isColored
    : getColorWordSegmentsSetting(settings);

  if (!colored) {
    return <span className={`font-bold ${className}`.trim()}>{text}</span>;
  }

  let rEntry = rootEntry;
  if (!rEntry && entry) {
    rEntry = entry.rootEntry;
    if (!rEntry && rootMap) {
      rEntry = rootMap.get(entry.Index) ||
               rootMap.get(entry.id) ||
               rootMap.get(entry.merged_id) ||
               rootMap.get(entry.sources?.['lily-dict.csv']?.Index);
    }
    if (!rEntry && (entry.surface_segments || entry.segmented_forms)) {
      rEntry = entry;
    }
  } else if (!rEntry && form && rootMap) {
    if (form.word_index) {
      rEntry = rootMap.get(form.word_index);
    }
  }

  if (!rEntry) {
    return <span className={`font-bold ${className}`.trim()}>{text}</span>;
  }

  const candidateKey = formKey ||
    form?.normalized_key ||
    form?.form_name ||
    form?.label ||
    form?.slotKey ||
    (entry && !form ? 'present' : undefined);

  const hdSlot = resolveHdFormName(candidateKey);

  // 1. Exact match in surface_segments (either directly on form, or on rEntry)
  const exactSegs = form?.surface_segments || (hdSlot && rEntry.surface_segments?.[hdSlot]);
  if (exactSegs) {
    const projected = projectSegmentsOntoTone(exactSegs, text);
    return (
      <span className={className}>
        {renderSegmentedSurface(projected, colored)}
      </span>
    );
  }

  // 2. Derive segmented form if available
  if (rEntry.segmented_forms) {
    const derivedSeg = deriveSegmentedForm(
      form || { normalized_key: candidateKey || 'present', translit: text },
      allForms || [],
      rEntry
    );

    if (derivedSeg) {
      const slotName = (candidateKey || '').split('|')[2] || hdSlot || 'present';
      const groups = segmentVerbForm(derivedSeg, slotName, rEntry.config, rEntry.class_name);
      const pSet = getFormPronominalSet(candidateKey || '', rEntry.config);
      return (
        <span className={className}>
          {renderColorizedCherokee(text, groups, pSet, colored)}
        </span>
      );
    }

    // If headword or present
    if ((!form || hdSlot === 'present') && rEntry.segmented_forms.present) {
      const groups = segmentVerbForm(rEntry.segmented_forms.present, 'present', rEntry.config, rEntry.class_name);
      const pSet = rEntry.config?.pron?.set_type === 'b' ? 'B' : 'A';
      return (
        <span className={className}>
          {renderColorizedCherokee(text, groups, pSet, colored)}
        </span>
      );
    }
  }

  return <span className={`font-bold ${className}`.trim()}>{text}</span>;
};

export function formatCommunityRoot(rootRaw: string): string {
  if (!rootRaw) return '';
  if (rootRaw === '∅') return '∅';
  return unrespellConsonants(rootRaw)
    .replace(/(?<!\\)(kh|Kh|hs)/gi, (m) => m.toLowerCase() === 'hs' ? 'sh' : 'k')
    .replace(/\s+/g, '');
}

export function isEmptyRoot(rootEntry?: any): boolean {
  if (!rootEntry) return false;
  const h = rootEntry.root_h;
  const g = rootEntry.root_g;
  if (h === '∅' || g === '∅') return true;
  const slug = (rootEntry.slug || rootEntry.root_slug || '').toLowerCase();
  if (slug === 'bg9uzw' || slug === 'fc1zb2xpza' || slug === 'agl0') return true;
  if (!h && !g) return true;
  return false;
}

export interface VerbMorphologyTemplateProps {
  rootEntry: any;
  onViewRoot: (slug: string) => void;
  onViewClass: (className: string) => void;
  showMascot?: boolean;
  className?: string;
}

export const VerbMorphologyTemplate: React.FC<VerbMorphologyTemplateProps> = ({
  rootEntry,
  onViewRoot,
  onViewClass,
  showMascot = false,
  className = ''
}) => {
  if (!rootEntry) return null;

  const config = rootEntry.config;
  const elements: React.ReactNode[] = [];

  // 1. Prepronominals
  if (config?.pre?.translocutive) {
    elements.push(
      <span key="pre-wi" className="font-semibold text-emerald-500 dark:text-emerald-300" title="Translocutive prefix">
        wi
      </span>
    );
  }
  if (config?.pre?.partitive) {
    elements.push(
      <span key="pre-ni" className="font-semibold text-emerald-500 dark:text-emerald-300" title="Partitive prefix">
        ni
      </span>
    );
  }
  if (config?.pre?.distributive) {
    elements.push(
      <span key="pre-te" className="font-semibold text-emerald-500 dark:text-emerald-300" title="Distributive prefix">
        te
      </span>
    );
  }

  // 2. Pronominal set
  let setLabel = 'Set A';
  const setType = (config?.pron?.set_type || '').toLowerCase();
  let setClass = 'text-red-600 dark:text-red-500 font-semibold';

  if (setType === 'b') {
    setLabel = config?.pron?.plural_pronouns ? 'Set B (pl)' : 'Set B';
    setClass = 'text-blue-600 dark:text-blue-400 font-semibold';
  } else if (setType === 'p2p' || setType === 'person_to_person') {
    setLabel = 'Person-to-person';
    setClass = 'text-purple-600 dark:text-purple-400 font-semibold';
  } else {
    setLabel = config?.pron?.use_ka_variant ? 'Set A (ga)' : 'Set A';
    if (config?.pron?.plural_pronouns) setLabel += ' (pl)';
  }

  elements.push(
    <span key="pron-set" className={setClass} title={`Pronominal Set ${setLabel}`}>
      {setLabel}
    </span>
  );

  // 3. Middle voice
  const mv = config?.pron?.middle_voice;
  if (mv && mv !== 'none') {
    const mvClean = mv.replace(/_/g, '/').toLowerCase();
    elements.push(
      <span key="mv" className="text-slate-500 dark:text-slate-400 italic font-medium" title="Middle voice">
        {mvClean}
      </span>
    );
  }

  // 4. Root in Community Orthography
  let rootLines: string[] = [];
  if (isEmptyRoot(rootEntry)) {
    rootLines = ['∅'];
  } else {
    const commH = rootEntry.root_h ? formatCommunityRoot(rootEntry.root_h) : '';
    const commG = rootEntry.root_g ? formatCommunityRoot(rootEntry.root_g) : '';

    if (commH && commG && commH !== commG) {
      rootLines = [commH, commG];
    } else {
      const raw = commH || commG || (rootEntry.slug || rootEntry.root_slug ? formatCommunityRoot(rootEntry.slug || rootEntry.root_slug) : '');
      if (raw.includes('/')) {
        rootLines = raw.split('/').map(s => s.trim()).filter(Boolean);
      } else if (raw.includes('|')) {
        rootLines = raw.split('|').map(s => s.trim()).filter(Boolean);
      } else if (raw) {
        rootLines = [raw];
      }
    }

    if (rootLines.length === 0) {
      rootLines = ['Root'];
    }
  }

  if (rootLines.length > 1) {
    elements.push(
      <button
        key="root"
        type="button"
        onClick={() => onViewRoot(rootEntry.slug || rootEntry.root_slug)}
        className="font-bold text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors inline-flex flex-col items-center align-middle leading-tight"
        title="View Root"
      >
        {rootLines.map((line, rIdx) => (
          <span key={rIdx} className="underline decoration-dotted underline-offset-2 select-text leading-tight">
            {line}
          </span>
        ))}
      </button>
    );
  } else {
    elements.push(
      <button
        key="root"
        type="button"
        onClick={() => onViewRoot(rootEntry.slug || rootEntry.root_slug)}
        className="font-bold text-slate-900 dark:text-slate-100 hover:text-amber-600 dark:hover:text-amber-400 transition-colors underline decoration-dotted underline-offset-4"
        title="View Root"
      >
        {rootLines[0]}
      </button>
    );
  }

  // 5. Post-root morpheme
  if (rootEntry.post_root_morpheme) {
    const prm = getPostRootMorpheme(rootEntry.post_root_morpheme);
    const prmForm = prm?.form || '';
    const prmName = prm?.name || rootEntry.post_root_morpheme;

    elements.push(
      <div key="prm" className="inline-flex flex-col items-center align-middle leading-tight" title={`Post-root morpheme: ${prmName}`}>
        {prmForm ? (
          <>
            <span className="font-semibold text-slate-800 dark:text-slate-200 leading-none underline decoration-transparent decoration-dotted underline-offset-4">
              {prmForm}
            </span>
            <span className="text-[11px] font-sans font-normal text-slate-400 dark:text-slate-500 leading-none mt-1 select-text">
              {prmName}
            </span>
          </>
        ) : (
          <span className="text-slate-500 dark:text-slate-400 font-medium select-text">
            {prmName}
          </span>
        )}
      </div>
    );
  }

  // 6. Aspect class & mascot
  if (rootEntry.class_name) {
    const mascot = rootEntry.class_mascot;
    elements.push(
      <div key="class" className="inline-flex flex-col items-center align-middle leading-tight">
        <button
          type="button"
          onClick={() => onViewClass(rootEntry.class_name)}
          className="font-normal text-emerald-500 dark:text-emerald-300 hover:text-emerald-400 dark:hover:text-emerald-200 transition-colors leading-none underline decoration-dotted underline-offset-4"
          title="View Class"
        >
          [{rootEntry.class_name}]
        </button>
        {showMascot && mascot && (
          <span className="text-[11px] font-sans italic font-normal text-slate-400 dark:text-slate-500 leading-none mt-1 select-text" title="Class mascot verb">
            {mascot}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-base sm:text-lg font-medium pb-1 select-text ${className}`}>
      {elements.map((el, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="text-slate-400 dark:text-slate-600 font-sans select-none">-</span>}
          {el}
        </React.Fragment>
      ))}
    </div>
  );
};

