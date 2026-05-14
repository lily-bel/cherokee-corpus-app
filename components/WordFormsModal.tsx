
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Trash2, Pause, Volume2, Plus } from './Icons';
import { getFriendlyLabel } from '../utils';

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
    importedData
}) => {
    if (!isOpen || !entry) return null;

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

    importedFormsForThisEntry.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(f => {
        allForms.push({
            type: 'imported',
            label: getFriendlyLabel(f.form_name),
            translit: f.translit,
            syllabary: f.syllabary,
            tone: f.tone,
            notes: f.notes,
            index: f.computed_index,
            color: f.color
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
                            {allForms.length} form{allForms.length !== 1 ? 's' : ''} available
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
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 border-b border-slate-100 dark:border-slate-700 w-1/3">Form Name</th>
                                <th className="p-4 border-b border-slate-100 dark:border-slate-700">Details</th>
                                <th className="p-4 border-b border-slate-100 dark:border-slate-700 w-20 text-center">Audio</th>
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
                                        <td className="p-4 align-top pl-6">
                                            {/* SOURCE RIM */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-1.5"
                                                style={{ backgroundColor: borderStyle.borderLeftColor }}
                                            />
                                            <div className="font-bold text-slate-700 dark:text-slate-200 text-sm break-words">{form.label}</div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col gap-0.5 overflow-hidden">
                                                <div className="font-noto-cherokee text-xl text-slate-800 dark:text-slate-100 break-words">{form.syllabary}</div>
                                                <div className="font-noto-serif text-amber-700 dark:text-amber-400 font-medium break-words">{form.translit}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 italic break-words">{form.tone}</div>
                                                {form.notes && <div className="text-xs text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1 break-words">{form.notes}</div>}
                                            </div>
                                        </td>
                                        <td className="p-4 align-top">
                                            <div className="flex flex-col items-center gap-2">
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
                                                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-colors"
                                                    title="Record Audio"
                                                >
                                                    <Mic size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}

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
