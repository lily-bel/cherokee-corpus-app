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