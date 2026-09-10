import React, { useState } from 'react';
import { ArrowLeft, Pencil, ListPlus, Star, ListIcon, X, Plus, Folder, Pause, MicPlus, Trash2, Mic, Menu } from './Icons';
import { AudioPlayer, SourceBadge } from './UI';
import { renderStyledText, getAudioFromDB, processFormsContextually, parseListName, renderColorizedCherokee, renderSegmentedSurface, projectSegmentsOntoTone, segmentVerbForm, VerbMorphologyTemplate } from '../utils';
import { usePackageManager } from './PackageManagerContext';
import AudioRecorder from './AudioRecorder';
import { useCorpus } from './CorpusContext';
import { SentenceCard } from './SentenceCard';
import { WordFormsModal } from './WordFormsModal';
import ReferenceFormsPreview, { getReferencePreviewMatchedForms } from './ReferenceFormsPreview';

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

const EntryDetail = ({ entry, settings, customDictionaries, userNotes, userAudioMeta, userWordForms, onSaveAudio, onDeleteAudio, favorites, customLists, customListOrder, onClose, onEdit, onToggleFavorite, onToggleList, onDelete, onSearchTerm, onOpenNewListModal, onMove, personalWords, onEditSentence, onDeleteSentence, onCreateWord, onManageForms, onReadInContext, onShowSettings, onViewRoot, onViewClass, style }: any) => {
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
    const rootEntry = (entry.Index ? rootMap.get(entry.Index) : null) || (entry.id ? rootMap.get(entry.id) : null) || (entry.merged_id ? rootMap.get(entry.merged_id) : null);
    const showMascots = settings?.showClassMascots ?? false;

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
    const linkedSentenceIds = Array.from(new Set([
        ...(entryToSentencesMap.get(e.Index) || []),
        ...(entryToSentencesMap.get(e.id) || []),
        ...(entryToSentencesMap.get((e as any).merged_id) || []),
        ...((e as any).sources?.['lily-dict.csv']?.Index ? (entryToSentencesMap.get((e as any).sources['lily-dict.csv'].Index) || []) : [])
    ]));
    const linkedSentences = linkedSentenceIds.map(id => sentenceMap.get(id)).filter(Boolean);


    // HANDLE SENTENCE VIEW (If entry is a sentence object)
    if (e.english && !e.Definition) {
        return (
            <div style={style} className="fixed inset-0 z-[10000] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden">
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm shrink-0 h-[60px]">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><ArrowLeft size={24} className="text-slate-700 dark:text-slate-200" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 pb-24">
                    <SentenceCard sentence={e} onSaveAudio={onSaveAudio} userAudioMeta={userAudioMeta} personalWords={personalWords} onDeleteAudio={onDeleteAudio}
                        favorites={favorites} customLists={customLists} onToggleFavorite={onToggleFavorite} onToggleList={onToggleList} onOpenNewListModal={onOpenNewListModal}
                        onReadInContext={onReadInContext}
                        onEditSentence={onEditSentence}
                        onDeleteSentence={onDeleteSentence}
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
                    forms.forEach((f, idx) => list.push({
                        ...f,
                        _uid: f.id || `${p.id}_${f.word_index}_${f.normalized_key || f.form_name || ''}_${idx}`,
                        color: p.color,
                        pkgName: p.name,
                        pkgType: p.type
                    }));
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
    
    // User created forms count
    const userFormsCount = userWordForms && userWordForms[e.Index] ? userWordForms[e.Index].split('|').length : 0;
    const legacyOfficialFormsCount = e.Other_Forms ? e.Other_Forms.split('|').length : 0;

    const { hasMiniPreview, matchedForms: miniMatchedForms } = React.useMemo(() => {
        if (!cedForms || cedForms.length === 0) {
            return { hasMiniPreview: false, matchedForms: new Set<any>() };
        }
        return getReferencePreviewMatchedForms(cedForms, e, rootEntry);
    }, [cedForms, e, rootEntry]);

    const totalFormsCount = rawImportedForms.length + legacyOfficialFormsCount + userFormsCount;

    const otherFormsCount = React.useMemo(() => {
        if (hasMiniPreview) {
            const countInMini = rawImportedForms.filter(rawForm => {
                return Array.from(miniMatchedForms).some((mf: any) => {
                    if (!mf) return false;
                    if (rawForm._uid && mf._uid && rawForm._uid === mf._uid) return true;
                    const k1 = (rawForm.normalized_key || rawForm.form_name || '').toLowerCase();
                    const k2 = (mf.normalized_key || mf.form_name || '').toLowerCase();
                    const s1 = (rawForm.syllabary || '').trim();
                    const s2 = (mf.syllabary || '').trim();
                    const t1 = (rawForm.translit || '').trim().toLowerCase();
                    const t2 = (mf.translit || '').trim().toLowerCase();
                    if (k1 && k2 && k1 === k2) return true;
                    if (s1 && s2 && s1 === s2 && t1 && t2 && t1 === t2) return true;
                    return false;
                });
            }).length;
            return Math.max(0, totalFormsCount - countInMini);
        } else {
            return Math.max(0, totalFormsCount > 0 ? totalFormsCount - 1 : 0);
        }
    }, [hasMiniPreview, rawImportedForms, miniMatchedForms, totalFormsCount]);

    const formsButtonLabel = otherFormsCount > 0
        ? `View ${otherFormsCount} other form${otherFormsCount === 1 ? '' : 's'}`
        : 'No other forms';



    const activeFormData = React.useMemo(() => {
        if (!recorderTarget || recorderTarget === 'entry' || recorderTarget === 'sentence') return null;

        const parts = recorderTarget.split('_');
        if (parts.length < 2) return null;
        const targetIndex = parseInt(parts[1]);
        if (isNaN(targetIndex)) return null;

        const list: any[] = [];
        let indexCounter = 1;

        // 1. Official Forms
        if (e.Other_Forms) {
            e.Other_Forms.split('|').forEach((form: string) => {
                const parts = form.split(':');
                if (parts.length >= 2) {
                    const values = parts[1].split('^');
                    list.push({
                        index: indexCounter++,
                        label: parts[0],
                        translit: values[0],
                        syllabary: values[1],
                        tone: values[2],
                        notes: values[3]
                    });
                }
            });
        }

        // 2. Imported Forms
        importedForms.forEach(f => {
            list.push({
                index: indexCounter++,
                label: f.displayLabel || f.form_name,
                translit: f.translit,
                syllabary: f.syllabary,
                tone: f.tone,
                notes: f.notes
            });
        });

        // 3. Custom Forms
        if (userWordForms && userWordForms[e.Index]) {
            userWordForms[e.Index].split('|').forEach((form: string) => {
                const parts = form.split(':');
                if (parts.length >= 2) {
                    const values = parts[1].split('^');
                    list.push({
                        index: indexCounter++,
                        label: parts[0],
                        translit: values[0],
                        syllabary: values[1],
                        tone: values[2],
                        notes: values[3]
                    });
                }
            });
        }

        return list.find(f => f.index === targetIndex) || null;
    }, [recorderTarget, e, importedForms, userWordForms]);

    const mainPresSeg = rootEntry?.segmented_forms?.present;
    const mainVerbConfig = rootEntry?.config;
    const mainPresGroups = React.useMemo(() => {
        if (!rootEntry || !mainPresSeg) return null;
        return segmentVerbForm(mainPresSeg, 'present', mainVerbConfig, rootEntry?.class_name);
    }, [mainPresSeg, mainVerbConfig, rootEntry]);
    const mainPronounSet = mainVerbConfig?.pron?.set_type === 'b' ? 'B' : 'A';

    return (
        <div style={style} className="fixed inset-0 z-[10000] bg-[#F9F9F7] dark:bg-slate-950 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between shadow-sm shrink-0 h-12">
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
                                <h2 className="font-noto-serif text-2xl text-amber-800 dark:text-amber-400 font-bold">
                                    {rootEntry?.surface_segments?.present
                                        ? renderSegmentedSurface(rootEntry.surface_segments.present, settings?.colorWordSegments !== false)
                                        : (rootEntry && mainPresGroups
                                            ? renderColorizedCherokee(e.Entry, mainPresGroups, mainPronounSet, settings?.colorWordSegments !== false)
                                            : e.Entry)}
                                </h2>
                                {e.Entry_Tone && (
                                    <span className="font-serif text-base text-slate-500 dark:text-slate-400 font-bold italic">
                                        {rootEntry?.surface_segments?.present
                                            ? renderSegmentedSurface(
                                                projectSegmentsOntoTone(rootEntry.surface_segments.present, e.Entry_Tone),
                                                settings?.colorWordSegments !== false
                                              )
                                            : (rootEntry && mainPresGroups
                                                ? renderColorizedCherokee(e.Entry_Tone, mainPresGroups, mainPronounSet, settings?.colorWordSegments !== false)
                                                : e.Entry_Tone)}
                                    </span>
                                )}

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

                    {/* MORPHOLOGY BREAKDOWN TEMPLATE */}
                    {rootEntry && (
                        <div className="pb-2">
                            <VerbMorphologyTemplate
                                rootEntry={rootEntry}
                                onViewRoot={onViewRoot}
                                onViewClass={onViewClass}
                                showMascot={showMascots}
                            />
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
                                const { folder, name: displayName } = parseListName(name);
                                return (
                                    <span key={id} className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                                        {folder ? `${folder} > ${displayName}` : displayName}
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

                    {/* Word Forms List */}
                    <div className="pt-4 -mx-5 px-5">
                        <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3">Conjugations / Forms</h3>
                        
                        {hasMiniPreview && (
                            <div className="mb-3">
                                <ReferenceFormsPreview
                                    forms={cedForms}
                                    entry={e}
                                    rootEntry={rootEntry}
                                    settings={settings}
                                    onPlayAudio={handlePlayUserAudio}
                                    onOpenAllForms={() => setShowWordFormsModal(true)}
                                />
                            </div>
                        )}

                        <button 
                            onClick={() => setShowWordFormsModal(true)}
                            className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-900/50 rounded-lg text-amber-700 dark:text-amber-500 text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors flex items-center gap-2 flex-wrap mt-2"
                        >
                            <span>{formsButtonLabel}</span>
                            {userFormsCount > 0 && (
                                <span className="bg-amber-400 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">{userFormsCount} Custom</span>
                            )}
                            {/* Aggregate remaining imported forms by color */}
                            {otherFormsCount > 0 && Object.values(
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
                                const { folder, name: displayName } = parseListName(name);
                                return (
                                    <label key={listId} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                                        <input type="checkbox" checked={isChecked} onChange={() => onToggleList(listId, e.Index)} className="w-5 h-5 accent-amber-500" />
                                        <div className="flex items-center gap-2">
                                            <ListIcon size={18} className="text-slate-500" />
                                            <span className="font-medium text-slate-700 dark:text-slate-200">
                                                {folder ? `${folder} > ${displayName}` : displayName}
                                            </span>
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
                    formLabel={recorderTarget === 'entry' ? 'Base Form' : (recorderTarget === 'sentence' ? 'Sentence' : (activeFormData?.label || 'Word Form'))}
                    syllabary={recorderTarget === 'entry' ? e.Syllabary : (recorderTarget === 'sentence' ? e.Sentence_Syllabary : (activeFormData ? activeFormData.syllabary : null))}
                    title={recorderTarget === 'entry' ? (e.Entry_Tone || e.Entry) : (recorderTarget === 'sentence' ? (e.Sentence_Tone || e.Sentence_Transliteration) : (activeFormData ? (activeFormData.tone || activeFormData.translit) : `Form Audio`))}
                    transliteration={recorderTarget === 'entry' ? (e.Definition || e.English || null) : (recorderTarget === 'sentence' ? e.Sentence_English : (activeFormData ? (e.Definition || e.English || activeFormData.notes || null) : null))}
                    onSave={(blob, speaker) => {
                        if (typeof recorderTarget === 'string' && recorderTarget.startsWith('form_')) {
                            const formIndex = parseInt(recorderTarget.split('_')[1]);
                            const slug = activeFormData?.translit || activeFormData?.syllabary || e.Entry;
                            onSaveAudio(e.Index, blob, speaker, formIndex, slug);
                        } else {
                            const targetIndex = recorderTarget === 'entry' ? e.Index : e.Index + '_sentence';
                            const slug = recorderTarget === 'entry' ? (e.Entry || e.Syllabary) : (e.Sentence_English || e.Sentence_Transliteration);
                            onSaveAudio(targetIndex, blob, speaker, undefined, slug);
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
                rootEntry={rootEntry}
                settings={settings}
            />
        </div>
    );
};

export default EntryDetail;
