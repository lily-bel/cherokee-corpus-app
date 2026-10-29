import React, { useMemo, useRef, useState } from 'react';
import { Volume2, Pause, TranslateCherokee } from './Icons';
import {
    renderColorizedCherokee,
    renderSegmentedSurface,
    segmentVerbForm,
    deriveSegmentedForm,
    getAudioFromDB,
    cleanStr,
    SegmentGroup,
    resolveRoleTaggedSegments,
    getCombinedCedVerbsMode,
    getTransliterationStyleSetting,
    getToneOrthographySetting,
    getShowLengthInTranslitSetting,
    convertToneText,
    formatTranslitWithLength,
    projectToneOrLengthOntoSegments,
    hasToneMarks,
    getFormTransliteration,
    isCedForm,
    convertConsonantsToStyle
} from '../utils';
import { usePackageManager } from './PackageManagerContext';
import { useCorpus } from './CorpusContext';

const SLOT_TO_HD_FORM: Record<string, string> = {
    '1s|3a|present': 'present_1sg',
    '1s|3s|present': 'present_1sg',
    '2s|3a|imperative': 'imperative',
    '2s|3s|imperative': 'imperative',
    '3s|3s|present': 'present',
    '3s|3s|habitual': 'imperfective',
    '3s|3s|infinitive': 'infinitive',
    '3s|3s|completive past': 'perfective',
};

export const COMPACT_SLOT_LABELS: Record<string, string> = {
    '1s|3a|present': '1st Pres (an)',
    '2s|3a|imperative': '2nd Imp (an)',
    '1s|3s|present': '1st Pres',
    '2s|3s|imperative': '2nd Imp',
    '3s|3s|present': '3rd Pres',
    '3s|3s|habitual': '3rd Hab',
    '3s|3s|infinitive': '3rd Infinitive',
    '3s|3s|completive past': '3rd Past',
    'noun|singular|': 'Singular',
    'noun|plural|': 'Plural',
};

export const CATEGORY_STYLES: Record<string, any> = {
    p2p: {
        bg: 'bg-transparent',
        border: 'border-0',
        label: 'text-purple-700 dark:text-purple-300 font-bold',
        translit: 'text-slate-900 dark:text-slate-100 font-semibold',
        syllabary: 'text-slate-600 dark:text-slate-400 font-medium'
    },
    ab: {
        bg: 'bg-transparent',
        border: 'border-0',
        label: 'text-rose-700 dark:text-rose-300 font-bold',
        translit: 'text-slate-900 dark:text-slate-100 font-semibold',
        syllabary: 'text-slate-600 dark:text-slate-400 font-medium'
    },
    set_b: {
        bg: 'bg-transparent',
        border: 'border-0',
        label: 'text-sky-700 dark:text-sky-300 font-bold',
        translit: 'text-slate-900 dark:text-slate-100 font-semibold',
        syllabary: 'text-slate-600 dark:text-slate-400 font-medium'
    },
    noun: {
        bg: 'bg-transparent',
        border: 'border-0',
        label: 'text-slate-700 dark:text-slate-300 font-bold',
        translit: 'text-slate-900 dark:text-slate-100 font-semibold',
        syllabary: 'text-slate-600 dark:text-slate-400 font-medium'
    }
};

export interface ReferenceFormCardData {
    slotKey: string;
    label: string;
    category: 'p2p' | 'ab' | 'set_b' | 'noun';
    form?: any;
    pronominalSet: 'A' | 'B' | 'P2P';
    crossRef?: {
        label: string;
        targetId: string;
    };
}

interface ReferenceFormsPreviewProps {
    entry?: any;
    forms: any[];
    rootEntry?: any;
    settings?: {
        showToneInForms?: boolean;
        colorWordSegments?: boolean;
        miniConjugationsColumns?: 1 | 2;
        [key: string]: any;
    };
    columns?: 1 | 2;
    onViewEntry?: (entry: any) => void;
    onPlayAudio?: (audio: any) => void;
    playingAudioId?: string | null;
    onOpenAllForms?: () => void;
    className?: string;
    userAudioMeta?: Record<string, any[]>;
}

export interface ReferencePreviewRow {
    category: 'p2p' | 'ab' | 'set_b' | 'noun';
    left: ReferenceFormCardData | null;
    right: ReferenceFormCardData | null;
}

