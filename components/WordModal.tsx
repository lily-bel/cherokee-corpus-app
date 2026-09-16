import React, { useState, useEffect } from 'react';
import { Modal } from './UI';
import { formatToneInput, transliterateToSyllabary, TransliterationStyle } from '../utils';
import { WordFormsEditor } from './WordFormsEditor';
import { TranslateCherokee, ChevronDown, ChevronUp, Sliders, Sparkles } from './Icons';

export interface WordFormData {
    Entry: string;
    Syllabary: string;
    Definition: string;
    PoS: string;
    Entry_Tone: string;
    Notes: string;
    customDictionaryId: string;
    Other_Forms?: string;
    // Morphological / Verb Architecture
    class_name?: string;
    root_h?: string;
    root_g?: string;
    root_slug?: string;
    preDistributive?: boolean;
    preTranslocutive?: boolean;
    prePartitive?: boolean;
    pronSetType?: string;
    middleVoice?: string;
    segmented_forms?: {
        present?: string;
        present_1sg?: string;
        imperfective?: string;
        perfective?: string;
        imperative?: string;
        infinitive?: string;
    };
    [key: string]: any;
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
    settings?: any;
}

export const WordModal: React.FC<WordModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    isSentenceMode = false,
    editingId,
    customDictionaries,
    usedFormLabels = [],
    settings
}) => {
    const isLinguist = settings?.dictionaryLevel === 'linguist';
    const [formData, setFormData] = useState<WordFormData | undefined>(initialData);
    const [otherForms, setOtherForms] = useState<any[]>([]);
    const [showMorphology, setShowMorphology] = useState(isLinguist);

    // Morphology Fields
    const [className, setClassName] = useState<string>('');
    const [rootH, setRootH] = useState<string>('');
    const [rootG, setRootG] = useState<string>('');
    const [rootSlug, setRootSlug] = useState<string>('');
    const [preDistributive, setPreDistributive] = useState<boolean>(false);
    const [preTranslocutive, setPreTranslocutive] = useState<boolean>(false);
    const [prePartitive, setPrePartitive] = useState<boolean>(false);
    const [pronSetType, setPronSetType] = useState<string>('a');
    const [middleVoice, setMiddleVoice] = useState<string>('none');
    const [segmentedForms, setSegmentedForms] = useState<{
        present: string;
        present_1sg: string;
        imperfective: string;
        perfective: string;
        imperative: string;
        infinitive: string;
    }>({
        present: '',
        present_1sg: '',
        imperfective: '',
        perfective: '',
        imperative: '',
        infinitive: ''
    });

    useEffect(() => {
        setFormData(initialData);

        if (initialData) {
            setClassName(initialData.class_name || (initialData as any).className || '');
            setRootH(initialData.root_h || '');
            setRootG(initialData.root_g || '');
            setRootSlug(initialData.root_slug || (initialData as any).slug || '');
            setPreDistributive(initialData.preDistributive ?? initialData.config?.pre?.distributive ?? false);
            setPreTranslocutive(initialData.preTranslocutive ?? initialData.config?.pre?.translocutive ?? false);
            setPrePartitive(initialData.prePartitive ?? initialData.config?.pre?.partitive ?? false);
            setPronSetType(initialData.pronSetType || initialData.config?.pron?.set_type || 'a');
            setMiddleVoice(initialData.middleVoice || initialData.config?.pron?.middle_voice || 'none');
            setSegmentedForms({
                present: initialData.segmented_forms?.present || '',
                present_1sg: initialData.segmented_forms?.present_1sg || '',
                imperfective: initialData.segmented_forms?.imperfective || '',
                perfective: initialData.segmented_forms?.perfective || '',
                imperative: initialData.segmented_forms?.imperative || '',
                infinitive: initialData.segmented_forms?.infinitive || ''
            });

            if (initialData.class_name || initialData.root_h || initialData.root_g || initialData.segmented_forms?.present) {
                setShowMorphology(true);
            }
        }
        
        // Parse Other_Forms
        if (initialData?.Other_Forms) {
            const forms = initialData.Other_Forms.split('|').map((raw, idx) => {
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
            setOtherForms(forms);
        } else {
            setOtherForms([]);
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const getEffectiveStyle = (): TransliterationStyle => {
        if (settings?.transliterationStyle) return settings.transliterationStyle;
        try {
            const saved = localStorage.getItem('cherokee_app_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.transliterationStyle) return parsed.transliterationStyle;
            }
        } catch (e) {}
        return 'classic';
    };

    const handleAutoSyllabary = () => {
        const translit = formData?.Entry || '';
        if (!translit.trim()) return;
        const style = getEffectiveStyle();
        const generated = transliterateToSyllabary(translit, style);
        setFormData(prev => ({
            ...(prev || {} as WordFormData),
            Syllabary: generated,
            Entry: prev?.Entry || translit,
            Definition: prev?.Definition || '',
            PoS: prev?.PoS || '',
            Entry_Tone: prev?.Entry_Tone || '',
            Notes: prev?.Notes || '',
            customDictionaryId: prev?.customDictionaryId || ''
        }));
    };

    const handleAutoGenerateTemplates = () => {
        const root = (rootH || rootG || formData?.Entry || '').trim();
        if (!root) return;

        // Strip prefixes/hyphens to get clean root core
        const cleanRoot = root.replace(/^[a-z]+-/, '').replace(/-[a-z0-9:ʔ¹²³⁴]+$/, '');
        const pref = preTranslocutive ? 'wi-' : (preDistributive ? 'de-' : '');
        const mid = middleVoice === 'ada' ? 'ada-' : (middleVoice === 'ali' ? 'ali-' : '');

        let p3 = `${pref}g-a:${mid}${cleanRoot}-h-a`;
        let p1 = `${pref}ts-i:${mid}${cleanRoot}-h-a`;
        let impf = `${pref}g-a:${mid}${cleanRoot}-h-o:³ʔi`;
        let perf = `${pref}u:²-${mid}${cleanRoot}-h-v:³ʔi`;
        let imp = `${pref}h-i:${mid}${cleanRoot}-h-a`;
        let inf = `${pref}u:²-${mid}${cleanRoot}-hd-i`;

        if (className === 'Class 1') {
            p3 = `${pref}ga-${mid}${cleanRoot}-a`;
            p1 = `${pref}tsi-${mid}${cleanRoot}-a`;
            impf = `${pref}ga-${mid}${cleanRoot}-o:³ʔi`;
            perf = `${pref}u-${mid}${cleanRoot}-v:³ʔi`;
            imp = `${pref}hi-${mid}${cleanRoot}-a`;
            inf = `${pref}u-${mid}${cleanRoot}-di`;
        }

        setSegmentedForms({
            present: p3,
            present_1sg: p1,
            imperfective: impf,
            perfective: perf,
            imperative: imp,
            infinitive: inf
        });

        // Also auto-fill Entry if empty
        if (!formData?.Entry) {
            const surfacePres = p3.replace(/[-:]/g, '');
            const style = getEffectiveStyle();
            setFormData(prev => ({
                ...(prev || {} as WordFormData),
                Entry: surfacePres,
                Syllabary: transliterateToSyllabary(surfacePres, style),
                PoS: 'v'
            }));
        }
    };

    const handleSave = () => {
        // Serialize Other_Forms: Label:Translit^Syllabary^Tone^Notes
        const serializedForms = otherForms
            .filter(f => f.label.trim() && (f.syllabary.trim() || f.translit.trim()))
            .map(f => `${f.label.trim()}:${f.translit.trim()}^${f.syllabary.trim()}^${f.tone.trim()}^${f.notes.trim()}`)
            .join('|');

        if (!formData) return;

        const hasMorph = !!(className.trim() || rootH.trim() || rootG.trim() || rootSlug.trim() || segmentedForms.present.trim());

        onSave({
            ...formData,
            Entry: formData.Entry || '',
            Syllabary: formData.Syllabary || '',
            Definition: formData.Definition || '',
            PoS: formData.PoS || (hasMorph ? 'v' : ''),
            Entry_Tone: formData.Entry_Tone || '',
            Notes: formData.Notes || '',
            customDictionaryId: formData.customDictionaryId || '',
            Other_Forms: serializedForms,
            ...(hasMorph ? {
                class_name: className.trim() || 'Class 1',
                root_h: formatToneInput(rootH.trim()),
                root_g: formatToneInput(rootG.trim()),
                root_slug: rootSlug.trim() || formatToneInput(rootH.trim()) || formData.Entry,
                preDistributive,
                preTranslocutive,
                prePartitive,
                pronSetType,
                middleVoice,
                config: {
                    pre: {
                        distributive: preDistributive,
                        translocutive: preTranslocutive,
                        translocutiveImpOnly: false,
                        partitive: prePartitive
                    },
                    pron: {
                        set_type: pronSetType,
                        stem_type: '',
                        use_ka_variant: false,
                        plural_pronouns: false,
                        middle_voice: middleVoice,
                        use_3rd_person_object: false
                    }
                },
                segmented_forms: {
                    present: formatToneInput(segmentedForms.present.trim()),
                    present_1sg: formatToneInput(segmentedForms.present_1sg.trim()),
                    imperfective: formatToneInput(segmentedForms.imperfective.trim()),
                    perfective: formatToneInput(segmentedForms.perfective.trim()),
                    imperative: formatToneInput(segmentedForms.imperative.trim()),
                    infinitive: formatToneInput(segmentedForms.infinitive.trim())
                }
            } : {})
        });
    };

    return (
        <Modal title={editingId ? "Edit Word" : (isSentenceMode ? "New Sentence" : "New Word")} onClose={onClose}>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Transliteration (Cherokee)</label>
                    <input
                        type="text"
                        value={formData?.Entry || ''}
                        onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Entry: formatToneInput(e.target.value), Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                        placeholder="e.g. tsalagi"
                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Syllabary (Cherokee)</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={formData?.Syllabary || ''}
                            onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Syllabary: e.target.value, Entry: prev?.Entry || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                            placeholder="e.g. ᏣᎳᎩ"
                            className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg pl-3 pr-10 py-2 font-noto-cherokee text-lg outline-none focus:border-amber-500 dark:text-white"
                        />
                        <button
                            type="button"
                            onClick={handleAutoSyllabary}
                            title="Auto-generate Syllabary from Transliteration"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-100/60 dark:hover:bg-amber-900/40 rounded-md transition-colors flex items-center justify-center"
                        >
                            <TranslateCherokee size={18} />
                        </button>
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">{isSentenceMode ? "English Translation" : "Definition"}</label>
                    <input
                        type="text"
                        value={formData?.Definition || ''}
                        onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Definition: e.target.value, Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                        placeholder={isSentenceMode ? "e.g. He is speaking Cherokee." : "e.g. Cherokee person, language"}
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
                                    value={formData?.PoS || ''}
                                    onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), PoS: e.target.value, Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                                    placeholder="n, v, adj..."
                                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Tone (Optional)</label>
                                <input
                                    type="text"
                                    value={formData?.Entry_Tone || ''}
                                    onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Entry_Tone: formatToneInput(e.target.value), Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                                    placeholder="e.g. tsa²la⁴gi¹"
                                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-serif dark:text-white"
                                />
                            </div>
                        </div>

                        {/* MORPHOLOGICAL ARCHITECTURE & VERB ROOTS PANEL */}
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/40">
                            <button
                                type="button"
                                onClick={() => setShowMorphology(!showMorphology)}
                                className="w-full flex items-center justify-between p-3 bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-750 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Sliders size={16} className="text-amber-600 dark:text-amber-400" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                        Morphological Architecture / Verb Roots
                                    </span>
                                    {isLinguist && (
                                        <span className="text-[10px] uppercase font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded">
                                            Linguist
                                        </span>
                                    )}
                                </div>
                                <span className="text-slate-400">
                                    {showMorphology ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </span>
                            </button>

                            {showMorphology && (
                                <div className="p-4 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                Aspect Class
                                            </label>
                                            <select
                                                value={className}
                                                onChange={e => setClassName(e.target.value)}
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm outline-none focus:border-amber-500 dark:text-white"
                                            >
                                                <option value="">None / Not a verb</option>
                                                <option value="Class 1">Class 1 (Consonant stem)</option>
                                                <option value="Class 2">Class 2 (Vowel stem -a)</option>
                                                <option value="Class 3">Class 3 (Vowel stem -i)</option>
                                                <option value="Class 4">Class 4 (Vowel stem -o/u)</option>
                                                <option value="Class 5">Class 5 (Irregular)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                Root Identifier / Slug
                                            </label>
                                            <input
                                                type="text"
                                                value={rootSlug}
                                                onChange={e => setRootSlug(e.target.value)}
                                                placeholder="e.g. hne"
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm outline-none focus:border-amber-500 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                H-Grade Root
                                            </label>
                                            <input
                                                type="text"
                                                value={rootH}
                                                onChange={e => {
                                                    const formatted = formatToneInput(e.target.value);
                                                    setRootH(formatted);
                                                    if (!rootSlug) setRootSlug(formatted.replace(/[¹²³⁴1234?]/g, ''));
                                                }}
                                                placeholder="e.g. hne²"
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-serif outline-none focus:border-amber-500 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                Glottal-Grade Root
                                            </label>
                                            <input
                                                type="text"
                                                value={rootG}
                                                onChange={e => setRootG(formatToneInput(e.target.value))}
                                                placeholder="e.g. ʔne²"
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-serif outline-none focus:border-amber-500 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                Pronoun Set Type
                                            </label>
                                            <select
                                                value={pronSetType}
                                                onChange={e => setPronSetType(e.target.value)}
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm outline-none focus:border-amber-500 dark:text-white"
                                            >
                                                <option value="a">Set A (Default)</option>
                                                <option value="b">Set B (Experiencer / Involuntary)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                                                Middle Voice Prefix
                                            </label>
                                            <select
                                                value={middleVoice}
                                                onChange={e => setMiddleVoice(e.target.value)}
                                                className="w-full p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm outline-none focus:border-amber-500 dark:text-white"
                                            >
                                                <option value="none">None</option>
                                                <option value="ada">ada- (Reflexive / Middle)</option>
                                                <option value="ali">ali- (Passive / Intransitive)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Prepronominal Checkboxes */}
                                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
                                            Prepronominal Prefixes
                                        </span>
                                        <div className="flex flex-wrap gap-4 text-xs">
                                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={preTranslocutive}
                                                    onChange={e => setPreTranslocutive(e.target.checked)}
                                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>Translocutive (wi-)</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={preDistributive}
                                                    onChange={e => setPreDistributive(e.target.checked)}
                                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>Distributive (de-/te-)</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={prePartitive}
                                                    onChange={e => setPrePartitive(e.target.checked)}
                                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span>Partitive (ni-)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Segmented Reference Forms */}
                                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                CED Segmented Reference Forms
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleAutoGenerateTemplates}
                                                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 flex items-center gap-1"
                                            >
                                                <Sparkles size={13} /> Auto-Fill Forms
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">3rd Present (e.g. ga-ne²-h-a)</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.present}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, present: formatToneInput(e.target.value) }))}
                                                    placeholder="g-a:ne²-h-a"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">1st Present (e.g. tsi-ne²-h-a)</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.present_1sg}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, present_1sg: formatToneInput(e.target.value) }))}
                                                    placeholder="ts-i:ne²-h-a"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">Imperfective / Habitual</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.imperfective}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, imperfective: formatToneInput(e.target.value) }))}
                                                    placeholder="g-a:ne²-h-o:³ʔi"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">Perfective / Past</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.perfective}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, perfective: formatToneInput(e.target.value) }))}
                                                    placeholder="u:²-wne²-h-v:³ʔi"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">Imperative</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.imperative}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, imperative: formatToneInput(e.target.value) }))}
                                                    placeholder="h-i:ne²-h-a"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 block mb-0.5">Infinitive / Deverbal</label>
                                                <input
                                                    type="text"
                                                    value={segmentedForms.infinitive}
                                                    onChange={e => setSegmentedForms(prev => ({ ...prev, infinitive: formatToneInput(e.target.value) }))}
                                                    placeholder="u:²-wne²-hd-i"
                                                    className="w-full p-1.5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-serif outline-none focus:border-amber-500 dark:text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* OTHER FORMS SECTION */}
                        <WordFormsEditor
                            forms={otherForms}
                            setForms={setOtherForms}
                            usedFormLabels={usedFormLabels}
                            transliterationStyle={settings?.transliterationStyle}
                        />

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                            <textarea
                                value={formData?.Notes || ''}
                                onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Notes: e.target.value, Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', customDictionaryId: prev?.customDictionaryId || '' }))}
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
                        value={formData?.customDictionaryId || ''}
                        onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), customDictionaryId: e.target.value, Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '' }))}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                    >
                        <option value="" disabled>Select a dictionary...</option>
                        {Object.values(customDictionaries).map((nb: any) => (
                            <option key={nb.id} value={nb.id}>{nb.name}</option>
                        ))}
                    </select>
                </div>
            </div>
            <button onClick={handleSave} className="w-full mt-6 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg shadow-md transition-all active:scale-[0.99]">
                Save {isSentenceMode ? "Sentence" : "Word"}
            </button>
        </Modal>
    );
};
