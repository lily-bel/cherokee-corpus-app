import React, { useState } from 'react';
import { Plus, Trash2 } from './Icons';
import { formatToneInput } from '../utils';

interface FormRow {
    id: string;
    label: string;
    syllabary: string;
    translit: string;
    tone: string;
    notes: string;
}

interface WordFormsEditorProps {
    forms: FormRow[];
    setForms: React.Dispatch<React.SetStateAction<FormRow[]>>;
    usedFormLabels: string[];
}

export const WordFormsEditor: React.FC<WordFormsEditorProps> = ({ forms, setForms, usedFormLabels }) => {
    const [showLabelSuggestions, setShowLabelSuggestions] = useState<string | null>(null);

    const addFormRow = () => {
        setForms(prev => [
            ...prev,
            { id: `form_${Date.now()}`, label: '', syllabary: '', translit: '', tone: '', notes: '' }
        ]);
    };

    const removeFormRow = (id: string) => {
        setForms(prev => prev.filter(f => f.id !== id));
    };

    const updateFormRow = (id: string, field: keyof FormRow, text: string) => {
        setForms(prev => prev.map(f => f.id === id ? { ...f, [field]: text } : f));
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Word Forms</label>
                <button onClick={addFormRow} className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 flex items-center gap-1">
                    <Plus size={14} /> Add Form
                </button>
            </div>

            <div className="space-y-6">
                {forms.map((row) => (
                    <div key={row.id} className="flex gap-2 items-start relative bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex-1 flex flex-col gap-3">
                             {/* Label */}
                            <div className="relative">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Form Name / Label</label>
                                <input
                                    type="text"
                                    value={row.label}
                                    onChange={e => {
                                        updateFormRow(row.id, 'label', e.target.value);
                                        setShowLabelSuggestions(row.id);
                                    }}
                                    onFocus={() => setShowLabelSuggestions(row.id)}
                                    onBlur={() => setTimeout(() => setShowLabelSuggestions(null), 200)}
                                    placeholder="e.g. Plural"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                                />
                                {showLabelSuggestions === row.id && (
                                    <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                                        {usedFormLabels
                                            .filter(l => l.toLowerCase().includes(row.label.toLowerCase()))
                                            .map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => {
                                                        updateFormRow(row.id, 'label', l);
                                                        setShowLabelSuggestions(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                                                >
                                                    {l}
                                                </button>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Syllabary */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Syllabary</label>
                                <input
                                    type="text"
                                    value={row.syllabary}
                                    onChange={e => updateFormRow(row.id, 'syllabary', e.target.value)}
                                    placeholder="ᏣᎳᎩ"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-lg outline-none focus:border-amber-500 dark:text-white font-noto-cherokee"
                                />
                            </div>

                            {/* Transliteration */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Transliteration</label>
                                <input
                                    type="text"
                                    value={row.translit}
                                    onChange={e => updateFormRow(row.id, 'translit', e.target.value)}
                                    placeholder="Tsalagi"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white font-noto-serif"
                                />
                            </div>

                            {/* Tone */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tone</label>
                                <input
                                    type="text"
                                    value={row.tone}
                                    onChange={e => updateFormRow(row.id, 'tone', formatToneInput(e.target.value))}
                                    placeholder="1-4"
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Notes (Optional)</label>
                                <input
                                    type="text"
                                    value={row.notes}
                                    onChange={e => updateFormRow(row.id, 'notes', e.target.value)}
                                    placeholder="Add info..."
                                    className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white italic"
                                />
                            </div>
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={() => removeFormRow(row.id)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors mt-6"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}
                {forms.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">No extra forms added.</p>
                )}
            </div>
        </div>
    );
};