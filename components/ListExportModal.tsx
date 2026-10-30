import React, { useState, useMemo } from 'react';
import { Modal } from './UI';
import { Copy, Download, Printer, Check, ArrowLeft } from './Icons';
import {
    downloadFile,
    processFormsContextually,
    getCombinedCedVerbsMode,
    getFormTransliteration,
    getFormToneDisplay,
    formatTranslitWithLength,
    getShowLengthInTranslitSetting,
    getTransliterationStyleSetting,
    getToneOrthographySetting,
    convertConsonantsToStyle,
    convertToneText,
    hasToneMarks,
    resolveHdFormName,
    parseListName
} from '../utils';
import { getReferencePreviewMatchedForms } from './ReferenceFormsPreview';

export type StudyFieldKey = 'syllabary' | 'translit' | 'tone' | 'english' | 'notes';

export interface StudyRowData {
    id: string;
    itemType: 'word' | 'sentence';
    isExpandedForm: boolean;
    word?: any;
    sentence?: any;
    form?: any;
    slotKey?: string;
    formLabel?: string;
    rootEntry?: any;
    syllabary: string;
    translit: string;
    tone: string; // Falls back to translit when item has no distinct tone
    hasDistinctTone: boolean;
    english: string;
    baseEnglish: string;
    notes: string;
}

