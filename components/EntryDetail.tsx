import React, { useState } from 'react';
import { ArrowLeft, Pencil, ListPlus, Star, ListIcon, X, Plus, Folder, Pause, MicPlus, Trash2, Mic, Menu } from './Icons';
import { AudioPlayer, SourceBadge } from './UI';
import { renderStyledText, getAudioFromDB, processFormsContextually } from '../utils';
import { usePackageManager } from './PackageManagerContext';
import AudioRecorder from './AudioRecorder';
import { useCorpus } from './CorpusContext';
import { SentenceCard } from './SentenceCard';
import { WordFormsModal } from './WordFormsModal';

const getHexColor = (col: string) => {
  const COLORS: Record<string, string> = {
    slate: '#94a3b8',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#8b5cf6',
    pink: '#ec4899',
    orange: '#f97316',
    indigo: '#6366f1',
    teal: '#14b8a6',
    rose: '#f43f5e'
  };
  if (!col) return COLORS.slate;
  if (col.startsWith('#')) return col;
  return COLORS[col] || COLORS.slate;
};

const EntryDetail = ({ entry, customDictionaries, userNotes, userAudioMeta, userWordForms, onSaveAudio, onDeleteAudio, favorites, customLists, customListOrder, onClose, onEdit, onToggleFavorite, onToggleList, onDelete, onSearchTerm, onOpenNewListModal, onMove, personalWords, onEditSentence, onDeleteSentence, onCreateWord, onManageForms, onReadInContext, onShowSettings, onViewRoot, onViewClass }) => {
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

    const { entryToSentencesMap, sentenceMap, rootMap } = useCorpus();

    // Check if linked to a root
    const rootEntry = rootMap.get(entry.Index);

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
                const url = `https://cherokeenationdictionary.net/Audio/word/${audio.id}`;
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

    const rawImportedForms = React.useMemo(() => {
        const list: any[] = [];
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.word_forms) {
                const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === e.Index);
                if (forms.length > 0) {
                    forms.forEach(f => list.push({ ...f, color: p.color, pkgName: p.name, pkgType: p.type }));
                }
            }
        });
        return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [packages, importedData, e.Index]);

    // For standard uses and counting (preserves full global overlap context)
    const importedForms = React.useMemo(() => {
        return processFormsContextually(rawImportedForms);
    }, [rawImportedForms]);

    // For the CED mini table: compute context ONLY among CED forms to hide unnecessary objects!
    const cedForms = React.useMemo(() => {
        const rawCed = rawImportedForms.filter(f => f.source === 'ced');
        return processFormsContextually(rawCed);
    }, [rawImportedForms]);

    const otherImportedForms = importedForms.filter(f => f.source !== 'ced' && f.pkgType !== 'official');
    const extraOfficialForms = importedForms.filter(f => f.source !== 'ced' && f.pkgType === 'official');
    
    // User created forms count
    const userFormsCount = userWordForms && userWordForms[e.Index] ? userWordForms[e.Index].split('|').length : 0;
    const legacyOfficialFormsCount = e.Other_Forms ? e.Other_Forms.split('|').length : 0;
    const totalMoreForms = extraOfficialForms.length + otherImportedForms.length + userFormsCount + legacyOfficialFormsCount;



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


    return (
        <div className="fixed inset-0 z-[10000] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                <div className="flex items-center gap-2">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" />
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => onToggleFavorite(e.Index)} className="p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors" title="Toggle Favorite">
                        <Star size={20} className={isFav ? "fill-amber-400 text-amber-400" : "text-slate-400 dark:text-slate-500"} />
                    </button>
                    <button onClick={() => setShowListSheet(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500" title="Add to List">
                        <ListPlus size={20} />
                    </button>
                    <button onClick={onShowSettings} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1">
                        <Menu size={24} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            {/* Scrollable Container */}
            <div ref={containerRef} className="flex-1 overflow-y-auto p-5 pb-24">
                <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="font-noto-cherokee text-4xl font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">{e.Syllabary}</h1>
                                {canEdit && (
                                    <button onClick={() => onEdit(e)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-300 hover:text-amber-600 transition-colors">
                                        <Pencil size={20} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-baseline gap-3 flex-wrap">
                                <h2 className="font-noto-serif text-2xl text-amber-800 dark:text-amber-400 font-medium">{e.Entry}</h2>
                                {e.Entry_Tone && <span className="font-sans text-base text-slate-400 dark:text-slate-500 italic">{e.Entry_Tone}</span>}
                            </div>
                        </div>
                        <div className="shrink-0 pt-1">
                            <SourceBadge source={e.Source} name={customDictionaries[e.Source]?.name} />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* AUDIO ROW */}
                    <div className="flex items-center gap-2 flex-wrap min-h-[40px]">
                        {(!userAudioMeta?.[e.Index]?.some(a => !a.id.includes(`${e.Index}.`)) || (e.audio && (pkg?.type === 'official' || e.audio.startsWith('Word_') || e.audio.match(/^\d{4}\./) || e.audio.endsWith('.m4a')))) && (
                            <AudioPlayer
                                src={e.audio && (pkg?.type === 'official' || e.audio.startsWith('Word_') || e.audio.match(/^\d{4}\./) || e.audio.endsWith('.m4a')) ? `https://cherokeenationdictionary.net/Audio/word/${e.audio}` : undefined}
                                label="Official"
                                icon={Mic}
                                variant="gray"
                                customColor={pkg?.type !== 'official' ? pkg?.color : undefined}
                            />
                        )}
                        {/* USER AUDIO LIST */}
                        {userAudioMeta && userAudioMeta[e.Index] && userAudioMeta[e.Index]
                            .filter(audio => {
                                if (audio.packageId === 'official-cherokee-data' || audio.id.endsWith('.m4a')) return false;
                                if (audio.id.includes(`${e.Index}.`)) return false;
                                if (!audio.packageId) {
                                    const userPkg = packages.find(p => p.id === 'user');
                                    return userPkg ? userPkg.status === 'active' : true;
                                }
                                const pkg = packages.find(p => p.id === audio.packageId);
                                return pkg && pkg.status === 'active';
                            })
                            .map(audio => {
                                const audioPkgColor = getPackageColor(audio.packageId || 'user');
                                const isCustomAudioColor = audioPkgColor && audioPkgColor.startsWith('#');
                                let className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm group ";
                                let style = {};
                                if (audioPkgColor && isCustomAudioColor) {
                                    if (playingAudioId === audio.id) {
                                        style = { backgroundColor: audioPkgColor + '20', color: audioPkgColor, borderColor: audioPkgColor };
                                    } else {
                                        style = { backgroundColor: audioPkgColor, color: 'white' };
                                    }
                                } else if (audioPkgColor && audioPkgColor !== 'slate') {
                                    className += playingAudioId === audio.id ? `bg-${audioPkgColor}-100 dark:bg-${audioPkgColor}-900 text-${audioPkgColor}-800 dark:text-${audioPkgColor}-100` : `bg-${audioPkgColor}-500 text-white hover:bg-${audioPkgColor}-600`;
                                } else {
                                    className += playingAudioId === audio.id ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600';
                                }
                                return (
                                    <div key={audio.id} className={className} style={style}>
                                        <button onClick={() => handlePlayUserAudio(audio)} className="flex items-center gap-2">
                                            {playingAudioId === audio.id ? <Pause size={12} className="fill-current" /> : <Mic size={12} />}
                                            <span>{playingAudioId === audio.id ? 'Playing...' : (audio.speaker || 'User')}</span>
                                        </button>
                                        {!audio.packageId?.startsWith('official') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleLongPressAudio(audio.id); }} className="ml-1 pl-2 border-l border-white/20 hover:text-red-200 transition-colors flex items-center">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                )
                            })}
                        <button onClick={() => { setRecorderTarget('entry'); setShowRecorder(true); }} className="p-2 text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors">
                            <MicPlus size={20} />
                        </button>
                    </div>

                    {/* ROOT & CLASS INFO */}
                    {rootEntry && (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400 font-medium pb-2">
                            <div className="flex items-center gap-2">
                                <span className="uppercase text-[10px] tracking-wider text-slate-400">Root:</span>
                                <button
                                    onClick={() => onViewRoot(rootEntry.root_slug)}
                                    className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-noto-cherokee text-base"
                                >
                                    -{rootEntry.root_h || rootEntry.root_g || 'Root'}-
                                </button>
                            </div>
                            {rootEntry.class_name && (
                                <div className="flex items-center gap-2">
                                    <span className="uppercase text-[10px] tracking-wider text-slate-400">Class:</span>
                                    <button
                                        onClick={() => onViewClass(rootEntry.class_name)}
                                        className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors font-mono"
                                    >
                                        [{rootEntry.class_name}]
                                    </button>
                                </div>
                            )}
                            {rootEntry.config?.pron?.set_type && (
                                <span className="font-bold text-[11px] bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 border border-slate-200/30 dark:border-slate-700/30 tracking-wide">
                                    Set {rootEntry.config.pron.set_type.toUpperCase()}
                                </span>
                            )}
                            {rootEntry.config?.pre?.distributive && (
                                <span className="font-mono font-bold text-[11px] text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded border border-sky-100/30 dark:border-sky-900/30" title="Distributive prefix active">
                                    de-/d-
                                </span>
                            )}
                            {rootEntry.config?.pre?.translocutive && (
                                <span className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-100/30 dark:border-emerald-900/30" title="Translocutive prefix active">
                                    wi-/w-
                                </span>
                            )}
                        </div>
                    )}

                    {/* TAGS & ACTIONS (Subtle) */}
                    {(isFav || Object.keys(customLists).some(k => {
                        const list = customLists[k];
                        if (Array.isArray(list)) return list.includes(e.Index);
                        return list?.items?.includes(e.Index);
                    })) && (
                        <div className="flex flex-wrap items-center gap-1.5 min-h-[30px]">
                            {isFav && <span className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">Favorite</span>}
                            {Object.keys(customLists).filter(k => {
                                const list = customLists[k];
                                if (Array.isArray(list)) return list.includes(e.Index);
                                return list?.items?.includes(e.Index);
                            }).map(id => {
                                const list = customLists[id];
                                const name = Array.isArray(list) ? id : list.name;
                                return (
                                    <span key={id} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                                        {name}
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    <div className="pt-2">
                        <p className="font-noto-serif text-xl text-slate-800 dark:text-slate-100 leading-snug">
                            {renderStyledText(e.Definition)}
                            {e.PoS && (
                                <span className="text-slate-400 dark:text-slate-500 italic ml-2 text-lg font-normal">
                                    ({e.PoS})
                                </span>
                            )}
                        </p>
                        {e.Definition_Long && <p className="mt-3 text-slate-600 dark:text-slate-400 text-base leading-relaxed">{renderStyledText(e.Definition_Long)}</p>}
                    </div>

                    {/* Word Forms List (New) */}
                    {(cedForms.length > 0 || otherImportedForms.length > 0 || userFormsCount > 0 || legacyOfficialFormsCount > 0) && (
                        <div className="pt-4 -mx-5 px-5">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Conjugations / Forms</h3>
                            
                            {cedForms.length > 0 && (
                                <div className="grid grid-cols-[minmax(80px,auto)_auto_1fr] gap-x-4 md:gap-x-8 gap-y-2 mb-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 items-center overflow-x-auto">
                                    {cedForms.map(f => (
                                        <React.Fragment key={f.form_name}>
                                             <div className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider pr-1 leading-tight py-1" title={f.displayLabel}>
                                                 {f.displayLabel}:
                                             </div>
                                             <div className="font-noto-cherokee text-base text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">
                                                 {f.syllabary}
                                             </div>
                                             <div className="text-[15px] text-amber-800 dark:text-amber-400 italic font-semibold whitespace-nowrap">
                                                 {f.translit}
                                             </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}

                            <button 
                                onClick={() => setShowWordFormsModal(true)}
                                className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-900/50 rounded-lg text-amber-700 dark:text-amber-500 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-2 flex-wrap mt-2"
                            >
                                <span>{totalMoreForms > 0 ? `+ View ${totalMoreForms} More` : 'View all forms'}</span>
                                {userFormsCount > 0 && (
                                    <span className="bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">{userFormsCount} Custom</span>
                                )}
                                    {/* Aggregate remaining imported forms by color */}
                                    {Object.values(
                                        otherImportedForms.reduce((acc: any, f) => {
                                            const c = f.color || 'slate';
                                            if (!acc[c]) acc[c] = { count: 0, color: c };
                                            acc[c].count++;
                                            return acc;
                                        }, {})
                                    ).map((pkg: any, idx) => (
                                        <span key={idx} style={{ backgroundColor: getHexColor(pkg.color) }} className="px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                                            {pkg.count} Imported
                                        </span>
                                    ))}
                                </button>
                        </div>
                    )}

                    {(e.Sentence_Syllabary || e.Sentence_English) && (
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-2xl border border-amber-100/50 dark:border-amber-900/20">
                            <h3 className="text-[10px] font-bold text-amber-800/50 dark:text-amber-200/40 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">Example Sentence</h3>
                            {e.Sentence_Syllabary && <p className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-200 mb-2">{renderStyledText(e.Sentence_Syllabary)}</p>}
                            {e.Sentence_Transliteration && <p className="font-noto-serif text-md text-slate-600 dark:text-slate-400 italic mb-2">{renderStyledText(e.Sentence_Transliteration)}</p>}
                            {e.Sentence_English && <p className="font-noto-serif text-md text-slate-800 dark:text-slate-200 font-medium">{renderStyledText(e.Sentence_English)}</p>}
                            <div className="mt-4 flex items-center gap-3 flex-wrap">
                                <AudioPlayer src={e.Sentence_Audio} label="Play Sentence" icon={Mic} customColor={pkg?.type !== 'official' ? pkg?.color : undefined} />
                            </div>
                        </div>
                    )}

                    {/* SENTENCES SECTION */}
                    {linkedSentences.length > 0 && (
                        <div className="pt-4">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Linked Sentences ({linkedSentences.length})</h3>
                            <div ref={sentenceListRef} className="flex overflow-x-auto gap-4 pb-4 snap-x -mx-5 px-5">
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

                    <div className="pt-4">
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Notes</h3>
                        <div className="space-y-3">
                            {importedNotes.map((note, i) => (
                                <div key={i} className={`bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans text-sm border-l-4`} style={{ borderLeftColor: note.color }}>
                                    {note.text}
                                </div>
                            ))}
                            <div onClick={() => onEdit(e, noteContent, true)} className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative group border-l-4 border-l-amber-500/50">
                                {noteContent || <span className="text-slate-400 italic">Add a note...</span>}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"><Pencil size={12} className="text-amber-600" /></div>
                            </div>
                        </div>
                    </div>

                    {e.Cross_Reference && (
                        <div className="pt-4">
                            <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">See Also</h3>
                            <div className="flex flex-wrap gap-2">
                                {e.Cross_Reference.split(',').map((ref, i) => (
                                    <button key={i} onClick={() => onSearchTerm(ref.trim())} className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full text-slate-600 dark:text-slate-400 text-xs shadow-sm hover:border-amber-500 hover:text-amber-600 transition-colors">
                                        {ref.trim()}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
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

            {/* Modals & Overlays */}
            {showListSheet && (
                <div className="absolute inset-0 z-[60] flex flex-col justify-end">
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setShowListSheet(false)}></div>
                    <div className="bg-white dark:bg-slate-900 w-full rounded-t-2xl p-4 shadow-2xl animate-slide-up-sheet relative z-10 max-h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add to List</h3>
                            <button onClick={() => setShowListSheet(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                                <X size={20} className="dark:text-slate-200" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-2 mb-4">
                            <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                                <input type="checkbox" checked={favorites.includes(e.Index)} onChange={() => onToggleFavorite(e.Index)} className="w-5 h-5 accent-amber-500" />
                                <div className="flex items-center gap-2">
                                    <Star size={18} className="text-amber-500 fill-amber-500" />
                                    <span className="font-bold text-slate-700 dark:text-slate-200">Favorites</span>
                                </div>
                            </label>
                            {customListOrder.map(listId => {
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
                            })}
                        </div>
                        <button onClick={() => { setShowListSheet(false); onOpenNewListModal(e.Index); }} className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shrink-0">
                            <Plus size={20} /> Create New List
                        </button>
                    </div>
                </div>
            )}

            {showRecorder && (
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
            )}

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
                onReadInContext={onReadInContext}
            />
        </div>
    );
};

export default EntryDetail;
