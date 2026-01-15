import React, { useState } from 'react';
import { ArrowLeft, Pencil, ListPlus, Star, ListIcon, X, Plus, Folder, Pause, MicPlus, Trash2, Mic, ChevronRight } from './Icons';
import { AudioPlayer, SourceBadge } from './UI';
import { renderStyledText, getAudioFromDB } from '../utils';
import { usePackageManager } from './PackageManagerContext';
import AudioRecorder from './AudioRecorder';
import { useCorpus } from './CorpusContext';
import { SentenceCard } from './SentenceCard';
import { WordFormsModal } from './WordFormsModal';

const EntryDetail = ({ entry, customDictionaries, userNotes, userAudioMeta, userWordForms, onSaveAudio, onDeleteAudio, favorites, customLists, customListOrder, onClose, onEdit, onToggleFavorite, onToggleList, onDelete, onSearchTerm, onOpenNewListModal, onMove, personalWords, onEditSentence, onDeleteSentence, onCreateWord, onManageForms, onReadInContext }) => {
    const [showListSheet, setShowListSheet] = useState(false);
    const [showRecorder, setShowRecorder] = useState(false);
    const [recorderTarget, setRecorderTarget] = useState<'entry' | 'sentence' | string>('entry');
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const [showWordFormsModal, setShowWordFormsModal] = useState(false);

    const audioRef = React.useRef(new Audio());
    const containerRef = React.useRef<HTMLDivElement>(null);
    const sentenceListRef = React.useRef<HTMLDivElement>(null);

    // Reset scroll when entry changes
    React.useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
        if (sentenceListRef.current) sentenceListRef.current.scrollLeft = 0;
    }, [entry.Index]);

    const { entryToSentencesMap, sentenceMap } = useCorpus();

    // Determine audio color based on package
    const { getPackageColor, packages, importedData } = usePackageManager();

    const handlePlayUserAudio = async (audio: any) => {
        if (playingAudioId === audio.id) {
            audioRef.current.pause();
            setPlayingAudioId(null);
            return;
        }

        try {
            if (audio.src) {
                audioRef.current.src = audio.src;
                audioRef.current.onended = () => setPlayingAudioId(null);
                audioRef.current.play();
                setPlayingAudioId(audio.id);
                return;
            }

            // Official Audio (File-based)
            if (audio.packageId === 'official-cherokee-data' || audio.packageId?.startsWith('official')) {
                const url = `/data/audio/${audio.id}`;
                audioRef.current.src = url;
                audioRef.current.onended = () => setPlayingAudioId(null);
                audioRef.current.play();
                setPlayingAudioId(audio.id);
                return;
            }

            const data = await getAudioFromDB(audio.id);
            if (data) {
                const blob = new Blob([data as Blob], { type: 'audio/mp3' });
                const url = URL.createObjectURL(blob);
                audioRef.current.src = url;
                audioRef.current.onended = () => {
                    setPlayingAudioId(null);
                    URL.revokeObjectURL(url);
                };
                audioRef.current.play();
                setPlayingAudioId(audio.id);
            }
        } catch (e) {
            console.error("Failed to play audio", e);
        }
    };

    const handleLongPressAudio = (audioId, entryIndexOverride = null) => {
        if (window.confirm("Delete this recording?")) {
            onDeleteAudio(entryIndexOverride || entry.Index, audioId);
        }
    };

    if (!entry) return null;
    const e = entry;
    const isFav = favorites.includes(e.Index);
    const isPersonal = !!customDictionaries[e.Source];

    // CHANGE: Ignore CSV notes (e.Notes) for non-personal words. Only use userNotes.
    const noteContent = isPersonal ? e.Notes : (userNotes[e.Index] || '');

    // Get linked sentences
    const linkedSentenceIds = entryToSentencesMap.get(e.Index) || [];
    const linkedSentences = linkedSentenceIds.map(id => sentenceMap.get(id)).filter(Boolean);


    // HANDLE SENTENCE VIEW (If entry is a sentence object)
    if (e.english && !e.Definition) {
        return (
            <div className="absolute inset-0 z-0 bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 pb-24">
                                            <SentenceCard sentence={e} onSaveAudio={onSaveAudio} userAudioMeta={userAudioMeta} personalWords={personalWords} onDeleteAudio={onDeleteAudio}
                                                favorites={favorites} customLists={customLists} onToggleFavorite={onToggleFavorite} onToggleList={onToggleList} onOpenNewListModal={onOpenNewListModal}
                                                onReadInContext={onReadInContext}
                                            />
                    <div className="mt-12 text-xs text-slate-300 font-mono text-center">Ref ID: {e.id}</div>
                </div>
            </div>
        );
    }

    // Check editable status
    const pkg = packages.find(p => p.status === 'active' && (p.id === e.Source || (p.metadata.source_names && p.metadata.source_names[e.Source])));
    const isEditablePackage = pkg?.metadata.editable === 'Yes';
    const canEdit = isPersonal || isEditablePackage;

    const importedNotes = React.useMemo(() => {
        const list: any[] = [];
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.notes) {
                // Find note for this word (type 'W')
                const note = importedData[p.id].notes!.find((n: any) => n.target_id === e.Index && n.type === 'W');
                if (note) {
                    list.push({ ...note, color: p.color, pkgName: p.name });
                }
            }
        });
        return list;
    }, [packages, importedData, e.Index]);

    const importedForms = React.useMemo(() => {
        const list: any[] = [];
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === e.Index);
                if (forms.length > 0) {
                    forms.forEach(f => list.push({ ...f, color: p.color, pkgName: p.name }));
                }
            }
        });
        return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [packages, importedData, e.Index]);



    const activeFormData = React.useMemo(() => {
        if (!recorderTarget || recorderTarget === 'entry' || recorderTarget === 'sentence') return null;

        const parts = recorderTarget.split('_');
        if (parts.length < 2) return null;
        const targetIndex = parseInt(parts[1]);
        if (isNaN(targetIndex)) return null;

        // Check Official Forms
        let officialCount = 0;
        if (e.Other_Forms) {
            const forms = e.Other_Forms.split('|');
            officialCount = forms.length;
            if (targetIndex >= 1 && targetIndex <= forms.length) {
                const f = forms[targetIndex - 1];
                const parts = f.split(':');
                if (parts.length >= 2) {
                    const values = parts[1].split('^');
                    return {
                        label: parts[0],
                        translit: values[0],
                        syllabary: values[1],
                        tone: values[2],
                        notes: values[3]
                    };
                }
            }
        }

        // Check Imported Forms
        const imported = importedForms.find(f => f.computed_index === targetIndex);
        if (imported) {
            return {
                label: imported.form_name,
                translit: imported.translit,
                syllabary: imported.syllabary,
                tone: imported.tone,
                notes: imported.notes
            };
        }

        // Check Custom Forms
        if (userWordForms && userWordForms[e.Index]) {
            const forms = userWordForms[e.Index].split('|');
            const customArrayIndex = targetIndex - officialCount - 1;

            if (customArrayIndex >= 0 && customArrayIndex < forms.length) {
                const f = forms[customArrayIndex];
                const parts = f.split(':');
                if (parts.length >= 2) {
                    const values = parts[1].split('^');
                    return {
                        label: parts[0],
                        translit: values[0],
                        syllabary: values[1],
                        tone: values[2],
                        notes: values[3]
                    };
                }
            }
        }

        return null;
    }, [recorderTarget, e, importedForms, userWordForms]);

    const hasForms = e.Other_Forms || (userWordForms && userWordForms[e.Index]) || importedForms.length > 0;

    return (
        <div className="absolute inset-0 z-0 bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" /></button>
                <div className="flex gap-2">{canEdit && <button onClick={() => onEdit(e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><Pencil size={20} /></button>}<button onClick={() => setShowListSheet(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><ListPlus size={24} /></button><button onClick={() => onToggleFavorite(e.Index)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Star size={24} className={isFav ? "fill-amber-400 text-amber-400" : "text-slate-400 dark:text-slate-500"} /></button></div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-y-auto p-5 pb-24">
                <div className="mb-2"><div className="flex items-start justify-between mb-2"><h1 className="font-noto-cherokee text-4xl font-bold text-slate-900 dark:text-slate-100">{e.Syllabary}</h1><SourceBadge source={e.Source} name={customDictionaries[e.Source]?.name} /></div><h2 className="font-noto-serif text-2xl text-amber-800 dark:text-amber-400 font-medium mb-1">{e.Entry}</h2>{e.Entry_Tone && <div className="font-sans text-lg text-slate-500 dark:text-slate-400 italic">{e.Entry_Tone}</div>}</div>

                {/* CONTENT */}
                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="space-y-6">
                        {/* METADATA ROW 1: Audio */}
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <AudioPlayer
                                src={e.Entry_Audio ? `/data/audio/${e.Entry_Audio}` : undefined}
                                label="Official"
                                icon={Mic}
                                variant="gray"
                                customColor={pkg?.type !== 'official' ? pkg?.color : undefined}
                                showNoAudioMessage={!((userAudioMeta && userAudioMeta[e.Index] && userAudioMeta[e.Index].length > 0) || e.Entry_Audio)}
                            />
                            {/* USER AUDIO LIST */}
                            {userAudioMeta && userAudioMeta[e.Index] && userAudioMeta[e.Index]
                                .filter(audio => {
                                    // Exclude form audio from main list (check for sub-ID pattern like -10.1_)
                                    if (audio.id.includes(`-${e.Index}.`)) return false;

                                    if (!audio.packageId) {
                                        const userPkg = packages.find(p => p.id === 'user');
                                        return userPkg ? userPkg.status === 'active' : true;
                                    }
                                    const pkg = packages.find(p => p.id === audio.packageId);
                                    return pkg && pkg.status === 'active';
                                })
                                .map(audio => {
                                    const audioPkg = packages.find(p => p.id === audio.packageId);
                                    const isOfficial = audioPkg ? audioPkg.type === 'official' : false;

                                    // Determine color for this specific audio file
                                    const audioPkgColor = getPackageColor(audio.packageId || 'user');
                                    const isCustomAudioColor = audioPkgColor && audioPkgColor.startsWith('#');

                                    let className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm group ";
                                    let style = {};

                                    if (isOfficial) {
                                        className += playingAudioId === audio.id ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
                                    } else if (isCustomAudioColor) {
                                        // Use custom package color
                                        if (playingAudioId === audio.id) {
                                            style = {
                                                backgroundColor: audioPkgColor + '20', // ~12% opacity
                                                color: audioPkgColor,
                                                borderColor: audioPkgColor
                                            };
                                        } else {
                                            style = {
                                                backgroundColor: audioPkgColor,
                                                color: 'white'
                                            };
                                        }
                                    } else if (audioPkgColor && audioPkgColor !== 'slate') {
                                        className += playingAudioId === audio.id ? `bg-${audioPkgColor}-100 dark:bg-${audioPkgColor}-900 text-${audioPkgColor}-800 dark:text-${audioPkgColor}-100` : `bg-${audioPkgColor}-500 text-white hover:bg-${audioPkgColor}-600`;
                                    } else {
                                        // Default Amber behavior
                                        className += playingAudioId === audio.id ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600';
                                    }

                                    return (
                                        <div key={audio.id} className={className} style={style}>
                                            <button
                                                onClick={() => handlePlayUserAudio(audio)}
                                                className="flex items-center gap-2"
                                            >
                                                {playingAudioId === audio.id ? <Pause size={12} className="fill-current" /> : <Mic size={12} />}
                                                <span>{playingAudioId === audio.id ? 'Playing...' : (audio.speaker || 'User')}</span>
                                            </button>
                                            {!isOfficial && (
                                                <button onClick={(e) => { e.stopPropagation(); handleLongPressAudio(audio.id); }} className="ml-1 pl-2 border-l border-white/20 hover:text-red-200 transition-colors flex items-center">
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            <button onClick={() => { setRecorderTarget('entry'); setShowRecorder(true); }} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors">
                                <MicPlus size={20} />
                            </button>
                        </div>

                        {/* METADATA ROW 2: Tags */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {favorites.includes(e.Index) && <span className="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 font-medium text-xs flex items-center gap-1"><Star size={12} /> Favorites</span>}
                            {Object.keys(customLists).filter(k => {
                                const list = customLists[k];
                                if (Array.isArray(list)) return list.includes(e.Index);
                                return list?.items?.includes(e.Index);
                            }).map(id => {
                                const list = customLists[id];
                                const name = Array.isArray(list) ? id : list.name;
                                return (
                                    <span key={id} className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 font-medium text-xs flex items-center gap-1">
                                        <ListIcon size={12} /> {name}
                                    </span>
                                );
                            })}
                        </div>

                        <hr className="border-slate-200 dark:border-slate-800 mb-6" />

                        {/* DEFINITION SECTION */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Definition</h3>
                            <p className="font-noto-serif text-lg text-slate-800 dark:text-slate-200 leading-relaxed">
                                {renderStyledText(e.Definition)}
                                {/* PoS Moved Here (After) */}
                                {e.PoS && <span className="text-slate-400 dark:text-slate-500 italic ml-2 text-base font-normal">({e.PoS})</span>}
                                {e.Definition_Long && <span className="block mt-2 text-slate-600 dark:text-slate-400 text-base">{renderStyledText(e.Definition_Long)}</span>}
                            </p>
                        </div>

                        {/* OTHER FORMS SECTION (New Button Style) */}
                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Word Forms</h3>
                            {hasForms ? (
                                <button
                                    onClick={() => setShowWordFormsModal(true)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500/50 p-4 rounded-xl flex items-center justify-between group transition-all"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-lg text-amber-600 dark:text-amber-500">
                                            <Folder size={20} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-slate-800 dark:text-slate-200">See Word Forms</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-amber-600 transition-colors">
                                                Tap to view conjugations & recordings
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 transition-colors" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => onManageForms(e)}
                                    className="text-xs font-bold text-slate-400 hover:text-amber-600 flex items-center gap-1 uppercase tracking-wide italic"
                                >
                                    <Plus size={14} /> Add a form...
                                </button>
                            )}
                        </div>

                        {(e.Sentence_Syllabary || e.Sentence_English) && (<div className="mb-8 bg-amber-50/50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30"><h3 className="text-sm font-bold text-amber-800/60 dark:text-amber-200/60 uppercase tracking-widest mb-3 flex items-center gap-2">Example Sentence</h3>{e.Sentence_Syllabary && <p className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-200 mb-2">{renderStyledText(e.Sentence_Syllabary)}</p>}{e.Sentence_Transliteration && <p className="font-noto-serif text-md text-slate-600 dark:text-slate-400 italic mb-2">{renderStyledText(e.Sentence_Transliteration)}</p>}{e.Sentence_English && <p className="font-noto-serif text-md text-slate-800 dark:text-slate-200 font-medium">{renderStyledText(e.Sentence_English)}</p>}<div className="mt-4 flex items-center gap-3 flex-wrap"><AudioPlayer src={e.Sentence_Audio} label="Play Sentence" icon={Mic} customColor={pkg?.type !== 'official' ? pkg?.color : undefined} /></div></div>)}

                        {/* SENTENCES SECTION (Horizontal Scroll) - Moved Above Notes */}
                        {linkedSentences.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Sentences ({linkedSentences.length})</h3>
                                <div ref={sentenceListRef} className="flex overflow-x-auto gap-4 pb-4 snap-x">
                                    {linkedSentences.map((s: any) => (
                                        <div key={s.id} className="min-w-[85vw] md:min-w-[400px] snap-center">
                                            <SentenceCard sentence={s} userNotes={userNotes} onEditNote={(_, note) => onEdit(s, note, true)} onSaveAudio={onSaveAudio} userAudioMeta={userAudioMeta} onEditSentence={onEditSentence} onDeleteSentence={onDeleteSentence} onDeleteAudio={onDeleteAudio} onCreateWord={onCreateWord} personalWords={personalWords} customDictionaries={customDictionaries}
                                                favorites={favorites}
                                                customLists={customLists}
                                                onToggleFavorite={onToggleFavorite}
                                                onToggleList={onToggleList}
                                                onOpenNewListModal={onOpenNewListModal}
                                                onReadInContext={onReadInContext}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mb-8">
                            <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes</h3>

                            {/* Imported Notes */}
                            {importedNotes.map((note, i) => (
                                <div key={i} className={`mb-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-sm border-l-4`} style={{ borderLeftColor: note.color }}>
                                    {note.text}
                                </div>
                            ))}

                            {/* User Note */}
                            <div onClick={() => onEdit(e, noteContent, true)} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-amber-200 transition-colors relative group border-l-4 border-l-amber-500">
                                {noteContent || <span className="text-slate-400 italic">Add a note...</span>}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm"><Pencil size={14} className="text-amber-600" /></div>
                            </div>
                        </div>
                        {e.Cross_Reference && (<div className="mb-8"><h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">See Also</h3><div className="flex flex-wrap gap-2">{e.Cross_Reference.split(',').map((ref, i) => <button key={i} onClick={() => onSearchTerm(ref.trim())} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-slate-600 dark:text-slate-300 text-sm shadow-sm hover:border-amber-500 hover:text-amber-600 transition-colors">{ref.trim()}</button>)}</div></div>)}


                    </div>
                </div>
                {isPersonal && (
                    <div className="mt-12 space-y-3">
                        <button onClick={() => onMove(e.Index)} className="w-full py-3 text-sky-700 dark:text-sky-400 font-bold bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-900/50 flex items-center justify-center gap-2">
                            <Folder size={20} /> Move to Custom Dictionary
                        </button>
                        <button onClick={() => onDelete(e.Index)} className="w-full py-3 text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">Delete Word</button>
                    </div>
                )}
                <div className="mt-12 text-xs text-slate-300 font-mono text-center">Ref Index: {e.Index} | Source: {e.Source_Long}</div>
            </div>
            {showListSheet && (<div className="absolute inset-0 z-[60] flex flex-col justify-end"><div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setShowListSheet(false)}></div><div className="bg-white dark:bg-slate-900 w-full rounded-t-2xl p-4 shadow-2xl animate-slide-up-sheet relative z-10 max-h-[70vh] flex flex-col"><div className="flex justify-between items-center mb-4 shrink-0"><h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add to List</h3><button onClick={() => setShowListSheet(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X size={20} className="dark:text-slate-200" /></button></div><div className="overflow-y-auto flex-1 space-y-2 mb-4"><label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer"><input type="checkbox" checked={favorites.includes(e.Index)} onChange={() => onToggleFavorite(e.Index)} className="w-5 h-5 accent-amber-500" /><div className="flex items-center gap-2"><Star size={18} className="text-amber-500 fill-amber-500" /><span className="font-bold text-slate-700 dark:text-slate-200">Favorites</span></div></label>{customListOrder.map(listId => {
                const list = customLists[listId];
                if (!list) return null;
                const isChecked = Array.isArray(list) ? list.includes(e.Index) : list.items.includes(e.Index);
                const name = Array.isArray(list) ? listId : list.name;
                return (
                    <label key={listId} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                        <input type="checkbox" checked={isChecked} onChange={() => onToggleList(listId, e.Index)} className="w-5 h-5 accent-amber-500" />
                        <div className="flex items-center gap-2">
                            <ListIcon size={18} className="text-slate-500" />
                            <span className="font-medium text-slate-700 dark:text-slate-200">{name}</span>
                        </div>
                    </label>
                );
            })}</div><button onClick={() => { setShowListSheet(false); onOpenNewListModal(e.Index); }} className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shrink-0"><Plus size={20} /> Create New List</button></div></div>)}
            {
                showRecorder && (
                    <AudioRecorder
                        title={recorderTarget === 'entry' ? e.Entry : (recorderTarget === 'sentence' ? (e.Sentence_English || "Example Sentence") : (activeFormData ? activeFormData.translit : `Form Audio`))}
                        syllabary={recorderTarget === 'entry' ? e.Syllabary : (recorderTarget === 'sentence' ? e.Sentence_Syllabary : (activeFormData ? activeFormData.syllabary : null))}
                        transliteration={recorderTarget === 'entry' ? null : (recorderTarget === 'sentence' ? e.Sentence_Transliteration : null)}
                        onSave={(blob, speaker) => {
                            if (typeof recorderTarget === 'string' && recorderTarget.startsWith('form_')) {
                                const formIndex = parseInt(recorderTarget.split('_')[1]);
                                onSaveAudio(e.Index, blob, speaker, formIndex);
                            } else {
                                const targetIndex = recorderTarget === 'entry' ? e.Index : e.Index + '_sentence';
                                onSaveAudio(targetIndex, blob, speaker);
                            }
                            setShowRecorder(false);
                        }}
                        onCancel={() => setShowRecorder(false)}
                    />
                )
            }
            <WordFormsModal
                isOpen={showWordFormsModal}
                onClose={() => setShowWordFormsModal(false)}
                entry={e}
                userWordForms={userWordForms}
                onManageForms={onManageForms}
                userAudioMeta={userAudioMeta}
                onPlayAudio={handlePlayUserAudio}
                playingAudioId={playingAudioId}
                onRecordAudio={(target) => {
                    setRecorderTarget(target);
                    setShowRecorder(true);
                }}
                onDeleteAudio={onDeleteAudio}
                getPackageColor={getPackageColor}
                packages={packages}
                importedData={importedData}
            />
        </div>
    );
};

export default EntryDetail;