export function getReferencePreviewMatchedForms(
    rawFormsInput: any[] = [],
    entry?: any,
    rootEntry?: any,
    settings?: any
): {
    rows: ReferencePreviewRow[];
    displayedCards: ReferenceFormCardData[];
    matchedForms: Set<any>;
    hasMiniPreview: boolean;
} {
    const verbConfig = rootEntry?.config || entry?.config;
    const isPartB = Boolean(entry?.is_combined_part_b || rootEntry?.is_combined_part_b);
    const combinedMode = getCombinedCedVerbsMode(settings);
    const isParentWithPartB = !isPartB && Boolean(entry?.combined_part_b_id || (Array.isArray(entry?.shim_forms) && entry.shim_forms.length > 0) || (Array.isArray(rootEntry?.shim_forms) && rootEntry.shim_forms.length > 0));
    const hidePartBFromParent = isParentWithPartB && combinedMode === 'full';

    const shimFormsSet = new Set<string>(
        (entry?.shim_forms || rootEntry?.shim_forms || []).map((s: string) => s.toLowerCase())
    );

    const forms = hidePartBFromParent
        ? rawFormsInput.filter(f => {
            if (f.is_shim) return false;
            const k = (f.normalized_key || f.form_name || '').toLowerCase();
            if (k.includes('infinitive') && shimFormsSet.has('infinitive')) return false;
            if (k.includes('imperative') && !k.includes('3a') && !k.includes('animate') && shimFormsSet.has('imperative')) return false;
            return true;
        })
        : rawFormsInput;

    // Helper to find a form matching normalized_key or label
    const findForm = (
        keys: string[],
        labelSnippets: string[],
        excludeSet?: Set<any>,
        forbidSubstrings?: string[]
    ) => {
        // Pass 1: exact or prefix/suffix normalized key match among non-excluded forms
        const byKey = forms.find(f => {
            if (excludeSet && excludeSet.has(f)) return false;
            const k = (f.normalized_key || f.form_name || '').toLowerCase();
            return keys.some(key => k === key || k.startsWith(key) || k.endsWith(key));
        });
        if (byKey) return byKey;

        // Pass 2: label match among non-excluded forms
        return forms.find(f => {
            if (excludeSet && excludeSet.has(f)) return false;
            const l = (f.displayLabel || f.label || '').toLowerCase();
            const k = (f.normalized_key || f.form_name || '').toLowerCase();
            if (forbidSubstrings && forbidSubstrings.some(fs => l.includes(fs) || k.includes(fs))) return false;
            return labelSnippets.some(ls => l.includes(ls));
        });
    };

    const pos = (
        entry?.PoS ||
        entry?.Part_of_Speech ||
        entry?.pos ||
        entry?._PoS_Lily ||
        entry?.sources?.['lily-dict.csv']?.PoS ||
        entry?.sources?.['cn-app-dictionary.csv']?.['Part of speech'] ||
        ''
    ).toLowerCase().trim();

    const hasNounForms = forms.some(f => {
        const k = (f.normalized_key || f.form_name || '').toLowerCase();
        return k.startsWith('noun|') || k === 'noun' || k === 'singular' || k === 'plural';
    });

    const isNounPos = pos === 'noun' || pos === 'n' || pos === 'n.' || pos.startsWith('noun');
    const isVerbPos = pos === 'verb' || pos.startsWith('v') || rootEntry != null;
    const isNoun = hasNounForms || (isNounPos && !isVerbPos);

    const rows: ReferencePreviewRow[] = [];
    let matchedForms = new Set<any>();

    if (isNoun) {
        const pSingular = findForm(
            ['noun|singular', 'singular'],
            ['singular']
        );
        const nounSingular = pSingular || (entry ? {
            translit: entry.Entry || entry.translit || entry.practical || '',
            tone: entry.Entry_Tone || entry.tone || '',
            tone2: entry.Entry_Tone || entry.tone2 || '',
            syllabary: entry.Syllabary || entry.syllabary || '',
            audio: entry.Entry_Audio || entry.audio || '',
            form_name: 'noun|singular|',
            displayLabel: 'Singular'
        } : undefined);

        const pPlural = findForm(
            ['noun|plural', 'plural'],
            ['plural']
        );
        const nounPlural = pPlural || (entry?.Plural ? {
            translit: entry.Plural,
            tone: entry.Plural_Tone || '',
            tone2: entry.Plural_Tone || '',
            syllabary: entry.Plural_Syllabary || '',
            audio: '',
            form_name: 'noun|plural|',
            displayLabel: 'Plural'
        } : undefined);

        if (nounSingular || nounPlural) {
            rows.push({
                category: 'noun',
                left: nounSingular ? {
                    slotKey: 'noun|singular|',
                    label: 'Singular',
                    category: 'noun',
                    form: nounSingular,
                    pronominalSet: 'A'
                } : null,
                right: nounPlural ? {
                    slotKey: 'noun|plural|',
                    label: 'Plural',
                    category: 'noun',
                    form: nounPlural,
                    pronominalSet: 'A'
                } : null
            });
        }

        matchedForms = new Set([pSingular, pPlural].filter(Boolean));
    } else {
        // Slot 1 & 2: Person-to-person
        const p2p1 = findForm(
            ['1s|3a|present'],
            ['1st present (animate object)', 'animate object', '1st to 3rd present', '1st person singular with animate']
        );
        const p2p2 = findForm(
            ['2s|3a|imperative'],
            ['2nd imperative (animate object)', 'animate direct', '2nd to 3rd imperative', 'imperative with animate']
        );

        const p2pMatched = new Set([p2p1, p2p2].filter(Boolean));

        // Slot 3 & 4: A/B 1st present & 2nd imperative
        const pres1 = findForm(
            ['1s|3s|present', '1s|present'],
            ['1st present (inanimate object)', '1st person singular present (inanimate', '1st person singular with inanimate', '1st present'],
            p2pMatched,
            ['animate']
        );
        const imp2 = findForm(
            ['2s|3s|imperative', '2s|imperative'],
            ['2nd imperative (inanimate object)', 'imperative (inanimate', 'imperative with inanimate', '2nd imperative'],
            p2pMatched,
            ['animate']
        );

        // Slot 5 & 6: A/B 3rd present & 3rd habitual
        const pPres3 = findForm(
            ['3s|3s|present', '3s|present'],
            ['3rd present', '3rd person singular present']
        );
        const pres3 = pPres3 || (!isPartB && entry && !forms.some(f => (f.normalized_key || f.form_name) === '3s|3s|present') ? {
            translit: entry.Entry || entry.translit,
            tone: entry.Entry_Tone || entry.tone,
            tone2: entry.Entry_Tone || entry.tone2,
            syllabary: entry.Syllabary || entry.syllabary,
            audio: entry.Entry_Audio || entry.audio,
            form_name: '3s|3s|present'
        } : undefined);

        const hab3 = findForm(
            ['3s|3s|habitual', '3s|habitual'],
            ['3rd habitual', 'present habitual', 'habitual']
        );

        // Slot 7 & 8: Always Set B
        const pInf3 = findForm(
            ['3s|3s|infinitive', '3s|infinitive'],
            ['infinitive', '3rd person singular infinitive']
        );
        const inf3 = pInf3 || (isPartB && entry && !forms.some(f => (f.normalized_key || f.form_name || '').includes('infinitive')) ? {
            translit: entry.Entry || entry.translit,
            tone: entry.Entry_Tone || entry.tone,
            tone2: entry.Entry_Tone || entry.tone2,
            syllabary: entry.Syllabary || entry.syllabary,
            is_auto_syllabary: entry.is_auto_syllabary,
            audio: entry.Entry_Audio || entry.audio,
            form_name: '3s|3s|infinitive'
        } : undefined);
        const past3 = findForm(
            ['3s|3s|completive past', '3s|3s|past', '3s|past', 'completive past'],
            ['completive past', 'remote past', '3rd past']
        );

        const defaultAbPronounSet: 'A' | 'B' = verbConfig?.pron?.set_type === 'b' ? 'B' : 'A';
        const partBCrossRefId = entry?.combined_part_b_id || ((entry?.id || entry?.Index) ? `${entry.id || entry.Index}_b` : '');
        const partACrossRefId = entry?.combined_parent_id || ((entry?.id || entry?.Index || '').replace(/_b$/, ''));

        // Row 1: Person-to-person (only if at least one P2P form is present)
        if (p2p1 || p2p2) {
            rows.push({
                category: 'p2p',
                left: p2p1 ? {
                    slotKey: '1s|3a|present',
                    label: '1st Present (animate object)',
                    category: 'p2p',
                    form: p2p1,
                    pronominalSet: 'P2P'
                } : null,
                right: p2p2 ? {
                    slotKey: '2s|3a|imperative',
                    label: '2nd Imperative (animate object)',
                    category: 'p2p',
                    form: p2p2,
                    pronominalSet: 'P2P'
                } : null
            });
        }

        // Row 2: 1st present & 2nd imperative
        const imp2CrossRef = (!imp2 && hidePartBFromParent && shimFormsSet.has('imperative') && partBCrossRefId) ? {
            slotKey: '2s|3s|imperative',
            label: '2nd imperative',
            category: 'ab' as const,
            pronominalSet: defaultAbPronounSet,
            crossRef: {
                label: 'See CED Entry Part B',
                targetId: partBCrossRefId
            }
        } : null;

        if (pres1 || imp2 || imp2CrossRef) {
            const hasAnimateContrast = !!(p2p1 || p2p2);
            rows.push({
                category: 'ab',
                left: pres1 ? {
                    slotKey: '1s|3s|present',
                    label: (hasAnimateContrast || pres1.displayLabel?.toLowerCase().includes('inanimate')) ? '1st Present (inanimate object)' : '1st present',
                    category: 'ab',
                    form: pres1,
                    pronominalSet: defaultAbPronounSet
                } : null,
                right: imp2 ? {
                    slotKey: '2s|3s|imperative',
                    label: (hasAnimateContrast || imp2.displayLabel?.toLowerCase().includes('inanimate')) ? '2nd Imperative (inanimate object)' : '2nd imperative',
                    category: 'ab',
                    form: imp2,
                    pronominalSet: defaultAbPronounSet
                } : imp2CrossRef
            });
        }

        // Row 3: 3rd present & 3rd habitual
        const pres3CrossRef = (!pres3 && isPartB && partACrossRefId) ? {
            slotKey: '3s|3s|present',
            label: '3rd present',
            category: 'ab' as const,
            pronominalSet: defaultAbPronounSet,
            crossRef: {
                label: 'See CED Entry Part A',
                targetId: partACrossRefId
            }
        } : null;

        if (pres3 || hab3 || pres3CrossRef) {
            rows.push({
                category: 'ab',
                left: pres3 ? {
                    slotKey: '3s|3s|present',
                    label: '3rd present',
                    category: 'ab',
                    form: pres3,
                    pronominalSet: defaultAbPronounSet
                } : pres3CrossRef,
                right: hab3 ? {
                    slotKey: '3s|3s|habitual',
                    label: '3rd habitual',
                    category: 'ab',
                    form: hab3,
                    pronominalSet: defaultAbPronounSet
                } : null
            });
        }

        // Row 4: 3rd past & 3rd infinitive
        const inf3CrossRef = (!inf3 && hidePartBFromParent && shimFormsSet.has('infinitive') && partBCrossRefId) ? {
            slotKey: '3s|3s|infinitive',
            label: '3rd infinitive',
            category: 'set_b' as const,
            pronominalSet: 'B' as const,
            crossRef: {
                label: 'See CED Entry Part B',
                targetId: partBCrossRefId
            }
        } : null;

        if (past3 || inf3 || inf3CrossRef) {
            rows.push({
                category: 'set_b',
                left: past3 ? {
                    slotKey: '3s|3s|completive past',
                    label: '3rd past',
                    category: 'set_b',
                    form: past3,
                    pronominalSet: 'B'
                } : null,
                right: inf3 ? {
                    slotKey: '3s|3s|infinitive',
                    label: '3rd infinitive',
                    category: 'set_b',
                    form: inf3,
                    pronominalSet: 'B'
                } : inf3CrossRef
            });
        }

        matchedForms = new Set([p2p1, p2p2, pres1, imp2, pPres3, hab3, pInf3, past3].filter(Boolean));
    }

    const displayedCards = rows.flatMap(r => [r.left, r.right]).filter((c): c is ReferenceFormCardData => c != null && (c.form != null || c.crossRef != null));
    const hasMiniPreview = isPartB ? displayedCards.length >= 1 : displayedCards.length > 1;

    return {
        rows,
        displayedCards,
        matchedForms,
        hasMiniPreview
    };
}

