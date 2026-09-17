import React, { useState } from 'react';
import { Plus, Trash2, TranslateCherokee, Sliders } from './Icons';
import { formatToneInput, transliterateToSyllabary, TransliterationStyle, getFriendlyLabel } from '../utils';

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
    transliterationStyle?: TransliterationStyle;
}

const SUBJECT_MAP: Record<string, string> = {
    '1s': '1st person singular',
    '2s': '2nd person singular',
    '3s': '3rd person singular',
    '1d-in': '1st person dual inclusive',
    '1d-ex': '1st person dual exclusive',
    '2d': '2nd person dual',
    '1p-in': '1st person plural inclusive',
    '1p-ex': '1st person plural exclusive',
    '2p': '2nd person plural',
    '3p': '3rd person plural',
};

const OBJECT_MAP: Record<string, string> = {
    '1s': '1st person singular',
    '2s': '2nd person singular',
    '1d-in': '1st person dual inclusive',
    '1d-ex': '1st person dual exclusive',
    '2d': '2nd person dual',
    '1p-in': '1st person plural inclusive',
    '1p-ex': '1st person plural exclusive',
    '2p': '2nd person plural',
};

function parseFormLabelToParts(label: string): { subject: string; tense: string; object: string } {
    if (!label) return { subject: '1s', tense: 'present', object: 'none' };
    const lower = label.toLowerCase().trim();

    // Check nouns
    if (lower === 'singular' || lower === 'noun:singular' || lower === 'noun|singular|' || lower === 'noun|singular') {
        return { subject: 'noun:singular', tense: '', object: 'none' };
    }
    if (lower === 'plural' || lower === 'noun:plural' || lower === 'noun|plural|' || lower === 'noun|plural') {
        return { subject: 'noun:plural', tense: '', object: 'none' };
    }
    if (lower.includes('singular') && lower.includes('animate')) {
        return { subject: 'noun:singular_anim', tense: '', object: 'none' };
    }
    if (lower.includes('plural') && lower.includes('animate')) {
        return { subject: 'noun:plural_anim', tense: '', object: 'none' };
    }
    if (lower.includes('plural') && lower.includes('inanimate')) {
        return { subject: 'noun:plural_inanim', tense: '', object: 'none' };
    }

    // Check if it's already a pipe shorthand: e.g. "1s|3a|present"
    if (label.includes('|')) {
        const parts = label.split('|');
        if (parts[0] === 'noun') {
            const n = (parts[1] || '').toLowerCase();
            if (n.includes('plural') && n.includes('animate')) return { subject: 'noun:plural_anim', tense: '', object: 'none' };
            if (n.includes('plural') && n.includes('inanimate')) return { subject: 'noun:plural_inanim', tense: '', object: 'none' };
            if (n.includes('singular') && n.includes('animate')) return { subject: 'noun:singular_anim', tense: '', object: 'none' };
            if (n.includes('plural')) return { subject: 'noun:plural', tense: '', object: 'none' };
            return { subject: 'noun:singular', tense: '', object: 'none' };
        }
        let obj = parts[1] || 'none';
        if (obj === '3s') obj = '3s_inanim';
        if (obj === '3p') obj = '3p_inanim';
        return {
            subject: parts[0] || '1s',
            object: obj,
            tense: parts[2] || 'present'
        };
    }

    // Parse human readable verb string
    let subject = '1s';
    if (lower.includes('1st person dual inclusive') || lower.includes('1d-in') || lower.includes('1d in')) subject = '1d-in';
    else if (lower.includes('1st person dual exclusive') || lower.includes('1d-ex') || lower.includes('1d ex')) subject = '1d-ex';
    else if (lower.includes('1st person plural inclusive') || lower.includes('1p-in') || lower.includes('1p in')) subject = '1p-in';
    else if (lower.includes('1st person plural exclusive') || lower.includes('1p-ex') || lower.includes('1p ex')) subject = '1p-ex';
    else if (lower.includes('1st person plural') || lower.includes('1p')) subject = '1p-ex';
    else if (lower.includes('1st person singular') || lower.includes('1st present') || lower.includes('1sg') || lower.startsWith('1st')) subject = '1s';
    else if (lower.includes('2nd person dual') || lower.includes('2d')) subject = '2d';
    else if (lower.includes('2nd person plural') || lower.includes('2p')) subject = '2p';
    else if (lower.includes('2nd person singular') || lower.includes('2nd imperative') || lower.includes('2sg') || lower.startsWith('2nd')) subject = '2s';
    else if (lower.includes('3rd person plural') || lower.includes('3p')) subject = '3p';
    else if (lower.includes('3rd person singular') || lower.includes('3sg') || lower.includes('3s') || lower.startsWith('3rd')) subject = '3s';

    let tense = 'present';
    if (lower.includes('completive past') || lower.includes('remote past') || lower.includes('perfective')) tense = 'completive past';
    else if (lower.includes('habitual past') || lower.includes('habitual')) tense = 'habitual';
    else if (lower.includes('immediate past')) tense = 'immediate past';
    else if (lower.includes('future imperative')) tense = 'future imperative';
    else if (lower.includes('future')) tense = 'future';
    else if (lower.includes('imperative')) tense = 'imperative';
    else if (lower.includes('infinitive') || lower.includes('deverbal')) tense = 'infinitive';
    else if (lower.includes('present')) tense = 'present';

    let object = 'none';
    if (lower.includes('animate plural object') || lower.includes('(animate plural)')) object = '3pa';
    else if (lower.includes('inanimate plural object') || lower.includes('(inanimate plural)')) object = '3p_inanim';
    else if (lower.includes('animate object') || lower.includes('(animate)')) object = '3a';
    else if (lower.includes('inanimate object') || lower.includes('(inanimate)')) object = '3s_inanim';
    else if (lower.includes('1st person singular object') || lower.includes('(1st person singular object)')) object = '1s';
    else if (lower.includes('2nd person singular object') || lower.includes('(2nd person singular object)')) object = '2s';
    else if (lower.includes('1st person dual inclusive object')) object = '1d-in';
    else if (lower.includes('1st person dual exclusive object')) object = '1d-ex';
    else if (lower.includes('2nd person dual object')) object = '2d';
    else if (lower.includes('1st person plural inclusive object')) object = '1p-in';
    else if (lower.includes('1st person plural exclusive object')) object = '1p-ex';
    else if (lower.includes('2nd person plural object')) object = '2p';

    return { subject, tense, object };
}

