
import { openDB } from 'idb';

const DB_NAME = 'cherokee_widgets_db';
const STORE_NAME = 'widgets';

const BASE_URL = import.meta.env.BASE_URL || '/';

export interface Widget {
    name: string;
    content: string; // HTML content
    isBuiltIn: boolean;
    path?: string; // For built-in or URL-based widgets
    icon?: string; // Emoji or 1-2 chars
    packageId?: string; // ID of package if imported
    date?: number;
}

export const BUILT_IN_WIDGETS: Widget[] = [
    { name: 'Syllabary Learner', icon: 'Ꮝ', content: '', isBuiltIn: true, path: `${BASE_URL}data/widgets/Syllabary Learner.html` },
    { name: 'Transliteration Converter', icon: '↔️', content: '', isBuiltIn: true, path: `${BASE_URL}data/widgets/Transliteration Converter.html` },
    { name: 'Pronoun Game', icon: '🕹️', content: '', isBuiltIn: true, path: `${BASE_URL}data/widgets/pronoun_game.html` },
    { name: 'Grammar Guide', icon: '📖', content: '', isBuiltIn: true, path: 'https://www.cherokeedictionary.net/grammar' }
];

export const getWidgetIcon = (widget: { name: string; icon?: string; path?: string; isBuiltIn?: boolean }): string => {
    if (widget.icon && widget.icon.trim()) return widget.icon.trim();
    const lower = widget.name.toLowerCase();
    if (lower.includes('syllabar')) return 'Ꮝ';
    if (lower.includes('translit') || lower.includes('converter')) return '↔️';
    if (lower.includes('pronoun') || lower.includes('game')) return '🕹️';
    if (lower.includes('grammar') || lower.includes('guide')) return '📖';
    if (widget.path && (widget.path.startsWith('http://') || widget.path.startsWith('https://'))) return '🌐';
    return '📄';
};

export const initWidgetDB = async () => {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'name' });
            }
        },
    });
};

export const saveWidget = async (name: string, content: string, path?: string, icon?: string, packageId?: string) => {
    const db = await initWidgetDB();
    const cleanIcon = icon?.trim() || (path && (path.startsWith('http://') || path.startsWith('https://')) ? '🌐' : '📄');
    await db.put(STORE_NAME, { 
        name, 
        content: content || '', 
        path: path || undefined, 
        isBuiltIn: false,
        icon: cleanIcon,
        packageId: packageId || undefined,
        date: Date.now()
    });
};

export const deleteWidget = async (name: string) => {
    const db = await initWidgetDB();
    await db.delete(STORE_NAME, name);
};

export const deleteWidgetsByPackageId = async (packageId: string) => {
    try {
        const db = await initWidgetDB();
        const all = await db.getAll(STORE_NAME);
        for (const w of all) {
            if (w.packageId === packageId) {
                await db.delete(STORE_NAME, w.name);
            }
        }
    } catch (e) {
        console.warn("Failed to delete package widgets:", e);
    }
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