export const ReferenceFormsPreview: React.FC<ReferenceFormsPreviewProps> = ({
    entry,
    forms = [],
    rootEntry,
    settings,
    columns,
    onViewEntry: _onViewEntry,
    onPlayAudio,
    playingAudioId,
    onOpenAllForms,
    className = '',
    userAudioMeta
}) => {
    const cols = columns ?? (settings?.miniConjugationsColumns === 1 ? 1 : 2);
    const showTone = settings?.showToneInForms !== false;
    const colorSegments = settings?.colorWordSegments !== false;
    const verbConfig = rootEntry?.config || entry?.config;

    let packages: any[] = [];
    let getPackageColor = (_id: string): string | undefined => undefined;
    try {
        const pm = usePackageManager();
        if (pm) {
            packages = pm.packages;
            getPackageColor = pm.getPackageColor;
        }
    } catch (_) {}

    let corpusAudioMeta: Record<string, any[]> = {};
    let corpusDictionaryMap: Map<string, any> | undefined;
    try {
        const corpus = useCorpus();
        if (corpus) {
            corpusAudioMeta = corpus.userAudioMeta;
            corpusDictionaryMap = corpus.dictionaryMap;
        }
    } catch (_) {}

    const effectiveUserAudioMeta = userAudioMeta || corpusAudioMeta;

    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    const [localPlayingId, setLocalPlayingId] = useState<string | null>(null);

    const activeAudiosForThisEntry = useMemo(() => {
        const entryKeys = [
            entry?.Index,
            entry?.id,
            entry?.merged_id,
            (entry as any)?.sources?.['lily-dict.csv']?.Index,
            rootEntry?.entry_id
        ].filter(Boolean);

        const map = new Map<string, any>();
        entryKeys.forEach(k => {
            const list = effectiveUserAudioMeta[k];
            if (Array.isArray(list)) {
                list.forEach(item => {
                    if (item?.id && !map.has(item.id)) {
                        map.set(item.id, item);
                    }
                });
            }
        });

        return Array.from(map.values()).filter(audio => {
            if (!audio.packageId || audio.packageId === 'user') {
                const userPkg = packages.find(p => p.id === 'user');
                return userPkg ? userPkg.status === 'active' : true;
            }
            const pkg = packages.find(p => p.id === audio.packageId);
            return pkg && pkg.status === 'active';
        });
    }, [effectiveUserAudioMeta, entry, rootEntry, packages]);

    const getFormAudios = (form: any) => {
        if (!form) return [];
        const result: any[] = [];
        const seenIds = new Set<string>();

        // 1. Official audio or direct form audio from form.audio / form.Word_Audio
        const directAudio = form.audio || form.Word_Audio;
        if (directAudio) {
            const isOfficialDirect = !form.packageId || form.packageId === 'official-cherokee-data' || form.packageId === 'ced' || form.source === 'ced';
            const pkg = form.packageId ? packages.find(p => p.id === form.packageId) : null;
            const isOfficial = pkg ? pkg.type === 'official' : isOfficialDirect;
            const color = isOfficial ? undefined : getPackageColor(form.packageId || 'user');
            result.push({
                id: directAudio,
                audio: directAudio,
                isOfficial,
                isUser: false,
                packageId: form.packageId || (isOfficial ? 'official-cherokee-data' : 'user'),
                color,
                speaker: isOfficial ? 'Official' : (form.pkgName || 'Package')
            });
            seenIds.add(directAudio);
        }

        // 2. Audio from userAudioMeta (user recordings or package-imported audios)
        const formIndex = form.index;
        const formRegex = formIndex !== undefined ? new RegExp(`(?:_F|\\.)${formIndex}(?:_|$)`) : null;
        const rawSlug = form.translit || form.Practical || form.Entry || '';
        const translitSlug = cleanStr(rawSlug).toLowerCase().replace(/[^a-z0-9]/g, '');

        activeAudiosForThisEntry.forEach(audio => {
            if (seenIds.has(audio.id)) return;

            let matches = false;
            if (formIndex !== undefined) {
                if (formRegex && formRegex.test(audio.id)) {
                    matches = true;
                } else if (audio.formIndex === formIndex) {
                    matches = true;
                } else if (audio.id.includes(`.${formIndex}_`) || audio.id.includes(`_F${formIndex}_`)) {
                    matches = true;
                }
            }

            // Fallback match: if audio id includes _F[0-9]+_[translitSlug]_
            if (!matches && translitSlug && translitSlug.length >= 3) {
                const lowerId = audio.id.toLowerCase();
                if (lowerId.includes(`_${translitSlug}_`) && (lowerId.includes('_f') || lowerId.includes(`_${entry?.Index}.`))) {
                    matches = true;
                }
            }

            if (matches) {
                const audioPkg = packages.find(p => p.id === audio.packageId);
                const isOfficial = audioPkg ? audioPkg.type === 'official' : (audio.packageId?.startsWith('official') || false);
                const isUser = !audio.packageId || audio.packageId === 'user';
                const pkgColor = isOfficial ? undefined : getPackageColor(audio.packageId || 'user');
                const effectiveColor = isUser ? '#f59e0b' : (pkgColor || '#f59e0b');

                result.push({
                    id: audio.id,
                    audio: audio.id,
                    isOfficial,
                    isUser,
                    packageId: audio.packageId || 'user',
                    color: effectiveColor,
                    speaker: audio.speaker || (isUser ? 'User' : 'Package')
                });
                seenIds.add(audio.id);
            }
        });

        return result;
    };

    const handleAudioClick = (e: React.MouseEvent, audioItem: any) => {
        e.stopPropagation();
        const audioSrc = audioItem.id || audioItem.audio;
        if (!audioSrc) return;

        if (onPlayAudio) {
            onPlayAudio({
                ...audioItem,
                id: audioSrc,
                audio: audioSrc,
                packageId: audioItem.packageId || (audioItem.isOfficial ? 'official-cherokee-data' : 'user'),
                pkgType: audioItem.isOfficial ? 'official' : (audioItem.isUser ? 'user' : 'imported')
            });
            return;
        }

        // Direct fallback playback
        if (!localAudioRef.current) {
            localAudioRef.current = new Audio();
        }
        const player = localAudioRef.current;

        if (localPlayingId === audioSrc) {
            player.pause();
            setLocalPlayingId(null);
            return;
        }

        const isOfficial = audioItem.isOfficial || 
            audioSrc.startsWith('Word_') || 
            audioSrc.match(/^\d{4}\./) || 
            audioSrc.endsWith('.m4a');

        if (isOfficial) {
            player.src = audioSrc.startsWith('http') ? audioSrc : `https://cherokeenationdictionary.net/Audio/word/${audioSrc}`;
            player.onended = () => setLocalPlayingId(null);
            player.play().catch(err => console.error("Failed to play audio:", err));
            setLocalPlayingId(audioSrc);
        } else {
            getAudioFromDB(audioSrc).then(data => {
                if (data) {
                    const blob = new Blob([data as Blob], { type: 'audio/mp3' });
                    const url = URL.createObjectURL(blob);
                    player.src = url;
                    player.onended = () => {
                        setLocalPlayingId(null);
                        URL.revokeObjectURL(url);
                    };
                    player.play().catch(err => console.error("Failed to play audio:", err));
                    setLocalPlayingId(audioSrc);
                }
            });
        }
    };

    const { rows, hasMiniPreview } = useMemo(() => {
        return getReferencePreviewMatchedForms(forms, entry, rootEntry, settings);
    }, [forms, entry, rootEntry, settings]);

    if (!hasMiniPreview) {
        return null;
    }

    const renderCard = (cardData: ReferenceFormCardData | null, fallbackKey: string) => {
        if (cardData && cardData.crossRef && !cardData.form) {
            const style = CATEGORY_STYLES[cardData.category] || CATEGORY_STYLES.ab;
            return (
                <button
                    key={cardData.slotKey}
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        const target = corpusDictionaryMap?.get(cardData.crossRef!.targetId);
                        if (target && _onViewEntry) {
                            _onViewEntry(target);
                        }
                    }}
                    className="p-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 flex flex-col justify-between items-start text-left transition-all min-h-[84px] cursor-pointer group"
                >
                    <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider break-words leading-tight ${style.label}`}>
                        {cardData.label}
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 group-hover:underline my-auto">
                        {cardData.crossRef.label} →
                    </span>
                </button>
            );
        }

        if (!cardData || !cardData.form) {
            return (
                <div
                    key={fallbackKey}
                    className="p-3 rounded-xl border border-dashed border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center items-center opacity-40 min-h-[84px]"
                >
                    <span className="text-[11px] uppercase tracking-wider text-slate-400">---</span>
                </div>
            );
        }

        const { form, label, category, pronominalSet } = cardData;
        const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.ab;

        const hdFormName = SLOT_TO_HD_FORM[cardData.slotKey];
        const hdSegments = resolveRoleTaggedSegments(form, rootEntry, hdFormName, settings);
        const translitStyle = getTransliterationStyleSetting(settings);
        const toneOrthography = getToneOrthographySetting(settings);
        const showLengthInTranslit = getShowLengthInTranslitSetting(settings);
        const rawToneSource = form.tone1 || form.tone || form.tone2 || form.Entry_Tone || '';
        const practicalStr = form.translit || form.Practical || form.Entry || '';

        // Determine surface text
        const isCed = isCedForm(form, entry);
        let surface = '';
        if (isCed && showTone && rawToneSource && hasToneMarks(rawToneSource)) {
            surface = convertToneText(rawToneSource, toneOrthography, translitStyle, practicalStr);
        } else {
            surface = getFormTransliteration(form, rootEntry, hdFormName, settings) || (isCed ? formatTranslitWithLength(practicalStr, rawToneSource, showLengthInTranslit, translitStyle) : convertConsonantsToStyle(practicalStr, translitStyle));
        }

        // Split on semicolon if multiple forms exist: color the primary form matching King parse, render remainder uncolored
        let primarySurface = surface;
        let remainderSurface = '';
        if (surface.includes(';')) {
            const parts = surface.split(';');
            primarySurface = parts[0].trim();
            remainderSurface = '; ' + parts.slice(1).map(p => p.trim()).join('; ');
        }

        const syllabary = form.syllabary || form.Syllabary || '';

        // Derive segmented groups only if linked to King recreation rootEntry and no exact hdSegments
        let groups: SegmentGroup[] | null = null;
        if (rootEntry && !hdSegments) {
            const derivedSeg = deriveSegmentedForm(form, forms, rootEntry);
            if (derivedSeg) {
                const formName = cardData.slotKey.split('|')[2] || 'present';
                groups = segmentVerbForm(derivedSeg, formName, verbConfig, rootEntry?.class_name, rootEntry?.post_root_morpheme);
            }
        }

        const formAudios = getFormAudios(form);

        return (
            <div
                key={cardData.slotKey}
                onClick={onOpenAllForms ? () => onOpenAllForms() : undefined}
                className={`relative flex flex-col justify-between p-3 rounded-xl shadow-sm transition-all duration-150 min-w-0 ${onOpenAllForms ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''} ${style.bg} ${style.border}`}
                title={onOpenAllForms ? 'Click to view all forms' : undefined}
            >
                {/* Card Top: Small Label & optional Audio buttons */}
                <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider break-words leading-tight ${style.label}`}>
                        {label}
                    </span>
                    {formAudios.length > 0 && (
                        <div className="flex items-center gap-1 shrink-0 -mr-0.5 -mt-0.5" onClick={e => e.stopPropagation()}>
                            {formAudios.map((audioItem: any) => {
                                const isPlaying = Boolean(
                                    (playingAudioId && (playingAudioId === audioItem.id || playingAudioId === audioItem.audio)) ||
                                    (localPlayingId && (localPlayingId === audioItem.id || localPlayingId === audioItem.audio))
                                );

                                let btnClass = "w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ";
                                let btnStyle: React.CSSProperties = {};

                                if (isPlaying) {
                                    btnClass += "bg-amber-100 dark:bg-amber-900/50 text-amber-600 ring-2 ring-amber-400 scale-105";
                                } else if (audioItem.isOfficial) {
                                    btnClass += "bg-slate-200/90 dark:bg-slate-700/90 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-700 opacity-85 hover:opacity-100";
                                } else if (audioItem.isUser) {
                                    // User-generated audio: small gold circle around it
                                    btnClass += "bg-amber-500 text-white shadow-xs hover:bg-amber-600 hover:scale-105 ring-1.5 ring-amber-400/60";
                                } else if (audioItem.color) {
                                    // Package imported audio: correct package color
                                    const c = audioItem.color;
                                    if (c.startsWith('#')) {
                                        btnStyle = { backgroundColor: c, color: '#fff' };
                                        btnClass += "shadow-xs hover:brightness-110 hover:scale-105 ring-1.5 ring-white/30";
                                    } else if (c === 'gold' || c === 'amber') {
                                        btnClass += "bg-amber-500 text-white hover:bg-amber-600 shadow-xs hover:scale-105 ring-1.5 ring-amber-400/60";
                                    } else {
                                        btnClass += `bg-${c}-500 text-white hover:bg-${c}-600 shadow-xs hover:scale-105 ring-1.5 ring-white/30`;
                                    }
                                } else {
                                    btnClass += "bg-amber-500 text-white hover:bg-amber-600 shadow-xs hover:scale-105 ring-1.5 ring-amber-400/60";
                                }

                                const title = audioItem.isOfficial
                                    ? (isPlaying ? "Pause official audio" : "Play official audio")
                                    : (audioItem.isUser
                                        ? (isPlaying ? `Pause audio (${audioItem.speaker || 'User'})` : `Play user audio (${audioItem.speaker || 'User'})`)
                                        : (isPlaying ? `Pause audio (${audioItem.speaker || 'Package'})` : `Play package audio (${audioItem.speaker || 'Package'})`));

                                return (
                                    <button
                                        key={audioItem.id}
                                        type="button"
                                        onClick={(e) => handleAudioClick(e, audioItem)}
                                        className={btnClass}
                                        style={btnStyle}
                                        title={title}
                                    >
                                        {isPlaying ? <Pause size={10} className="fill-current" /> : <Volume2 size={10} className="fill-current" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Swapped: Translit / Tone on top */}
                <div className={`font-serif text-base sm:text-lg font-bold leading-tight break-words my-0.5 ${style.translit}`}>
                    {hdSegments ? (
                        <>
                            {(() => {
                                const hasTone = Boolean(rawToneSource && hasToneMarks(rawToneSource));
                                const shouldProject = isCed && hasTone && (showTone || showLengthInTranslit);
                                const displaySegments = shouldProject
                                    ? projectToneOrLengthOntoSegments(hdSegments, rawToneSource, {
                                          showTone: showTone && hasTone,
                                          toneOrthography,
                                          showLengthInTranslit,
                                          translitStyle,
                                          practicalStr
                                      })
                                    : hdSegments;
                                const finalSegs = (pronominalSet === 'P2P' || cardData.category === 'p2p')
                                    ? displaySegments.map(s => s.role === 'pronoun' ? { ...s, color: 'Purple', set: 'P2P' as const } : s)
                                    : displaySegments;
                                return renderSegmentedSurface(finalSegs, colorSegments);
                            })()}
                            {remainderSurface && (
                                <span className="font-normal opacity-75">{remainderSurface}</span>
                            )}
                        </>
                    ) : (
                        <>
                            {renderColorizedCherokee(primarySurface, groups, pronominalSet, colorSegments)}
                            {remainderSurface && (
                                <span className="font-normal opacity-75">{remainderSurface}</span>
                            )}
                        </>
                    )}
                </div>

                {/* Swapped: Syllabary on bottom */}
                <div className={`font-noto-cherokee text-lg sm:text-xl font-medium leading-tight break-words mt-0.5 flex items-center gap-1.5 flex-wrap ${style.syllabary}`}>
                    <span className="break-words">{syllabary}</span>
                    {form.is_auto_syllabary && (
                        <TranslateCherokee size={14} className="inline-block text-amber-600 dark:text-amber-400 opacity-80 shrink-0" title="Auto-transliterated syllabary" />
                    )}
                </div>
            </div>
        );
    };

    const combinedMode = getCombinedCedVerbsMode(settings);
    const separateFormsInEntry = combinedMode === 'forms' && !entry?.is_combined_part_b && !rootEntry?.is_combined_part_b;
    const isCardShim = (card: ReferenceFormCardData | null): boolean => {
        if (!card || !card.form) return false;
        if (card.form.is_shim) return true;
        const hdName = SLOT_TO_HD_FORM[card.slotKey];
        return Boolean(hdName && rootEntry?.shim_forms?.includes(hdName));
    };

    const shimCards = separateFormsInEntry
        ? rows.flatMap(r => [r.left, r.right]).filter((c): c is ReferenceFormCardData => c != null && isCardShim(c))
        : [];

    const mainRows = separateFormsInEntry && shimCards.length > 0
        ? rows.map(r => ({
            ...r,
            left: isCardShim(r.left) ? null : r.left,
            right: isCardShim(r.right) ? null : r.right,
        })).filter(r => r.left != null || r.right != null)
        : rows;

    const shimClass = shimCards.find(c => c.form?.shim_class)?.form?.shim_class || rootEntry?.shim_class;

    return (
        <div className={`space-y-2.5 ${className}`}>
            {/* Main Grid */}
            <div className={`grid ${cols === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 sm:gap-3`}>
                {mainRows.map((row, idx) => (
                    <React.Fragment key={idx}>
                        {renderCard(row.left, `row-${idx}-left`)}
                        {renderCard(row.right, `row-${idx}-right`)}
                    </React.Fragment>
                ))}
            </div>
            {shimCards.length > 0 && (
                <div className="pt-2 border-t border-dashed border-slate-200 dark:border-slate-700/70">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-2 px-0.5">
                        Combined CED Verb — Part B{shimClass ? ` (${shimClass})` : ''}
                    </div>
                    <div className={`grid ${cols === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5 sm:gap-3`}>
                        {shimCards.map((card, idx) => renderCard(card, `shim-${idx}`))}
                    </div>
                </div>
            )}
        </div>
    );
};

export interface DesktopHorizontalFormsStripProps {
    entry?: any;
    forms: any[];
    rootEntry?: any;
    settings?: any;
    onOpenAllForms?: () => void;
    className?: string;
}

const VERB_CANONICAL_SLOTS = [
    '1s|3a|present',
    '2s|3a|imperative',
    '1s|3s|present',
    '2s|3s|imperative',
    '3s|3s|present',
    '3s|3s|habitual',
    '3s|3s|completive past',
    '3s|3s|infinitive',
];

export const DesktopHorizontalFormsStrip: React.FC<DesktopHorizontalFormsStripProps> = ({
    entry,
    forms = [],
    rootEntry,
    settings,
    onOpenAllForms,
    className = ""
}) => {
    const showTone = settings?.showToneInForms !== false;
    const colorSegments = settings?.colorWordSegments !== false;
    const verbConfig = rootEntry?.config || entry?.config;

    const { displayedCards, hasMiniPreview } = useMemo(() => {
        return getReferencePreviewMatchedForms(forms, entry, rootEntry, settings);
    }, [forms, entry, rootEntry, settings]);

    if (!hasMiniPreview || displayedCards.length === 0) {
        return null;
    }

    const isNoun = displayedCards.some(c => c.slotKey.startsWith('noun|'));
    const slotsToRender = isNoun ? displayedCards.map(c => c.slotKey) : VERB_CANONICAL_SLOTS;
    const cardsBySlot = new Map(displayedCards.map(c => [c.slotKey, c]));

    const renderCardCell = (cardData: ReferenceFormCardData) => {
        const { form, label, category, pronominalSet } = cardData;
        if (!form) return null;

        const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.ab;
        const compactLabel = COMPACT_SLOT_LABELS[cardData.slotKey] || label;

        const hdFormName = SLOT_TO_HD_FORM[cardData.slotKey];
        const hdSegments = resolveRoleTaggedSegments(form, rootEntry, hdFormName, settings);
        const translitStyle = getTransliterationStyleSetting(settings);
        const toneOrthography = getToneOrthographySetting(settings);
        const showLengthInTranslit = getShowLengthInTranslitSetting(settings);
        const rawToneSource = form.tone1 || form.tone || form.tone2 || form.Entry_Tone || '';
        const practicalStr = form.translit || form.Practical || form.Entry || '';

        const isCed = isCedForm(form, entry);
        let surface = '';
        if (isCed && showTone && rawToneSource && hasToneMarks(rawToneSource)) {
            surface = convertToneText(rawToneSource, toneOrthography, translitStyle, practicalStr);
        } else {
            surface = getFormTransliteration(form, rootEntry, hdFormName, settings) || (isCed ? formatTranslitWithLength(practicalStr, rawToneSource, showLengthInTranslit, translitStyle) : convertConsonantsToStyle(practicalStr, translitStyle));
        }

        let primarySurface = surface;
        if (surface.includes(';')) {
            primarySurface = surface.split(';')[0].trim();
        }

        const syllabary = form.syllabary || form.Syllabary || '';

        let groups: SegmentGroup[] | null = null;
        if (rootEntry && !hdSegments) {
            const derivedSeg = deriveSegmentedForm(form, forms, rootEntry);
            if (derivedSeg) {
                const formName = cardData.slotKey.split('|')[2] || 'present';
                groups = segmentVerbForm(derivedSeg, formName, verbConfig, rootEntry?.class_name, rootEntry?.post_root_morpheme);
            }
        }

        return (
            <div
                key={cardData.slotKey}
                className={`min-w-0 p-[2px] rounded-lg text-center flex flex-col justify-between transition-all duration-150 ${style.bg} ${style.border}`}
            >
                <span className={`text-[9px] uppercase tracking-wider leading-tight font-bold mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis ${style.label}`}>
                    {compactLabel}
                </span>
                <div className={`font-serif text-xs font-bold leading-snug break-words my-0.5 ${style.translit}`}>
                    {hdSegments ? (
                        <>
                            {(() => {
                                const hasTone = Boolean(rawToneSource && hasToneMarks(rawToneSource));
                                const shouldProject = isCed && hasTone && (showTone || showLengthInTranslit);
                                const displaySegments = shouldProject
                                    ? projectToneOrLengthOntoSegments(hdSegments, rawToneSource, {
                                          showTone: showTone && hasTone,
                                          toneOrthography,
                                          showLengthInTranslit,
                                          translitStyle,
                                          practicalStr
                                      })
                                    : hdSegments;
                                const finalSegs = (pronominalSet === 'P2P' || cardData.category === 'p2p')
                                    ? displaySegments.map(s => s.role === 'pronoun' ? { ...s, color: 'Purple', set: 'P2P' as const } : s)
                                    : displaySegments;
                                return renderSegmentedSurface(finalSegs, colorSegments);
                            })()}
                        </>
                    ) : (
                        renderColorizedCherokee(primarySurface, groups, pronominalSet, colorSegments)
                    )}
                </div>
                {syllabary && (
                    <span className={`font-noto-cherokee text-[11px] leading-snug break-words mt-0.5 inline-flex items-center justify-center gap-0.5 ${style.syllabary}`}>
                        <span>{syllabary}</span>
                        {form.is_auto_syllabary && (
                            <TranslateCherokee size={10} className="inline-block text-amber-600 dark:text-amber-400 opacity-80 shrink-0" title="Auto-transliterated syllabary" />
                        )}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div
            onClick={onOpenAllForms}
            className={`grid ${isNoun ? 'grid-cols-2 max-w-sm' : 'grid-cols-8 min-w-[760px]'} gap-2 w-full py-0.5 ${onOpenAllForms ? 'cursor-pointer' : ''} ${className}`}
            title={onOpenAllForms ? 'Click to view all forms' : undefined}
        >
            {slotsToRender.map(slotKey => {
                const card = cardsBySlot.get(slotKey);
                if (!card || !card.form) {
                    return (
                        <div
                            key={`empty-${slotKey}`}
                            className="min-w-0 p-[2px] rounded-lg border border-transparent"
                            aria-hidden="true"
                        />
                    );
                }
                return renderCardCell(card);
            })}
        </div>
    );
};

export default ReferenceFormsPreview;