export function buildStudyRowsForItems(
    items: { type: 'word' | 'sentence'; data: any }[],
    options: {
        expandVerbForms: boolean;
        packages: any[];
        importedData: Record<string, any>;
        rootMap?: Map<string, any>;
        settings?: any;
        userNotes?: Record<string, string>;
        customDictionaries?: Record<string, any>;
    }
): StudyRowData[] {
    const {
        expandVerbForms,
        packages = [],
        importedData = {},
        rootMap,
        settings,
        userNotes = {},
        customDictionaries = {}
    } = options;

    const translitStyle = getTransliterationStyleSetting(settings);
    const toneOrthography = getToneOrthographySetting(settings);
    const showLength = getShowLengthInTranslitSetting(settings);
    const combinedMode = getCombinedCedVerbsMode(settings);

    const rows: StudyRowData[] = [];

    items.forEach(item => {
        if (!item || !item.data) return;

        if (item.type === 'word') {
            const word = item.data;
            const wordKey = word?.Index || word?.id || word?.merged_id || '';
            const rootEntry = word
                ? (rootMap?.get(word.Index) || rootMap?.get(word.id) || rootMap?.get(word.merged_id) || null)
                : null;

            const isPersonal = Boolean(word?.Source && customDictionaries?.[word.Source]);
            const notes = (isPersonal ? (word.Notes || '') : (userNotes?.[word.Index] || '')).trim();
            const headwordEnglish = (word.Definition || word.definition || '').trim();

            if (expandVerbForms) {
                const entryIndex = word.Index || word.id;
                const hidePartBFromParent = !word.is_combined_part_b && combinedMode === 'full';
                const rawList: any[] = [];

                packages.forEach(p => {
                    if (p.status === 'active' && importedData[p.id]?.word_forms) {
                        const forms = importedData[p.id].word_forms.filter(
                            (f: any) => f.word_index === entryIndex && !(hidePartBFromParent && f.is_shim)
                        );
                        forms.forEach((f: any, idx: number) => {
                            rawList.push({
                                ...f,
                                _uid: f.id || `${p.id}_${f.word_index}_${f.normalized_key || f.form_name || ''}_${idx}`,
                                color: p.color,
                                pkgName: p.name,
                                pkgType: p.type,
                                packageId: p.id
                            });
                        });
                    }
                });

                const sorted = rawList.sort((a, b) => (a.order || 0) - (b.order || 0));
                const legacyOfficialFormsCount = word.Other_Forms ? word.Other_Forms.split('|').length : 0;
                const indexedForms = sorted.map((f, idx) => ({
                    ...f,
                    index: legacyOfficialFormsCount + idx + 1
                }));

                const rawCed = indexedForms.filter(f => f.source === 'ced');
                const formsForPreview = processFormsContextually(rawCed.length > 0 ? rawCed : indexedForms);
                const { displayedCards, hasMiniPreview } = getReferencePreviewMatchedForms(
                    formsForPreview,
                    word,
                    rootEntry,
                    settings
                );

                const verbSurfaceCards = displayedCards.filter(
                    c => c.form != null && c.category !== 'noun'
                );

                if (
                    verbSurfaceCards.length > 0 &&
                    (hasMiniPreview || verbSurfaceCards.length > 1 || Boolean(word.is_combined_part_b))
                ) {
                    verbSurfaceCards.forEach(card => {
                        const form = card.form;
                        const slotKey = card.slotKey;
                        const formLabel = card.label;
                        const hdSlot = resolveHdFormName(slotKey || form.normalized_key || form.form_name);

                        const syllabary = (form.syllabary || form.Syllabary || '').trim();
                        const practicalStr = form.translit || form.Practical || form.Entry || '';
                        const rawToneSource = form.tone1 || form.tone || form.tone2 || form.Entry_Tone || '';

                        const translit = (
                            getFormTransliteration(form, rootEntry, hdSlot, settings) ||
                            formatTranslitWithLength(practicalStr, rawToneSource, showLength, translitStyle) ||
                            practicalStr
                        ).trim();

                        const rawToneDisplay = getFormToneDisplay(form, word, settings).trim();
                        const tone = rawToneDisplay || translit;
                        const hasDistinctTone = Boolean(rawToneDisplay && rawToneDisplay !== translit);

                        const specificEnglish = (
                            form.notes ||
                            form.translations ||
                            form.translation ||
                            form.english ||
                            form.definition ||
                            ''
                        ).trim();
                        const baseEnglish = specificEnglish || headwordEnglish;
                        const english = baseEnglish ? `${baseEnglish} — [${formLabel}]` : `[${formLabel}]`;

                        rows.push({
                            id: `${wordKey}__${slotKey}`,
                            itemType: 'word',
                            isExpandedForm: true,
                            word,
                            form,
                            slotKey,
                            formLabel,
                            rootEntry,
                            syllabary,
                            translit,
                            tone,
                            hasDistinctTone,
                            english,
                            baseEnglish,
                            notes
                        });
                    });
                    return;
                }
            }

            // Standard headword row
            const syllabary = (word.Syllabary || word.syllabary || '').trim();
            const defaultSlot = (word?.is_combined_part_b || rootEntry?.is_combined_part_b) ? 'infinitive' : 'present';
            const rawWordTranslit = word.Entry || word.translit || '';
            const rawWordTone = word.Entry_Tone || word.tone1 || word.tone || '';

            const translit = (
                (rootEntry ? getFormTransliteration(null, rootEntry, defaultSlot, settings) : '') ||
                formatTranslitWithLength(rawWordTranslit, rawWordTone, showLength, translitStyle) ||
                rawWordTranslit
            ).trim();

            const rawToneDisplay = getFormToneDisplay(null, word, settings).trim();
            const tone = rawToneDisplay || translit;
            const hasDistinctTone = Boolean(rawToneDisplay && rawToneDisplay !== translit);

            rows.push({
                id: String(wordKey),
                itemType: 'word',
                isExpandedForm: false,
                word,
                form: null,
                rootEntry,
                syllabary,
                translit,
                tone,
                hasDistinctTone,
                english: headwordEnglish,
                baseEnglish: headwordEnglish,
                notes
            });
        } else if (item.type === 'sentence') {
            const sentence = item.data;
            const syllabary = (sentence.syllabary || sentence.Syllabary || '').replace(/\*/g, '').trim();
            const rawTranslit = (sentence.translit || sentence.Transliteration || '').replace(/\*/g, '').trim();
            const translit = convertConsonantsToStyle(rawTranslit, translitStyle).trim();

            const rawSentTone = (sentence.tone || sentence.Tone || '').replace(/\*/g, '').trim();
            const rawToneDisplay =
                rawSentTone && hasToneMarks(rawSentTone)
                    ? convertToneText(rawSentTone, toneOrthography, translitStyle, rawTranslit).trim()
                    : '';
            const tone = rawToneDisplay || translit;
            const hasDistinctTone = Boolean(rawToneDisplay && rawToneDisplay !== translit);

            const english = (sentence.english || sentence.English || '').replace(/\*/g, '').trim();
            const notes = (
                userNotes?.[`s_${sentence.id}`] ||
                userNotes?.[sentence.id] ||
                sentence.notes ||
                sentence.Notes ||
                ''
            ).trim();

            rows.push({
                id: `s_${sentence.id}`,
                itemType: 'sentence',
                isExpandedForm: false,
                sentence,
                syllabary,
                translit,
                tone,
                hasDistinctTone,
                english,
                baseEnglish: english,
                notes
            });
        }
    });

    return rows;
}

