import React, { useMemo, useRef, useState } from 'react';
import { Volume2, Pause } from './Icons';
import {
    renderColorizedCherokee,
    renderSegmentedSurface,
    projectSegmentsOntoTone,
    segmentVerbForm,
    deriveSegmentedForm,
    getAudioFromDB,
    cleanStr,
    SegmentGroup
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

export interface ReferenceFormCardData {
    slotKey: string;
    label: string;
    category: 'p2p' | 'ab' | 'set_b' | 'noun';
    form?: any;
    pronominalSet: 'A' | 'B' | 'P2P';
}

interface ReferenceFormsPreviewProps {
    entry?: any;
    forms: any[];
    rootEntry?: any;
    settings?: {
        showToneInForms?: boolean;
        colorWordSegments?: boolean;
        [key: string]: any;
    };
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
    forms: any[] = [],
    entry?: any,
    rootEntry?: any
): {
    rows: ReferencePreviewRow[];
    displayedCards: ReferenceFormCardData[];
    matchedForms: Set<any>;
    hasMiniPreview: boolean;
} {
    const verbConfig = rootEntry?.config || entry?.config;

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
        const pres3 = pPres3 || (entry && !forms.some(f => (f.normalized_key || f.form_name) === '3s|3s|present') ? {
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
        const inf3 = findForm(
            ['3s|3s|infinitive', '3s|infinitive'],
            ['infinitive', '3rd person singular infinitive']
        );
        const past3 = findForm(
            ['3s|3s|completive past', '3s|3s|past', '3s|past', 'completive past'],
            ['completive past', 'remote past', '3rd past']
        );

        const defaultAbPronounSet: 'A' | 'B' = verbConfig?.pron?.set_type === 'b' ? 'B' : 'A';

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
        if (pres1 || imp2) {
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
                } : null
            });
        }

        // Row 3: 3rd present & 3rd habitual
        if (pres3 || hab3) {
            rows.push({
                category: 'ab',
                left: pres3 ? {
                    slotKey: '3s|3s|present',
                    label: '3rd present',
                    category: 'ab',
                    form: pres3,
                    pronominalSet: defaultAbPronounSet
                } : null,
                right: hab3 ? {
                    slotKey: '3s|3s|habitual',
                    label: '3rd habitual',
                    category: 'ab',
                    form: hab3,
                    pronominalSet: defaultAbPronounSet
                } : null
            });
        }

        // Row 4: 3rd infinitive & 3rd past
        if (inf3 || past3) {
            rows.push({
                category: 'set_b',
                left: inf3 ? {
                    slotKey: '3s|3s|infinitive',
                    label: '3rd infinitive',
                    category: 'set_b',
                    form: inf3,
                    pronominalSet: 'B'
                } : null,
                right: past3 ? {
                    slotKey: '3s|3s|completive past',
                    label: '3rd past',
                    category: 'set_b',
                    form: past3,
                    pronominalSet: 'B'
                } : null
            });
        }

        matchedForms = new Set([p2p1, p2p2, pres1, imp2, pPres3, hab3, inf3, past3].filter(Boolean));
    }

    const displayedCards = rows.flatMap(r => [r.left, r.right]).filter((c): c is ReferenceFormCardData => c != null && c.form != null);
    const hasMiniPreview = displayedCards.length > 1;

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
    onViewEntry: _onViewEntry,
    onPlayAudio,
    playingAudioId,
    onOpenAllForms,
    className = '',
    userAudioMeta
}) => {
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
    try {
        const corpus = useCorpus();
        if (corpus) {
            corpusAudioMeta = corpus.userAudioMeta;
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
        return getReferencePreviewMatchedForms(forms, entry, rootEntry);
    }, [forms, entry, rootEntry]);

    if (!hasMiniPreview) {
        return null;
    }

    // Styling constants: transparent background with colored border
    const CATEGORY_STYLES: Record<string, any> = {
        p2p: {
            bg: 'bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
            border: 'border-2 border-purple-300 dark:border-purple-700/60',
            label: 'text-purple-700 dark:text-purple-300 font-bold',
            translit: 'text-slate-900 dark:text-slate-100 font-medium',
            syllabary: 'text-slate-600 dark:text-slate-400'
        },
        ab: {
            bg: 'bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
            border: 'border-2 border-rose-300 dark:border-rose-700/60',
            label: 'text-rose-700 dark:text-rose-300 font-bold',
            translit: 'text-slate-900 dark:text-slate-100 font-medium',
            syllabary: 'text-slate-600 dark:text-slate-400'
        },
        set_b: {
            bg: 'bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
            border: 'border-2 border-sky-300 dark:border-sky-700/60',
            label: 'text-sky-700 dark:text-sky-300 font-bold',
            translit: 'text-slate-900 dark:text-slate-100 font-medium',
            syllabary: 'text-slate-600 dark:text-slate-400'
        },
        noun: {
            bg: 'bg-transparent hover:bg-slate-50/60 dark:hover:bg-slate-800/40',
            border: 'border-2 border-slate-300 dark:border-slate-700',
            label: 'text-slate-600 dark:text-slate-400 font-bold',
            translit: 'text-slate-900 dark:text-slate-100 font-medium',
            syllabary: 'text-slate-600 dark:text-slate-400'
        }
    };

    const renderCard = (cardData: ReferenceFormCardData | null, fallbackKey: string) => {
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
        const hdSegments = form.surface_segments || (hdFormName && rootEntry?.surface_segments ? rootEntry.surface_segments[hdFormName] : undefined);

        // Determine surface text
        let surface = '';
        if (showTone) {
            surface = form.tone2 || form.tone || form.Entry_Tone || form.translit || form.Practical || form.Entry || '';
        } else {
            surface = form.translit || form.Practical || form.Entry || form.tone || '';
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
                onClick={() => onOpenAllForms?.()}
                className={`relative flex flex-col justify-between p-3 rounded-xl shadow-sm transition-all duration-150 min-w-0 ${onOpenAllForms ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''} ${style.bg} ${style.border}`}
                title={onOpenAllForms ? 'Click to view all forms' : undefined}
            >
                {/* Card Top: Small Label & optional Audio buttons */}
                <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-[10px] sm:text-[11px] uppercase tracking-wider truncate leading-tight ${style.label}`}>
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
                <div className={`font-serif text-base sm:text-lg font-bold leading-tight truncate my-0.5 ${style.translit}`}>
                    {hdSegments ? (
                        <>
                            {renderSegmentedSurface(
                                showTone && primarySurface
                                    ? projectSegmentsOntoTone(hdSegments, primarySurface)
                                    : hdSegments,
                                colorSegments
                            )}
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
                <div className={`font-noto-cherokee text-lg sm:text-xl font-medium leading-tight truncate mt-0.5 ${style.syllabary}`}>
                    {syllabary}
                </div>
            </div>
        );
    };

    return (
        <div className={`space-y-2.5 ${className}`}>
            {/* Main 2-Column Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                {rows.map((row, idx) => (
                    <React.Fragment key={idx}>
                        {renderCard(row.left, `row-${idx}-left`)}
                        {renderCard(row.right, `row-${idx}-right`)}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

export default ReferenceFormsPreview;
