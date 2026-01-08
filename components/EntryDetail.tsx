import React, { useState } from 'react';
import { ArrowLeft, Pencil, ListPlus, Star, ListIcon, X, Plus, Folder, Pause, MicPlus, Trash2, Mic } from './Icons';
import { AudioPlayer, SourceBadge } from './UI';
import { renderStyledText, getAudioFromDB } from '../utils';
import { usePackageManager } from './PackageManagerContext';
import AudioRecorder from './AudioRecorder';
import { useCorpus } from './CorpusContext';
import { SentenceCard } from './SentenceCard';

const EntryDetail = ({ entry, notebooks, userNotes, userAudioMeta, userWordForms, onSaveAudio, onDeleteAudio, favorites, customLists, customListOrder, onClose, onEdit, onToggleFavorite, onToggleList, onDelete, onSearchTerm, onOpenNewListModal, onMove, personalWords, onEditSentence, onDeleteSentence, onCreateWord, onManageForms }) => {
    const [showListSheet, setShowListSheet] = useState(false);
    const [showRecorder, setShowRecorder] = useState(false);
    const [recorderTarget, setRecorderTarget] = useState<'entry' | 'sentence'>('entry');
    const [playingAudioId, setPlayingAudioId] = useState(null);
    const audioRef = React.useRef(new Audio());
    const containerRef = React.useRef<HTMLDivElement>(null);
    const sentenceListRef = React.useRef<HTMLDivElement>(null);

    // Reset scroll when entry changes
    React.useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = 0;
        if (sentenceListRef.current) sentenceListRef.current.scrollLeft = 0;
    }, [entry.Index]);

    const { entryToSentencesMap, sentenceMap } = useCorpus();

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
    const isPersonal = !!notebooks[e.Source];

    // CHANGE: Ignore CSV notes (e.Notes) for non-personal words. Only use userNotes.
    const noteContent = isPersonal ? e.Notes : (userNotes[e.Index] || '');

    // Get linked sentences
    const linkedSentenceIds = entryToSentencesMap.get(e.Index) || [];
    const linkedSentences = linkedSentenceIds.map(id => sentenceMap.get(id)).filter(Boolean);

    const renderConjugation = (label, translit, tone, syllabary, notes, borderColor: string | null = null, audioList: any[] = [], onAddAudio: (() => void) | null = null) => {
        if (!syllabary && !translit) return null;

        let borderStyle = {};
        let borderClass = 'border-slate-100 dark:border-slate-800'; // Default

        if (borderColor) {
            if (borderColor.startsWith('#')) {
                borderStyle = { borderLeftColor: borderColor, borderLeftWidth: '4px' };
            } else {
                borderClass = `border-l-4 border-l-${borderColor}-500`;
            }
        }

        return (
            <div className="mb-3">
                {label && <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</div>}
                <div className={`bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border ${borderClass} relative`} style={borderStyle}>
                    <div className="font-noto-cherokee text-xl text-slate-800 dark:text-slate-200 mb-1">{syllabary}</div>
                    <div className="flex flex-col mb-4">
                        {translit && <span className="font-noto-serif text-md text-amber-700 dark:text-amber-400 font-medium">{translit}</span>}
                        {tone && <span className="font-sans text-sm text-slate-500 dark:text-slate-400 italic">{tone}</span>}
                        {notes && <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-1">{notes}</span>}
                    </div>

                    {/* Audio Controls (Bottom Right) */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        {audioList.map(audio => {
                            const audioPkg = packages.find(p => p.id === audio.packageId);
                            const pkgColor = getPackageColor(audio.packageId || 'user');
                            const isOfficial = audioPkg ? audioPkg.type === 'official' : false;
                            const isCustomColor = pkgColor && pkgColor.startsWith('#');

                            let className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all shadow-sm ";
                            let style = {};

                            if (isOfficial) {
                                className += playingAudioId === audio.id ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
                            } else if (isCustomColor) {
                                if (playingAudioId === audio.id) {
                                    style = { backgroundColor: pkgColor + '20', color: pkgColor, borderColor: pkgColor, borderWidth: '1px' };
                                } else {
                                    style = { backgroundColor: pkgColor, color: 'white' };
                                }
                            } else if (pkgColor && pkgColor !== 'slate') {
                                className += playingAudioId === audio.id ? `bg-${pkgColor}-100 dark:bg-${pkgColor}-900 text-${pkgColor}-800 dark:text-${pkgColor}-100` : `bg-${pkgColor}-500 text-white`;
                            } else {
                                className += playingAudioId === audio.id ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white';
                            }

                            return (
                                <div key={audio.id} className={className} style={style}>
                                    <button onClick={() => handlePlayUserAudio(audio)} className="flex items-center gap-1.5 focus:outline-none">
                                        {playingAudioId === audio.id ? <Pause size={10} className="fill-current" /> : <Mic size={10} />}
                                        <span className="whitespace-nowrap">{audio.speaker || 'User'}</span>
                                    </button>
                                    {!isOfficial && (
                                        <button onClick={(ev) => { ev.stopPropagation(); handleLongPressAudio(audio.id); }} className="ml-1 pl-1.5 border-l border-white/20 hover:text-red-200 dark:hover:text-red-400 transition-colors">
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        {onAddAudio && (
                            <button onClick={onAddAudio} className="p-1.5 text-slate-400 hover:text-amber-600 rounded-full transition-colors">
                                <MicPlus size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // HANDLE SENTENCE VIEW (If entry is a sentence object)
    if (e.english && !e.Definition) {
        return (
            <div className="fixed inset-0 z-50 bg-[#F9F9F7] dark:bg-slate-950 flex flex-col animate-slide-up overflow-hidden">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 pb-24">
                    <SentenceCard sentence={e} onSaveAudio={onSaveAudio} userAudioMeta={userAudioMeta} personalWords={personalWords} onDeleteAudio={onDeleteAudio}
                        favorites={favorites}
                        customLists={customLists}
                        onToggleFavorite={onToggleFavorite}
                        onToggleList={onToggleList}
                        onOpenNewListModal={onOpenNewListModal}
                    />
                    <div className="mt-12 text-xs text-slate-300 font-mono text-center">Ref ID: {e.id}</div>
                </div>
            </div>
        );
    }

    // Determine audio color based on package
    const { getPackageColor, packages, importedData } = usePackageManager(); // Need to import this hook


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
                    // Sort by order if needed, but let's assume export preserved order or just push
                    forms.forEach(f => list.push({ ...f, color: p.color, pkgName: p.name }));
                }
            }
        });
        return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [packages, importedData, e.Index]);



    return (
        <div className="fixed inset-0 z-50 bg-[#F9F9F7] dark:bg-slate-950 flex flex-col animate-slide-up overflow-hidden">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" /></button>
                <div className="flex gap-2">{canEdit && <button onClick={() => onEdit(e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><Pencil size={20} /></button>}<button onClick={() => setShowListSheet(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400"><ListPlus size={24} /></button><button onClick={() => onToggleFavorite(e.Index)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Star size={24} className={isFav ? "fill-amber-400 text-amber-400" : "text-slate-400 dark:text-slate-500"} /></button></div>
            </div>
            <div ref={containerRef} className="flex-1 overflow-y-auto p-5 pb-24">
                <div className="mb-2"><div className="flex items-start justify-between mb-2"><h1 className="font-noto-cherokee text-4xl font-bold text-slate-900 dark:text-slate-100">{e.Syllabary}</h1><SourceBadge source={e.Source} name={notebooks[e.Source]?.name} /></div><h2 className="font-noto-serif text-2xl text-amber-800 dark:text-amber-400 font-medium mb-1">{e.Entry}</h2>{e.Entry_Tone && <div className="font-sans text-lg text-slate-500 dark:text-slate-400 italic">{e.Entry_Tone}</div>}</div>

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

                        {/* OTHER FORMS SECTION */}
                        {(e.Other_Forms || (userWordForms && userWordForms[e.Index])) && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Other Word Forms</h3>
                                <div className="grid grid-cols-1 gap-2">
                                    {/* Official Forms */}
                                    {e.Other_Forms && e.Other_Forms.split('|').map((form, i) => {
                                        const parts = form.split(':');
                                        if (parts.length < 2) return null;
                                        const label = parts[0];
                                        const values = parts[1].split('^');
                                        // values[0] = Translit, values[1] = Syllabary, values[2] = Tone, values[3] = Notes

                                        // Form Audio Logic
                                        // ID: Speaker_W-EntryID.FormIndex_Timestamp (or just count)
                                        // We need to find audio files that match the pattern for this form index (i+1 since 1-based usually, or 0-based?)
                                        // User said: "Lily_W-10.2_1.m4a would correspond to the 2nd other form"
                                        // So if i is 0, FormIndex is 1? Or 2? "2nd other form" usually means index 2 (1-based) or index 1 (0-based)?
                                        // "10.2" implies 2nd form. If it's 1-based, 10.1 is 1st.
                                        const formIndex = i + 1;

                                        // Find audio for this form
                                        // We look in userAudioMeta[e.Index] and check if the ID contains `.formIndex_`
                                        // Actually `userAudioMeta` stores list of objects {id, speaker, ...}
                                        // The ID string itself contains the info.
                                        const formAudios = userAudioMeta && userAudioMeta[e.Index]
                                            ? userAudioMeta[e.Index].filter(a => {
                                                // ID format: Speaker_W-EntryID.FormIndex_Timestamp
                                                // Check for `-${e.Index}.${formIndex}_`
                                                // Note: e.Index might be "10". Regex: `[-_]10\.${formIndex}_`
                                                return a.id.includes(`-${e.Index}.${formIndex}_`);
                                            })
                                            : [];

                                        return (
                                            <div key={`official_${i}`} className="relative group">
                                                {renderConjugation(
                                                    label, values[0], values[2], values[1], values[3],
                                                    pkg?.type === 'official' ? 'slate' : (pkg?.color || 'slate'),
                                                    formAudios,
                                                    () => { setRecorderTarget(`form_${formIndex}` as any); setShowRecorder(true); }
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Imported Forms */}
                                    {importedForms.map((form, i) => (
                                        <div key={`imported_${i}`} className="relative group">
                                            {renderConjugation(
                                                form.form_name, form.translit, form.tone, form.syllabary, form.notes, form.color,
                                                userAudioMeta && userAudioMeta[e.Index]
                                                    ? userAudioMeta[e.Index].filter(a => a.id.includes(`-${e.Index}.${form.computed_index}_`))
                                                    : [],
                                                () => { setRecorderTarget(`form_${form.computed_index}` as any); setShowRecorder(true); }
                                            )}
                                        </div>
                                    ))}

                                    {/* Custom Forms */}
                                    {userWordForms && userWordForms[e.Index] && userWordForms[e.Index].split('|').map((form, i) => {
                                        const parts = form.split(':');
                                        if (parts.length < 2) return null;
                                        const label = parts[0];
                                        const values = parts[1].split('^');

                                        // Custom forms continue index after official forms
                                        const officialCount = e.Other_Forms ? e.Other_Forms.split('|').length : 0;
                                        const formIndex = officialCount + i + 1;

                                        const formAudios = userAudioMeta && userAudioMeta[e.Index]
                                            ? userAudioMeta[e.Index].filter(a => a.id.includes(`-${e.Index}.${formIndex}_`))
                                            : [];

                                        return (
                                            <div key={`custom_${i}`} className="relative group">
                                                {renderConjugation(
                                                    label, values[0], values[2], values[1], values[3], 'amber',
                                                    formAudios,
                                                    () => { setRecorderTarget(`form_${formIndex}` as any); setShowRecorder(true); }
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Add Form Button */}
                                <div className="mt-4">
                                    <button
                                        onClick={() => onManageForms(e)}
                                        className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 flex items-center gap-1 uppercase tracking-wide"
                                    >
                                        <Plus size={14} /> Add Other Form
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* If no forms exist, still show the Add button in a dedicated section or just allow it via the edit logic?
                            User said "small button similar to the notes button under the word forms".
                            If no word forms exist, the section is hidden.
                            We should show the section if forms exist OR if we want to allow adding.
                            Let's change the condition to always show if it's a word (not sentence) so user can add.
                        */}
                        {!e.Other_Forms && (!userWordForms || !userWordForms[e.Index]) && !e.english && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Other Word Forms</h3>
                                <button
                                    onClick={() => onManageForms(e)}
                                    className="text-xs font-bold text-slate-400 hover:text-amber-600 flex items-center gap-1 uppercase tracking-wide italic"
                                >
                                    <Plus size={14} /> Add a form...
                                </button>
                            </div>
                        )}

                        {(e.Sentence_Syllabary || e.Sentence_English) && (<div className="mb-8 bg-amber-50/50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30"><h3 className="text-sm font-bold text-amber-800/60 dark:text-amber-200/60 uppercase tracking-widest mb-3 flex items-center gap-2">Example Sentence</h3>{e.Sentence_Syllabary && <p className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-200 mb-2">{renderStyledText(e.Sentence_Syllabary)}</p>}{e.Sentence_Transliteration && <p className="font-noto-serif text-md text-slate-600 dark:text-slate-400 italic mb-2">{renderStyledText(e.Sentence_Transliteration)}</p>}{e.Sentence_English && <p className="font-noto-serif text-md text-slate-800 dark:text-slate-200 font-medium">{renderStyledText(e.Sentence_English)}</p>}<div className="mt-4 flex items-center gap-3 flex-wrap"><AudioPlayer src={e.Sentence_Audio} label="Play Sentence" icon={Mic} customColor={pkg?.type !== 'official' ? pkg?.color : undefined} /></div></div>)}

                        {/* SENTENCES SECTION (Horizontal Scroll) - Moved Above Notes */}
                        {linkedSentences.length > 0 && (
                            <div className="mb-8">
                                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Sentences ({linkedSentences.length})</h3>
                                <div ref={sentenceListRef} className="flex overflow-x-auto gap-4 pb-4 snap-x">
                                    {linkedSentences.map((s: any) => (
                                        <div key={s.id} className="min-w-[85vw] md:min-w-[400px] snap-center">
                                            <SentenceCard sentence={s} userNotes={userNotes} onEditNote={(_, note) => onEdit(s, note, true)} onSaveAudio={onSaveAudio} userAudioMeta={userAudioMeta} onEditSentence={onEditSentence} onDeleteSentence={onDeleteSentence} onDeleteAudio={onDeleteAudio} onCreateWord={onCreateWord} personalWords={personalWords} notebooks={notebooks}
                                                favorites={favorites}
                                                customLists={customLists}
                                                onToggleFavorite={onToggleFavorite}
                                                onToggleList={onToggleList}
                                                onOpenNewListModal={onOpenNewListModal}
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
                            <Folder size={20} /> Move to Notebook
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
                        title={recorderTarget === 'entry' ? e.Entry : (recorderTarget === 'sentence' ? (e.Sentence_English || "Example Sentence") : `Form Audio`)}
                        syllabary={recorderTarget === 'entry' ? e.Syllabary : (recorderTarget === 'sentence' ? e.Sentence_Syllabary : null)}
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
        </div>
    );
};

export default EntryDetail;