const FIELD_META: { key: StudyFieldKey; label: string; shortLabel: string }[] = [
    { key: 'syllabary', label: 'Syllabary', shortLabel: 'Syllabary' },
    { key: 'translit', label: 'Transliteration', shortLabel: 'Translit' },
    { key: 'tone', label: 'Tone (fallback to Translit)', shortLabel: 'Tone' },
    { key: 'english', label: 'English', shortLabel: 'English' },
    { key: 'notes', label: 'Notes', shortLabel: 'Notes' }
];

type ExportFormat = 'quizlet' | 'anki' | 'sheet' | 'csv';

interface ListExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    listName: string;
    listItems: { type: 'word' | 'sentence'; data: any }[];
    initialListMode: 'words' | 'sentences';
    initialExpandVerbForms?: boolean;
    packages: any[];
    importedData: Record<string, any>;
    rootMap?: Map<string, any>;
    settings?: any;
    userNotes?: Record<string, string>;
    customDictionaries?: Record<string, any>;
}

export const ListExportModal: React.FC<ListExportModalProps> = ({
    isOpen,
    onClose,
    listName,
    listItems,
    initialListMode,
    initialExpandVerbForms = false,
    packages,
    importedData,
    rootMap,
    settings,
    userNotes,
    customDictionaries
}) => {
    const [format, setFormat] = useState<ExportFormat>('quizlet');
    const [itemScope, setItemScope] = useState<'words' | 'sentences' | 'both'>(initialListMode);
    const [expandVerbForms, setExpandVerbForms] = useState<boolean>(initialExpandVerbForms);

    // Front / Back selection for Quizlet and Anki 2-column mode
    const [frontFields, setFrontFields] = useState<StudyFieldKey[]>(['syllabary', 'translit']);
    const [backFields, setBackFields] = useState<StudyFieldKey[]>(['english']);
    const [sideSeparator, setSideSeparator] = useState<'slash' | 'dash' | 'newline'>('slash');

    // Column selection for Anki (multi-column), Study Sheet, and CSV/JSON
    const [columnFields, setColumnFields] = useState<StudyFieldKey[]>(['syllabary', 'translit', 'tone', 'english']);
    const [ankiMode, setAnkiMode] = useState<'columns' | 'front_back'>('front_back');
    const [sheetLayout, setSheetLayout] = useState<'standard' | 'fold' | 'practice'>('standard');

    const [copiedState, setCopiedState] = useState<string | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            const wordCount = listItems.filter(i => i?.type === 'word').length;
            const sentCount = listItems.filter(i => i?.type === 'sentence').length;
            if (initialListMode === 'words' && wordCount === 0 && sentCount > 0) {
                setItemScope('sentences');
            } else if (initialListMode === 'sentences' && sentCount === 0 && wordCount > 0) {
                setItemScope('words');
            } else {
                setItemScope(initialListMode);
            }
            setExpandVerbForms(initialExpandVerbForms);
        }
    }, [isOpen, initialListMode, initialExpandVerbForms, listItems]);

    const wordItemsCount = useMemo(() => listItems.filter(i => i?.type === 'word').length, [listItems]);
    const sentenceItemsCount = useMemo(() => listItems.filter(i => i?.type === 'sentence').length, [listItems]);

    const scopedItems = useMemo(() => {
        if (itemScope === 'words') return listItems.filter(i => i?.type === 'word');
        if (itemScope === 'sentences') return listItems.filter(i => i?.type === 'sentence');
        return listItems;
    }, [listItems, itemScope]);

    const studyRows = useMemo(() => {
        return buildStudyRowsForItems(scopedItems, {
            expandVerbForms: expandVerbForms && itemScope !== 'sentences',
            packages,
            importedData,
            rootMap,
            settings,
            userNotes,
            customDictionaries
        });
    }, [scopedItems, expandVerbForms, itemScope, packages, importedData, rootMap, settings, userNotes, customDictionaries]);

    const { name: cleanDisplayName } = parseListName(listName);
    const safeFilenameBase = (cleanDisplayName || 'cherokee_list').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

    const toggleFrontField = (key: StudyFieldKey) => {
        setFrontFields(prev => (prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]));
    };

    const toggleBackField = (key: StudyFieldKey) => {
        setBackFields(prev => (prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]));
    };

    const toggleColumnField = (key: StudyFieldKey) => {
        setColumnFields(prev => (prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]));
    };

    const handleSwapFrontBack = () => {
        const temp = [...frontFields];
        setFrontFields([...backFields]);
        setBackFields(temp);
    };

    const formatSideText = (row: StudyRowData, fields: StudyFieldKey[], sepType: 'slash' | 'dash' | 'newline') => {
        const values: string[] = [];
        fields.forEach(f => {
            const val = (row[f] || '').trim();
            if (!val) return;
            // Avoid duplicating exact string if both translit and tone are checked and tone fell back to translit
            if (f === 'tone' && fields.includes('translit') && val === row.translit) return;
            if (!values.includes(val)) {
                values.push(val);
            }
        });
        const sep = sepType === 'newline' ? '\n' : sepType === 'dash' ? ' — ' : ' / ';
        return values.join(sep);
    };

    // Build Quizlet text
    const quizletText = useMemo(() => {
        return studyRows
            .map(row => {
                const front = formatSideText(row, frontFields, sideSeparator).replace(/\t/g, ' ');
                const back = formatSideText(row, backFields, sideSeparator).replace(/\t/g, ' ');
                return `${front}\t${back}`;
            })
            .join(sideSeparator === 'newline' ? '\n\n' : '\n');
    }, [studyRows, frontFields, backFields, sideSeparator]);

    // Build Anki TSV
    const ankiText = useMemo(() => {
        const headerLines = ['#separator:tab', '#html:true'];
        if (ankiMode === 'front_back') {
            headerLines.push('#columns:Front\tBack');
            const dataLines = studyRows.map(row => {
                const front = formatSideText(row, frontFields, 'newline').replace(/\t/g, ' ').replace(/\n/g, '<br>');
                const back = formatSideText(row, backFields, 'newline').replace(/\t/g, ' ').replace(/\n/g, '<br>');
                return `${front}\t${back}`;
            });
            return [...headerLines, ...dataLines].join('\n');
        } else {
            const colNames = columnFields.map(k => FIELD_META.find(m => m.key === k)?.shortLabel || k).join('\t');
            headerLines.push(`#columns:${colNames}`);
            const dataLines = studyRows.map(row =>
                columnFields.map(k => (row[k] || '').replace(/\t/g, ' ').replace(/\n/g, '<br>')).join('\t')
            );
            return [...headerLines, ...dataLines].join('\n');
        }
    }, [studyRows, ankiMode, frontFields, backFields, columnFields]);

    // Build CSV
    const csvText = useMemo(() => {
        const headers = columnFields.map(k => FIELD_META.find(m => m.key === k)?.shortLabel || k);
        const lines = [headers.join(',')];
        studyRows.forEach(row => {
            const vals = columnFields.map(k => `"${(row[k] || '').replace(/"/g, '""')}"`);
            lines.push(vals.join(','));
        });
        return lines.join('\n');
    }, [studyRows, columnFields]);

    // Build JSON
    const jsonText = useMemo(() => {
        const data = studyRows.map(row => {
            const obj: Record<string, string> = {};
            columnFields.forEach(k => {
                obj[k] = row[k] || '';
            });
            if (row.formLabel) obj.form = row.formLabel;
            return obj;
        });
        return JSON.stringify(data, null, 2);
    }, [studyRows, columnFields]);

    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedState(label);
            setTimeout(() => setCopiedState(null), 2000);
        } catch {
            // Fallback textarea copy
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopiedState(label);
            setTimeout(() => setCopiedState(null), 2000);
        }
    };

    const escapeHtml = (str: string) =>
        (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

    const handlePrint = () => {
        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            alert('Please allow pop-ups to open the print preview.');
            return;
        }

        let bodyHtml = '';

        if (format === 'sheet') {
            if (sheetLayout === 'fold') {
                const cherokeeKeys = columnFields.filter(k => k === 'syllabary' || k === 'translit' || k === 'tone');
                const englishKeys = columnFields.filter(k => k === 'english' || k === 'notes');
                const leftKeys: StudyFieldKey[] = cherokeeKeys.length > 0 ? cherokeeKeys : ['syllabary', 'translit'];
                const rightKeys: StudyFieldKey[] = englishKeys.length > 0 ? englishKeys : ['english'];

                bodyHtml = `
                    <div class="sheet-header">
                        <h1>${escapeHtml(cleanDisplayName)} — Fold-Over Study Sheet</h1>
                        <p>${studyRows.length} items · Fold vertically along the center dashed line to self-test</p>
                    </div>
                    <table class="fold-table">
                        <thead>
                            <tr>
                                <th style="width: 50%;">Cherokee (${leftKeys.map(k => FIELD_META.find(m => m.key === k)?.shortLabel).join(' / ')})</th>
                                <th style="width: 50%;" class="fold-divider">English (${rightKeys.map(k => FIELD_META.find(m => m.key === k)?.shortLabel).join(' / ')})</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${studyRows
                                .map(row => {
                                    const leftParts = leftKeys
                                        .map(k => {
                                            if (k === 'tone' && leftKeys.includes('translit') && row.tone === row.translit) return '';
                                            const v = escapeHtml(row[k]);
                                            if (!v) return '';
                                            return k === 'syllabary'
                                                ? `<div class="cherokee-syl">${v}</div>`
                                                : `<div class="cherokee-tr">${v}</div>`;
                                        })
                                        .filter(Boolean)
                                        .join('');
                                    const rightParts = rightKeys
                                        .map(k => {
                                            const v = escapeHtml(row[k]);
                                            return v ? `<div class="${k === 'notes' ? 'note-text' : 'eng-text'}">${v}</div>` : '';
                                        })
                                        .filter(Boolean)
                                        .join('');
                                    return `<tr><td>${leftParts}</td><td class="fold-divider">${rightParts}</td></tr>`;
                                })
                                .join('')}
                        </tbody>
                    </table>
                `;
            } else {
                const headersHtml = columnFields
                    .map(k => `<th>${escapeHtml(FIELD_META.find(m => m.key === k)?.shortLabel || k)}</th>`)
                    .join('') + (sheetLayout === 'practice' ? '<th style="width: 32%;">Practice / Notes</th>' : '');

                const rowsHtml = studyRows
                    .map(row => {
                        const cells = columnFields
                            .map(k => {
                                const cls = k === 'syllabary' ? 'cherokee-syl' : k === 'translit' || k === 'tone' ? 'cherokee-tr' : '';
                                return `<td class="${cls}">${escapeHtml(row[k])}</td>`;
                            })
                            .join('');
                        const practiceCell = sheetLayout === 'practice' ? '<td class="practice-cell"></td>' : '';
                        return `<tr>${cells}${practiceCell}</tr>`;
                    })
                    .join('');

                bodyHtml = `
                    <div class="sheet-header">
                        <h1>${escapeHtml(cleanDisplayName)}</h1>
                        <p>${studyRows.length} study items</p>
                    </div>
                    <table class="study-table">
                        <thead><tr>${headersHtml}</tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                `;
            }
        }

        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(cleanDisplayName)} - Print</title>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Cherokee:wght@400;600;700&family=Noto+Serif:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; }
                    body {
                        font-family: 'Noto Serif', Georgia, serif;
                        color: #0f172a;
                        margin: 0;
                        padding: 20px;
                    }
                    .sheet-header {
                        margin-bottom: 16px;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 8px;
                    }
                    .sheet-header h1 {
                        margin: 0 0 4px 0;
                        font-size: 20px;
                    }
                    .sheet-header p {
                        margin: 0;
                        font-size: 12px;
                        color: #475569;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                    }
                    th, td {
                        border: 1px solid #cbd5e1;
                        padding: 8px 10px;
                        text-align: left;
                        vertical-align: middle;
                    }
                    th {
                        background: #f8fafc;
                        font-size: 11px;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                    tr { page-break-inside: avoid; }
                    .fold-divider {
                        border-left: 2px dashed #64748b !important;
                    }
                    .cherokee-syl {
                        font-family: 'Noto Sans Cherokee', sans-serif;
                        font-size: 17px;
                        font-weight: 600;
                        line-height: 1.3;
                    }
                    .cherokee-tr {
                        font-weight: 700;
                        font-size: 13px;
                    }
                    .eng-text {
                        font-size: 13px;
                    }
                    .note-text {
                        font-size: 11px;
                        color: #475569;
                        font-style: italic;
                    }
                    .practice-cell {
                        border-bottom: 1px solid #94a3b8;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                ${bodyHtml}
                <script>
                    document.fonts.ready.then(() => {
                        setTimeout(() => { window.print(); }, 200);
                    });
                </script>
            </body>
            </html>
        `);
        printWin.document.close();
    };

    const usesFrontBackBuilder =
        format === 'quizlet' || (format === 'anki' && ankiMode === 'front_back');

    if (!isOpen) return null;

    return (
        <Modal
            title={`Export & Study: ${cleanDisplayName}`}
            onClose={onClose}
            maxWidth="max-w-xl"
        >
            <div className="space-y-4">
                {/* Format Selector Tabs */}
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {[
                            { id: 'quizlet', label: 'Quizlet' },
                            { id: 'anki', label: 'Anki' },
                            { id: 'sheet', label: 'Study Sheet' },
                            { id: 'csv', label: 'CSV / JSON' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFormat(tab.id as ExportFormat)}
                                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                                    format === tab.id
                                        ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Scope & Verb Surface Forms Expansion */}
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Include Items:</span>
                        <div className="flex bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setItemScope('words')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                    itemScope === 'words'
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                Words ({wordItemsCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setItemScope('sentences')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                    itemScope === 'sentences'
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                Sentences ({sentenceItemsCount})
                            </button>
                            {wordItemsCount > 0 && sentenceItemsCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setItemScope('both')}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                        itemScope === 'both'
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    Both ({wordItemsCount + sentenceItemsCount})
                                </button>
                            )}
                        </div>
                    </div>

                    {itemScope !== 'sentences' && (
                        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                            <input
                                type="checkbox"
                                checked={expandVerbForms}
                                onChange={e => setExpandVerbForms(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                            />
                            <div className="flex-1 text-xs">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                    Separate verb stems
                                </span>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug mt-0.5">
                                    Exports each of the 6-8 surface forms from the CED as separate cards (1st present, 2nd imperative, 3rd present, 3rd habitual, 3rd past, 3rd infinitive (and two possible person-to-person forms)
                                </p>
                            </div>
                        </label>
                    )}
                </div>

                {/* Format-specific sub-options */}
                {format === 'anki' && (
                    <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Anki Note Structure:</span>
                        <div className="flex bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setAnkiMode('front_back')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                    ankiMode === 'front_back'
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                Front / Back (Basic)
                            </button>
                            <button
                                type="button"
                                onClick={() => setAnkiMode('columns')}
                                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                    ankiMode === 'columns'
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-500 dark:text-slate-400'
                                }`}
                            >
                                Separate Fields
                            </button>
                        </div>
                    </div>
                )}

                {format === 'sheet' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Sheet Style:</span>
                        <div className="flex bg-slate-200/70 dark:bg-slate-900 p-0.5 rounded-lg">
                            {[
                                { id: 'standard', label: 'Standard Table' },
                                { id: 'fold', label: 'Fold-Over Test' },
                                { id: 'practice', label: 'Writing Practice' }
                            ].map(opt => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setSheetLayout(opt.id as any)}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                        sheetLayout === opt.id
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Field Selection */}
                {usesFrontBackBuilder ? (
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Card Fields (Tone falls back to Translit)
                            </span>
                            <button
                                type="button"
                                onClick={handleSwapFrontBack}
                                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                            >
                                <ArrowLeft className="rotate-90" size={12} /> Swap Front/Back
                            </button>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Front of Card</div>
                            <div className="flex flex-wrap gap-1.5">
                                {FIELD_META.map(f => {
                                    const active = frontFields.includes(f.key);
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => toggleFrontField(f.key)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                                active
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            {f.shortLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Back of Card</div>
                            <div className="flex flex-wrap gap-1.5">
                                {FIELD_META.map(f => {
                                    const active = backFields.includes(f.key);
                                    return (
                                        <button
                                            key={f.key}
                                            type="button"
                                            onClick={() => toggleBackField(f.key)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                                active
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            {f.shortLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {format === 'quizlet' && (
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-700/60">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Multi-field separator:</span>
                                <div className="flex gap-1">
                                    {[
                                        { id: 'slash', label: ' / ' },
                                        { id: 'dash', label: ' — ' },
                                        { id: 'newline', label: 'Newline' }
                                    ].map(s => (
                                        <button
                                            key={s.id}
                                            type="button"
                                            onClick={() => setSideSeparator(s.id as any)}
                                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                sideSeparator === s.id
                                                    ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Columns to Include (Tone falls back to Translit)
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {FIELD_META.map(f => {
                                const active = columnFields.includes(f.key);
                                return (
                                    <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => toggleColumnField(f.key)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            active
                                                ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Live Preview */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Preview ({studyRows.length} {studyRows.length === 1 ? 'line' : 'lines'})
                        </span>
                        {format === 'quizlet' && (
                            <span className="text-[11px] text-slate-400">
                                Paste directly into Quizlet → "Import"
                            </span>
                        )}
                    </div>

                    {studyRows.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                            No items in the selected scope.
                        </div>
                    ) : (
                        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                            {studyRows.slice(0, 12).map(row => (
                                <div key={row.id} className="p-2.5 flex items-center justify-between gap-3">
                                    {usesFrontBackBuilder ? (
                                        <>
                                            <div className="flex-1 min-w-0 font-bold text-slate-800 dark:text-slate-100 break-words whitespace-pre-line">
                                                {formatSideText(row, frontFields, format === 'quizlet' ? sideSeparator : 'slash') || '—'}
                                            </div>
                                            <div className="text-slate-300 dark:text-slate-600 shrink-0">→</div>
                                            <div className="flex-1 min-w-0 text-slate-600 dark:text-slate-300 break-words whitespace-pre-line">
                                                {formatSideText(row, backFields, format === 'quizlet' ? sideSeparator : 'slash') || '—'}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 w-full">
                                            {columnFields.map(k => (
                                                <span
                                                    key={k}
                                                    className={
                                                        k === 'syllabary'
                                                            ? 'font-noto-cherokee text-sm font-bold text-slate-900 dark:text-slate-100'
                                                            : k === 'translit' || k === 'tone'
                                                            ? 'font-bold text-amber-700 dark:text-amber-400'
                                                            : 'text-slate-600 dark:text-slate-300'
                                                    }
                                                >
                                                    {row[k] || '—'}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {studyRows.length > 12 && (
                                <div className="p-2 text-center text-[11px] text-slate-400 italic">
                                    + {studyRows.length - 12} more items...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap gap-2">
                    {format === 'quizlet' && (
                        <>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => handleCopy(quizletText, 'quizlet')}
                                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                {copiedState === 'quizlet' ? <Check size={18} /> : <Copy size={18} />}
                                {copiedState === 'quizlet' ? 'Copied for Quizlet!' : 'Copy for Quizlet'}
                            </button>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => downloadFile(quizletText, `${safeFilenameBase}_quizlet.txt`, 'text/plain')}
                                className="py-3 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download size={18} /> .txt
                            </button>
                        </>
                    )}

                    {format === 'anki' && (
                        <>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => downloadFile(ankiText, `${safeFilenameBase}_anki.tsv`, 'text/tab-separated-values')}
                                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                <Download size={18} /> Download Anki (.tsv)
                            </button>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => handleCopy(ankiText, 'anki')}
                                className="py-3 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                {copiedState === 'anki' ? <Check size={18} /> : <Copy size={18} />}
                                {copiedState === 'anki' ? 'Copied' : 'Copy'}
                            </button>
                        </>
                    )}

                    {format === 'sheet' && (
                        <button
                            type="button"
                            disabled={studyRows.length === 0}
                            onClick={handlePrint}
                            className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                        >
                            <Printer size={18} /> Print / Save as PDF
                        </button>
                    )}

                    {format === 'csv' && (
                        <>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => downloadFile(csvText, `${safeFilenameBase}.csv`, 'text/csv')}
                                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                                <Download size={18} /> Download CSV
                            </button>
                            <button
                                type="button"
                                disabled={studyRows.length === 0}
                                onClick={() => downloadFile(jsonText, `${safeFilenameBase}.json`, 'application/json')}
                                className="py-3 px-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download size={18} /> JSON
                            </button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};
