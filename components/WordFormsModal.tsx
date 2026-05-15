
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Trash2, Pause, Volume2, Plus } from './Icons';
import { getFriendlyLabel, processFormsContextually } from '../utils';
import { useCorpus } from './CorpusContext';

interface WordFormsModalProps {
    isOpen: boolean;
    onClose: () => void;
    entry: any;
    userWordForms: any;
    importedData: any;
    onManageForms: (entry: any) => void;
    userAudioMeta: any;
    onPlayAudio: (audio: any) => void;
    playingAudioId: string | null;
    onRecordAudio: (target: string) => void;
    onDeleteAudio: (entryIndex: string, audioId: string) => void;
    getPackageColor: (id: string) => string | undefined | any;
    packages: any[];
    onReadInContext?: (sentenceId: string) => void;
}

const MiniAudioButton = ({ audio, isOfficial = false, color, isPlaying, onPlay, onDelete }: { audio: any, isOfficial?: boolean, color?: string, isPlaying: boolean, onPlay: () => void, onDelete?: () => void }) => {

    let bgClass = "";
    let style = {};

    if (isPlaying) {
        bgClass = "bg-amber-100 dark:bg-amber-900/40 text-amber-600";
    } else if (color) {
        if (color.startsWith('#')) {
            style = { backgroundColor: color, color: '#fff' };
        } else {
            bgClass = `bg-${color}-500 text-white hover:bg-${color}-600`;
        }
    } else if (isOfficial) {
        bgClass = "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-700 transition-colors";
    } else {
        bgClass = "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-amber-600";
    }

    // Adjust for playing state with custom color
    if (isPlaying && color && color.startsWith('#')) {
        style = { backgroundColor: color + '20', color: color, borderColor: color, borderWidth: '1px' };
        bgClass = "";
    }

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={(e) => { e.stopPropagation(); onPlay(); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${bgClass}`}
                style={style}
                title={isOfficial ? "Official Audio" : (audio.speaker || "User Recording")}
            >
                {isPlaying ? <Pause size={14} className="fill-current" /> : <Volume2 size={14} />}
            </button>
            {onDelete && !isOfficial && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                >
                    <Trash2 size={14} />
                </button>
            )}
        </div>

    );
};

export const WordFormsModal: React.FC<WordFormsModalProps> = ({
    isOpen,
    onClose,
    entry,
    userWordForms,
    onManageForms,
    userAudioMeta,
    onPlayAudio,
    playingAudioId,
    onRecordAudio,
    onDeleteAudio,
    getPackageColor,
    packages,
    importedData,
    onReadInContext
}) => {
    if (!isOpen || !entry) return null;

    const { glosses, sentenceMap } = useCorpus();
    const entryGlosses = glosses.filter((g: any) => g.entry_id === entry.Index && (g.gloss_syllabary || g.gloss_phonetic));

    // Helper to tokenize sentence for context view
    const tokenizeSentence = (syllabary: string, translit: string) => {
        const syl = syllabary ? syllabary.split(' ') : [];
        const tr = translit ? translit.split(' ') : [];
        const max = Math.max(syl.length, tr.length);
        const tokens: { syl: string; tr: string; index: number }[] = [];
        for (let i = 0; i < max; i++) {
            tokens.push({ syl: (syl[i] || '').replace(/\*/g, ''), tr: (tr[i] || '').replace(/\*/g, ''), index: i });
        }
        return tokens;
    };

    // Compile all forms
    const allForms: any[] = [];

    // 1. Official Forms
    if (entry.Other_Forms) {
        entry.Other_Forms.split('|').forEach((form: string, i: number) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                const formIndex = i + 1;
                allForms.push({
                    type: 'official',
                    label: parts[0],
                    translit: values[0],
                    syllabary: values[1],
                    tone: values[2],
                    notes: values[3],
                    index: formIndex, // Official 1-based index
                    color: 'slate'
                });
            }
        });
    }

    // 2. Imported Forms
    const importedFormsForThisEntry: any[] = [];
    packages.forEach(p => {
        if (p.status === 'active' && importedData[p.id]?.word_forms) {
            const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === entry.Index);
            if (forms.length > 0) {
                forms.forEach(f => importedFormsForThisEntry.push({ ...f, color: p.color, pkgName: p.name }));
            }
        }
    });

    const processedImportedForms = processFormsContextually(importedFormsForThisEntry);

    processedImportedForms.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(f => {
        allForms.push({
            type: 'imported',
            label: f.displayLabel || getFriendlyLabel(f.form_name),
            translit: f.translit,
            syllabary: f.syllabary,
            tone: f.tone,
            notes: f.notes,
            index: f.computed_index,
            color: f.color,
            source: f.source,
            audio: f.audio
        });
    });

    // 3. Custom Forms
    if (userWordForms && userWordForms[entry.Index]) {
        const officialCount = entry.Other_Forms ? entry.Other_Forms.split('|').length : 0;
        userWordForms[entry.Index].split('|').forEach((form: string, i: number) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                const formIndex = officialCount + i + 1;
                allForms.push({
                    type: 'custom',
                    label: parts[0],
                    translit: values[0],
                    syllabary: values[1],
                    tone: values[2],
                    notes: values[3],
                    index: formIndex,
                    color: 'gold' // or amber
                });
            }
        });
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-white dark:bg-slate-900 animate-fade-in shadow-2xl">
            <div className="flex-1 flex flex-col overflow-hidden w-full h-full">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 h-[70px]">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">Word Forms</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                            {allForms.length} form{allForms.length !== 1 ? 's' : ''} available{entryGlosses.length > 0 ? ` (+${entryGlosses.length} contextual)` : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 flex items-center justify-center"
                        aria-label="Close"
                        title="Close Word Forms"
                    >
                        <X size={24} strokeWidth={2} />
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-1/4">Form</th>
                                <th className="p-3 border-b border-slate-100 dark:border-slate-700">Details</th>
                                <th className="p-3 border-b border-slate-100 dark:border-slate-700 w-16 text-center">Audio</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {allForms.map((form, idx) => {
                                // Audio Logic
                                const formAudios = userAudioMeta && userAudioMeta[entry.Index]
                                    ? userAudioMeta[entry.Index].filter((a: any) => a.id.includes(`-${entry.Index}.${form.index}_`))
                                    : [];

                                let borderStyle: React.CSSProperties = { borderLeftWidth: '6px' };
                                const colorName = form.color === 'gold' ? 'amber' : (form.color || 'slate');

                                if (colorName.startsWith('#')) {
                                    borderStyle.borderLeftColor = colorName;
                                } else {
                                    const colors: Record<string, string> = {
                                        'amber': '#f59e0b',
                                        'blue': '#3b82f6',
                                        'green': '#22c55e',
                                        'red': '#ef4444',
                                        'purple': '#a855f7',
                                        'sky': '#0ea5e9',
                                        'pink': '#ec4899',
                                        'orange': '#f97316',
                                        'slate': '#64748b'
                                    };
                                    borderStyle.borderLeftColor = colors[colorName] || '#64748b';
                                }

                                return (
                                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group relative">
                                        <td className="p-3 align-top pl-5">
                                            {/* SOURCE RIM */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-1.5"
                                                style={{ backgroundColor: borderStyle.borderLeftColor }}
                                            />
                                            <div className="font-bold text-slate-700 dark:text-slate-200 text-xs break-words leading-tight">{form.label}</div>
                                            {form.source && (
                                                <div className="mt-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                    {form.source}
                                                </div>
                                            )}
                                            {form.type === 'custom' && (
                                                <div className="mt-1 text-[9px] font-bold text-amber-500 uppercase tracking-widest">
                                                    User
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                                <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 break-words leading-snug">{form.syllabary}</div>
                                                <div className="font-noto-serif text-sm text-amber-700 dark:text-amber-400 font-medium break-words leading-snug">{form.translit}</div>
                                                {form.tone && <div className="text-[10px] text-slate-400 dark:text-slate-500 italic break-words">{form.tone}</div>}
                                                {form.notes && <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1 break-words leading-tight">{form.notes}</div>}
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col items-center gap-1.5">
                                                {form.audio && (
                                                    <MiniAudioButton
                                                        key={`official-${form.audio}`}
                                                        audio={{ id: form.audio, packageId: 'official-cherokee-data' }}
                                                        isOfficial={true}
                                                        isPlaying={playingAudioId === form.audio}
                                                        onPlay={() => onPlayAudio({ id: form.audio, packageId: 'official-cherokee-data' })}
                                                    />
                                                )}
                                                {formAudios.map((audio: any) => {
                                                    const audioPkg = packages.find(p => p.id === audio.packageId);
                                                    const isOfficial = audioPkg ? audioPkg.type === 'official' : false;
                                                    return (
                                                        <MiniAudioButton
                                                            key={audio.id}
                                                            audio={audio}
                                                            isOfficial={isOfficial}
                                                            color={isOfficial ? undefined : getPackageColor(audio.packageId || 'user')}
                                                            isPlaying={playingAudioId === audio.id}
                                                            onPlay={() => onPlayAudio(audio)}
                                                            onDelete={() => onDeleteAudio(entry.Index, audio.id)}
                                                        />
                                                    );
                                                })}
                                                <button
                                                    onClick={() => onRecordAudio(`form_${form.index}`)}
                                                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-colors shrink-0"
                                                    title="Record Audio"
                                                >
                                                    <Mic size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

                            {entryGlosses.length > 0 && (
                                <>
                                    {/* Small space separator */}
                                    <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                                        <td colSpan={3} className="py-3.5 px-6 border-y border-slate-100 dark:border-slate-800/60">
                                            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                                                Seen in context
                                            </span>
                                        </td>
                                    </tr>
                                    {entryGlosses.map((g: any, gIdx: number) => {
                                        const sentence = sentenceMap.get(g.sentence_id);
                                        if (!sentence) return null;

                                        const tokens = tokenizeSentence(sentence.syllabary, sentence.translit);
                                        const targetIndices = g.word_index ? g.word_index.split(',').map(Number) : [];

                                        const pkgColor = getPackageColor(g.source || 'slate') || 'slate';
                                        let pkgHex = '#64748b'; // Default Slate
                                        if (pkgColor.startsWith('#')) {
                                            pkgHex = pkgColor;
                                        } else {
                                            const colors: Record<string, string> = {
                                                'amber': '#f59e0b',
                                                'blue': '#3b82f6',
                                                'green': '#22c55e',
                                                'red': '#ef4444',
                                                'purple': '#a855f7',
                                                'sky': '#0ea5e9',
                                                'pink': '#ec4899',
                                                'orange': '#f97316',
                                                'slate': '#64748b'
                                            };
                                            pkgHex = colors[pkgColor] || '#64748b';
                                        }

                                        return (
                                            <tr key={`gloss-${gIdx}`} className="border-b border-slate-100 dark:border-slate-800/50">
                                                <td colSpan={3} className="p-4">
                                                    <div 
                                                        className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm bg-white dark:bg-slate-900/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group relative pl-6 cursor-pointer overflow-hidden"
                                                        onClick={() => {
                                                            if (onReadInContext) {
                                                                onReadInContext(g.sentence_id);
                                                                onClose();
                                                            }
                                                        }}
                                                    >
                                                        {/* Color Bar Rim */}
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1.5"
                                                            style={{ backgroundColor: pkgHex }}
                                                        />

                                                        {/* Card Header / Meta */}
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                Source: {g.source || 'N/A'}
                                                            </div>
                                                            <div className="text-sky-600 dark:text-sky-400 font-extrabold text-xs uppercase tracking-wider group-hover:underline">
                                                                See in context
                                                            </div>
                                                        </div>

                                                        {/* Tokens (Spotlight highlight like investigation queue) */}
                                                        <div className="flex flex-wrap gap-x-3 gap-y-2 mb-3">
                                                            {tokens.map((token, i) => {
                                                                const isTarget = targetIndices.includes(i);
                                                                return (
                                                                    <div
                                                                        key={i}
                                                                        className={`flex flex-col items-center transition-opacity ${isTarget ? 'opacity-100 scale-[1.02]' : 'opacity-30'}`}
                                                                    >
                                                                        <span className={`font-serif text-lg ${isTarget
                                                                            ? 'text-amber-600 dark:text-amber-400 font-bold'
                                                                            : 'text-slate-700 dark:text-slate-300'
                                                                        }`}>
                                                                            {token.syl}
                                                                        </span>
                                                                        <span className={`text-sm ${isTarget
                                                                            ? 'text-amber-600 dark:text-amber-400 font-semibold italic'
                                                                            : 'text-slate-500 dark:text-slate-500'
                                                                        }`}>
                                                                            {token.tr}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* English translation */}
                                                        {sentence.english && (
                                                            <div className="text-sm text-slate-500 dark:text-slate-400 italic border-t border-slate-100 dark:border-slate-800/60 pt-2.5 mt-2">
                                                                {sentence.english}
                                                            </div>
                                                        )}

                                                        {/* Breakdown or Gloss specific info */}
                                                        {g.notes && (
                                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-2">
                                                                Note: {g.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </>
                            )}

                            {/* Add Form Row */}
                            <tr
                                onClick={() => onManageForms(entry)}
                                className="hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors"
                            >
                                <td colSpan={3} className="p-4 text-center border-l-4 border-transparent group-hover:border-l-amber-300">
                                    <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 group-hover:text-amber-600 font-bold text-sm uppercase tracking-wide">
                                        <Plus size={18} />
                                        <span>Add / Manage Word Forms</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>,
        document.body
    );
};
