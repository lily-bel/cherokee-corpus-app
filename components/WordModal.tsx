import React, { useState, useEffect } from 'react';
import { Modal } from './UI';
import { formatToneInput } from '../utils';
import { WordFormsEditor } from './WordFormsEditor';

interface WordFormData {
    Entry: string;
    Syllabary: string;
    Definition: string;
    PoS: string;
    Entry_Tone: string;
    Notes: string;
    customDictionaryId: string;
    Other_Forms?: string;
}

interface WordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: WordFormData) => void;
    initialData?: WordFormData;
    isSentenceMode?: boolean;
    editingId?: string | null;
    customDictionaries: Record<string, any>;
    usedFormLabels?: string[];
}

export const WordModal: React.FC<WordModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    isSentenceMode = false,
    editingId,
    customDictionaries,
    usedFormLabels = []
}) => {
    const [formData, setFormData] = useState(initialData);
    const [otherForms, setOtherForms] = useState<any[]>([]);

    useEffect(() => {
        setFormData(initialData);
        
        // Parse Other_Forms
        if (initialData.Other_Forms) {
            const forms = initialData.Other_Forms.split('|').map((raw, idx) => {
                const parts = raw.split(':');
                const label = parts[0] || '';
                const values = (parts[1] || '').split('^');
                // values[0] = Translit, values[1] = Syllabary, values[2] = Tone, values[3] = Notes
                return {
                    id: `form_${Date.now()}_${idx}`,
                    label,
                    translit: values[0] || '',
                    syllabary: values[1] || '',
                    tone: values[2] || '',
                    notes: values[3] || ''
                };
            });
            setOtherForms(forms);
        } else {
            setOtherForms([]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Serialize Other_Forms: Label:Translit^Syllabary^Tone^Notes
        const serializedForms = otherForms
            .filter(f => f.label.trim() && (f.syllabary.trim() || f.translit.trim()))
            .map(f => `${f.label.trim()}:${f.translit.trim()}^${f.syllabary.trim()}^${f.tone.trim()}^${f.notes.trim()}`)
            .join('|');

        onSave({
            ...formData,
            Other_Forms: serializedForms
        });
    };

    return (
        <Modal title={editingId ? "Edit Word" : (isSentenceMode ? "New Sentence" : "New Word")} onClose={onClose}>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Syllabary (Cherokee)</label>
                    <input
                        type="text"
                        value={formData.Syllabary}
                        onChange={e => setFormData({ ...formData, Syllabary: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-cherokee text-lg outline-none focus:border-amber-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Transliteration (Cherokee)</label>
                    <input
                        type="text"
                        value={formData.Entry}
                        onChange={e => setFormData({ ...formData, Entry: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{isSentenceMode ? "English Translation" : "Definition"}</label>
                    <input
                        type="text"
                        value={formData.Definition}
                        onChange={e => setFormData({ ...formData, Definition: e.target.value })}
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white"
                    />
                </div>

                {!isSentenceMode && (
                    <>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">PoS (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.PoS}
                                    onChange={e => setFormData({ ...formData, PoS: e.target.value })}
                                    placeholder="n, v, adj..."
                                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Tone (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.Entry_Tone}
                                    onChange={e => setFormData({ ...formData, Entry_Tone: formatToneInput(e.target.value) })}
                                    placeholder="Type 1-4 for tones"
                                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-sans dark:text-white"
                                />
                            </div>
                        </div>

                        {/* OTHER FORMS SECTION */}
                        <WordFormsEditor
                            forms={otherForms}
                            setForms={setOtherForms}
                            usedFormLabels={usedFormLabels}
                        />

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                            <textarea
                                value={formData.Notes}
                                onChange={e => setFormData({ ...formData, Notes: e.target.value })}
                                rows={3}
                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 resize-none dark:text-white"
                                placeholder="Add conjugations, examples, or extra info here..."
                            ></textarea>
                        </div>
                    </>
                )}

                            <div>
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Custom Dictionary</label>
                                <select
                                    value={formData.customDictionaryId}
                                    onChange={e => setFormData({ ...formData, customDictionaryId: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                                >
                                    <option value="" disabled>Select a dictionary...</option>
                                    {Object.values(customDictionaries).map((nb: any) => (
                                        <option key={nb.id} value={nb.id}>{nb.name}</option>
                                    ))}
                                </select>
                            </div>
            </div>
            <button onClick={handleSave} className="w-full mt-6 bg-amber-600 text-white font-bold py-3 rounded-lg">
                Save {isSentenceMode ? "Sentence" : "Word"}
            </button>
        </Modal>
    );
};
