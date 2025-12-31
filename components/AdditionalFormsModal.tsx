import React, { useState, useEffect } from 'react';
import { Modal } from './UI';
import { WordFormsEditor } from './WordFormsEditor';

interface AdditionalFormsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (formsString: string) => void;
    initialForms: string;
    usedFormLabels: string[];
}

export const AdditionalFormsModal: React.FC<AdditionalFormsModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialForms,
    usedFormLabels
}) => {
    const [forms, setForms] = useState<any[]>([]);

    useEffect(() => {
        if (initialForms) {
            const parsed = initialForms.split('|').map((raw, idx) => {
                const parts = raw.split(':');
                const label = parts[0] || '';
                const values = (parts[1] || '').split('^');
                return {
                    id: `form_${Date.now()}_${idx}`,
                    label,
                    translit: values[0] || '',
                    syllabary: values[1] || '',
                    tone: values[2] || '',
                    notes: values[3] || ''
                };
            });
            setForms(parsed);
        } else {
            setForms([]);
        }
    }, [initialForms, isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        const serialized = forms
            .filter(f => f.label.trim() && (f.syllabary.trim() || f.translit.trim()))
            .map(f => `${f.label.trim()}:${f.translit.trim()}^${f.syllabary.trim()}^${f.tone.trim()}^${f.notes.trim()}`)
            .join('|');
        onSave(serialized);
    };

    return (
        <Modal title="Manage Custom Forms" onClose={onClose}>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Add extra word forms to this entry. These are saved locally.
            </p>
            
            <WordFormsEditor
                forms={forms}
                setForms={setForms}
                usedFormLabels={usedFormLabels}
            />

            <button onClick={handleSave} className="w-full mt-6 bg-amber-600 text-white font-bold py-3 rounded-lg">
                Save Forms
            </button>
        </Modal>
    );
};
