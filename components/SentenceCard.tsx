import React, { useState, useMemo, useRef } from 'react';
import { Sentence, useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';
import { GlossPopover } from './GlossPopover';
import { LinkerModal } from './LinkerModal';
import { AudioPlayer, SourceBadge } from './UI';
import { Check, Plus, Mic, Pencil, MicPlus, Trash2, Pause, ListIcon, Star, X, ListPlus, BookOpen } from './Icons';
import { getAudioFromDB, renderStyledText } from '../utils';

import AudioRecorder from './AudioRecorder';

interface SentenceCardProps {
    sentence: Sentence;
    onClick?: () => void;
    isDimmed?: boolean;
    customDictionaries?: any;
    userNotes?: Record<string, string>;
    onEditNote?: (id: string, note: string) => void;
    onEditSentence?: (id: string) => void;
    sourceMap?: Record<string, string>;
    onSaveAudio?: (id: string, blob: Blob, speaker: string, formIndex?: number, wordSlug?: string) => void;
    userAudioMeta?: Record<string, any[]>;
    personalWords?: any[];
    onDeleteSentence?: (id: string) => void;
    onDeleteAudio?: (targetId: string, audioId: string) => void;
    onCreateWord?: () => void;
    // List Props
    favorites?: string[];
    customLists?: Record<string, any>;
    onToggleFavorite?: (id: string) => void;
    onToggleList?: (listId: string, id: string) => void;
    onOpenNewListModal?: (id: string) => void;
    // Reader Props
    onReadInContext?: (sentenceId: string) => void;
}

export const SentenceCard: React.FC<SentenceCardProps> = ({ sentence, onClick, isDimmed, customDictionaries, userNotes, onEditNote, onEditSentence, sourceMap, onSaveAudio, userAudioMeta, personalWords, onDeleteSentence, onDeleteAudio, onCreateWord, favorites, customLists, onToggleFavorite, onToggleList, onOpenNewListModal, onReadInContext }) => {
    const { dictionary, glossMap, dictionaryMap, addUserGloss, removeUserGloss, removeUserSentence } = useCorpus();
    const { packages, getPackageColor, importedData } = usePackageManager(); // Add this line
    const [activePopover, setActivePopover] = useState<{ index: number, rect: { x: number, y: number } } | null>(null);
    const [showRecorder, setShowRecorder] = useState(false);
    const [showListSheet, setShowListSheet] = useState(false);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const audioRef = useRef(new Audio());
    const [showLinker, setShowLinker] = useState<{
        indices: number[],
        initialQuery: string,
        targetWord?: { syllabary: string, translit: string } | { syllabary: string, translit: string }[],
        initialData?: { entry: any, notes: string, breakdownCherokee: string, breakdownEnglish: string },
        glossId?: string
    } | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

    const glosses = glossMap.get(sentence.id) || [];

    const tokens = useMemo(() => {
        const syl = sentence.syllabary ? sentence.syllabary.split(' ') : [];
        const tr = sentence.translit ? sentence.translit.split(' ') : [];
        const max = Math.max(syl.length, tr.length);
        const res: { syl: string, tr: string, index: number }[] = [];
        for (let i = 0; i < max; i++) {
            res.push({
                syl: (syl[i] || '').replace(/\*/g, ''),
                tr: (tr[i] || '').replace(/\*/g, ''),
                index: i
            });
        }
        return res;
    }, [sentence]);

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm("Delete this sentence?")) {
            if (onDeleteSentence) {
                onDeleteSentence(sentence.id);
            } else {
                removeUserSentence(sentence.id);
            }
        }
    };

    const COLORS: Record<string, string> = {
        slate: '#cbd5e1',
        gray: '#cbd5e1',
        zinc: '#d4d4d8',
        neutral: '#d4d4d8',
        stone: '#d6d3d1',
        red: '#f87171',
        orange: '#fb923c',
        amber: '#fbbf24',
        yellow: '#facc15',
        lime: '#a3e635',
        green: '#4ade80',
        emerald: '#34d399',
        teal: '#2dd4bf',
        cyan: '#22d3ee',
        sky: '#38bdf8',
        blue: '#60a5fa',
        indigo: '#818cf8',
        violet: '#a78bfa',
        purple: '#c084fc',
        fuchsia: '#e879f9',
        pink: '#f472b6',
        rose: '#fb7185',
    };

    const getGlossMeta = (index: number): { uniqueColors: string[], isMultiple: boolean } | null => {
        const wordGlosses = glosses.filter(g => {
            const indices = g.word_index ? g.word_index.split(',').map(Number) : [];
            return indices.includes(index);
        });

        if (wordGlosses.length === 0) return null;

        // Get colors for all glosses
        const colors = wordGlosses.map(g => {
            const colorName = getPackageColor(g.source);
            if (colorName) {
                if (colorName.startsWith('#')) return colorName;
                if (COLORS[colorName]) return COLORS[colorName];
            }

            // Fallbacks
            if (g.source === 'user' || (customDictionaries && customDictionaries[g.source]) || g.source.startsWith('nb_')) {
                return COLORS.amber; // #fbbf24
            }

            return COLORS.slate; // #cbd5e1 (default)
        });

        return {
            uniqueColors: Array.from(new Set(colors)),
            isMultiple: wordGlosses.length > 1
        };
    };

    const UnderlineBars = ({ colors, isMultiple }: { colors: string[], isMultiple: boolean }) => {
        if (!colors || colors.length === 0) return null;

        const isGradient = colors.length > 1;
        const gradientStr = isGradient ? `linear-gradient(90deg, ${colors.map((c, i, arr) => `${c} ${(i / (arr.length - 1)) * 100}%`).join(', ')})` : colors[0];

        return (
            <div className={`absolute left-0 right-0 ${isMultiple ? 'bottom-[2px]' : 'bottom-[6px]'} pointer-events-none flex flex-col gap-[2px]`}>
                {/* Top/Single Bar */}
                <div
                    className="h-[2px] rounded-full w-full"
                    style={{ background: gradientStr }}
                />
                {/* Secondary Bar for multiple glosses */}
                {isMultiple && (
                    <div
                        className="h-[2px] rounded-full w-full"
                        style={{ background: gradientStr }}
                    />
                )}
            </div>
        );
    };

    const handleWordClick = (index: number, event: React.MouseEvent) => {
        if (selectMode) {
            setSelectedIndices(prev => prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]);
            return;
        }

        const wordGlosses = glosses.filter(g => g.word_index ? g.word_index.split(',').map(Number).includes(index) : false);

        if (wordGlosses.length > 0) {
            // Open Popover
            const rect = (event.target as HTMLElement).getBoundingClientRect();
            setActivePopover({ index, rect: { x: rect.left, y: rect.bottom } });
        } else {
            // Open Linker
            const token = tokens[index];
            setShowLinker({
                indices: [index],
                initialQuery: (token.syl || token.tr || '').replace(/[.,!?;:"()]/g, '').trim(),
                targetWord: { syllabary: token.syl, translit: token.tr }
            });
        }
    };

    const handleLinkSelection = () => {
        if (selectedIndices.length === 0) return;
        const sorted = [...selectedIndices].sort((a, b) => a - b);
        // Construct query from first selected word
        const firstToken = tokens[sorted[0]];
        const query = (firstToken?.syl || firstToken?.tr || '').replace(/[.,!?;:"()]/g, '').trim();

        // Map all selected indices to tokens
        const targetWords = sorted.map(i => ({ syllabary: tokens[i].syl, translit: tokens[i].tr }));

        setShowLinker({
            indices: sorted,
            initialQuery: query,
            targetWord: targetWords,
        });
    };

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
                const url = `https://cherokeenationdictionary.net/Audio/${audio.id}`;
                audioRef.current.src = url;
                audioRef.current.onended = () => setPlayingAudioId(null);
                audioRef.current.play();
                setPlayingAudioId(audio.id);
                return;
            }

            const blob = await getAudioFromDB(audio.id);
            if (blob) {
                const url = URL.createObjectURL(blob as any);
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

    // DEBUG: Log audio availability
    console.log(`SentenceCard [${sentence.id}]:`, {
        key: sentence.id + '_sentence',
        hasMeta: !!(userAudioMeta && userAudioMeta[sentence.id + '_sentence']),
        files: userAudioMeta ? userAudioMeta[sentence.id + '_sentence'] : []
    });

    // Derived List ID to avoid collision with Word IDs
    const listId = `s_${sentence.id}`;

    // Imported Notes for Sentence
    const importedNotes = useMemo(() => {
        const list: any[] = [];
        if (!importedData) return list;
        packages.forEach(p => {
            if (p.status === 'active' && importedData[p.id]?.notes) {
                const note = importedData[p.id].notes!.find((n: any) => n.target_id === sentence.id && n.type === 'S');
                if (note) {
                    list.push({ ...note, color: p.color, pkgName: p.name });
                }
            }
        });
        return list;
    }, [packages, importedData, sentence.id]);

    // LIST COUNT
    const inFav = favorites?.includes(listId);
    const inLists = customLists ? Object.keys(customLists).filter(k => {
        const list = customLists[k];
        if (Array.isArray(list)) return list.includes(listId);
        return list?.items?.includes(listId);
    }).length : 0;
    const totalLists = (inFav ? 1 : 0) + inLists;

    // Compute rim color from source package
    const rimHex = (() => {
        const c = getPackageColor(sentence.source);
        if (c?.startsWith('#')) return c;
        const map: Record<string, string> = {
            amber: '#f59e0b', blue: '#3b82f6', green: '#22c55e', red: '#ef4444',
            purple: '#a855f7', sky: '#0ea5e9', pink: '#ec4899', orange: '#f97316', slate: '#64748b'
        };
        if (c && map[c]) return map[c];
        if (sentence.source === 'user' || sentence.source.startsWith('nb_') || customDictionaries?.[sentence.source]) return '#f59e0b';
        return '#64748b';
    })();

    return (
        <div className={`bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4 pl-6 shadow-sm mb-4 relative overflow-hidden group/card hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${isDimmed ? 'opacity-50 grayscale' : ''} ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
            {/* Color Bar Rim */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ backgroundColor: rimHex }} />
            {/* Header / Controls */}
            <div className="flex justify-between items-center mb-1.5" onClick={e => e.stopPropagation()}>
                <div className="flex gap-1 items-center">
                   {/* Left side empty or add items here if needed */}
                </div>
                <div className="flex items-center gap-3">
                    {/* Read in Context Button */}
                    {onReadInContext && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onReadInContext(sentence.id); }}
                            className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest hover:underline flex items-center gap-1"
                            title="See in context"
                        >
                            <BookOpen size={12} />
                            See in Context
                        </button>
                    )}
                    
                    {/* List Add Button */}
                    {(onToggleFavorite || onToggleList) && (
                        <button onClick={(e) => { e.stopPropagation(); setShowListSheet(true); }} className={`p-1 rounded-full transition-colors flex items-center gap-1 ${totalLists > 0 ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            {totalLists > 0 ? <ListIcon size={14} className="fill-amber-100" /> : <ListPlus size={14} />}
                            {totalLists > 0 && <span className="text-[10px] font-bold">{totalLists}</span>}
                        </button>
                    )}

                    {/* Edit Note Button */}
                    {onEditNote && (
                        <button onClick={(e) => { e.stopPropagation(); onEditNote(sentence.id, userNotes?.[`s_${sentence.id}`] || ''); }} className="text-slate-300 hover:text-amber-600 p-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                            <Pencil size={14} />
                        </button>
                    )}

                    <SourceBadge source={sentence.source} name={customDictionaries?.[sentence.source]?.name || sourceMap?.[sentence.source] || sentence.source} />
                </div>
            </div>

            {/* Edit/Delete for user sentences - hover reveal */}
            {(sentence.source === 'user' || sentence.source.startsWith('nb_')) && (
                <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    {onEditSentence && (
                        <button onClick={(e) => { e.stopPropagation(); onEditSentence(sentence.id); }} className="text-slate-400 hover:text-amber-600 p-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors bg-white/80 dark:bg-slate-900/80 shadow-sm">
                            <Pencil size={12} />
                        </button>
                    )}
                    <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-white/80 dark:bg-slate-900/80 shadow-sm">
                        <Trash2 size={12} />
                    </button>
                </div>
            )}

            {/* Sentence Tokens */}
            <div className="flex flex-wrap gap-x-3 gap-y-2 mb-3">
                {tokens.map((token, i) => {
                    const isSelected = selectedIndices.includes(i);
                    const glossMeta = getGlossMeta(i);

                    // Determine if the sentence has ANY syllabary at all to reserve vertical space
                    const hasAnySyllabary = tokens.some(t => t.syl && t.syl.trim().length > 0);

                    return (
                        <div
                            key={i}
                            className={`flex flex-col items-center cursor-pointer group relative ${isSelected ? 'bg-amber-100 dark:bg-amber-900/40 rounded px-1 -mx-1' : ''}`}
                            onClick={(e) => { e.stopPropagation(); handleWordClick(i, e); }}
                        >
                            {/* Syllabary Row */}
                            <div className={`relative flex flex-col items-center justify-end ${hasAnySyllabary ? 'min-h-[2.5rem]' : ''}`}>
                                <span
                                    className="font-serif text-xl text-slate-900 dark:text-slate-100 leading-none pb-2 block"
                                >
                                    {token.syl}
                                </span>
                                {token.syl && glossMeta && (
                                    <UnderlineBars colors={glossMeta.uniqueColors} isMultiple={glossMeta.isMultiple} />
                                )}
                            </div>

                            {/* Transliteration Row */}
                            <div className="relative flex flex-col items-center justify-start min-h-[1.75rem]">
                                <span
                                    className="text-lg text-slate-500 dark:text-slate-400 font-medium pb-2 block"
                                >
                                    {token.tr}
                                </span>
                                {!token.syl && glossMeta && (
                                    <UnderlineBars colors={glossMeta.uniqueColors} isMultiple={glossMeta.isMultiple} />
                                )}
                            </div>
                            {/* Selection Checkmark */}
                            {isSelected && <div className="absolute -top-2 -right-2 bg-amber-500 text-white rounded-full p-0.5"><Check size={10} /></div>}
                        </div>
                    );
                })}
            </div>

            {/* Gloss Select Mode Bar - only shows when active */}
            {selectMode && (
                <div className="flex items-center gap-2 mb-2" onClick={e => e.stopPropagation()}>
                    <button
                        onClick={() => { setSelectMode(false); setSelectedIndices([]); }}
                        className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleLinkSelection}
                        disabled={selectedIndices.length === 0}
                        className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${selectedIndices.length > 0 ? 'bg-amber-500 text-white shadow-md hover:bg-amber-600' : 'bg-slate-100 text-slate-400'}`}
                    >
                        <Plus size={12} /> Gloss ({selectedIndices.length})
                    </button>
                </div>
            )}

            {/* English Translation */}
            <div className="text-sm text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800/60 pt-2.5 mt-2">
                {renderStyledText(sentence.english)}
            </div>

            {/* All Audios & Record Button */}
            {(sentence.audio || userAudioMeta?.[sentence.id + '_sentence'] || onSaveAudio) && (
                <div className="mt-3 flex flex-wrap gap-2 items-center" onClick={e => e.stopPropagation()}>
                    {/* Official Audio */}
                    {sentence.audio && (() => {
                        const sColor = getPackageColor(sentence.source);
                        const isOfficial = packages.find(p => (p.id === sentence.source || p.metadata.source_names?.[sentence.source]) && p.type === 'official');
                        const isOfficialFile = isOfficial || sentence.audio.endsWith('.m4a') || sentence.audio.startsWith('Word_') || sentence.audio.match(/^\d{4}\./);
                        
                        if (!isOfficialFile) return null;

                        const customColor = isOfficial ? undefined : sColor;
                        const audioUrl = `https://cherokeenationdictionary.net/Audio/${sentence.audio}`;
                        
                        return (
                            <AudioPlayer src={audioUrl} label={sentence.speaker || "Official"} icon={Mic} variant="gray" customColor={customColor} />
                        );
                    })()}

                    {/* User Audios */}
                    {userAudioMeta?.[sentence.id + '_sentence']
                        ?.filter(audio => {
                            if (audio.packageId === 'official-cherokee-data' || audio.id.endsWith('.m4a')) return false;
                            if (!audio.packageId) {
                                const userPkg = packages.find(p => p.id === 'user');
                                return userPkg ? userPkg.status === 'active' : true;
                            }
                            const pkg = packages.find(p => p.id === audio.packageId);
                            return pkg && pkg.status === 'active';
                        })
                        .map((audio: any) => {
                            const audioPkg = packages.find(p => p.id === audio.packageId);
                            const isOfficial = audioPkg ? audioPkg.type === 'official' : false;
                            const pkgColor = getPackageColor(audio.packageId || 'user');
                            const isCustomColor = pkgColor && pkgColor.startsWith('#');
                            const isPlaying = playingAudioId === audio.id;
                            const speakerName = isOfficial ? (audio.id.split('_')[0] || 'Official') : (audio.speaker || 'User');
                            let style = {};
                            let className = "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm group ";

                            if (isOfficial) {
                                className += isPlaying ? 'bg-slate-300 text-slate-800' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
                            } else if (isCustomColor) {
                                if (isPlaying) {
                                    style = {
                                        backgroundColor: pkgColor + '20',
                                        color: pkgColor,
                                        borderColor: pkgColor
                                    };
                                } else {
                                    style = {
                                        backgroundColor: pkgColor,
                                        color: 'white'
                                    };
                                }
                            } else if (pkgColor && pkgColor !== 'slate') {
                                className += isPlaying ? `bg-${pkgColor}-100 dark:bg-${pkgColor}-900 text-${pkgColor}-800 dark:text-${pkgColor}-100` : `bg-${pkgColor}-500 text-white hover:bg-${pkgColor}-600`;
                            } else {
                                className += isPlaying ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600';
                            }

                            return (
                                <div key={audio.id} className={className} style={style}>
                                    <button
                                        onClick={() => handlePlayUserAudio(audio)}
                                        className="flex items-center gap-2"
                                    >
                                        {isPlaying ? <Pause size={12} className="fill-current" /> : <Mic size={12} />}
                                        <span>{isPlaying ? 'Playing...' : speakerName}</span>
                                    </button>
                                    {!isOfficial && onDeleteAudio && (
                                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete audio?")) onDeleteAudio(sentence.id + '_sentence', audio.id); }} className="ml-1 pl-2 border-l border-white/20 hover:text-red-200 transition-colors flex items-center">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        
                    {/* Record Audio Button - inline with audio */}
                    {onSaveAudio && (
                        <button
                            onClick={() => setShowRecorder(true)}
                            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors shrink-0"
                            title="Record Audio"
                        >
                            <MicPlus size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* Notes - only shown when notes exist */}
            {(importedNotes.length > 0 || (userNotes?.[`s_${sentence.id}`])) && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    {/* Imported Notes */}
                    {importedNotes.map((note, i) => (
                        <div key={i} className="mb-2 text-xs text-slate-600 dark:text-slate-300 border-l-2 pl-2" style={{ borderLeftColor: note.color }}>
                            {note.text}
                        </div>
                    ))}

                    {userNotes?.[`s_${sentence.id}`] && onEditNote && (
                        <div
                            onClick={() => onEditNote(sentence.id, userNotes[`s_${sentence.id}`] || '')}
                            className="text-xs text-slate-600 dark:text-slate-300 hover:text-amber-600 cursor-pointer flex items-center gap-1 group relative border-l-2 pl-2 border-l-amber-500"
                        >
                            <span>{userNotes[`s_${sentence.id}`]}</span>
                            <Pencil size={10} className="absolute -right-1 top-0 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600" />
                        </div>
                    )}
                </div>
            )}

            {/* Modals/Popovers */}
            {activePopover && (
                <GlossPopover
                    glosses={glosses.filter(g => g.word_index ? g.word_index.split(',').map(Number).includes(activePopover.index) : false)}
                    targetWord={{ syllabary: tokens[activePopover.index].syl, translit: tokens[activePopover.index].tr }}
                    dictionaryMap={dictionaryMap}
                    position={activePopover.rect}
                    onClose={() => setActivePopover(null)}
                    onEntryClick={(id) => {
                        // Navigate to entry
                        const url = new URL(window.location.href);
                        url.searchParams.set('word', id);
                        window.history.pushState({}, '', url.toString());
                        window.dispatchEvent(new PopStateEvent('popstate'));
                        setActivePopover(null);
                    }}

                    onDelete={(gloss) => {
                        if (gloss.id) {
                            removeUserGloss(gloss.id);
                        } else {
                            console.warn("Cannot delete gloss without ID");
                        }
                        setActivePopover(null);
                    }}
                    onAdd={() => {
                        const index = activePopover.index;
                        const token = tokens[index];
                        setShowLinker({
                            indices: [index],
                            initialQuery: (token.syl || token.tr || '').replace(/[.,!?;:"()]/g, '').trim(),
                            targetWord: { syllabary: token.syl, translit: token.tr }
                        });
                        setActivePopover(null);
                    }}
                    onEdit={(gloss) => {
                        let entry = dictionaryMap.get(gloss.entry_id);
                        if (!entry && personalWords) {
                            const pw = personalWords.find(w => w.Index === gloss.entry_id || w.id === gloss.entry_id);
                            if (pw) entry = { ...pw, id: pw.Index, translit: pw.Entry, syllabary: pw.Syllabary, definition: pw.Definition };
                        }

                        if (entry) {
                            const indices = gloss.word_index ? gloss.word_index.split(',').map(Number) : [];
                            const targetWords = indices.map(i => ({ syllabary: tokens[i]?.syl || '', translit: tokens[i]?.tr || '' }));

                            setShowLinker({
                                indices: indices,
                                initialQuery: entry.translit || '',
                                targetWord: targetWords,
                                initialData: {
                                    entry,
                                    notes: gloss.notes || '',
                                    breakdownCherokee: gloss.breakdown_cherokee || '',
                                    breakdownEnglish: gloss.breakdown_english || ''
                                },
                                glossId: gloss.id
                            });
                            setActivePopover(null);
                        }
                    }}
                    personalWords={personalWords}
                />
            )}

            {showLinker && (
                <LinkerModal
                    initialQuery={showLinker.initialQuery}
                    targetWord={showLinker.targetWord}
                    initialData={showLinker.initialData}
                    dictionary={dictionary}
                    personalWords={personalWords}
                    onClose={() => setShowLinker(null)}
                    onSelect={(entry, notes, breakdownCherokee, breakdownEnglish) => {
                        const targetWords = Array.isArray(showLinker.targetWord) 
                            ? showLinker.targetWord 
                            : (showLinker.targetWord ? [showLinker.targetWord] : []);
                        const glossSyl = targetWords.map(tw => tw.syllabary || '').join(' ').trim();
                        const glossPhon = targetWords.map(tw => tw.translit || '').join(' ').trim();
                        const glossDef = entry.definition || entry.Definition;

                        // If editing existing gloss (glossId present), update it.
                        if (showLinker.glossId) {
                            addUserGloss({
                                sentence_id: sentence.id,
                                word_index: showLinker.indices.join(','),
                                entry_id: entry.id,
                                notes,
                                breakdown_cherokee: breakdownCherokee,
                                breakdown_english: breakdownEnglish,
                                source: 'user',
                                id: showLinker.glossId,
                                gloss_syllabary: glossSyl,
                                gloss_phonetic: glossPhon,
                                gloss_english: glossDef
                            });
                        } else {
                            // Creating new gloss - Single entry for multiple words
                            addUserGloss({
                                sentence_id: sentence.id,
                                word_index: showLinker.indices.join(','),
                                entry_id: entry.id,
                                notes,
                                breakdown_cherokee: breakdownCherokee,
                                breakdown_english: breakdownEnglish,
                                source: 'user',
                                gloss_syllabary: glossSyl,
                                gloss_phonetic: glossPhon,
                                gloss_english: glossDef
                            });
                        }
                        setShowLinker(null);
                        setSelectMode(false);
                        setSelectedIndices([]);
                    }}
                    onDelete={showLinker.initialData ? () => {
                        if (showLinker.glossId) {
                            removeUserGloss(showLinker.glossId);
                        } else {
                            // Fallback (shouldn't happen for existing user glosses)
                            showLinker.indices.forEach(idx => {
                                const g = glosses.find(g => g.word_index === idx.toString());
                                if (g && g.id) removeUserGloss(g.id);
                            });
                        }
                        setShowLinker(null);
                    } : undefined}
                    onCreateNew={onCreateWord}
                    customDictionaries={customDictionaries}
                />
            )}
            {showRecorder && (
                <AudioRecorder
                    formLabel="Sentence"
                    syllabary={sentence.syllabary}
                    title={sentence.tone || sentence.translit}
                    transliteration={sentence.english}
                    onSave={(blob, speaker) => {
                        if (onSaveAudio) {
                            onSaveAudio(sentence.id + '_sentence', blob, speaker, undefined, sentence.english || sentence.translit);
                        }
                        setShowRecorder(false);
                    }}
                    onCancel={() => setShowRecorder(false)}
                />
            )}
            {showListSheet && customLists && (
                <div className="fixed inset-0 z-[100] flex flex-col justify-end" onClick={(e) => e.stopPropagation()}>
                    <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={() => setShowListSheet(false)}></div>
                    <div className="bg-white dark:bg-slate-900 w-full rounded-t-2xl p-4 shadow-2xl animate-slide-up-sheet relative z-10 max-h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add to List</h3>
                            <button onClick={() => setShowListSheet(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                                <X size={20} className="dark:text-slate-200" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 space-y-2 mb-4">
                            {onToggleFavorite && (
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                                    <input type="checkbox" checked={favorites?.includes(listId) || false} onChange={() => onToggleFavorite(listId)} className="w-5 h-5 accent-amber-500" />
                                    <div className="flex items-center gap-2">
                                        <Star size={18} className="text-amber-500 fill-amber-500" />
                                        <span className="font-bold text-slate-700 dark:text-slate-200">Favorites</span>
                                    </div>
                                </label>
                            )}
                            {Object.keys(customLists).map(listKey => {
                                const list = customLists[listKey];
                                const isChecked = Array.isArray(list) ? list.includes(listId) : list.items.includes(listId);
                                const name = Array.isArray(list) ? listKey : list.name;
                                return (
                                    <label key={listKey} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 cursor-pointer">
                                        <input type="checkbox" checked={isChecked} onChange={() => onToggleList && onToggleList(listKey, listId)} className="w-5 h-5 accent-amber-500" />
                                        <div className="flex items-center gap-2">
                                            <ListIcon size={18} className="text-slate-500" />
                                            <span className="font-medium text-slate-700 dark:text-slate-200">{name}</span>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        {onOpenNewListModal && (
                            <button onClick={() => { setShowListSheet(false); onOpenNewListModal(listId); }} className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 shrink-0">
                                <Plus size={20} /> Create New List
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};