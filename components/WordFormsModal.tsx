import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mic, Trash2, Pause, Volume2, Plus, TranslateCherokee, ChevronDown, ChevronRight } from './Icons';
import {
    getFriendlyLabel,
    processFormsContextually,
    renderStyledText,
    ColorizedCherokeeWord,
    getColorWordSegmentsSetting,
    getFormTransliteration,
    resolveHdFormName,
    getCombinedCedVerbsMode
} from '../utils';
import { useCorpus } from './CorpusContext';
import { useReader } from './ReaderContext';

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
    rootEntry?: any;
    settings?: any;
}

const CORE_TENSES: { id: string; label: string; sublabel: string }[] = [
    { id: 'present', label: 'Present', sublabel: 'Current action' },
    { id: 'habitual', label: 'Habitual', sublabel: 'Regularly occurs' },
    { id: 'completive past', label: 'Completive Past', sublabel: 'Completed action' },
    { id: 'imperative', label: 'Imperative / Immediate', sublabel: 'Command / Recent action' },
    { id: 'infinitive', label: 'Infinitive', sublabel: 'To / For action' },
];

const CORE_PERSONS: { id: string; label: string; sublabel: string }[] = [
    { id: '1s', label: '1st Person', sublabel: 'Singular (I)' },
    { id: '2s', label: '2nd Person', sublabel: 'Singular (You)' },
    { id: '3s', label: '3rd Person', sublabel: 'Singular (He / She / It)' },
    { id: '3p', label: '3rd Person', sublabel: 'Plural (They)' },
    { id: '1p-in', label: '1st Person', sublabel: 'Plural Incl. (We all)' },
];

const EXPANSION_PERSONS: { id: string; label: string; sublabel: string }[] = [
    { id: '1d-in', label: '1st Person', sublabel: 'Dual Incl. (You & I)' },
    { id: '1d-ex', label: '1st Person', sublabel: 'Dual Excl. (Another & I)' },
    { id: '2d', label: '2nd Person', sublabel: 'Dual (You two)' },
    { id: '1p-ex', label: '1st Person', sublabel: 'Plural Excl. (Others & I)' },
    { id: '2p', label: '2nd Person', sublabel: 'Plural (You all)' },
];

const ALL_PERSON_METAS: Record<string, { label: string; sublabel: string }> = {
    '1s': { label: '1st Person', sublabel: 'Singular (I)' },
    '2s': { label: '2nd Person', sublabel: 'Singular (You)' },
    '3s': { label: '3rd Person', sublabel: 'Singular (He / She / It)' },
    '3p': { label: '3rd Person', sublabel: 'Plural (They)' },
    '1p-in': { label: '1st Person', sublabel: 'Plural Incl. (We all)' },
    '1d-in': { label: '1st Person', sublabel: 'Dual Incl. (You & I)' },
    '1d-ex': { label: '1st Person', sublabel: 'Dual Excl. (Another & I)' },
    '2d': { label: '2nd Person', sublabel: 'Dual (You two)' },
    '1p-ex': { label: '1st Person', sublabel: 'Plural Excl. (Others & I)' },
    '2p': { label: '2nd Person', sublabel: 'Plural (You all)' },
};

const OBJECT_LABELS: Record<string, { label: string; sublabel: string }> = {
    '1s': { label: 'Me', sublabel: '1st Singular' },
    '2s': { label: 'You (sg)', sublabel: '2nd Singular' },
    '3s': { label: 'It / Him / Her', sublabel: '3rd Singular (Inanimate)' },
    '3a': { label: 'Him / Her (an)', sublabel: '3rd Singular (Animate)' },
    '1d-in': { label: 'You & Me', sublabel: '1st Dual Inclusive' },
    '1d-ex': { label: 'Someone & Me', sublabel: '1st Dual Exclusive' },
    '2d': { label: 'You two', sublabel: '2nd Dual' },
    '1p-in': { label: 'All of us', sublabel: '1st Plural Inclusive' },
    '1p-ex': { label: 'Others & Me', sublabel: '1st Plural Exclusive' },
    '2p': { label: 'You all', sublabel: '2nd Plural' },
    '3p': { label: 'Those things', sublabel: '3rd Plural (Inanimate)' },
    '3pa': { label: 'Them', sublabel: '3rd Plural (Animate)' },
};

const SUBJECT_SECTION_TITLES: Record<string, string> = {
    '1s': '1st Person Singular (I → ...)',
    '2s': '2nd Person Singular (You → ...)',
    '3s': '3rd Person Singular (He / She / It → ...)',
    '1d-in': '1st Person Dual Inclusive (You & I → ...)',
    '1d-ex': '1st Person Dual Exclusive (Another & I → ...)',
    '2d': '2nd Person Dual (You two → ...)',
    '1p-in': '1st Person Plural Inclusive (All of us → ...)',
    '1p-ex': '1st Person Plural Exclusive (Others & I → ...)',
    '2p': '2nd Person Plural (You all → ...)',
    '3p': '3rd Person Plural (They → ...)',
};

function normalizeTense(raw: string): string {
    if (!raw) return '';
    const t = raw.toLowerCase().trim();
    // 1. Separate compound / specific tenses first
    if (t === 'future imperative' || t === 'future imperative/volative') return 'future imperative';
    if (t === 'future (expected) tense' || t === 'future (expected)' || t === 'future' || t === 'future tense') return 'future';
    if (t === 'present habitual' || t === 'present habitual tense' || t === 'habitual' || t === 'habitual tense' || t === 'imperfective') return 'habitual';
    if (t === 'remote past' || t === 'remote past tense' || t === 'completive past' || t === 'past' || t === 'perfective') return 'completive past';
    // 2. Unify Immediate Past and Imperative (Stem IV / Immediate) into the core Column 4 stem
    if (t === 'immediate past' || t === 'immediate past tense' || t === 'immediate imperative' || t === 'immediate imperative/volative' || t === 'immediate' || t === 'imperative') return 'imperative';
    if (t === 'infinitive' || t === 'deverbative') return 'infinitive';
    return t;
}

