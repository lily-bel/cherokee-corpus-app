import React, { useState, useMemo, useRef } from 'react';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import {
    ArrowLeft, Book, Mic, StickyNote,
    ChevronDown, ChevronRight, ListIcon, ListPlus, SquaresPlus,
    Search, Pause, Play
} from './Icons';
import EntryCard from './EntryCard';
import EntryDetail from './EntryDetail';
import { getAudioFromDB } from '../utils';

interface PackageDetailViewProps {
    packageId: string;
    onBack: () => void;
    customLists: Record<string, any>;
}

export const PackageDetailView: React.FC<PackageDetailViewProps> = ({ packageId, onBack, customLists }) => {
    const { packages, importedData } = usePackageManager(); // importedData needed for official/imported packages
    const {
        notebooks, personalWords, userSentences,
        userAudioMeta, glosses, userNotes, userWordForms,
        dictionary, sentences,
        saveAudio, deleteAudio
    } = useCorpus();

    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);

    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return null;

    const isUser = pkg.type === 'user';
    const isOfficial = pkg.type === 'official';

    // --- DATA GATHERING ---
    const data = useMemo(() => {
        const findAnywhere = (id: string, type: 'W' | 'S') => {
            const cleanId = String(id).replace('_sentence', '');

            if (type === 'W') {
                // 1. Check personal words
                let found = personalWords.find(w => w.Index === cleanId || w.id === cleanId);
                if (found) return found;
                // 2. Check base dictionary
                found = dictionary.find(w => w.id === cleanId || w.Index === cleanId);
                if (found) return found;
                // 3. Check all packages
                for (const pId in importedData) {
                    found = importedData[pId].dictionary?.find((w: any) => w.id === cleanId || w.Index === cleanId);
                    if (found) return found;
                }
            } else {
                // 1. Check user sentences
                let found = userSentences.find(s => s.id === cleanId || s.ID === cleanId);
                if (found) return found;
                // 2. Check base sentences
                found = sentences.find(s => s.id === cleanId || s.ID === cleanId);
                if (found) return found;
                // 3. Check all packages
                for (const pId in importedData) {
                    found = importedData[pId].sentences?.find((s: any) => s.id === cleanId || s.ID === cleanId);
                    if (found) return found;
                }
            }
            return null;
        };

        const getParent = (targetId: string, audioId?: string, forcePkg?: any) => {
            // First try parsing audioId if provided (most reliable: speaker_W-123_456)
            if (audioId) {
                const parts = audioId.split('_');
                if (parts.length >= 2) {
                    const info = parts[1]; // e.g. S-123 or W-10.2
                    const match = info.match(/^([WS])-(.+)$/);
                    if (match) {
                        const type = match[1] as 'W' | 'S';
                        const id = match[2].split('.')[0];

                        // Try forcePkg first if it has dictionary/sentences
                        if (forcePkg) {
                            if (type === 'W') {
                                const found = forcePkg.dictionary?.find((d: any) => d.id === id || d.Index === id);
                                if (found) return found;
                            } else {
                                const found = forcePkg.sentences?.find((s: any) => s.id === id || s.ID === id);
                                if (found) return found;
                            }
                        }

                        // Search everywhere
                        return findAnywhere(id, type);
                    }
                }
            }

            // Fallback to targetId key (entryIndex)
            if (!targetId) return null;
            const type = String(targetId).endsWith('_sentence') ? 'S' : 'W';
            const cleanId = String(targetId).replace('_sentence', '');

            if (forcePkg) {
                const found = forcePkg.dictionary?.find((d: any) => d.id === cleanId || d.Index === cleanId) ||
                    forcePkg.sentences?.find((s: any) => s.id === cleanId || s.ID === cleanId);
                if (found) return found;
            }

            return findAnywhere(cleanId, type);
        };

        if (isUser) {
            // User Data
            const nbList = Object.values(notebooks);

            // Filter audio for user
            const audioList: any[] = [];
            Object.entries(userAudioMeta).forEach(([targetId, list]: [string, any[]]) => {
                list.forEach(a => {
                    if (!a.packageId || a.packageId === 'user') {
                        const parent = getParent(targetId, a.id);
                        audioList.push({ ...a, parent, entryIndex: targetId });
                    }
                });
            });

            // Glosses
            const userGlosses = glosses.filter(g => g.source === 'user').map(g => {
                const sent = userSentences.find(s => s.id === g.sentence_id);
                const linkedEntry = findAnywhere(g.entry_id, 'W');
                return { ...g, sentence: sent, linkedEntry };
            });

            // Notes
            const notesList: any[] = [];
            Object.entries(userNotes).forEach(([key, val]) => {
                let parent: any = personalWords.find(w => w.Index === key);
                if (!parent) parent = userSentences.find(s => s.id === key.replace('s_', ''));
                if (val) {
                    notesList.push({ id: key, text: val, parent });
                }
            });

            // Word Forms
            const formsList: any[] = [];
            Object.entries(userWordForms).forEach(([key, val]) => {
                const parent = personalWords.find(w => w.Index === key);
                if (val) {
                    formsList.push({ id: key, forms: val, parent });
                }
            });

            // Lists
            const userLists = Object.values(customLists).map((l: any) => {
                if (typeof l === 'string') return null;
                if (Array.isArray(l)) return { id: "list", name: "List", count: l.length, items: l };
                return { id: l.id, name: l.name, count: l.items?.length || 0, items: l.items };
            }).filter(Boolean);

            return {
                notebooks: nbList.map(n => ({ ...n, count: 1 })),
                words: personalWords,
                sentences: userSentences,
                audio: audioList,
                glosses: userGlosses,
                notes: notesList,
                wordForms: formsList,
                lists: userLists
            };
        } else {
            // Official / Imported Data
            const pData = importedData[pkg.id];
            if (!pData) return null;

            // Audio for package
            const audioList: any[] = [];
            Object.entries(userAudioMeta).forEach(([targetId, list]: [string, any[]]) => {
                list.forEach(a => {
                    if (a.packageId === pkg.id) {
                        const parent = getParent(targetId, a.id, pData);
                        audioList.push({ ...a, parent, entryIndex: targetId });
                    }
                });
            });

            // Word Forms
            let wordForms: any[] = pData.word_forms?.map((f: any, i: number) => {
                const parent = findAnywhere(f.word_index, 'W');
                return { id: i, ...f, parent };
            }) || [];

            if (wordForms.length === 0 && pData.dictionary) {
                pData.dictionary.forEach((entry: any) => {
                    if (entry.Other_Forms) {
                        const forms = entry.Other_Forms.split('|').filter(f => f.includes(':'));
                        if (forms.length > 0) {
                            wordForms.push({
                                id: `official_${entry.id}`,
                                forms: entry.Other_Forms,
                                parent: entry,
                                isRaw: true
                            });
                        }
                    }
                });
            }

            // Notes
            const notes = pData.notes?.map((n: any, i: number) => ({
                id: i,
                text: n.text,
                parent: findAnywhere(n.target_id, 'W') || findAnywhere(n.target_id, 'S')
            })) || [];

            const glosses = pData.glosses.map((g: any) => {
                const sent = pData.sentences?.find((s: any) => s.id === g.sentence_id);
                const linkedEntry = findAnywhere(g.entry_id, 'W');
                return { ...g, sentence: sent, linkedEntry };
            });

            return {
                notebooks: [],
                words: pData.dictionary,
                sentences: pData.sentences,
                audio: audioList,
                glosses: glosses,
                notes: notes,
                wordForms: wordForms,
                lists: pData.lists?.map((l: any) => ({ ...l, count: l.items.length })) || []
            };
        }
    }, [isUser, isOfficial, pkg.id, importedData, notebooks, personalWords, userSentences, userAudioMeta, glosses, userNotes, userWordForms, dictionary, sentences, customLists]);

    if (!data) return <div className="p-8 text-center text-slate-400">Loading package data...</div>;

    if (selectedEntry) {
        return <EntryDetail
            entry={selectedEntry}
            notebooks={notebooks}
            userNotes={userNotes}
            userAudioMeta={userAudioMeta}
            userWordForms={userWordForms}
            onSaveAudio={saveAudio}
            onDeleteAudio={deleteAudio}
            favorites={[]} // Pass if needed
            customLists={customLists}
            customListOrder={[]}
            onClose={() => setSelectedEntry(null)}
            onEdit={() => { }}
            onToggleFavorite={() => { }}
            onToggleList={() => { }}
            onDelete={() => { }}
            onSearchTerm={() => { }}
            onOpenNewListModal={() => { }}
            onMove={() => { }}
            personalWords={personalWords}
            onEditSentence={() => { }}
            onDeleteSentence={() => { }}
            onCreateWord={() => { }}
            onManageForms={() => { }}
        />;
    }

    return (
        <div className="flex flex-col h-full bg-[#F9F9F7] dark:bg-slate-950 animate-fade-in text-slate-800 dark:text-slate-100">
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3 shrink-0 sticky top-0 z-10">
                <button
                    onClick={onBack}
                    className="p-2 -ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                    <ArrowLeft size={24} />
                </button>
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
                    style={{ backgroundColor: pkg.color }}
                >
                    {(pkg.name.split(' ').length > 1 ? (pkg.name.split(' ')[0][0] + pkg.name.split(' ')[1][0]).toUpperCase() : pkg.name.substring(0, 2).toUpperCase())}
                </div>
                <div>
                    <h2 className="font-bold text-lg leading-tight">{pkg.name}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Package Contents</p>
                </div>
            </div>

            {/* Content Stats List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <SectionItem
                    icon={<Book size={20} style={{ color: pkg.color }} />}
                    label="Notebooks"
                    items={data.notebooks}
                    type="notebook"
                />

                <SectionItem
                    icon={null}
                    label="Words"
                    items={data.words || []}
                    searchable
                    type="word"
                    onItemClick={setSelectedEntry}
                    extraProps={{ notebooks, userNotes, userAudioMeta, userWordForms, favorites: [], customLists: {} }} // Pass required props for EntryCard
                />

                <SectionItem
                    icon={null}
                    label="Sentences"
                    items={data.sentences || []}
                    searchable
                    type="sentence"
                    onItemClick={setSelectedEntry}
                />

                <SectionItem
                    icon={<Mic size={20} style={{ color: pkg.color }} />}
                    label="Audio"
                    items={data.audio}
                    type="audio"
                />

                <SectionItem
                    icon={<ListPlus size={20} style={{ color: pkg.color }} />}
                    label="Glosses"
                    items={data.glosses}
                    type="gloss"
                />

                <SectionItem
                    icon={<ListIcon size={20} style={{ color: pkg.color }} />}
                    label="Lists"
                    items={data.lists}
                    type="list"
                />

                <SectionItem
                    icon={<StickyNote size={20} style={{ color: pkg.color }} />}
                    label="Notes"
                    items={data.notes}
                    type="note"
                />

                <SectionItem
                    icon={<SquaresPlus size={20} style={{ color: pkg.color }} />}
                    label="Word Forms"
                    items={data.wordForms}
                    type="form"
                />
            </div>
        </div>
    );
};

const SectionItem = ({
    icon,
    label,
    items,
    searchable = false,
    type,
    onItemClick,
    extraProps
}: {
    icon: React.ReactNode,
    label: string,
    items: any[],
    searchable?: boolean,
    type: 'word' | 'sentence' | 'audio' | 'gloss' | 'list' | 'note' | 'form' | 'notebook',
    onItemClick?: (item: any) => void,
    extraProps?: any
}) => {
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(20);

    const filteredItems = useMemo(() => {
        if (!query) return items;
        const q = query.toLowerCase();
        return items.filter(i => {
            if (type === 'word') {
                return (i.Entry && i.Entry.toLowerCase().includes(q)) ||
                    (i.Syllabary && i.Syllabary.includes(q)) ||
                    (i.Definition && i.Definition.toLowerCase().includes(q));
            } else if (type === 'sentence') {
                return (i.english && i.english.toLowerCase().includes(q)) ||
                    (i.translit && i.translit.toLowerCase().includes(q)) ||
                    (i.syllabary && i.syllabary.includes(q));
            } else {
                // Generic fallback
                return JSON.stringify(i).toLowerCase().includes(q);
            }
        });
    }, [items, query, type]);

    if (items.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                            {icon}
                        </div>
                    )}
                    <span className="font-bold text-slate-700 dark:text-slate-200">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                        {items.length}
                    </span>
                    {expanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    {searchable && (
                        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    className="w-full bg-white dark:bg-slate-800 border-none rounded-lg py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-amber-500 dark:text-slate-200"
                                    placeholder={`Search ${label.toLowerCase()}...`}
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredItems.slice(0, limit).map((item, idx) => (
                            <div key={item.id || item.Index || idx} className="bg-white dark:bg-slate-900">
                                {type === 'word' && <EntryCard entry={item} onClick={onItemClick} {...extraProps} />}
                                {type === 'sentence' && <CompactSentenceCard sentence={item} onClick={onItemClick} />}
                                {type === 'audio' && <AudioCard audio={item} />}
                                {type === 'note' && <NoteCard note={item} />}
                                {type === 'form' && <WordFormCard form={item} />}
                                {type === 'gloss' && <GlossCard gloss={item} />}
                                {type === 'list' && <ListCard list={item} />}
                                {type === 'notebook' && (
                                    <div className="p-3 pl-4">
                                        <div className="font-bold text-slate-800 dark:text-slate-100">{item.name}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {filteredItems.length > limit && (
                            <button
                                onClick={() => setLimit(l => l + 20)}
                                className="w-full py-3 text-xs font-bold text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-500 transition-colors bg-slate-100/50 dark:bg-slate-800/50"
                            >
                                Show More
                            </button>
                        )}
                        {filteredItems.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400">No items found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB COMPONENTS ---

const EntryPreview = ({ entry }: { entry: any }) => {
    if (!entry) return null;
    return (
        <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="font-noto-cherokee font-bold text-lg text-slate-900 dark:text-slate-100 mb-0.5">{entry.syllabary || entry.Syllabary}</div>
            <div className="text-base font-medium text-amber-800 dark:text-amber-500 mb-1">{entry.translit || entry.Entry || entry.entry}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">{entry.definition || entry.Definition}</div>
        </div>
    );
};

const CompactSentenceCard = ({ sentence, onClick }: { sentence: any, onClick?: (s: any) => void }) => (
    <div
        onClick={() => onClick && onClick(sentence)}
        className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
    >
        <div className="font-noto-cherokee text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{sentence.syllabary}</div>
        <div className="font-noto-serif text-amber-700 dark:text-amber-400 text-sm italic mb-1">{sentence.translit}</div>
        <div className="text-slate-600 dark:text-slate-400 text-sm">{sentence.english}</div>
    </div>
);

const AudioCard = ({ audio }: { audio: any }) => {
    const parent = audio.parent;
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playAudio = async () => {
        if (playing && audioRef.current) {
            audioRef.current.pause();
            setPlaying(false);
            return;
        }

        try {
            let url = "";
            if (audio.src) url = audio.src;
            else {
                const data = await getAudioFromDB(audio.id);
                if (data) {
                    const blob = new Blob([data as Blob], { type: 'audio/mp3' });
                    url = URL.createObjectURL(blob);
                }
            }

            if (url) {
                const a = new Audio(url);
                audioRef.current = a;
                a.onended = () => { setPlaying(false); if (!audio.src) URL.revokeObjectURL(url); };
                a.onplay = () => setPlaying(true);
                a.play();
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="p-4 flex flex-col gap-3">
            {parent ? (
                <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-100 dark:border-slate-800">
                    <div className="flex items-baseline gap-2">
                        <span className="font-noto-cherokee font-bold text-sm text-slate-800 dark:text-slate-200">{parent.Syllabary || parent.syllabary}</span>
                        <span className="font-noto-serif text-xs italic text-slate-500">{parent.Entry || parent.translit}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 uppercase tracking-tighter mt-0.5">{parent.Definition || parent.english}</div>
                </div>
            ) : <div className="text-xs text-slate-400 italic">Attached to unknown entry</div>}

            <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm ${playing ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                    <button onClick={playAudio} className="flex items-center gap-2">
                        {playing ? <Pause size={12} className="fill-current animate-pulse" /> : <Mic size={12} />}
                        <span>{playing ? 'Playing...' : `Speaker Name: ${audio.speaker || 'User'}`}</span>
                    </button>
                </div>
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">{audio.id}</span>
            </div>
        </div>
    );
};

const NoteCard = ({ note }: { note: any }) => {
    const { parent } = note;
    return (
        <div className="p-4">
            {parent && (
                <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-800/50">
                    <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-noto-cherokee font-bold text-slate-800 dark:text-slate-200">{parent.Syllabary || parent.syllabary}</span>
                        <span className="font-noto-serif text-sm italic text-amber-700 dark:text-amber-500">{parent.Entry || parent.translit}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{parent.Definition || parent.english}</div>
                </div>
            )}
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-serif pl-2 border-l-2 border-amber-300 dark:border-amber-700">
                {note.text}
            </div>
        </div>
    );
};

const WordFormCard = ({ form }: { form: any }) => {
    const { parent } = form;

    if (form.isRaw) {
        // Official raw string forms
        const { forms } = form;
        const parts = forms.split('|').filter((f: string) => f.includes(':'));
        return (
            <div className="p-4">
                <EntryPreview entry={parent} />
                <div className="space-y-2 pl-4 border-l-2 border-amber-200 dark:border-amber-900/50 mt-4">
                    {parts.map((part: string, i: number) => {
                        const [label, vals] = part.split(':');
                        const values = vals.split('^');
                        return (
                            <div key={i}>
                                <span className="text-[10px] font-bold text-amber-600 uppercase mr-2">{label}</span>
                                <span className="font-noto-cherokee font-medium text-slate-800 dark:text-slate-200">{values[1]}</span>
                                <span className="font-noto-serif italic text-slate-500 ml-2 text-sm">{values[0]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <EntryPreview entry={parent} />
            <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm border-l-4 border-l-amber-500">
                <div className="text-[10px] font-bold text-amber-600 uppercase mb-1">{form.form_name}</div>
                <div className="font-noto-cherokee text-xl text-slate-800 dark:text-slate-100">{form.syllabary}</div>
                <div className="font-noto-serif italic text-slate-600 dark:text-slate-400">{form.translit}</div>
            </div>
        </div>
    );
};

const GlossCard = ({ gloss }: { gloss: any }) => {
    const { sentence, linkedEntry } = gloss;
    if (!sentence) return <div className="p-4 text-xs text-red-400">Orphaned Gloss</div>;

    const sylMap = sentence.syllabary.split(' ');
    const trMap = sentence.translit.split(' ');
    const idx = gloss.word_index * 1 - 1;

    let igtSegments: { c: string, e: string }[] = [];
    if (gloss.breakdown_cherokee || gloss.breakdown_english) {
        const cParts = (gloss.breakdown_cherokee || '').split('-').map((s: string) => s.trim());
        const eParts = (gloss.breakdown_english || '').split('-').map((s: string) => s.trim());
        const max = Math.max(cParts.length, eParts.length);
        for (let k = 0; k < max; k++) {
            igtSegments.push({ c: cParts[k] || '', e: eParts[k] || '' });
        }
    }

    return (
        <div className="p-4">
            <EntryPreview entry={linkedEntry} />

            <div className="flex flex-wrap gap-x-2 gap-y-4 mb-4 mt-2">
                {sylMap.map((word: string, i: number) => {
                    const isTarget = i === idx;
                    const translit = trMap[i] || "";
                    return (
                        <div key={i} className={`flex flex-col items-center ${isTarget ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                            <span className={`font-noto-cherokee text-lg ${isTarget ? 'font-bold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white' : 'text-slate-500'}`}>
                                {word}
                            </span>
                            <span className="font-noto-serif text-[10px] italic text-slate-500 mt-1">{translit}</span>
                        </div>
                    );
                })}
            </div>

            {igtSegments.length > 0 && (
                <div className="mb-3 overflow-x-auto pb-2">
                    <div className="flex gap-3 min-w-max border-t border-slate-100 dark:border-slate-800 pt-3">
                        {igtSegments.map((seg, k) => (
                            <div key={k} className="flex flex-col items-center">
                                <span className="font-bold text-slate-700 dark:text-slate-300 text-xs border-b border-slate-200 dark:border-slate-700 pb-0.5 mb-0.5">{seg.c}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">{seg.e}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {gloss.notes && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm border-l-4 border-slate-300 dark:border-slate-600">
                    <div className="font-mono text-[10px] text-slate-500 mb-1 uppercase tracking-widest">Morphology / Notes</div>
                    <div className="text-slate-800 dark:text-slate-200">{gloss.notes}</div>
                </div>
            )}
        </div>
    );
};

const ListCard = ({ list }: { list: any }) => (
    <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <ListIcon size={20} />
            </div>
            <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">{list.name}</div>
                <div className="text-xs text-slate-500">{list.count} items</div>
            </div>
        </div>
    </div>
);
