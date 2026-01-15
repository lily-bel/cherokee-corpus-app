import React, { useState, useMemo, useRef } from 'react';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';
import {
    ArrowLeft, Folder, Mic, StickyNote,
    ChevronDown, ChevronRight, ListIcon, ListPlus, SquaresPlus,
    Search, Pause, Volume2
} from './Icons';
import { SourceBadge } from './UI';
import EntryCard from './EntryCard';
import EntryDetail from './EntryDetail';
import { getAudioFromDB } from '../utils';

interface PackageDetailViewProps {
    packageId: string;
    onBack: () => void;
    customLists: Record<string, any>;
    onNavigate: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void;
    onReadInContext?: (sentenceId: string) => void;
}

const getIconStyles = (pkg: any) => {
    let iconBg = "bg-slate-100 dark:bg-slate-800";
    let iconColor = "text-slate-500";
    let iconStyle = {};

    if (pkg.id === 'user') {
        iconBg = "bg-amber-100 dark:bg-amber-900/30";
        iconColor = "text-amber-600 dark:text-amber-500";
    } else if (pkg.type === 'official') {
        iconBg = "bg-slate-200 dark:bg-slate-700";
        iconColor = "text-slate-500 dark:text-slate-400";
    } else if (pkg.color) {
        iconStyle = { backgroundColor: pkg.color, color: '#fff' };
        iconBg = ""; // override
        iconColor = ""; // override
    }
    return { iconBg, iconColor, iconStyle };
};