function formatTenseName(tense: string): string {
    if (tense === 'present') return 'Present';
    if (tense === 'habitual') return 'Habitual';
    if (tense === 'completive past') return 'Completive Past';
    if (tense === 'imperative') return 'Imperative / Immediate';
    if (tense === 'infinitive') return 'Infinitive';
    if (tense === 'future') return 'Future';
    if (tense === 'future imperative') return 'Future Imperative';
    if (tense === 'immediate past') return 'Immediate Past';
    return tense.charAt(0).toUpperCase() + tense.slice(1);
}

function isCedReferenceSlot(subj: string, tense: string): boolean {
    return (
        (subj === '3s' && tense === 'present') ||
        (subj === '1s' && tense === 'present') ||
        (subj === '3s' && tense === 'habitual') ||
        (subj === '3s' && tense === 'completive past') ||
        (subj === '2s' && tense === 'imperative') ||
        (subj === '3s' && tense === 'infinitive')
    );
}

const getSourceColorHex = (colorName: string | undefined): string => {
    const c = colorName === 'gold' ? 'amber' : (colorName || 'slate');
    if (c.startsWith('#')) return c;
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
    return colors[c] || '#64748b';
};

const MiniAudioButton = ({
    audio,
    isOfficial = false,
    color,
    isPlaying,
    onPlay,
    onDelete
}: {
    audio: any;
    isOfficial?: boolean;
    color?: string;
    isPlaying: boolean;
    onPlay: () => void;
    onDelete?: () => void;
}) => {
    let bgClass = '';
    let style: React.CSSProperties = {};

    const effectiveColor = isOfficial ? undefined : (color || '#f59e0b');

    if (isPlaying) {
        bgClass = 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 ring-2 ring-amber-400';
    } else if (effectiveColor) {
        if (effectiveColor.startsWith('#')) {
            style = { backgroundColor: effectiveColor, color: '#fff' };
            bgClass = 'hover:brightness-110 shadow-sm transition-all';
        } else if (effectiveColor === 'gold' || effectiveColor === 'amber') {
            bgClass = 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors';
        } else {
            bgClass = `bg-${effectiveColor}-500 text-white hover:bg-${effectiveColor}-600 shadow-sm transition-colors`;
        }
    } else if (isOfficial) {
        bgClass = 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-700 transition-colors';
    } else {
        bgClass = 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors';
    }

    if (isPlaying && effectiveColor && effectiveColor.startsWith('#')) {
        style = { backgroundColor: effectiveColor + '20', color: effectiveColor, borderColor: effectiveColor, borderWidth: '1px' };
        bgClass = 'ring-2 ring-amber-400';
    }

    return (
        <div className="flex items-center gap-1 shrink-0">
            <button
                onClick={(e) => { e.stopPropagation(); onPlay(); }}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${bgClass}`}
                style={style}
                title={isOfficial ? 'Official Audio' : (audio.speaker ? `${audio.speaker} (User Recording)` : 'User Recording')}
            >
                {isPlaying ? <Pause size={13} className="fill-current" /> : <Volume2 size={13} />}
            </button>
            {onDelete && !isOfficial && (
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors"
                    title="Delete recording"
                >
                    <Trash2 size={13} />
                </button>
            )}
        </div>
    );
};

interface ActivePopoverData {
    cellId: string;
    forms: any[];
    isCedSlot: boolean;
    rect: DOMRect;
    title?: string;
    subtitle?: string;
}

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
    onReadInContext,
    rootEntry,
    settings
}) => {
    if (!isOpen || !entry) return null;

    const { glosses, sentenceMap, rootMap } = useCorpus();
    const { isSentenceFromCollection } = useReader();
    const hideCustomization = !!settings?.hideCustomization;
    const isColored = getColorWordSegmentsSetting(settings);
    const effectiveRootEntry = rootEntry || (entry ? rootMap?.get(entry.Index || entry.id || entry.merged_id) : undefined);
    const entryGlosses = glosses.filter((g: any) => g.entry_id === entry.Index && (g.gloss_syllabary || g.gloss_phonetic));

    // Popover state and hover timers
    const [activePopover, setActivePopover] = useState<ActivePopoverData | null>(null);
    // All transitives collapsed by default on open
    const [expandedTransitive, setExpandedTransitive] = useState<Record<string, boolean>>({});
    // Additional persons in Table 1 collapsed by default on open
    const [showAdditionalPersons, setShowAdditionalPersons] = useState(false);
    const popoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);

    const clearPopoverTimer = () => {
        if (popoverTimeoutRef.current) {
            clearTimeout(popoverTimeoutRef.current);
            popoverTimeoutRef.current = null;
        }
    };

    const schedulePopoverClose = () => {
        clearPopoverTimer();
        popoverTimeoutRef.current = setTimeout(() => {
            setActivePopover(null);
        }, 180);
    };

    // Close popover when clicking outside
    useEffect(() => {
        if (!activePopover) return;
        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setActivePopover(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [activePopover]);

    // Reset collapsible sections when modal opens or entry changes
    useEffect(() => {
        if (isOpen) {
            setExpandedTransitive({});
            setShowAdditionalPersons(false);
        }
    }, [isOpen, entry?.Index]);

    // Helper to tokenize sentence for context view
    const tokenizeSentence = (syllabary: string, translit: string) => {
        const cleanSyl = (syllabary || '').replace(/\*/g, '').trim();
        const cleanTr = (translit || '').replace(/\*/g, '').trim();
        const syl = cleanSyl ? cleanSyl.split(/\s+/) : [];
        const tr = cleanTr ? cleanTr.split(/\s+/) : [];
        const max = Math.max(syl.length, tr.length);
        const tokens: { syl: string; tr: string; index: number }[] = [];
        for (let i = 0; i < max; i++) {
            tokens.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
        }
        return tokens;
    };

    // Compile all forms with sequential 1-based indexing
    const allForms: any[] = [];
    let formCounter = 1;

    // 1. Official Forms
    if (entry.Other_Forms) {
        entry.Other_Forms.split('|').forEach((form: string) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                allForms.push({
                    type: 'official',
                    label: parts[0],
                    form_name: parts[0],
                    translit: values[0],
                    syllabary: values[1],
                    tone: values[2],
                    notes: values[3],
                    index: formCounter++,
                    color: 'slate',
                    source: 'ced'
                });
            }
        });
    }

    // 2. Imported Forms
    const importedFormsForThisEntry: any[] = [];
    packages.forEach(p => {
        if (p.status === 'active' && importedData[p.id]?.word_forms) {
            const hidePartBFromParent = !entry.is_combined_part_b && getCombinedCedVerbsMode(settings) === 'full';
            const forms = importedData[p.id].word_forms!.filter((f: any) => f.word_index === entry.Index && !(hidePartBFromParent && f.is_shim));
            if (forms.length > 0) {
                forms.forEach(f => importedFormsForThisEntry.push({ ...f, color: p.color, pkgName: p.name }));
            }
        }
    });

    const processedImportedForms = processFormsContextually(importedFormsForThisEntry);

    processedImportedForms.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(f => {
        const slot = resolveHdFormName(f.normalized_key || f.form_name);
        const dynamicTranslit = getFormTransliteration(f, effectiveRootEntry, slot, settings) || f.translit;
        allForms.push({
            ...f,
            type: 'imported',
            label: f.displayLabel || getFriendlyLabel(f.form_name),
            form_name: f.form_name,
            normalized_key: f.normalized_key,
            translit: dynamicTranslit,
            syllabary: f.syllabary,
            tone: f.tone,
            notes: f.notes,
            index: formCounter++,
            color: f.color,
            source: f.source,
            audio: f.audio,
            segmented_raw: f.segmented_raw,
            segmented_aspiration: f.segmented_aspiration,
            segmented_reverse_aspiration: f.segmented_reverse_aspiration,
            segmented_surface: f.segmented_surface,
            surface_segments: f.surface_segments,
            is_shim: f.is_shim,
            shim_class: f.shim_class
        });
    });

    // 3. Custom Forms
    if (userWordForms && userWordForms[entry.Index]) {
        userWordForms[entry.Index].split('|').forEach((form: string) => {
            const parts = form.split(':');
            if (parts.length >= 2) {
                const values = parts[1].split('^');
                allForms.push({
                    type: 'custom',
                    label: parts[0],
                    form_name: parts[0],
                    translit: values[0],
                    syllabary: values[1],
                    tone: values[2],
                    notes: values[3],
                    index: formCounter++,
                    color: 'gold',
                    source: 'user'
                });
            }
        });
    }

    // Audio resolution helpers
    const getFormAudios = (form: any) => {
        const audiosForThisEntry = (userAudioMeta && (
            userAudioMeta[entry.Index] ||
            (entry.id && userAudioMeta[entry.id]) ||
            (entry.merged_id && userAudioMeta[entry.merged_id])
        )) || [];
        const formRegex = new RegExp(`(?:_F|\\.)${form.index}(?:_|$)`);
        return audiosForThisEntry.filter((a: any) =>
            formRegex.test(a.id) ||
            a.id.includes(`-${entry.Index}.${form.index}_`) ||
            a.id.includes(`.${form.index}_`) ||
            a.formIndex === form.index
        );
    };

    const getFirstAudio = (form: any) => {
        if (!form) return null;
        if (form.audio) {
            return {
                id: form.audio,
                packageId: 'official-cherokee-data',
                isOfficial: true
            };
        }
        const userAudios = getFormAudios(form);
        if (userAudios.length > 0) {
            const first = userAudios[0];
            const audioPkg = packages.find(p => p.id === first.packageId);
            const isOfficial = audioPkg ? audioPkg.type === 'official' : false;
            return {
                ...first,
                isOfficial,
                color: isOfficial ? undefined : getPackageColor(first.packageId || 'user')
            };
        }
        return null;
    };

    // Categorization into Tables and Sections
    interface CellSlot {
        animate?: any;
        inanimate?: any;
        single?: any;
    }

    const table1Map = new Map<string, CellSlot>();
    const table2Map = new Map<string, CellSlot>();
    const table2TensesSet = new Set<string>();
    const table2SubjectsSet = new Set<string>();
    const transitiveBySubject = new Map<string, any[]>();
    const unclassifiedForms: any[] = [];

    allForms.forEach(form => {
        const key = form.normalized_key || form.form_name || '';
        if (!key || key.startsWith('noun')) {
            unclassifiedForms.push(form);
            return;
        }

        const parts = key.split('|');
        if (parts.length >= 3) {
            const subj = parts[0].toLowerCase().trim();
            const obj = parts[1].toLowerCase().trim();
            const rawTense = parts[2].toLowerCase().trim();
            const tense = normalizeTense(rawTense);
            const isCoreTense = CORE_TENSES.some(t => t.id === tense);
            const isStandardObj = (obj === '3s' || obj === '3a' || obj === 'none' || obj === '3i' || !obj);
            const isAnimate = obj === '3a';

            if (isCoreTense && isStandardObj) {
                // Table 1: Core 5x5 Grid
                const cellKey = `${subj}:${tense}`;
                const existing = table1Map.get(cellKey) || {};
                if (isAnimate) {
                    existing.animate = form;
                } else {
                    existing.inanimate = form;
                }
                table1Map.set(cellKey, existing);
            } else if (!isCoreTense && isStandardObj) {
                // Table 2: Additional Tenses
                const cellKey = `${subj}:${tense}`;
                const existing = table2Map.get(cellKey) || {};
                if (isAnimate) {
                    existing.animate = form;
                } else {
                    existing.inanimate = form;
                }
                table2Map.set(cellKey, existing);
                table2TensesSet.add(tense);
                table2SubjectsSet.add(subj);
            } else {
                // Dedicated Transitive section (Subject -> Object interaction)
                const enriched = {
                    ...form,
                    parsedSubj: subj,
                    parsedObj: obj,
                    parsedTense: tense
                };
                if (!transitiveBySubject.has(subj)) {
                    transitiveBySubject.set(subj, []);
                }
                transitiveBySubject.get(subj)!.push(enriched);
            }
        } else {
            unclassifiedForms.push(form);
        }
    });

    const isVerbWithConjugations = table1Map.size > 0 || table2Map.size > 0 || transitiveBySubject.size > 0;

    // Table 1 person rows: Always include baseline 5 rows, then append expansion rows only if they have data
    const expansionPersonsWithData = EXPANSION_PERSONS.filter(p =>
        CORE_TENSES.some(t => table1Map.has(`${p.id}:${t.id}`))
    );

    // Table 2 person rows: Only rows that have data in additional tenses
    const table2Tenses = Array.from(table2TensesSet);
    const allOrderedPersons = [...CORE_PERSONS, ...EXPANSION_PERSONS];
    const table2Persons = allOrderedPersons.filter(p => table2SubjectsSet.has(p.id));

    // Transitive subject order
    const transitiveSubjects = allOrderedPersons
        .map(p => p.id)
        .filter(subj => transitiveBySubject.has(subj));

    const allTransitivesExpanded = transitiveSubjects.length > 0 && transitiveSubjects.every(s => expandedTransitive[s]);
    const toggleAllTransitives = () => {
        if (allTransitivesExpanded) {
            setExpandedTransitive({});
        } else {
            const all: Record<string, boolean> = {};
            transitiveSubjects.forEach(s => { all[s] = true; });
            setExpandedTransitive(all);
        }
    };

    // Floating Popover positioning calculations
    const renderFloatingPopover = () => {
        if (!activePopover) return null;

        const popoverWidth = 330;
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

        let left = activePopover.rect.left + activePopover.rect.width / 2 - popoverWidth / 2;
        if (left < 12) left = 12;
        if (left + popoverWidth > viewportWidth - 12) left = viewportWidth - popoverWidth - 12;

        const estimatedHeight = activePopover.forms.length > 1 ? 340 : 250;
        const spaceBelow = viewportHeight - activePopover.rect.bottom;
        const spaceAbove = activePopover.rect.top;

        let top = activePopover.rect.bottom + 8;
        if (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) {
            top = Math.max(12, activePopover.rect.top - estimatedHeight - 8);
        }

        return createPortal(
            <div
                ref={popoverRef}
                className="fixed z-[20000] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl p-4 w-[330px] max-h-[85vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
                style={{ top: `${top}px`, left: `${left}px` }}
                onMouseEnter={clearPopoverTimer}
                onMouseLeave={schedulePopoverClose}
            >
                {/* Header */}
                <div className="flex items-start justify-between pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        {activePopover.title && (
                            <div className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                {activePopover.title}
                            </div>
                        )}
                        {activePopover.subtitle && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {activePopover.subtitle}
                            </div>
                        )}
                        {activePopover.isCedSlot && (
                            <span className="inline-block mt-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wide">
                                CED Reference Form
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setActivePopover(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -mr-1 -mt-1 rounded-full transition-colors"
                    >
                        <X size={15} />
                    </button>
                </div>

                {/* Forms list */}
                <div className="flex flex-col gap-3.5">
                    {activePopover.forms.map((f: any, fIdx: number) => {
                        const formAudios = getFormAudios(f);
                        const isAnimateForm = f.normalized_key?.includes('|3a|') || f.form_name?.includes('|3a|');
                        const isInanimateForm = f.normalized_key?.includes('|3s|') || f.form_name?.includes('|3s|');

                        return (
                            <div key={f.index || fIdx} className={`relative pl-3.5 ${fIdx > 0 ? 'pt-3 border-t border-slate-100 dark:border-slate-800' : ''}`}>
                                {/* Source color line */}
                                <div
                                    className="absolute left-0 top-1 bottom-1 w-1 rounded-full"
                                    style={{ backgroundColor: getSourceColorHex(f.color) }}
                                    title={`Source: ${f.source || f.pkgName || 'Unknown'}`}
                                />
                                {activePopover.forms.length > 1 && (
                                    <div className="mb-1.5">
                                        <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                            isAnimateForm
                                                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                                : isInanimateForm
                                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                        }`}>
                                            {isAnimateForm ? 'Animate Object' : isInanimateForm ? 'Inanimate Object' : f.label || 'Form'}
                                        </span>
                                    </div>
                                )}

                                {/* Syllabary */}
                                <div className="font-noto-cherokee text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    <span>{f.syllabary}</span>
                                    {f.is_auto_syllabary && (
                                        <TranslateCherokee size={15} className="inline-block text-amber-600 dark:text-amber-400 opacity-80 shrink-0" title="Auto-transliterated syllabary" />
                                    )}
                                </div>

                                {/* Transliteration */}
                                <div className="font-noto-serif text-sm font-bold text-amber-700 dark:text-amber-400 mt-1">
                                    <ColorizedCherokeeWord
                                        word={f.translit}
                                        form={f}
                                        entry={entry}
                                        rootEntry={effectiveRootEntry}
                                        allForms={allForms}
                                        isColored={isColored}
                                        settings={settings}
                                    />
                                </div>

                                {/* Tone */}
                                {f.tone && f.tone !== f.translit && (
                                    <div className="font-serif text-xs text-slate-500 dark:text-slate-400 font-semibold italic mt-0.5">
                                        <ColorizedCherokeeWord
                                            word={f.tone}
                                            form={f}
                                            entry={entry}
                                            rootEntry={effectiveRootEntry}
                                            allForms={allForms}
                                            isColored={isColored}
                                            settings={settings}
                                        />
                                    </div>
                                )}

                                {/* Notes / English Definition */}
                                {f.notes && (
                                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80 leading-relaxed">
                                        {f.notes}
                                    </div>
                                )}

                                {/* Source badge */}
                                {f.source && (
                                    <div className="mt-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        Source: <span className="text-slate-600 dark:text-slate-300 font-extrabold">{f.source}</span>
                                    </div>
                                )}

                                {/* Audio Section */}
                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                    {f.audio && (
                                        <MiniAudioButton
                                            audio={{ id: f.audio, packageId: 'official-cherokee-data' }}
                                            isOfficial={true}
                                            isPlaying={playingAudioId === f.audio}
                                            onPlay={() => onPlayAudio({ id: f.audio, packageId: 'official-cherokee-data' })}
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
                                    {!hideCustomization && (
                                        <button
                                            onClick={() => onRecordAudio(`form_${f.index}`)}
                                            className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-xs font-semibold flex items-center gap-1 transition-colors"
                                            title="Record Audio"
                                        >
                                            <Mic size={12} />
                                            <span className="text-[10px]">Record</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>,
            document.body
        );
    };

    // Render helper for an individual table cell with separate hover/click targets for animate & inanimate
    const renderCell = (
        cellKey: string,
        slot: CellSlot | undefined,
        subj: string,
        tense: string,
        isCedSlot: boolean
    ) => {
        if (!slot || (!slot.animate && !slot.inanimate && !slot.single)) {
            return (
                <div className="h-full min-h-[50px] flex items-center justify-center p-2 text-slate-300 dark:text-slate-700 select-none text-xs">
                    —
                </div>
            );
        }

        const animForm = slot.animate;
        const inanimForm = slot.inanimate || slot.single;
        const bothExist = animForm && inanimForm;

        const animAudio = animForm ? getFirstAudio(animForm) : null;
        const inanimAudio = inanimForm ? getFirstAudio(inanimForm) : null;

        const baseCellTitle = `${ALL_PERSON_METAS[subj]?.label || subj} (${ALL_PERSON_METAS[subj]?.sublabel || ''}) • ${formatTenseName(tense)}`;

        const openSinglePopover = (e: React.MouseEvent<HTMLElement>, form: any, subTitle: string) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setActivePopover({
                cellId: `${cellKey}_${form.index}`,
                forms: [form],
                isCedSlot,
                rect,
                title: subTitle ? `${baseCellTitle} • ${subTitle}` : baseCellTitle
            });
        };

        return (
            <div
                className={`relative h-full min-h-[50px] transition-all flex flex-col justify-center ${
                    isCedSlot
                        ? 'border-2 border-amber-500/80 dark:border-amber-400/80 shadow-sm rounded-lg bg-amber-50/15 dark:bg-amber-900/10'
                        : 'border border-slate-200/80 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900/50'
                }`}
            >
                {bothExist ? (
                    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/80 p-1">
                        {/* Animate Form Sub-row: Individual hover & click target */}
                        <div
                            className="relative overflow-hidden pl-2.5 pr-1 py-1 rounded hover:bg-purple-50/70 dark:hover:bg-purple-950/30 transition-colors cursor-pointer group flex items-center justify-between gap-1.5"
                            onMouseEnter={(e) => {
                                clearPopoverTimer();
                                openSinglePopover(e, animForm, 'Animate Object');
                            }}
                            onMouseLeave={schedulePopoverClose}
                            onClick={(e) => {
                                e.stopPropagation();
                                openSinglePopover(e, animForm, 'Animate Object');
                            }}
                        >
                            {/* Source color line */}
                            <div
                                className="absolute left-0 top-0.5 bottom-0.5 w-1 rounded-full"
                                style={{ backgroundColor: getSourceColorHex(animForm.color) }}
                                title={`Source: ${animForm.source || animForm.pkgName || 'Unknown'}`}
                            />
                            <div className="flex items-center gap-1 min-w-0">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/40 px-1 rounded shrink-0 border border-purple-200/40 dark:border-purple-800/40">
                                    an
                                </span>
                                <span className="font-serif text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                                    <ColorizedCherokeeWord
                                        word={animForm.tone || animForm.translit}
                                        form={animForm}
                                        entry={entry}
                                        rootEntry={effectiveRootEntry}
                                        allForms={allForms}
                                        isColored={isColored}
                                        settings={settings}
                                    />
                                </span>
                            </div>
                            {animAudio && (
                                <MiniAudioButton
                                    audio={animAudio}
                                    isOfficial={animAudio.isOfficial}
                                    color={animAudio.color}
                                    isPlaying={playingAudioId === animAudio.id}
                                    onPlay={() => onPlayAudio(animAudio)}
                                />
                            )}
                        </div>

                        {/* Inanimate Form Sub-row: Individual hover & click target */}
                        <div
                            className="relative overflow-hidden pl-2.5 pr-1 py-1 rounded hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group flex items-center justify-between gap-1.5"
                            onMouseEnter={(e) => {
                                clearPopoverTimer();
                                openSinglePopover(e, inanimForm, 'Inanimate Object');
                            }}
                            onMouseLeave={schedulePopoverClose}
                            onClick={(e) => {
                                e.stopPropagation();
                                openSinglePopover(e, inanimForm, 'Inanimate Object');
                            }}
                        >
                            {/* Source color line */}
                            <div
                                className="absolute left-0 top-0.5 bottom-0.5 w-1 rounded-full"
                                style={{ backgroundColor: getSourceColorHex(inanimForm.color) }}
                                title={`Source: ${inanimForm.source || inanimForm.pkgName || 'Unknown'}`}
                            />
                            <div className="flex items-center gap-1 min-w-0">
                                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded shrink-0 border border-slate-200/50 dark:border-slate-700/50">
                                    in
                                </span>
                                <span className="font-serif text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                                    <ColorizedCherokeeWord
                                        word={inanimForm.tone || inanimForm.translit}
                                        form={inanimForm}
                                        entry={entry}
                                        rootEntry={effectiveRootEntry}
                                        allForms={allForms}
                                        isColored={isColored}
                                        settings={settings}
                                    />
                                </span>
                            </div>
                            {inanimAudio && (
                                <MiniAudioButton
                                    audio={inanimAudio}
                                    isOfficial={inanimAudio.isOfficial}
                                    color={inanimAudio.color}
                                    isPlaying={playingAudioId === inanimAudio.id}
                                    onPlay={() => onPlayAudio(inanimAudio)}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    // Single form
                    (() => {
                        const single = animForm || inanimForm;
                        const sAudio = animForm ? animAudio : inanimAudio;
                        const isAnimateOnly = !!animForm;

                        return (
                            <div
                                className="relative overflow-hidden pl-2.5 pr-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group flex items-center justify-between gap-1.5"
                                onMouseEnter={(e) => {
                                    clearPopoverTimer();
                                    openSinglePopover(e, single, isAnimateOnly ? 'Animate Object' : '');
                                }}
                                onMouseLeave={schedulePopoverClose}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openSinglePopover(e, single, isAnimateOnly ? 'Animate Object' : '');
                                }}
                            >
                                {/* Source color line */}
                                <div
                                    className="absolute left-0 top-1 bottom-1 w-1 rounded-full"
                                    style={{ backgroundColor: getSourceColorHex(single.color) }}
                                    title={`Source: ${single.source || single.pkgName || 'Unknown'}`}
                                />
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {isAnimateOnly && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/40 px-1 rounded shrink-0 border border-purple-200/40 dark:border-purple-800/40">
                                            an
                                        </span>
                                    )}
                                    <span className="font-serif text-xs font-semibold text-slate-800 dark:text-slate-200 truncate group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                                        <ColorizedCherokeeWord
                                            word={single.tone || single.translit}
                                            form={single}
                                            entry={entry}
                                            rootEntry={effectiveRootEntry}
                                            allForms={allForms}
                                            isColored={isColored}
                                            settings={settings}
                                        />
                                    </span>
                                </div>
                                {sAudio && (
                                    <MiniAudioButton
                                        audio={sAudio}
                                        isOfficial={sAudio.isOfficial}
                                        color={sAudio.color}
                                        isPlaying={playingAudioId === sAudio.id}
                                        onPlay={() => onPlayAudio(sAudio)}
                                    />
                                )}
                            </div>
                        );
                    })()
                )}
            </div>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[15000] flex flex-col bg-white dark:bg-slate-900 shadow-2xl">
            <div className="flex-1 flex flex-col overflow-hidden w-full h-full">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0 h-[70px]">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                                Word Forms
                            </h3>
                            {entry.Syllabary && (
                                <span className="font-noto-cherokee text-lg text-amber-600 dark:text-amber-400 font-semibold">
                                    {entry.Syllabary}
                                </span>
                            )}
                            {entry.Entry && entry.Entry !== entry.Syllabary && (
                                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                    ({entry.Entry})
                                </span>
                            )}
                        </div>
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

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">

                    {isVerbWithConjugations ? (
                        <>
                            {/* Table 1: Core 5x5 Grid */}
                            <div>
                                <div className="flex items-center justify-between mb-3 px-0.5">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                                Person/Tense 5×5
                                            </h4>
                                            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-200/50 dark:border-amber-700/50">
                                                CED Reference Forms Highlighted
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            Hover over or tap any cell to inspect syllabary, sources, translations, and audio recordings.
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 shadow-sm">
                                    <table className="w-full border-collapse table-fixed min-w-[760px]">
                                        <thead>
                                            <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                                                <th className="p-3 text-left w-40 border-r border-slate-200 dark:border-slate-800">
                                                    Person
                                                </th>
                                                {CORE_TENSES.map(t => (
                                                    <th key={t.id} className="p-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200">{t.label}</div>
                                                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-normal lowercase tracking-normal">
                                                            {t.sublabel}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                                            {/* Primary 5 Person Rows (Always visible) */}
                                            {CORE_PERSONS.map(person => (
                                                <tr key={person.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                                                    <td className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 align-middle">
                                                        <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-snug">
                                                            {person.label}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                                            {person.sublabel}
                                                        </div>
                                                    </td>
                                                    {CORE_TENSES.map(t => {
                                                        const cellKey = `${person.id}:${t.id}`;
                                                        const slot = table1Map.get(cellKey);
                                                        const isCedSlot = isCedReferenceSlot(person.id, t.id);

                                                        return (
                                                            <td key={t.id} className="p-1.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-middle">
                                                                {renderCell(cellKey, slot, person.id, t.id, isCedSlot)}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}

                                            {/* Additional Persons Collapsible Section */}
                                            {expansionPersonsWithData.length > 0 && (
                                                <>
                                                    <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                                                        <td colSpan={CORE_TENSES.length + 1} className="p-0 border-t border-b border-slate-200 dark:border-slate-800">
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowAdditionalPersons(prev => !prev)}
                                                                className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors group text-left cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {showAdditionalPersons ? (
                                                                        <ChevronDown size={14} className="text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                                                                    ) : (
                                                                        <ChevronRight size={14} className="text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                                                                    )}
                                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                                                                        Additional Persons ({expansionPersonsWithData.length})
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                                        (duals, exclusive plural, 2nd plural)
                                                                    </span>
                                                                </div>
                                                                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 group-hover:underline">
                                                                    {showAdditionalPersons ? 'Hide' : 'Show'}
                                                                </span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {showAdditionalPersons && expansionPersonsWithData.map(person => (
                                                        <tr key={person.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                                                            <td className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 align-middle">
                                                                <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-snug">
                                                                    {person.label}
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                                                    {person.sublabel}
                                                                </div>
                                                            </td>
                                                            {CORE_TENSES.map(t => {
                                                                const cellKey = `${person.id}:${t.id}`;
                                                                const slot = table1Map.get(cellKey);
                                                                const isCedSlot = isCedReferenceSlot(person.id, t.id);

                                                                return (
                                                                    <td key={t.id} className="p-1.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-middle">
                                                                        {renderCell(cellKey, slot, person.id, t.id, isCedSlot)}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Table 2: Additional Tenses */}
                            {table2Tenses.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2.5 px-0.5">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                            Additional Tenses
                                        </h4>
                                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold">
                                            {table2Tenses.length} tense{table2Tenses.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900/60 shadow-sm">
                                        <table className="w-full border-collapse table-fixed min-w-[560px]">
                                            <thead>
                                                <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-bold border-b border-slate-200 dark:border-slate-800">
                                                    <th className="p-3 text-left w-40 border-r border-slate-200 dark:border-slate-800">
                                                        Person
                                                    </th>
                                                    {table2Tenses.map(tense => (
                                                        <th key={tense} className="p-3 text-center border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200">
                                                                {formatTenseName(tense)}
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                                                {table2Persons.map(person => (
                                                    <tr key={person.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/20 transition-colors">
                                                        <td className="p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 align-middle">
                                                            <div className="font-bold text-slate-800 dark:text-slate-200 text-xs leading-snug">
                                                                {person.label}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                                                {person.sublabel}
                                                            </div>
                                                        </td>
                                                        {table2Tenses.map(tense => {
                                                            const cellKey = `${person.id}:${tense}`;
                                                            const slot = table2Map.get(cellKey);
                                                            return (
                                                                <td key={tense} className="p-1.5 border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-middle">
                                                                    {renderCell(cellKey, slot, person.id, tense, false)}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Dedicated Transitive Section (LTU Object Interactions) */}
                            {transitiveSubjects.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-3 px-0.5">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                                    Transitive Forms (Person to Person)
                                                </h4>
                                            </div>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                Direct object conjugations grouped by subject. Tap or hover over any card for details.
                                            </p>
                                        </div>
                                        <button
                                            onClick={toggleAllTransitives}
                                            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline px-2 py-1 rounded transition-colors"
                                        >
                                            {allTransitivesExpanded ? 'Collapse All' : 'Expand All'}
                                        </button>
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        {transitiveSubjects.map(subj => {
                                            const forms = transitiveBySubject.get(subj) || [];
                                            const isExpanded = !!expandedTransitive[subj];
                                            const title = SUBJECT_SECTION_TITLES[subj] || `${subj} Subject`;

                                            return (
                                                <div key={subj} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm">
                                                    <button
                                                        onClick={() => setExpandedTransitive(prev => ({ ...prev, [subj]: !isExpanded }))}
                                                        className="w-full px-4 py-3 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors flex items-center justify-between text-left"
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                                                                {title}
                                                            </span>
                                                            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                                                                {forms.length}
                                                            </span>
                                                        </div>
                                                        <div className="text-slate-400">
                                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 bg-slate-50/20 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800">
                                                            {forms.map(f => {
                                                                const fAudio = getFirstAudio(f);
                                                                const cardTitle = `${SUBJECT_SECTION_TITLES[f.parsedSubj] || f.parsedSubj} → ${OBJECT_LABELS[f.parsedObj]?.label || f.parsedObj}`;

                                                                const openCardPopover = (e: React.MouseEvent<HTMLElement>) => {
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    setActivePopover({
                                                                        cellId: `trans_${f.index}`,
                                                                        forms: [f],
                                                                        isCedSlot: false,
                                                                        rect,
                                                                        title: cardTitle,
                                                                        subtitle: f.parsedTense ? formatTenseName(f.parsedTense) : undefined
                                                                    });
                                                                };

                                                                return (
                                                                    <div
                                                                        key={f.index}
                                                                        className="relative overflow-hidden pl-3.5 pr-2.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 bg-white dark:bg-slate-900/70 transition-all cursor-pointer flex items-center justify-between gap-2 shadow-sm"
                                                                        onMouseEnter={(e) => {
                                                                            clearPopoverTimer();
                                                                            openCardPopover(e);
                                                                        }}
                                                                        onMouseLeave={schedulePopoverClose}
                                                                        onClick={openCardPopover}
                                                                    >
                                                                        {/* Source color line */}
                                                                        <div
                                                                            className="absolute left-0 top-0 bottom-0 w-1.5"
                                                                            style={{ backgroundColor: getSourceColorHex(f.color) }}
                                                                            title={`Source: ${f.source || f.pkgName || 'Unknown'}`}
                                                                        />
                                                                        <div className="flex flex-col min-w-0">
                                                                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded border border-purple-200/50 dark:border-purple-800/40 shrink-0">
                                                                                    → {OBJECT_LABELS[f.parsedObj]?.label || f.parsedObj}
                                                                                </span>
                                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50 shrink-0">
                                                                                    {formatTenseName(f.parsedTense || 'present')}
                                                                                </span>
                                                                            </div>
                                                                            <div className="font-serif text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                                                <ColorizedCherokeeWord
                                                                                    word={f.tone || f.translit}
                                                                                    form={f}
                                                                                    entry={entry}
                                                                                    rootEntry={effectiveRootEntry}
                                                                                    allForms={allForms}
                                                                                    isColored={isColored}
                                                                                    settings={settings}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        {fAudio && (
                                                                            <MiniAudioButton
                                                                                audio={fAudio}
                                                                                isOfficial={fAudio.isOfficial}
                                                                                color={fAudio.color}
                                                                                isPlaying={playingAudioId === fAudio.id}
                                                                                onPlay={() => onPlayAudio(fAudio)}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Unclassified / Irregular / Custom Forms (if any exist) */}
                            {unclassifiedForms.length > 0 && (
                                <div>
                                    <div className="mb-2.5 px-0.5">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                                            Other Uncategorized Forms
                                        </h4>
                                    </div>
                                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                                        <table className="w-full text-left border-collapse table-fixed">
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {unclassifiedForms.map((form, idx) => {
                                                    const formAudios = getFormAudios(form);
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative">
                                                            <td className="p-3 w-1/3 align-top pl-5">
                                                                {/* Source color line */}
                                                                <div
                                                                    className="absolute left-0 top-0 bottom-0 w-1.5"
                                                                    style={{ backgroundColor: getSourceColorHex(form.color) }}
                                                                    title={`Source: ${form.source || form.pkgName || 'Unknown'}`}
                                                                />
                                                                <div className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                                                                    {form.label}
                                                                </div>
                                                                {form.source && (
                                                                    <div className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                                        {form.source}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 align-top">
                                                                <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100">
                                                                    {form.syllabary}
                                                                </div>
                                                                <div className="font-noto-serif text-sm text-amber-700 dark:text-amber-400 font-bold mt-0.5">
                                                                    <ColorizedCherokeeWord
                                                                        word={form.translit}
                                                                        form={form}
                                                                        entry={entry}
                                                                        rootEntry={effectiveRootEntry}
                                                                        allForms={allForms}
                                                                        isColored={isColored}
                                                                        settings={settings}
                                                                    />
                                                                </div>
                                                                {form.notes && (
                                                                    <div className="text-[10px] text-slate-400 mt-1">
                                                                        {form.notes}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="p-3 w-16 align-top text-center">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    {form.audio && (
                                                                        <MiniAudioButton
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
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        // Flat List View for Nouns and Non-Verbs
                        <div>
                            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100 dark:border-slate-700">
                                        <tr>
                                            <th className="p-3 w-1/4">Form</th>
                                            <th className="p-3">Details</th>
                                            <th className="p-3 w-16 text-center">Audio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {allForms.map((form, idx) => {
                                            const formAudios = getFormAudios(form);
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
                                                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors relative">
                                                    <td className="p-3 align-top pl-5">
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1.5"
                                                            style={{ backgroundColor: borderStyle.borderLeftColor }}
                                                        />
                                                        <div className="font-bold text-slate-700 dark:text-slate-200 text-xs break-words leading-tight">
                                                            {form.label}
                                                        </div>
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
                                                            <div className="font-noto-cherokee text-lg text-slate-800 dark:text-slate-100 break-words leading-snug flex items-center gap-1.5">
                                                                <span>{form.syllabary}</span>
                                                                {form.is_auto_syllabary && (
                                                                    <TranslateCherokee size={14} className="inline-block text-amber-600 dark:text-amber-400 opacity-80 shrink-0" title="Auto-transliterated syllabary" />
                                                                )}
                                                            </div>
                                                            <div className="font-noto-serif text-sm text-amber-700 dark:text-amber-400 font-bold break-words leading-snug">
                                                                <ColorizedCherokeeWord
                                                                    word={form.translit}
                                                                    form={form}
                                                                    entry={entry}
                                                                    rootEntry={effectiveRootEntry}
                                                                    allForms={allForms}
                                                                    isColored={isColored}
                                                                    settings={settings}
                                                                />
                                                            </div>
                                                            {form.tone && (
                                                                <div className="font-serif text-xs text-slate-500 dark:text-slate-400 font-bold italic break-words">
                                                                    <ColorizedCherokeeWord
                                                                        word={form.tone}
                                                                        form={form}
                                                                        entry={entry}
                                                                        rootEntry={effectiveRootEntry}
                                                                        allForms={allForms}
                                                                        isColored={isColored}
                                                                        settings={settings}
                                                                    />
                                                                </div>
                                                            )}
                                                            {form.notes && (
                                                                <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-100 dark:border-slate-800 pt-1 break-words leading-tight">
                                                                    {form.notes}
                                                                </div>
                                                            )}
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
                                                            {!hideCustomization && (
                                                                <button
                                                                    onClick={() => onRecordAudio(`form_${form.index}`)}
                                                                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center justify-center transition-colors shrink-0"
                                                                    title="Record Audio"
                                                                >
                                                                    <Mic size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Add Form Action */}
                    {!hideCustomization && (
                        <div
                            onClick={() => onManageForms(entry)}
                            className="p-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 font-bold text-xs uppercase tracking-wide">
                                <Plus size={16} />
                                <span>Add / Manage Word Forms</span>
                            </div>
                        </div>
                    )}

                    {/* Seen in Context Section */}
                    {entryGlosses.length > 0 && (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 mb-3 px-0.5">
                                <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
                                    Seen in context ({entryGlosses.length})
                                </span>
                            </div>

                            <div className="space-y-3">
                                {entryGlosses.map((g: any, gIdx: number) => {
                                    const sentence = sentenceMap.get(g.sentence_id);
                                    if (!sentence) return null;

                                    const tokens = tokenizeSentence(sentence.syllabary, sentence.translit);
                                    const targetIndices = (g.word_index != null && g.word_index !== '') ? String(g.word_index).split(',').map(Number) : [];

                                    const pkgColor = getPackageColor(g.source || 'slate') || 'slate';
                                    let pkgHex = '#64748b';
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
                                        <div
                                            key={`gloss-${gIdx}`}
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
                                                    {isSentenceFromCollection(g.sentence_id) ? 'See in collection' : 'See in context'}
                                                </div>
                                            </div>

                                            {/* Tokens */}
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
                                                    {renderStyledText(sentence.english)}
                                                </div>
                                            )}

                                            {/* Note */}
                                            {g.notes && (
                                                <div className="text-xs text-slate-400 dark:text-slate-500 mt-2 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg p-2">
                                                    Note: {g.notes}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                </div>

                {/* Floating Popover Portal */}
                {renderFloatingPopover()}

            </div>
        </div>,
        document.body
    );
};