function buildLabelFromParts(subject: string, tense: string, object: string): string {
    if (subject.startsWith('noun:')) {
        if (subject === 'noun:singular') return 'Singular';
        if (subject === 'noun:plural') return 'Plural';
        if (subject === 'noun:singular_anim') return 'Singular (animate)';
        if (subject === 'noun:plural_anim') return 'Plural (animate)';
        if (subject === 'noun:plural_inanim') return 'Plural (inanimate)';
        return 'Noun';
    }

    const subjName = SUBJECT_MAP[subject] || subject;
    const tenseName = tense || 'present';

    let objSuffix = '';
    if (object === '3a') {
        objSuffix = ' (animate object)';
    } else if (object === '3pa') {
        objSuffix = ' (animate plural object)';
    } else if (object === '3s_inanim') {
        objSuffix = ' (inanimate object)';
    } else if (object === '3p_inanim') {
        objSuffix = ' (inanimate plural object)';
    } else if (object && object !== 'none' && object !== '3s') {
        const oName = OBJECT_MAP[object] || object;
        objSuffix = ` (${oName} object)`;
    }

    return `${subjName} ${tenseName}${objSuffix}`.trim();
}

export const WordFormsEditor: React.FC<WordFormsEditorProps> = ({ forms, setForms, usedFormLabels, transliterationStyle }) => {
    const [showLabelSuggestions, setShowLabelSuggestions] = useState<string | null>(null);
    const [expandedDropdowns, setExpandedDropdowns] = useState<Record<string, boolean>>({});

    const getEffectiveStyle = (): TransliterationStyle => {
        if (transliterationStyle) return transliterationStyle;
        try {
            const saved = localStorage.getItem('cherokee_app_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.transliterationStyle) return parsed.transliterationStyle;
            }
        } catch (e) {}
        return 'classic';
    };

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

    const handleAutoSyllabaryForRow = (id: string) => {
        const row = forms.find(f => f.id === id);
        if (!row || !row.translit.trim()) return;
        const style = getEffectiveStyle();
        const generated = transliterateToSyllabary(row.translit, style);
        updateFormRow(id, 'syllabary', generated);
    };

    const getFilteredSuggestions = (rawInput: string) => {
        const q = (rawInput || '').trim().toLowerCase();
        if (!q) return usedFormLabels.slice(0, 50);

        const friendlyQ = getFriendlyLabel(rawInput).toLowerCase();
        return usedFormLabels
            .filter(l => {
                const lLow = l.toLowerCase();
                return lLow.includes(q) || (friendlyQ && friendlyQ !== q && lLow.includes(friendlyQ));
            })
            .slice(0, 50);
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
                {forms.map((row) => {
                    const isDropdownOpen = !!expandedDropdowns[row.id];
                    const parts = parseFormLabelToParts(row.label);

                    return (
                        <div key={row.id} className="flex gap-2 items-start relative bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex-1 flex flex-col gap-3">
                                {/* Label Header with Dropdown Toggle */}
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Form Name / Label</label>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedDropdowns(prev => ({ ...prev, [row.id]: !prev[row.id] }))}
                                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
                                            title="Toggle Person / Tense / Object dropdowns"
                                        >
                                            <Sliders size={12} />
                                            <span>{isDropdownOpen ? 'Hide Dropdowns' : 'Person / Tense / Object'}</span>
                                        </button>
                                    </div>

                                    {/* Dropdown Builder Section */}
                                    {isDropdownOpen && (
                                        <div className="mb-2 p-3 bg-amber-50/50 dark:bg-slate-800/80 rounded-xl border border-amber-200/60 dark:border-slate-700 space-y-2.5">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                                {/* Person / Subject */}
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                        Person / Subject
                                                    </label>
                                                    <select
                                                        value={parts.subject}
                                                        onChange={e => {
                                                            const newSubj = e.target.value;
                                                            const isNoun = newSubj.startsWith('noun:');
                                                            const newTense = isNoun ? '' : (parts.tense || 'present');
                                                            const newObj = isNoun ? 'none' : (parts.object || 'none');
                                                            const newLabel = buildLabelFromParts(newSubj, newTense, newObj);
                                                            updateFormRow(row.id, 'label', newLabel);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500"
                                                    >
                                                        <optgroup label="Verb Persons (Subjects)">
                                                            <option value="1s">1st Person Singular (I)</option>
                                                            <option value="2s">2nd Person Singular (You)</option>
                                                            <option value="3s">3rd Person Singular (He/She/It)</option>
                                                            <option value="1d-in">1st Dual Inclusive (You & I)</option>
                                                            <option value="1d-ex">1st Dual Exclusive (He/She & I)</option>
                                                            <option value="2d">2nd Dual (You two)</option>
                                                            <option value="1p-in">1st Plural Inclusive (All of us)</option>
                                                            <option value="1p-ex">1st Plural Exclusive (Us not you)</option>
                                                            <option value="2p">2nd Plural (You all)</option>
                                                            <option value="3p">3rd Plural (They)</option>
                                                        </optgroup>
                                                        <optgroup label="Noun Forms">
                                                            <option value="noun:singular">Singular</option>
                                                            <option value="noun:plural">Plural</option>
                                                            <option value="noun:singular_anim">Singular (animate)</option>
                                                            <option value="noun:plural_anim">Plural (animate)</option>
                                                            <option value="noun:plural_inanim">Plural (inanimate)</option>
                                                        </optgroup>
                                                    </select>
                                                </div>

                                                {/* Tense / Aspect */}
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                        Tense / Aspect
                                                    </label>
                                                    <select
                                                        disabled={parts.subject.startsWith('noun:')}
                                                        value={parts.subject.startsWith('noun:') ? '' : parts.tense}
                                                        onChange={e => {
                                                            const newTense = e.target.value;
                                                            const newLabel = buildLabelFromParts(parts.subject, newTense, parts.object);
                                                            updateFormRow(row.id, 'label', newLabel);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                                                    >
                                                        <option value="present">Present / Present Habitual</option>
                                                        <option value="completive past">Completive Past (Perfective)</option>
                                                        <option value="habitual">Habitual Past</option>
                                                        <option value="immediate past">Immediate Past</option>
                                                        <option value="imperative">Imperative</option>
                                                        <option value="future">Future</option>
                                                        <option value="future imperative">Future Imperative</option>
                                                        <option value="infinitive">Infinitive / Deverbal</option>
                                                    </select>
                                                </div>

                                                {/* Object */}
                                                <div>
                                                    <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                        Direct Object (Optional)
                                                    </label>
                                                    <select
                                                        disabled={parts.subject.startsWith('noun:')}
                                                        value={parts.subject.startsWith('noun:') ? 'none' : parts.object}
                                                        onChange={e => {
                                                            const newObj = e.target.value;
                                                            const newLabel = buildLabelFromParts(parts.subject, parts.tense, newObj);
                                                            updateFormRow(row.id, 'label', newLabel);
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-40"
                                                    >
                                                        <option value="none">None (No direct object)</option>
                                                        <option value="3s_inanim">Inanimate Object</option>
                                                        <option value="3a">Animate Object</option>
                                                        <option value="3pa">Animate Plural Object</option>
                                                        <option value="3p_inanim">Inanimate Plural Object</option>
                                                        <optgroup label="Person-to-Person Object">
                                                            <option value="1s">1st Person Singular Object (Me)</option>
                                                            <option value="2s">2nd Person Singular Object (You)</option>
                                                            <option value="1d-in">1st Dual Inclusive Object</option>
                                                            <option value="1d-ex">1st Dual Exclusive Object</option>
                                                            <option value="2d">2nd Dual Object</option>
                                                            <option value="1p-in">1st Plural Inclusive Object</option>
                                                            <option value="1p-ex">1st Plural Exclusive Object</option>
                                                            <option value="2p">2nd Plural Object</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Text input with autocomplete suggestions */}
                                    <input
                                        type="text"
                                        value={row.label}
                                        onChange={e => {
                                            updateFormRow(row.id, 'label', e.target.value);
                                            setShowLabelSuggestions(row.id);
                                        }}
                                        onFocus={() => setShowLabelSuggestions(row.id)}
                                        onBlur={() => {
                                            const friendly = getFriendlyLabel(row.label);
                                            if (friendly && friendly !== row.label && !friendly.includes('|')) {
                                                updateFormRow(row.id, 'label', friendly);
                                            }
                                            setTimeout(() => setShowLabelSuggestions(null), 200);
                                        }}
                                        placeholder="e.g. 1st person singular present (animate object)"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                                    />
                                    {showLabelSuggestions === row.id && (
                                        <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-sm">
                                                Suggested Form Names
                                            </div>
                                            {getFilteredSuggestions(row.label).map(l => (
                                                <button
                                                    key={l}
                                                    type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        updateFormRow(row.id, 'label', l);
                                                        setShowLabelSuggestions(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between"
                                                >
                                                    <span>{l}</span>
                                                </button>
                                            ))}
                                            {getFilteredSuggestions(row.label).length === 0 && (
                                                <div className="px-3 py-2 text-xs text-slate-400 italic">No matching form names</div>
                                            )}
                                        </div>
                                    )}
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

                                {/* Syllabary */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 block mb-1">Syllabary</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={row.syllabary}
                                            onChange={e => updateFormRow(row.id, 'syllabary', e.target.value)}
                                            placeholder="ᏣᎳᎩ"
                                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg pl-3 pr-10 py-2 text-lg outline-none focus:border-amber-500 dark:text-white font-noto-cherokee"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAutoSyllabaryForRow(row.id)}
                                            title="Auto-generate Syllabary from Transliteration"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-md transition-colors flex items-center justify-center"
                                        >
                                            <TranslateCherokee size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Tone */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tone</label>
                                    <input
                                        type="text"
                                        value={row.tone}
                                        onChange={e => updateFormRow(row.id, 'tone', formatToneInput(e.target.value))}
                                        placeholder="e.g. tsa2la2gi"
                                        className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white font-serif"
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
                    );
                })}
                {forms.length === 0 && (
                    <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">No extra forms added.</p>
                )}
            </div>
        </div>
    );
};