import React, { useState, useMemo, useRef } from 'react';
import { Sentence, useCorpus } from './CorpusContext';
import { usePackageManager } from './PackageManagerContext';
import { GlossPopover } from './GlossPopover';
import { LinkerModal } from './LinkerModal';
import { AudioPlayer, SourceBadge } from './UI';
import { Check, Plus, Mic, Pencil, MicPlus, Trash2, Pause, ListIcon, Star, X, ListPlus } from './Icons';
import { getAudioFromDB } from '../utils';

import AudioRecorder from './AudioRecorder';

interface SentenceCardProps {
    sentence: Sentence;
    onClick?: () => void;
    isDimmed?: boolean;
    notebooks?: any;
    userNotes?: Record<string, string>;
    onEditNote?: (id: string, note: string) => void;
    onEditSentence?: (id: string) => void;
    sourceMap?: Record<string, string>;
    onSaveAudio?: (id: string, blob: Blob, speaker: string) => void;
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
}

export const SentenceCard: React.FC<SentenceCardProps> = ({ sentence, onClick, isDimmed, notebooks, userNotes, onEditNote, onEditSentence, sourceMap, onSaveAudio, userAudioMeta, personalWords, onDeleteSentence, onDeleteAudio, onCreateWord, favorites, customLists, onToggleFavorite, onToggleList, onOpenNewListModal }) => {
    const { glossMap, dictionaryMap, addUserGloss, removeUserGloss, removeUserSentence } = useCorpus();
    const { packages, getPackageColor } = usePackageManager(); // Add this line
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
            res.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
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
            const indices = g.word_index.split(',').map(Number);
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
            if (g.source === 'user' || (notebooks && notebooks[g.source]) || g.source.startsWith('nb_')) {
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

        const wordGlosses = glosses.filter(g => g.word_index.split(',').map(Number).includes(index));

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
                const url = `/data/audio/${audio.id}`;
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

    // LIST COUNT
    const inFav = favorites?.includes(listId);
    const inLists = customLists ? Object.keys(customLists).filter(k => {
        const list = customLists[k];
        if (Array.isArray(list)) return list.includes(listId);
        return list?.items?.includes(listId);
    }).length : 0;
    const totalLists = (inFav ? 1 : 0) + inLists;


    return (
        <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-4 ${isDimmed ? 'opacity-50 grayscale' : ''}`}>
            {/* Header / Controls */}
            <div className={`flex justify-between items-start mb-2 ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
                <div className="flex items-center gap-2">
                    {/* Edit/Delete buttons for user sentences - Moved to Left */}
                    {(sentence.source === 'user' || sentence.source.startsWith('nb_')) ? (
                        <div className="flex gap-1">
                            {onEditSentence && (
                                <button onClick={(e) => { e.stopPropagation(); onEditSentence(sentence.id); }} className="text-slate-400 hover:text-amber-600 p-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                    <Pencil size={14} />
                                </button>
                            )}
                            <button onClick={handleDelete} className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    {/* List Add Button */}
                    {(onToggleFavorite || onToggleList) && (
                        <button onClick={(e) => { e.stopPropagation(); setShowListSheet(true); }} className={`p-1 rounded-full transition-colors flex items-center gap-1 ${totalLists > 0 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                            {totalLists > 0 ? <ListIcon size={14} className="fill-amber-100" /> : <ListPlus size={14} />}
                            {totalLists > 0 && <span className="text-[10px] font-bold">{totalLists}</span>}
                        </button>
                    )}
                    {sentence.audio && <div className="text-slate-400"><Mic size={14} /></div>}
                    <SourceBadge source={sentence.source} name={notebooks?.[sentence.source]?.name || sourceMap?.[sentence.source] || sentence.source} />
                </div>
            </div>

            {/* Sentence Tokens */}
            <div className="flex flex-wrap gap-x-3 gap-y-4 mb-4">
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

            {/* Gloss Buttons & Audio Add - Moved Here */}
            <div className="flex items-center justify-between mb-2" onClick={e => e.stopPropagation()}>
                <div className="flex gap-2">
                    {selectMode ? (
                        <>
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
                        </>
                    ) : (
                        <button
                            onClick={() => setSelectMode(true)}
                            className="text-xs font-bold text-slate-500 hover:text-amber-600 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-200 transition-colors"
                        >
                            Gloss Multiple
                        </button>
                    )}
                </div>
                {/* Add User Audio Button */}
                {onSaveAudio && (
                    <button
                        onClick={() => setShowRecorder(true)}
                        className="text-slate-400 hover:text-amber-600 p-1 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                        <MicPlus size={16} />
                    </button>
                )}
            </div>

            {/* English Translation */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                {sentence.english}
            </div>

            {/* Official Audio */}
            {sentence.audio && (() => {
                const sColor = getPackageColor(sentence.source);
                const isOfficial = packages.find(p => (p.id === sentence.source || p.metadata.source_names?.[sentence.source]) && p.type === 'official');
                const customColor = isOfficial ? undefined : sColor;
                return (
                    <div className="mt-3" onClick={e => e.stopPropagation()}>
                        <AudioPlayer src={`/data/audio/${sentence.audio}`} label="Play Sentence" icon={Mic} variant="gray" customColor={customColor} />
                    </div>
                );
            })()}
            {/* User Audio */}
            {userAudioMeta && userAudioMeta[sentence.id + '_sentence'] && (
                <div className="mt-2 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                    {userAudioMeta[sentence.id + '_sentence']
                        .filter(audio => {
                            if (!audio.packageId) {
                                const userPkg = packages.find(p => p.id === 'user');
                                return userPkg ? userPkg.status === 'active' : true;
                            }
                            const pkg = packages.find(p => p.id === audio.packageId);
                            return pkg && pkg.status === 'active';
                        })
                        .map((audio: any) => {
                            // Determine color
                            const audioPkg = packages.find(p => p.id === audio.packageId);
                            const isOfficial = audioPkg ? audioPkg.type === 'official' : false;
                            const pkgColor = getPackageColor(audio.packageId || 'user');
                            const isCustomColor = pkgColor && pkgColor.startsWith('#');
                            const isPlaying = playingAudioId === audio.id;
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
                                // Default Amber
                                className += isPlaying ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600';
                            }

                            return (
                                <div key={audio.id} className={className} style={style}>
                                    <button
                                        onClick={() => handlePlayUserAudio(audio)}
                                        className="flex items-center gap-2"
                                    >
                                        {isPlaying ? <Pause size={12} className="fill-current" /> : <Mic size={12} />}
                                        <span>{isPlaying ? 'Playing...' : (audio.speaker || 'User')}</span>
                                    </button>
                                    {!isOfficial && onDeleteAudio && (
                                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete audio?")) onDeleteAudio(sentence.id + '_sentence', audio.id); }} className="ml-1 pl-2 border-l border-white/20 hover:text-red-200 transition-colors flex items-center">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Notes */}
            {onEditNote && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                    <div
                        onClick={() => onEditNote(sentence.id, userNotes?.[sentence.id] || '')}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-amber-600 cursor-pointer flex items-center gap-1 group"
                    >
                        <Pencil size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        {userNotes?.[sentence.id] ? (
                            <span className="italic">{userNotes[sentence.id]}</span>
                        ) : (
                            <span className="opacity-50">Add note...</span>
                        )}
                    </div>
                </div>
            )}

            {/* Modals/Popovers */}
            {activePopover && (
                <GlossPopover
                    glosses={glosses.filter(g => g.word_index.split(',').map(Number).includes(activePopover.index))}
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
                            const indices = gloss.word_index.split(',').map(Number);
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
                    dictionary={Array.from(dictionaryMap.values())}
                    personalWords={personalWords}
                    onClose={() => setShowLinker(null)}
                    onSelect={(entry, notes, breakdownCherokee, breakdownEnglish) => {
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
                                id: showLinker.glossId
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
                                source: 'user'
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
                    notebooks={notebooks}
                />
            )}
            {showRecorder && (
                <AudioRecorder
                    title={sentence.english || "Sentence Audio"}
                    syllabary={sentence.syllabary}
                    transliteration={sentence.translit}
                    onSave={(blob, speaker) => {
                        if (onSaveAudio) {
                            onSaveAudio(sentence.id + '_sentence', blob, speaker);
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