const ContentSection = ({ label, items, type, onNavigate, pkg }: { label: string, items: any[], type: 'dictionary' | 'list' | 'word' | 'sentence', onNavigate: any, pkg: any }) => {
    const [expanded, setExpanded] = useState(false);
    if (!items || items.length === 0) return null;

    const { iconBg, iconColor, iconStyle } = getIconStyles(pkg);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-3">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg} ${iconColor}`} style={iconStyle}>
                        {type === 'dictionary' ? <Folder size={18} /> : <ListIcon size={18} />}
                    </div>
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
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                    {items.map(item => (
                        <div
                            key={item.id}
                            onClick={() => onNavigate(type, item.id)}
                            className="p-3 pl-14 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors font-medium text-slate-700 dark:text-slate-300"
                        >
                            {item.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const PackageDetailView: React.FC<PackageDetailViewProps> = ({ packageId, onBack, customLists, onNavigate, onReadInContext }) => {
    const { packages, importedData } = usePackageManager(); // importedData needed for official/imported packages
    const {
        customDictionaries, personalWords, userSentences,
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
            const cleanId = String(id).replace('_sentence', '').replace(/^s_/, '');

            if (type === 'W') {
                // 1. Check personal words
                let found: any = personalWords.find(w => w.Index === cleanId || w.id === cleanId);
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
                let found = userSentences.find(s => s.id === cleanId);
                if (found) return found;
                // 2. Check base sentences
                found = sentences.find(s => s.id === cleanId);
                if (found) return found;
                // 3. Check all packages
                for (const pId in importedData) {
                    found = importedData[pId].sentences?.find((s: any) => s.id === cleanId);
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
            const targetIdStr = String(targetId);
            const isSentence = targetIdStr.endsWith('_sentence') || targetIdStr.startsWith('s_');
            const cleanId = targetIdStr.replace('_sentence', '').replace(/^s_/, '');
            const typeHint = isSentence ? 'S' : 'W';

            if (forcePkg) {
                const found = forcePkg.dictionary?.find((d: any) => d.id === cleanId || d.Index === cleanId) ||
                    forcePkg.sentences?.find((s: any) => s.id === cleanId || (s as any).ID === cleanId);
                if (found) return found;
            }

            // Search with hint
            let res = findAnywhere(cleanId, typeHint);
            if (!res) res = findAnywhere(cleanId, typeHint === 'W' ? 'S' : 'W'); // Fallback to other type
            return res;
        };

        if (isUser) {
            // User Data
            const dictionaryList = Object.values(customDictionaries);

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
                const parent = getParent(key);
                if (val) {
                    notesList.push({ id: key, text: val, parent });
                }
            });

            // Word Forms
            const formsList: any[] = [];
            Object.entries(userWordForms).forEach(([key, val]) => {
                const parent = getParent(key);
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
                dictionaries: dictionaryList.map(n => ({ ...n, count: 1 })),
                words: personalWords.map(w => ({ ...w, source: w.customDictionaryId || w.source })), // Ensure customDictionaryId is used for source
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
            let wordForms: any[] = [];

            if (pData.word_forms) {
                // Group by word_index to ensure one card per word
                const groupedMap = new Map<string, any[]>();
                pData.word_forms.forEach((f: any) => {
                    const idx = f.word_index;
                    if (!groupedMap.has(idx)) groupedMap.set(idx, []);
                    groupedMap.get(idx)!.push(f);
                });

                groupedMap.forEach((forms, idx) => {
                    const parent = findAnywhere(idx, 'W');
                    wordForms.push({
                        id: `group_${idx}`,
                        forms: forms, // Array of form objects
                        parent,
                        isGrouped: true
                    });
                });
            } else if (pData.dictionary) {
                // Legacy: Check Other_Forms string in dictionary
                pData.dictionary.forEach((entry: any) => {
                    if (entry.Other_Forms) {
                        const forms = entry.Other_Forms.split('|').filter((f: string) => f.includes(':'));
                        if (forms.length > 0) {
                            wordForms.push({
                                id: `official_${entry.id}`,
                                forms: entry.Other_Forms, // String
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
                parent: getParent(n.target_id, undefined, pData)
            })) || [];

            const glosses = (pData.glosses || []).map((g: any) => {
                const sent = pData.sentences?.find((s: any) => s.id === g.sentence_id);
                const linkedEntry = findAnywhere(g.entry_id, 'W');
                return { ...g, sentence: sent, linkedEntry };
            });

            return {
                dictionaries: [],
                words: pData.dictionary || [],
                sentences: pData.sentences || [],
                audio: audioList,
                glosses: glosses,
                lists: pData.lists || [],
                notes: notes,
                wordForms: wordForms
            };
        }
    }, [isUser, isOfficial, pkg.id, importedData, customDictionaries, personalWords, userSentences, userAudioMeta, glosses, userNotes, userWordForms, dictionary, sentences, customLists]);

    if (!data) return <div className="p-8 text-center text-slate-400">Loading package data...</div>;

    if (selectedEntry) {
        return (
            <EntryDetail
                entry={selectedEntry}
                customDictionaries={customDictionaries}
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
                onReadInContext={onReadInContext}
            />
        );
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
                    {data.dictionaries && data.dictionaries.length > 0 && (
                        <ContentSection
                            label="Dictionaries"
                            items={data.dictionaries}
                            type="dictionary"
                            onNavigate={onNavigate}
                            pkg={pkg}
                        />
                    )}


                <SectionItem
                    icon={null}
                    label="Lists"
                    items={data.lists}
                    type="list"
                    pkg={pkg}
                    onNavigate={onNavigate}
                />

                <SectionItem
                    icon={null}
                    label="Words"
                    items={data.words || []}
                    searchable
                    type="word"
                    pkg={pkg}
                    onItemClick={setSelectedEntry}
                    extraProps={{ customDictionaries, userNotes, userAudioMeta, userWordForms, favorites: [], customLists: {} }}
                     // Pass required props for EntryCard
                />

                <SectionItem
                    icon={null}
                    label="Sentences"
                    items={data.sentences || []}
                    searchable
                    type="sentence"
                    pkg={pkg}
                    onItemClick={setSelectedEntry}
                />

                <SectionItem
                    icon={<Mic size={20} />}
                    label="Audio"
                    items={data.audio}
                    type="audio"
                    pkg={pkg}
                    onNavigate={onNavigate}
                />

                <SectionItem
                    icon={<SquaresPlus size={20} />}
                    label="Word Forms"
                    items={data.wordForms}
                    type="form"
                    pkg={pkg}
                    onNavigate={onNavigate}
                />

                <SectionItem
                    icon={<StickyNote size={20} />}
                    label="Notes"
                    items={data.notes}
                    type="note"
                    pkg={pkg}
                    onNavigate={onNavigate}
                />

                <SectionItem
                    icon={<ListPlus size={20} />}
                    label="Glosses"
                    items={data.glosses}
                    type="gloss"
                    pkg={pkg}
                    onNavigate={onNavigate}
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
    extraProps,
    pkg,
    onNavigate
}: {
    icon: React.ReactNode,
    label: string,
    items: any[],
    searchable?: boolean,
    type: 'word' | 'sentence' | 'audio' | 'gloss' | 'list' | 'note' | 'form' | 'dictionary',
    onItemClick?: (item: any) => void,
    extraProps?: any,
    pkg: any,
    onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void
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

    const { iconBg, iconColor, iconStyle } = getIconStyles(pkg);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {icon && (
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}
                            style={iconStyle}
                        >
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
                                {type === 'audio' && <AudioCard audio={item} pkg={pkg} onNavigate={onNavigate} />}
                                {type === 'note' && <NoteCard note={item} onNavigate={onNavigate} />}
                                {type === 'form' && <WordFormCard form={item} onNavigate={onNavigate} />}
                                {type === 'gloss' && <GlossCard gloss={item} onNavigate={onNavigate} />}
                                {type === 'list' && <ListCard list={item} onNavigate={onNavigate} />}
                                {type === 'dictionary' && (
                                    <div
                                        onClick={() => onNavigate && onNavigate('dictionary', item.id)}
                                        className="p-3 pl-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                    >
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

const EntryPreview = ({ entry, onNavigate }: { entry: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => {
    if (!entry) return null;
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                if (onNavigate) onNavigate('word', entry);
            }}
            className="mb-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm cursor-pointer hover:border-amber-400 dark:hover:border-amber-700 transition-colors"
        >
            <span className="font-noto-cherokee font-bold text-slate-900 dark:text-slate-100">{entry.syllabary || entry.Syllabary}</span>
            <span className="font-noto-serif italic text-slate-600 dark:text-slate-400 border-r border-slate-300 dark:border-slate-700 pr-3">{entry.translit || entry.Entry || entry.entry}</span>
            <span className="text-slate-500 dark:text-slate-500">{entry.definition || entry.english || entry.Definition}</span>
        </div>
    );
};

const CompactSentenceCard = ({ sentence, onClick }: { sentence: any, onClick?: (s: any) => void }) => {
    const { getPackageColor } = usePackageManager();
    const { customDictionaries } = useCorpus();
    return (
        <div
            onClick={() => onClick && onClick(sentence)}
            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative"
        >
            <div className="font-noto-cherokee text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{sentence.syllabary}</div>
            <div className="font-noto-serif text-amber-700 dark:text-amber-400 text-sm italic mb-1">{sentence.translit}</div>
            <div className="text-slate-600 dark:text-slate-400 text-sm">{sentence.english}</div>
            <div className="absolute top-4 right-4">
                <SourceBadge
                    source={sentence.source}
                    name={customDictionaries[sentence.source]?.name}
                    customColor={getPackageColor(sentence.source)}
                />
            </div>
        </div>
    );
};

const AudioCard = ({ audio, pkg, onNavigate }: { audio: any, pkg: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => {
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
            const isOfficial = audio.packageId === 'official-cherokee-data';
            const audioId = audio.id;

            if (isOfficial) {
                url = audioId.startsWith('http') ? audioId : `/data/audio/${audioId}`;
            } else if (audio.src) {
                url = audio.src;
            } else {
                const data = await getAudioFromDB(audioId);
                if (data) {
                    const blob = new Blob([data as Blob], { type: 'audio/mp3' });
                    url = URL.createObjectURL(blob);
                }
            }

            if (url) {
                const a = new Audio(url);
                audioRef.current = a;
                a.onended = () => { setPlaying(false); if (!isOfficial && !audio.src) URL.revokeObjectURL(url); };
                a.onplay = () => setPlaying(true);
                a.play();
            }
        } catch (e) { console.error(e); }
    };

    const isOfficial = audio.packageId === 'official-cherokee-data';
    const speakerName = isOfficial ? (audio.id.split('_')[0] || 'Official Speaker') : (audio.speaker || 'Unknown Speaker');

    return (
        <div className="p-4">
            {parent ? <EntryPreview entry={parent} onNavigate={onNavigate} /> : <div className="text-xs text-slate-400 italic mb-2">Attached to unknown entry ({audio.entryIndex})</div>}

            <div className="flex items-center gap-3 mt-2">
                <button
                    onClick={playAudio}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${playing ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : 'text-white'}`}
                    style={{ backgroundColor: playing ? undefined : pkg.color }}
                >
                    {playing ? <Pause size={14} className="fill-current" /> : <Volume2 size={14} />}
                </button>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{speakerName}</span>
                    <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{audio.id}</span>
                </div>
            </div>
        </div>
    );
};

const NoteCard = ({ note, onNavigate }: { note: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => {
    const { parent } = note;
    return (
        <div className="p-4">
            {parent && <EntryPreview entry={parent} onNavigate={onNavigate} />}
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-serif pl-2 border-l-2 border-amber-300 dark:border-amber-700 mt-2">
                {note.text}
            </div>
        </div>
    );
};

const WordFormCard = ({ form, onNavigate }: { form: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => {
    const { parent } = form;

    let formsData: { label: string, value: string, desc: string }[] = [];

    if (Array.isArray(form.forms)) {
        // Grouped objects from imported data
        formsData = form.forms.map((f: any) => ({
            label: f.form_name,
            value: f.syllabary,
            desc: f.translit
        }));
    } else if (form.isRaw) {
        // Official raw string forms
        const { forms } = form;
        const parts = forms.split('|').filter((f: string) => f.includes(':'));
        formsData = parts.map((part: string) => {
            const [label, vals] = part.split(':');
            const values = vals.split('^');
            return { label, value: values[1], desc: values[0] };
        });
    } else {
        // User forms: might be object or raw
        // The detailed structure depends on how userWordForms are saved.
        // Assuming user forms might need parsing or are just simple entries
        // Based on current implementation, user forms are passed as "forms".
        // Use a generic display if not structured.
        if (typeof form.forms === 'string') {
            const parts = form.forms.split('|').filter((f: string) => f.includes(':'));
            if (parts.length > 0) {
                formsData = parts.map((part: string) => {
                    const [label, vals] = part.split(':');
                    const values = vals.split('^');
                    if (values.length >= 3) {
                        // Format: desc^syl^tr
                        const v = values[1] || "";
                        return { label, value: v, desc: values[2] || values[0] };
                    } else if (values.length === 2) {
                        // Format: syl^tr
                        return { label, value: values[0], desc: values[1] };
                    }
                    // Handle single values: If it looks like Cherokee, use value. If Latin, use desc.
                    const isCherokee = /[\u13A0-\u13FF]/.test(vals);
                    return { label, value: isCherokee ? vals : '', desc: isCherokee ? '' : vals };
                });
            } else {
                formsData = [{ label: 'Custom', value: form.forms, desc: '' }];
            }
        }
    }

    // Fallback for single form object (importedData sometimes has array of objects)
    if (!form.isRaw && form.form_name) {
        formsData.push({ label: form.form_name, value: form.syllabary, desc: form.translit });
    }

    return (
        <div className="p-4">
            <EntryPreview entry={parent} onNavigate={onNavigate} />
            <div className="space-y-2 mt-4">
                {formsData.map((item, i) => (
                    <div key={i} className="flex flex-col border-l-2 border-amber-200 dark:border-amber-900/50 pl-3">
                        <span className="text-[10px] font-bold text-amber-600 uppercase">{item.label}</span>
                        <span className="font-noto-cherokee font-medium text-slate-800 dark:text-slate-200">{item.value}</span>
                        {item.desc && <span className="font-noto-serif italic text-slate-500 text-xs">{item.desc}</span>}
                    </div>
                ))}
            </div>
        </div>
    );
};

const GlossCard = ({ gloss, onNavigate }: { gloss: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => {
    const { sentence, linkedEntry } = gloss;
    if (!sentence) return <div className="p-4 text-xs text-red-400">Orphaned Gloss</div>;

    const tokens = useMemo(() => {
        const syl = (sentence.syllabary || "").split(' ');
        const tr = (sentence.translit || "").split(' ');
        const max = Math.max(syl.length, tr.length);
        const res: { syl: string, tr: string, index: number }[] = [];
        for (let i = 0; i < max; i++) {
            res.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
        }
        return res;
    }, [sentence]);

    // word_index can be "0", "0,1", etc. (0-based as per SentenceCard logic)
    const targetIndices = (gloss.word_index || "0").split(',').map(Number);

    const { getPackageColor } = usePackageManager(); // Ensure we have this for colors
    const glossColor = (() => {
        const colorName = getPackageColor(gloss.source);
        if (colorName?.startsWith('#')) return colorName;
        const COLORS: Record<string, string> = {
            amber: '#fbbf24', slate: '#cbd5e1', blue: '#60a5fa', red: '#f87171', green: '#4ade80'
        };
        return COLORS[colorName || 'amber'] || COLORS.amber;
    })();

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

            <div
                onClick={() => onNavigate && onNavigate('sentence', sentence)}
                className="flex flex-wrap gap-x-2 gap-y-4 mb-2 mt-1 cursor-pointer group/sentence"
            >
                {tokens.map((token, i) => {
                    const isTarget = targetIndices.includes(i);
                    return (
                        <div key={i} className={`flex flex-col items-center transition-all ${isTarget ? 'opacity-100' : 'opacity-40 grayscale group-hover/sentence:opacity-60 group-hover/sentence:grayscale-0'}`}>
                            <div className="relative flex flex-col items-center">
                                <span className={`font-noto-cherokee text-lg leading-none ${isTarget ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {token.syl}
                                </span>
                                {isTarget && (
                                    <div
                                        className="h-[2px] rounded-full w-full mt-1"
                                        style={{ backgroundColor: glossColor }}
                                    />
                                )}
                            </div>
                            <span className="font-noto-serif text-[10px] italic text-slate-500 mt-1">{token.tr}</span>
                        </div>
                    );
                })}
            </div>

            <div
                onClick={() => onNavigate && onNavigate('sentence', sentence)}
                className="mb-4 text-sm text-slate-600 dark:text-slate-300 italic cursor-pointer hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
                {sentence.english || sentence.definition}
            </div>

            <EntryPreview entry={linkedEntry} onNavigate={onNavigate} />

            {igtSegments.length > 0 && (
                <div className="mb-3 overflow-x-auto pb-2 mt-2">
                    <div className="flex gap-3 min-w-max border-t border-b border-slate-100 dark:border-slate-800 py-3">
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
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-sm border-l-4 border-slate-300 dark:border-slate-600 mt-2">
                    <div className="font-mono text-[10px] text-slate-500 mb-1 uppercase tracking-widest">Morphology / Notes</div>
                    <div className="text-slate-800 dark:text-slate-200">{gloss.notes}</div>
                </div>
            )}
        </div>
    );
};

const ListCard = ({ list, onNavigate }: { list: any, onNavigate?: (type: 'dictionary' | 'list' | 'word' | 'sentence', payload: any) => void }) => (
    <div
        onClick={() => onNavigate && onNavigate('list', list.id)}
        className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
    >
        <div className="flex items-center gap-3">
            <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">{list.name}</div>
                <div className="text-xs text-slate-500">{list.count} items</div>
            </div>
        </div>
    </div>
); // Note: Corrected placement of ListCard to ensure valid TSX
