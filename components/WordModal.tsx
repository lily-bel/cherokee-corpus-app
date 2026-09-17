import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from './UI';
import { 
    formatToneInput, 
    transliterateToSyllabary, 
    TransliterationStyle, 
    getAllPrefixes, 
    getPrefixData, 
    getAllPostRootMorphemes, 
    getPostRootMorpheme, 
    formatCommunityRoot, 
    generateRootSlug, 
    getCustomMorphology, 
    saveCustomMorphology, 
    VerbMorphologyTemplate,
    PrefixData,
    PostRootMorphemeData,
    getFriendlyLabel
} from '../utils';
import { WordFormsEditor } from './WordFormsEditor';
import { TranslateCherokee, Sliders, ChevronDown, ChevronUp, Check, Plus, Trash2, AlertCircle } from './Icons';
import { useCorpus } from './CorpusContext';
import { ASPECT_CLASSES, getClassMascot, getParentClassName } from '../classMascots';

export interface WordFormData {
    Entry: string;
    Syllabary: string;
    Definition: string;
    PoS: string;
    Entry_Tone: string;
    Notes: string;
    customDictionaryId: string;
    Other_Forms?: string;
    // Class + Root / Verb Morphology
    root_slug?: string;
    root_h?: string;
    root_g?: string;
    class_name?: string;
    class_mascot?: string;
    post_root_morpheme?: string | null;
    post_root_morphemes?: string[];
    config?: {
        pre?: {
            prefixes?: string[];
            distributive?: boolean;
            translocutive?: boolean;
            translocutiveImpOnly?: boolean;
            partitive?: boolean;
        };
        pron?: {
            set_type?: string;
            stem_type?: string;
            use_ka_variant?: boolean;
            plural_pronouns?: boolean;
            middle_voice?: string;
            use_3rd_person_object?: boolean;
        };
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

interface MorphemeRow {
    id: string;
    value: string;
}

interface NewMorphemeDef {
    type: 'prefix' | 'post_root';
    key: string;
    name: string;
    form: string;
    definition: string;
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
    const { roots } = useCorpus();

    const [formData, setFormData] = useState<WordFormData | undefined>(initialData);
    const [otherForms, setOtherForms] = useState<any[]>([]);

    // Advanced section state
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [rootText, setRootText] = useState('');
    const [existingRootSlug, setExistingRootSlug] = useState<string | null>(null);
    const [rootH, setRootH] = useState('');
    const [rootG, setRootG] = useState('');
    const [showCustomGrades, setShowCustomGrades] = useState(false);
    const [classNameInput, setClassNameInput] = useState('');
    const [classMascot, setClassMascot] = useState('');

    // Prepronominal prefixes list (+ / -)
    const [prefixRows, setPrefixRows] = useState<MorphemeRow[]>([]);
    const [activePrefixDropdownId, setActivePrefixDropdownId] = useState<string | null>(null);

    // Post-root morphemes list (+ / -)
    const [postRootRows, setPostRootRows] = useState<MorphemeRow[]>([]);
    const [activePostRootDropdownId, setActivePostRootDropdownId] = useState<string | null>(null);

    // Verb template config state
    const [pronSet, setPronSet] = useState<'a' | 'b'>('a');
    const [pronUseKaVariant, setPronUseKaVariant] = useState(false);
    const [pronPlural, setPronPlural] = useState(false);
    const [pronUse3rdPersonObj, setPronUse3rdPersonObj] = useState(false);
    const [middleVoice, setMiddleVoice] = useState('none');

    // Autocomplete dropdown visibility
    const [showRootSuggestions, setShowRootSuggestions] = useState(false);
    const [showClassSuggestions, setShowClassSuggestions] = useState(false);

    // New Morpheme Definition Modal State
    const [pendingMorphemesQueue, setPendingMorphemesQueue] = useState<NewMorphemeDef[]>([]);
    const [currentMorphemePrompt, setCurrentMorphemePrompt] = useState<NewMorphemeDef | null>(null);

    useEffect(() => {
        setFormData(initialData);
        
        // Parse Other_Forms
        if (initialData?.Other_Forms) {
            const forms = initialData.Other_Forms.split('|').map((raw, idx) => {
                const parts = raw.split(':');
                const label = getFriendlyLabel(parts[0]) || parts[0] || '';
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

        // Initialize Advanced Morphology fields
        const slug = initialData?.root_slug || initialData?.slug || '';
        const h = initialData?.root_h || '';
        const g = initialData?.root_g || '';
        const displaySpelling = h ? formatCommunityRoot(h) : (slug ? formatCommunityRoot(slug) : '');

        setRootText(displaySpelling);
        setExistingRootSlug(slug || null);
        setRootH(h);
        setRootG(g);
        setShowCustomGrades(Boolean((h && h !== displaySpelling) || (g && g !== displaySpelling)));

        const cName = initialData?.class_name || '';
        const cMascot = initialData?.class_mascot || (cName ? getClassMascot(cName) || '' : '');
        setClassNameInput(cName);
        setClassMascot(cMascot);

        // Initialize Prefixes List
        const rawPre = initialData?.config?.pre?.prefixes;
        if (Array.isArray(rawPre) && rawPre.length > 0) {
            setPrefixRows(rawPre.map((p, i) => ({ id: `p_${Date.now()}_${i}`, value: p })));
        } else {
            const legacyPrefixes: string[] = [];
            if (initialData?.config?.pre?.translocutive) legacyPrefixes.push('wi');
            if (initialData?.config?.pre?.partitive) legacyPrefixes.push('ni');
            if (initialData?.config?.pre?.distributive) legacyPrefixes.push('te');
            if (initialData?.config?.pre?.translocutiveImpOnly && !initialData?.config?.pre?.translocutive) legacyPrefixes.push('wi-imp');
            setPrefixRows(legacyPrefixes.map((p, i) => ({ id: `p_${Date.now()}_${i}`, value: p })));
        }

        // Initialize Post-Root Morphemes List
        const rawPost = initialData?.post_root_morphemes || (initialData?.config as any)?.post_root_morphemes;
        if (Array.isArray(rawPost) && rawPost.length > 0) {
            setPostRootRows(rawPost.map((p, i) => ({ id: `prm_${Date.now()}_${i}`, value: p })));
        } else if (initialData?.post_root_morpheme) {
            const parts = initialData.post_root_morpheme.includes(',')
                ? initialData.post_root_morpheme.split(',').map(s => s.trim())
                : [initialData.post_root_morpheme];
            setPostRootRows(parts.map((p, i) => ({ id: `prm_${Date.now()}_${i}`, value: p })));
        } else {
            setPostRootRows([]);
        }

        // Initialize Pronoun Set (Set A or Set B only)
        const config = initialData?.config;
        const setType = (config?.pron?.set_type || 'a').toLowerCase();
        setPronSet(setType === 'b' ? 'b' : 'a');
        setPronUseKaVariant(Boolean(config?.pron?.use_ka_variant));
        setPronPlural(Boolean(config?.pron?.plural_pronouns));
        setPronUse3rdPersonObj(Boolean(config?.pron?.use_3rd_person_object));
        setMiddleVoice(config?.pron?.middle_voice || 'none');

        // Auto-open advanced section if morphology is configured
        if (slug || h || g || cName || (initialData?.post_root_morpheme) || (rawPost && rawPost.length > 0) || (rawPre && rawPre.length > 0) || config?.pron?.set_type === 'b' || (config?.pron?.middle_voice && config?.pron?.middle_voice !== 'none')) {
            setIsAdvancedOpen(true);
        } else {
            setIsAdvancedOpen(false);
        }
    }, [initialData, isOpen]);

    // Available prefixes (built-in + custom)
    const availablePrefixes = useMemo(() => {
        return getAllPrefixes();
    }, [isOpen, pendingMorphemesQueue]);

    // Available post-root morphemes (built-in + custom)
    const availablePostRoots = useMemo(() => {
        return getAllPostRootMorphemes();
    }, [isOpen, pendingMorphemesQueue]);

    // Build unique available roots list for suggested completions (user sees Cherokee root & definition, NEVER slug)
    const availableRoots = useMemo(() => {
        const rootMapByDisplay = new Map<string, {
            slug: string;
            root_h: string;
            root_g: string;
            displayRoot: string;
            definition: string;
            className?: string;
            mascot?: string;
            postRoots?: string[];
            prefixes?: string[];
            config?: any;
        }>();

        roots.forEach(r => {
            const h = r.root_h || '';
            const g = r.root_g || '';
            const slug = r.root_slug || r.slug || '';
            const display = formatCommunityRoot(h || g || slug);
            if (!display || display === '∅' || display === 'Root') return;

            const key = `${display.toLowerCase()}_${(r.definition || '').toLowerCase().slice(0, 20)}`;
            if (!rootMapByDisplay.has(key)) {
                rootMapByDisplay.set(key, {
                    slug,
                    root_h: h,
                    root_g: g,
                    displayRoot: display,
                    definition: r.definition || '',
                    className: r.class_name,
                    mascot: r.class_mascot,
                    postRoots: r.post_root_morpheme ? [r.post_root_morpheme] : undefined,
                    config: r.config
                });
            }
        });

        return Array.from(rootMapByDisplay.values()).sort((a, b) => 
            a.displayRoot.localeCompare(b.displayRoot)
        );
    }, [roots]);

    // Build available aspect classes list for suggested completions
    const availableClasses = useMemo(() => {
        const classList: {
            name: string;
            parentName: string;
            mascot?: string;
            definition?: string;
        }[] = [];
        const seen = new Set<string>();

        if (ASPECT_CLASSES?.classes) {
            ASPECT_CLASSES.classes.forEach(c => {
                if (!seen.has(c.name)) {
                    seen.add(c.name);
                    classList.push({
                        name: c.name,
                        parentName: c.name,
                        mascot: c.mascot?.present,
                        definition: c.mascot?.definition
                    });
                }
                c.subclasses?.forEach(s => {
                    if (!seen.has(s.name)) {
                        seen.add(s.name);
                        classList.push({
                            name: s.name,
                            parentName: c.name,
                            mascot: s.mascot?.present || c.mascot?.present,
                            definition: s.mascot?.definition || c.mascot?.definition
                        });
                    }
                    s.variants?.forEach(v => {
                        if (!seen.has(v.name)) {
                            seen.add(v.name);
                            classList.push({
                                name: v.name,
                                parentName: c.name,
                                mascot: v.mascot?.present || s.mascot?.present || c.mascot?.present,
                                definition: v.mascot?.definition || s.mascot?.definition || c.mascot?.definition
                            });
                        }
                    });
                });
            });
        }

        roots.forEach(r => {
            if (r.class_name && !seen.has(r.class_name)) {
                seen.add(r.class_name);
                classList.push({
                    name: r.class_name,
                    parentName: getParentClassName(r.class_name),
                    mascot: r.class_mascot || getClassMascot(r.class_name),
                    definition: undefined
                });
            }
        });

        return classList.sort((a, b) => a.name.localeCompare(b.name));
    }, [roots]);

    // Live preview rootEntry
    const previewRootEntry = useMemo(() => {
        const effectiveDisplay = rootText.trim();
        const effectiveH = rootH.trim() || effectiveDisplay;
        const effectiveG = rootG.trim() || effectiveDisplay;
        const effectiveClass = classNameInput.trim();
        const effectiveMascot = classMascot.trim() || (effectiveClass ? getClassMascot(effectiveClass) || '' : '');
        const effectivePrefixes = prefixRows.map(p => p.value.trim()).filter(Boolean);
        const effectivePostRoots = postRootRows.map(p => p.value.trim()).filter(Boolean);

        return {
            entry_id: editingId || 'preview_custom_word',
            root_slug: existingRootSlug || 'root',
            slug: existingRootSlug || 'root',
            root_h: effectiveH || 'root',
            root_g: effectiveG || 'root',
            definition: formData?.Definition || '',
            class_name: effectiveClass,
            class_mascot: effectiveMascot,
            prefixes: effectivePrefixes,
            post_root_morphemes: effectivePostRoots,
            post_root_morpheme: effectivePostRoots.join(', ') || null,
            config: {
                pre: {
                    prefixes: effectivePrefixes
                },
                pron: {
                    set_type: pronSet,
                    use_ka_variant: pronSet === 'a' ? pronUseKaVariant : false,
                    plural_pronouns: pronPlural,
                    middle_voice: middleVoice === 'none' ? undefined : middleVoice,
                    use_3rd_person_object: pronUse3rdPersonObj
                }
            }
        };
    }, [
        editingId,
        rootText,
        existingRootSlug,
        rootH,
        rootG,
        formData?.Definition,
        classNameInput,
        classMascot,
        prefixRows,
        postRootRows,
        pronSet,
        pronUseKaVariant,
        pronPlural,
        middleVoice,
        pronUse3rdPersonObj
    ]);

    const isVerbTemplateActive = Boolean(
        rootText.trim() ||
        classNameInput.trim() ||
        prefixRows.length > 0 ||
        postRootRows.length > 0 ||
        pronSet !== 'a' ||
        pronUseKaVariant ||
        pronPlural ||
        pronUse3rdPersonObj ||
        (middleVoice && middleVoice !== 'none')
    );

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

    const handleSelectRoot = (r: {
        slug: string;
        root_h: string;
        root_g: string;
        displayRoot: string;
        definition: string;
        className?: string;
        mascot?: string;
        postRoots?: string[];
        config?: any;
    }) => {
        setRootText(r.displayRoot);
        setExistingRootSlug(r.slug);
        setRootH(r.root_h || r.displayRoot);
        setRootG(r.root_g || r.displayRoot);
        setShowRootSuggestions(false);

        // Auto-fill class if not currently set
        if (!classNameInput.trim() && r.className) {
            setClassNameInput(r.className);
            setClassMascot(r.mascot || getClassMascot(r.className) || '');
        }

        // Auto-fill post-root morpheme if empty
        if (postRootRows.length === 0 && r.postRoots && r.postRoots.length > 0) {
            setPostRootRows(r.postRoots.map((p, i) => ({ id: `prm_${Date.now()}_${i}`, value: p })));
        }

        // Auto-fill config if present and default
        if (r.config && prefixRows.length === 0 && pronSet === 'a' && middleVoice === 'none') {
            if (r.config.pron) {
                const sType = (r.config.pron.set_type || 'a').toLowerCase();
                setPronSet(sType === 'b' ? 'b' : 'a');
                setPronUseKaVariant(Boolean(r.config.pron.use_ka_variant));
                setPronPlural(Boolean(r.config.pron.plural_pronouns));
                setPronUse3rdPersonObj(Boolean(r.config.pron.use_3rd_person_object));
                setMiddleVoice(r.config.pron.middle_voice || 'none');
            }
        }
    };

    const handleSelectClass = (c: {
        name: string;
        parentName: string;
        mascot?: string;
        definition?: string;
    }) => {
        setClassNameInput(c.name);
        setClassMascot(c.mascot || getClassMascot(c.name) || '');
        setShowClassSuggestions(false);
    };

    // Prefix list helpers
    const addPrefixRow = () => {
        setPrefixRows(prev => [...prev, { id: `pre_${Date.now()}_${Math.random()}`, value: '' }]);
    };

    const updatePrefixRow = (id: string, val: string) => {
        setPrefixRows(prev => prev.map(r => r.id === id ? { ...r, value: val } : r));
    };

    const removePrefixRow = (id: string) => {
        setPrefixRows(prev => prev.filter(r => r.id !== id));
    };

    // Post-root list helpers
    const addPostRootRow = () => {
        setPostRootRows(prev => [...prev, { id: `prm_${Date.now()}_${Math.random()}`, value: '' }]);
    };

    const updatePostRootRow = (id: string, val: string) => {
        setPostRootRows(prev => prev.map(r => r.id === id ? { ...r, value: val } : r));
    };

    const removePostRootRow = (id: string) => {
        setPostRootRows(prev => prev.filter(r => r.id !== id));
    };

    // Finalize save after checking for new morphemes
    const executeSave = () => {
        const serializedForms = otherForms
            .filter(f => f.label.trim() && (f.syllabary.trim() || f.translit.trim()))
            .map(f => `${f.label.trim()}:${f.translit.trim()}^${f.syllabary.trim()}^${f.tone.trim()}^${f.notes.trim()}`)
            .join('|');

        if (!formData) return;

        const effectiveDisplay = rootText.trim();
        const effectiveH = rootH.trim() || effectiveDisplay;
        const effectiveG = rootG.trim() || effectiveDisplay;
        const effectiveClass = classNameInput.trim();
        const effectiveMascot = classMascot.trim() || (effectiveClass ? getClassMascot(effectiveClass) || '' : '');
        const effectivePrefixes = prefixRows.map(p => p.value.trim()).filter(Boolean);
        const effectivePostRoots = postRootRows.map(p => p.value.trim()).filter(Boolean);

        // Generate backend slug for new roots if not selected from existing
        const finalSlug = existingRootSlug || (effectiveDisplay ? generateRootSlug(effectiveDisplay) : undefined);

        const finalConfig = {
            pre: {
                prefixes: effectivePrefixes,
                distributive: effectivePrefixes.includes('de') || effectivePrefixes.includes('te'),
                translocutive: effectivePrefixes.includes('wi'),
                translocutiveImpOnly: effectivePrefixes.includes('wi-imp'),
                partitive: effectivePrefixes.includes('ni')
            },
            pron: {
                set_type: pronSet,
                use_ka_variant: pronSet === 'a' ? pronUseKaVariant : false,
                plural_pronouns: pronPlural,
                middle_voice: middleVoice === 'none' ? undefined : middleVoice,
                use_3rd_person_object: pronUse3rdPersonObj
            }
        };

        onSave({
            ...formData,
            Entry: formData.Entry || '',
            Syllabary: formData.Syllabary || '',
            Definition: formData.Definition || '',
            PoS: formData.PoS || '',
            Entry_Tone: formData.Entry_Tone || '',
            Notes: formData.Notes || '',
            customDictionaryId: formData.customDictionaryId || '',
            Other_Forms: serializedForms,
            // Class + Root / Verb Morphology
            root_slug: finalSlug,
            slug: finalSlug,
            root_h: effectiveH || undefined,
            root_g: effectiveG || undefined,
            class_name: effectiveClass || undefined,
            class_mascot: effectiveMascot || undefined,
            post_root_morphemes: effectivePostRoots,
            post_root_morpheme: effectivePostRoots.join(', ') || null,
            config: finalConfig
        });
    };

    // Pre-save validation: Check for new unrecognized morphemes and prompt the user
    const handleSaveClick = () => {
        const effectivePrefixes = prefixRows.map(p => p.value.trim()).filter(Boolean);
        const effectivePostRoots = postRootRows.map(p => p.value.trim()).filter(Boolean);

        const knownPrefixKeys = new Set(availablePrefixes.map(p => p.key.toLowerCase()));
        const knownPostRootKeys = new Set(availablePostRoots.map(m => m.key.toLowerCase()));

        const newMorphemes: NewMorphemeDef[] = [];

        // Check prefixes
        effectivePrefixes.forEach(p => {
            const lower = p.toLowerCase();
            if (!knownPrefixKeys.has(lower) && !newMorphemes.some(m => m.key.toLowerCase() === lower)) {
                newMorphemes.push({
                    type: 'prefix',
                    key: p,
                    name: `${p}- prefix`,
                    form: p,
                    definition: ''
                });
            }
        });

        // Check post-root morphemes
        effectivePostRoots.forEach(prm => {
            const lower = prm.toLowerCase();
            if (!knownPostRootKeys.has(lower) && !newMorphemes.some(m => m.key.toLowerCase() === lower)) {
                newMorphemes.push({
                    type: 'post_root',
                    key: prm,
                    name: prm,
                    form: prm,
                    definition: ''
                });
            }
        });

        if (newMorphemes.length > 0) {
            setPendingMorphemesQueue(newMorphemes);
            setCurrentMorphemePrompt(newMorphemes[0]);
            return;
        }

        executeSave();
    };

    // Handle Morpheme Definition Modal responses
    const handleConfirmMorpheme = (def: NewMorphemeDef) => {
        const custom = getCustomMorphology();

        if (def.type === 'prefix') {
            const newPrefix: PrefixData = {
                key: def.key.trim(),
                name: def.name.trim() || def.key.trim(),
                form: def.form.trim() || def.key.trim(),
                definition: def.definition.trim() || undefined
            };
            custom.prefixes.push(newPrefix);
        } else {
            const newPostRoot: PostRootMorphemeData = {
                key: def.key.trim(),
                name: def.name.trim() || def.key.trim(),
                form: def.form.trim() || def.key.trim(),
                subcase: null,
                classes: [],
                definition: def.definition.trim() || undefined
            };
            custom.post_root_morphemes.push(newPostRoot);
        }

        saveCustomMorphology(custom);

        // Advance queue
        const remaining = pendingMorphemesQueue.slice(1);
        setPendingMorphemesQueue(remaining);

        if (remaining.length > 0) {
            setCurrentMorphemePrompt(remaining[0]);
        } else {
            setCurrentMorphemePrompt(null);
            executeSave();
        }
    };

    const handleSkipMorpheme = () => {
        const remaining = pendingMorphemesQueue.slice(1);
        setPendingMorphemesQueue(remaining);

        if (remaining.length > 0) {
            setCurrentMorphemePrompt(remaining[0]);
        } else {
            setCurrentMorphemePrompt(null);
            executeSave();
        }
    };

    return (
        <>
            <Modal title={editingId ? "Edit Word" : (isSentenceMode ? "New Sentence" : "New Word")} onClose={onClose}>
                <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 pb-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Transliteration (Cherokee)</label>
                        <input
                            type="text"
                            value={formData?.Entry || ''}
                            onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Entry: e.target.value, Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                            className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white"
                            placeholder="e.g. adelohohi"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Syllabary (Cherokee)</label>
                        <div className="relative">
                            <input
                                type="text"
                                value={formData?.Syllabary || ''}
                                onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Syllabary: e.target.value, Entry: prev?.Entry || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg pl-3 pr-10 py-2 font-noto-cherokee text-lg outline-none focus:border-amber-500 dark:text-white"
                                placeholder="e.g. ᎠᏕᎶᎰᎯ"
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
                            className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-noto-serif outline-none focus:border-amber-500 dark:text-white"
                            placeholder="e.g. he/she understands it"
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
                                        placeholder="v, n, adj..."
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Tone (Optional)</label>
                                    <input
                                        type="text"
                                        value={formData?.Entry_Tone || ''}
                                        onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), Entry_Tone: formatToneInput(e.target.value), Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Notes: prev?.Notes || '', customDictionaryId: prev?.customDictionaryId || '' }))}
                                        placeholder="e.g. a1de2lo3ho2hi"
                                        className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 font-serif dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* EXPANDABLE ADVANCED SECTION (CLASS + ROOT & VERB TEMPLATE) */}
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-visible bg-white dark:bg-slate-900 shadow-sm transition-all">
                                <button
                                    type="button"
                                    onClick={() => setIsAdvancedOpen(prev => !prev)}
                                    className="w-full px-4 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 transition-colors text-left rounded-xl"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                                            <Sliders size={16} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                                <span>Advanced: Verb Template & Class/Root</span>
                                                {isVerbTemplateActive && (
                                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                        Configured
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Configure root, aspect class, prefixes, pronominal set, and morphemes
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-slate-400 dark:text-slate-500 p-1">
                                        {isAdvancedOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </button>

                                {isAdvancedOpen && (
                                    <div className="p-4 space-y-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-xl">
                                        {/* 1. Live Verb Template Preview Card */}
                                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700/60">
                                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                                                <span>Verb Template Preview</span>
                                                {isVerbTemplateActive && (
                                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                        <Check size={12} /> Active Formula
                                                    </span>
                                                )}
                                            </div>
                                            <div className="bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 min-h-[44px] flex items-center overflow-x-auto">
                                                <VerbMorphologyTemplate
                                                    rootEntry={previewRootEntry}
                                                    showMascot={true}
                                                    className="text-sm sm:text-base font-semibold"
                                                />
                                            </div>
                                        </div>

                                        {/* 2. Root Input with Autocomplete (Slug completely hidden from user) */}
                                        <div className="relative">
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                                                    Verb Root
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCustomGrades(prev => !prev)}
                                                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                                                >
                                                    {showCustomGrades ? "Hide H/Glottal Fields" : "+ Separate H/Glottal Roots"}
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                value={rootText}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setRootText(val);
                                                    setExistingRootSlug(null); // Custom typing clears slug so new backend slug will generate
                                                    setShowRootSuggestions(true);
                                                }}
                                                onFocus={() => setShowRootSuggestions(true)}
                                                onBlur={() => setTimeout(() => setShowRootSuggestions(false), 200)}
                                                placeholder="e.g. adehl, atsvs, gohv..."
                                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white font-mono text-sm"
                                            />

                                            {/* Root Autocomplete Dropdown (Showing Cherokee spelling and definition only) */}
                                            {showRootSuggestions && (
                                                <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 backdrop-blur-sm">
                                                        Known Cherokee Roots ({availableRoots.length})
                                                    </div>
                                                    {availableRoots
                                                        .filter(r => {
                                                            const q = rootText.trim().toLowerCase();
                                                            if (!q) return true;
                                                            return (
                                                                r.displayRoot.toLowerCase().includes(q) ||
                                                                r.root_h.toLowerCase().includes(q) ||
                                                                r.root_g.toLowerCase().includes(q) ||
                                                                r.definition.toLowerCase().includes(q)
                                                            );
                                                        })
                                                        .slice(0, 40)
                                                        .map(r => (
                                                            <button
                                                                key={`${r.slug}_${r.displayRoot}`}
                                                                type="button"
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    handleSelectRoot(r);
                                                                }}
                                                                className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between gap-3 text-xs"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-slate-800 dark:text-slate-100 font-mono flex items-center gap-2">
                                                                        <span>-{r.displayRoot}-</span>
                                                                        {r.className && (
                                                                            <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                                                                                [{r.className}]
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {r.definition && (
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm">
                                                                            {r.definition}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))
                                                    }
                                                    {availableRoots.filter(r => {
                                                        const q = rootText.trim().toLowerCase();
                                                        if (!q) return true;
                                                        return r.displayRoot.toLowerCase().includes(q) || r.definition.toLowerCase().includes(q);
                                                    }).length === 0 && (
                                                        <div className="px-3 py-2.5 text-xs text-slate-400 italic">
                                                            New root "{rootText}". A unique identifier will be created automatically.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Separate H-Grade & Glottal Grade Inputs */}
                                            {showCustomGrades && (
                                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                            H-Grade Root
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={rootH}
                                                            onChange={e => setRootH(e.target.value)}
                                                            placeholder={rootText || "e.g. adelohos"}
                                                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 dark:text-white font-mono text-xs"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                            Glottal Root
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={rootG}
                                                            onChange={e => setRootG(e.target.value)}
                                                            placeholder={rootText || "e.g. ade?lohos"}
                                                            className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 dark:text-white font-mono text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* 3. Aspect Class Input with Autocomplete */}
                                        <div className="relative">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                                Aspect Class
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={classNameInput}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setClassNameInput(val);
                                                        setClassMascot(getClassMascot(val) || '');
                                                        setShowClassSuggestions(true);
                                                    }}
                                                    onFocus={() => setShowClassSuggestions(true)}
                                                    onBlur={() => setTimeout(() => setShowClassSuggestions(false), 200)}
                                                    placeholder="e.g. g-ts[*], v-vhs, a, i-a-i..."
                                                    className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 outline-none focus:border-amber-500 dark:text-white font-mono text-sm"
                                                />
                                                {classMascot && (
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-sans italic text-slate-400 dark:text-slate-500 pointer-events-none">
                                                        Mascot: {classMascot}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Class Autocomplete Dropdown */}
                                            {showClassSuggestions && (
                                                <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/90 sticky top-0 z-10 backdrop-blur-sm">
                                                        Aspect Classes & Subclasses
                                                    </div>
                                                    {availableClasses
                                                        .filter(c => {
                                                            const q = classNameInput.trim().toLowerCase();
                                                            if (!q) return true;
                                                            return (
                                                                c.name.toLowerCase().includes(q) ||
                                                                (c.mascot && c.mascot.toLowerCase().includes(q)) ||
                                                                (c.definition && c.definition.toLowerCase().includes(q))
                                                            );
                                                        })
                                                        .slice(0, 40)
                                                        .map(c => (
                                                            <button
                                                                key={c.name}
                                                                type="button"
                                                                onMouseDown={e => {
                                                                    e.preventDefault();
                                                                    handleSelectClass(c);
                                                                }}
                                                                className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between gap-3 text-xs"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                                        [{c.name}]
                                                                    </div>
                                                                    {c.mascot && (
                                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                                            <span className="italic">{c.mascot}</span>
                                                                            {c.definition && <span> &bull; {c.definition}</span>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 shrink-0">
                                                                    {c.parentName}
                                                                </div>
                                                            </button>
                                                        ))
                                                    }
                                                    {availableClasses.filter(c => {
                                                        const q = classNameInput.trim().toLowerCase();
                                                        if (!q) return true;
                                                        return c.name.toLowerCase().includes(q) || (c.mascot && c.mascot.toLowerCase().includes(q));
                                                    }).length === 0 && (
                                                        <div className="px-3 py-2.5 text-xs text-slate-400 italic">
                                                            Custom class: [{classNameInput}]
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* 4. Prepronominal Prefixes (+ / - Dynamic List) */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Prepronominal Prefixes
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={addPrefixRow}
                                                    className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 flex items-center gap-1"
                                                >
                                                    <Plus size={14} /> Add Prefix
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {prefixRows.map((row) => {
                                                    const matchedData = getPrefixData(row.value);
                                                    return (
                                                        <div key={row.id} className="relative flex items-center gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={row.value}
                                                                    onChange={e => {
                                                                        updatePrefixRow(row.id, e.target.value);
                                                                        setActivePrefixDropdownId(row.id);
                                                                    }}
                                                                    onFocus={() => setActivePrefixDropdownId(row.id)}
                                                                    onBlur={() => setTimeout(() => setActivePrefixDropdownId(null), 200)}
                                                                    placeholder="e.g. wi, ni, de, yi..."
                                                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-amber-500 font-mono dark:text-white"
                                                                />
                                                                {row.value && matchedData?.name && matchedData.name !== row.value && (
                                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-slate-500 pointer-events-none">
                                                                        {matchedData.name}
                                                                    </div>
                                                                )}

                                                                {/* Prefix Autocomplete Dropdown */}
                                                                {activePrefixDropdownId === row.id && (
                                                                    <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                                                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/90 sticky top-0">
                                                                            Known Prefixes
                                                                        </div>
                                                                        {availablePrefixes
                                                                            .filter(p => {
                                                                                const q = row.value.trim().toLowerCase();
                                                                                if (!q) return true;
                                                                                return p.key.toLowerCase().includes(q) || p.form.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
                                                                            })
                                                                            .map(p => (
                                                                                <button
                                                                                    key={p.key}
                                                                                    type="button"
                                                                                    onMouseDown={e => {
                                                                                        e.preventDefault();
                                                                                        updatePrefixRow(row.id, p.key);
                                                                                        setActivePrefixDropdownId(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-xs"
                                                                                >
                                                                                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{p.form}-</span>
                                                                                    <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
                                                                                </button>
                                                                            ))
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => removePrefixRow(row.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Remove Prefix"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {prefixRows.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic text-center py-2 bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                                        No prepronominal prefixes (tap + to add)
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* 5. Pronominal Set (Set A or Set B only) */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                                Pronominal Set
                                            </label>
                                            <div className="grid grid-cols-2 gap-3 mb-2.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setPronSet('a')}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                                                        pronSet === 'a'
                                                            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800 shadow-sm ring-1 ring-red-400'
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    Set A
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPronSet('b')}
                                                    className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all text-center ${
                                                        pronSet === 'b'
                                                            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800 shadow-sm ring-1 ring-blue-400'
                                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    Set B
                                                </button>
                                            </div>

                                            {/* Pronoun modifier checkboxes */}
                                            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
                                                {pronSet === 'a' && (
                                                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                                                        <input
                                                            type="checkbox"
                                                            checked={pronUseKaVariant}
                                                            onChange={e => setPronUseKaVariant(e.target.checked)}
                                                            className="rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                                                        />
                                                        <span>Use ga- / ka- variant (Set A)</span>
                                                    </label>
                                                )}
                                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={pronPlural}
                                                        onChange={e => setPronPlural(e.target.checked)}
                                                        className="rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                                                    />
                                                    <span>Plural pronouns (pl)</span>
                                                </label>
                                                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={pronUse3rdPersonObj}
                                                        onChange={e => setPronUse3rdPersonObj(e.target.checked)}
                                                        className="rounded text-amber-600 focus:ring-amber-500 border-slate-300 dark:border-slate-700"
                                                    />
                                                    <span>3rd person object</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* 6. Middle Voice */}
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                                Middle Voice
                                            </label>
                                            <select
                                                value={middleVoice}
                                                onChange={e => setMiddleVoice(e.target.value)}
                                                className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                                            >
                                                <option value="none">None</option>
                                                <option value="ali">ali</option>
                                                <option value="ada">ada</option>
                                                <option value="atal">atal</option>
                                                <option value="at">at</option>
                                                <option value="al">al</option>
                                                <option value="ali_ada">ali / ada</option>
                                            </select>
                                        </div>

                                        {/* 7. Post-Root Morphemes (+ / - Dynamic List) */}
                                        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                    Post-Root Morphemes
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={addPostRootRow}
                                                    className="text-xs font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 flex items-center gap-1"
                                                >
                                                    <Plus size={14} /> Add Morpheme
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {postRootRows.map((row) => {
                                                    const matchedPrm = getPostRootMorpheme(row.value);
                                                    return (
                                                        <div key={row.id} className="relative flex items-center gap-2">
                                                            <div className="relative flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={row.value}
                                                                    onChange={e => {
                                                                        updatePostRootRow(row.id, e.target.value);
                                                                        setActivePostRootDropdownId(row.id);
                                                                    }}
                                                                    onFocus={() => setActivePostRootDropdownId(row.id)}
                                                                    onBlur={() => setTimeout(() => setActivePostRootDropdownId(null), 200)}
                                                                    placeholder="e.g. change-out, iterative, hitting..."
                                                                    className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-amber-500 font-mono dark:text-white"
                                                                />
                                                                {row.value && matchedPrm?.form && (
                                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 pointer-events-none">
                                                                        -{matchedPrm.form}-
                                                                    </div>
                                                                )}

                                                                {/* Post-Root Autocomplete Dropdown */}
                                                                {activePostRootDropdownId === row.id && (
                                                                    <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                                                                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/90 sticky top-0">
                                                                            Known Post-Root Morphemes
                                                                        </div>
                                                                        {availablePostRoots
                                                                            .filter(m => {
                                                                                const q = row.value.trim().toLowerCase();
                                                                                if (!q) return true;
                                                                                return m.key.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || m.form.toLowerCase().includes(q);
                                                                            })
                                                                            .map(m => (
                                                                                <button
                                                                                    key={m.key}
                                                                                    type="button"
                                                                                    onMouseDown={e => {
                                                                                        e.preventDefault();
                                                                                        updatePostRootRow(row.id, m.key);
                                                                                        setActivePostRootDropdownId(null);
                                                                                    }}
                                                                                    className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-xs"
                                                                                >
                                                                                    <span className="font-bold text-slate-800 dark:text-slate-200">{m.key}</span>
                                                                                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">-{m.form}-</span>
                                                                                </button>
                                                                            ))
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => removePostRootRow(row.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                                                                title="Remove Morpheme"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                {postRootRows.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic text-center py-2 bg-slate-100/50 dark:bg-slate-900/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                                        No post-root morphemes (tap + to add)
                                                    </p>
                                                )}
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
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Collection</label>
                        <select
                            value={formData?.customDictionaryId || ''}
                            onChange={e => setFormData(prev => ({ ...(prev || {} as WordFormData), customDictionaryId: e.target.value, Entry: prev?.Entry || '', Syllabary: prev?.Syllabary || '', Definition: prev?.Definition || '', PoS: prev?.PoS || '', Entry_Tone: prev?.Entry_Tone || '', Notes: prev?.Notes || '' }))}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 outline-none focus:ring-2 focus:ring-amber-500 dark:text-white"
                        >
                            <option value="" disabled>Select a collection...</option>
                            {Object.values(customDictionaries).map((nb: any) => (
                                <option key={nb.id} value={nb.id}>{nb.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button onClick={handleSaveClick} className="w-full mt-6 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm">
                    Save {isSentenceMode ? "Sentence" : "Word"}
                </button>
            </Modal>

            {/* NEW MORPHEME DEFINITION MODAL PROMPT */}
            {currentMorphemePrompt && (
                <Modal title="Define New Morpheme" onClose={handleSkipMorpheme}>
                    <div className="space-y-4">
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2.5">
                            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-800 dark:text-amber-300">
                                You added a new {currentMorphemePrompt.type === 'prefix' ? 'prepronominal prefix' : 'post-root morpheme'}: <strong>"{currentMorphemePrompt.key}"</strong>. Please give it a display name and phonetic shape so it can be reused and formatted in templates.
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                Morpheme Key / Tag
                            </label>
                            <input
                                type="text"
                                value={currentMorphemePrompt.key}
                                onChange={e => setCurrentMorphemePrompt({ ...currentMorphemePrompt, key: e.target.value })}
                                className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 font-mono text-sm dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                Display Name / Grammatical Role
                            </label>
                            <input
                                type="text"
                                value={currentMorphemePrompt.name}
                                onChange={e => setCurrentMorphemePrompt({ ...currentMorphemePrompt, name: e.target.value })}
                                placeholder="e.g. Negative prefix, Causative suffix..."
                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                Phonetic Form (Segment text)
                            </label>
                            <input
                                type="text"
                                value={currentMorphemePrompt.form}
                                onChange={e => setCurrentMorphemePrompt({ ...currentMorphemePrompt, form: e.target.value })}
                                placeholder="e.g. yi, iy, ohts..."
                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 font-mono text-sm outline-none focus:border-amber-500 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                                English Meaning / Notes (Optional)
                            </label>
                            <input
                                type="text"
                                value={currentMorphemePrompt.definition}
                                onChange={e => setCurrentMorphemePrompt({ ...currentMorphemePrompt, definition: e.target.value })}
                                placeholder="e.g. Used for negation or conditions..."
                                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-500 dark:text-white"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleSkipMorpheme}
                                className="flex-1 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                            >
                                Skip / Use As-Is
                            </button>
                            <button
                                type="button"
                                onClick={() => handleConfirmMorpheme(currentMorphemePrompt)}
                                className="flex-1 py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm"
                            >
                                Save Morpheme & Continue
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
};
