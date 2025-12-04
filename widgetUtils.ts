
import { openDB } from 'idb';

const DB_NAME = 'cherokee_widgets_db';
const STORE_NAME = 'widgets';

export interface Widget {
    name: string;
    content: string; // HTML content
    isBuiltIn: boolean;
    path?: string; // For built-in widgets
}

export const BUILT_IN_WIDGETS: Widget[] = [
    { name: 'Syllabary Learner', content: '', isBuiltIn: true, path: '/data/widgets/Syllabary Learner.html' },
    { name: 'Transliteration Converter', content: '', isBuiltIn: true, path: '/data/widgets/Transliteration Converter.html' }
];

export const initWidgetDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
        },
    });
};

export const saveWidget = async (name: string, content: string) => {
    const db = await initWidgetDB();
    await db.put(STORE_NAME, { name, content, isBuiltIn: false });
};

export const deleteWidget = async (name: string) => {
    const db = await initWidgetDB();
    await db.delete(STORE_NAME, name);
};

export const getAllWidgets = async (): Promise<Widget[]> => {
    const db = await initWidgetDB();
    const customWidgets = await db.getAll(STORE_NAME);
    return [...BUILT_IN_WIDGETS, ...customWidgets];
};

export const loadBuiltInWidgetContent = async (path: string): Promise<string> => {
    try {
        const response = await fetch(path);
        return await response.text();
    } catch (e) {
        console.error("Failed to load built-in widget:", e);
        return "<h1>Error loading widget</h1>";
    }
};
