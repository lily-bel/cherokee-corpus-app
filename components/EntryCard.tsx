import { useMemo } from 'react';
import { StickyNote, ListIcon, Mic, SquaresPlus, TranslateCherokee } from './Icons';
import { SourceBadge } from './UI';
import { useCorpus } from './CorpusContext';
import { VerbMorphologyTemplate, isFormAudio, ColorizedCherokeeWord } from '../utils';
import { usePackageManager } from './PackageManagerContext';
import { DesktopHorizontalFormsStrip, getReferencePreviewMatchedForms } from './ReferenceFormsPreview';


const getHexColor = (col: string) => {
  const COLORS: Record<string, string> = {
    slate: '#94a3b8',
    amber: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    purple: '#8b5cf6',
    pink: '#ec4899',
    orange: '#f97316',
    indigo: '#6366f1',
    teal: '#14b8a6',
    rose: '#f43f5e'
  };
  if (!col) return COLORS.slate;
  if (col.startsWith('#')) return col;
  return COLORS[col] || COLORS.slate;
};

const MultiSourceIcon = ({ Icon, colors, size = 14 }: { Icon: any, colors: string[], size?: number }) => {
  // colors are already hex strings from useMemo logic below
  const uniqueColors = Array.from(new Set(colors));
  if (uniqueColors.length === 0) return null;
  const isMulti = uniqueColors.length > 1;

  // Use identical attribute structure for both cases to ensure same rendering
  const stroke = isMulti ? "url(#rainbow-gradient)" : uniqueColors[0];

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0" title={isMulti ? `${uniqueColors.length} sources` : undefined}>
      <Icon
        size={size}
        stroke={stroke}
        fill="none"
      />
      {isMulti && (
        <div className="grid grid-cols-3 gap-0.5 w-full max-w-[14px]">
          {uniqueColors.slice(0, 9).map((c, i) => (
            <div key={i} className="w-[3px] h-[3px] rounded-[0.5px] shrink-0" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
    </div>
  );
};

const EntryCard = ({ entry, customDictionaries, userNotes, userAudioMeta, userWordForms, favorites, customLists, onClick, isDimmed = false, showPos = false, settings, onViewRoot, onViewClass }: any) => {
  const { getPackageColor, packages, importedData, wordFormsByWordIndex } = usePackageManager();
  const { rootMap } = useCorpus();

  const isLinguist = settings?.dictionaryLevel === 'linguist';

  const isColored = (settings?.colorWordSegments !== undefined)
    ? settings.colorWordSegments !== false
    : (() => {
        try {
          const s = localStorage.getItem('cherokee_app_settings');
          return s ? JSON.parse(s).colorWordSegments !== false : true;
        } catch {
          return true;
        }
      })();

  const entryId = entry.id || entry.Index || entry.merged_id;
  const rootEntry = entry.rootEntry || (entryId ? rootMap?.get(entryId) : null);

  // --- Entry Forms for Desktop Preview ---
  const entryForms = useMemo(() => {
    const list: any[] = [];
    const directForms = entryId ? wordFormsByWordIndex?.get(entryId) : undefined;
    if (directForms && directForms.length > 0) {
      list.push(...directForms);
    }
    if (userWordForms && entry.Index && userWordForms[entry.Index]) {
      userWordForms[entry.Index].split('|').forEach((form: string) => {
        const parts = form.split(':');
        if (parts.length >= 2) {
          const values = parts[1].split('^');
          list.push({
            form_name: parts[0],
            translit: values[0],
            syllabary: values[1],
            tone: values[2],
            notes: values[3],
            color: 'gold'
          });
        }
      });
    }
    return list;
  }, [entryId, entry.Index, wordFormsByWordIndex, userWordForms]);

  const { hasMiniPreview } = useMemo(() => {
    return getReferencePreviewMatchedForms(entryForms, entry, rootEntry, settings);
  }, [entryForms, entry, rootEntry, settings]);

  // --- Audio Colors ---

  const audioColors = useMemo(() => {
    const cols = new Set<string>();

    // 1. Standard Official Audio
    if (entry.audio || entry.Entry_Audio || entry.entry_audio) {
      cols.add(getHexColor('slate'));
    }

    // 2. Extra Audio (User recorded or from Packages)
    const entryAudioList = (
      (entry.Index && userAudioMeta?.[entry.Index]) ||
      (entry.id && userAudioMeta?.[entry.id]) ||
      (entry.merged_id && userAudioMeta?.[entry.merged_id])
    );

    if (entryAudioList) {
      entryAudioList.forEach((a: any) => {
        if (isFormAudio(a)) return;
        const pkgId = a.packageId || 'user';
        const pkg = packages.find(p => p.id === pkgId);

        // Count it if it's user-recorded or from an active package
        if (!a.packageId || (pkg && pkg.status === 'active')) {
          const rawCol = getPackageColor(pkgId) || (pkgId === 'user' ? 'amber' : 'slate');
          cols.add(getHexColor(rawCol));
        }
      });
    }
    return Array.from(cols);
  }, [entry, userAudioMeta, packages, getPackageColor]);


  // --- Note Colors ---
  const noteColors = useMemo(() => {
    const cols = new Set<string>();
    // For personal words, Source is the custom dictionary ID. entry.source is often "user".
    const source = entry.Source || entry.source;
    const isPersonal = !!customDictionaries[source];
    const userNoteText = isPersonal ? entry.Notes : userNotes[entry.Index];
    if (userNoteText && userNoteText.trim().length > 0) cols.add(getHexColor('amber'));

    packages.forEach(p => {
      if (p.status === 'active' && importedData[p.id]?.notes) {
        const hasNote = importedData[p.id].notes!.some((n: any) => n.target_id === entry.Index && n.type === 'W');
        if (hasNote) cols.add(getHexColor(p.color));
      }
    });
    return Array.from(cols);
  }, [entry, userNotes, packages, importedData, customDictionaries]);

  // --- Form Colors ---
  const formColors = useMemo(() => {
    const cols = new Set<string>();
    const source = entry.Source || entry.source;
    const isPersonal = !!customDictionaries[source];
    
    if (userWordForms && userWordForms[entry.Index]) cols.add(getHexColor('amber')); // User custom forms
    if (isPersonal && entry.Other_Forms) {
        const sourceColor = getPackageColor(source) || 'amber';
        cols.add(getHexColor(sourceColor));
    }

    packages.forEach(p => {
      if (p.type !== 'official' && p.status === 'active' && importedData[p.id]?.word_forms) {
        const hasForms = importedData[p.id].word_forms!.some((f: any) => f.word_index === entry.Index);
        if (hasForms) cols.add(getHexColor(p.color));
      }
    });
    return Array.from(cols);
  }, [entry, userWordForms, packages, importedData, customDictionaries, getPackageColor]);

  // LIST COUNT
  const inFav = favorites.includes(entry.Index);
  const inLists = Object.keys(customLists).filter(k => {
    const list = customLists[k];
    if (Array.isArray(list)) return list.includes(entry.Index);
    return list?.items?.includes(entry.Index);
  }).length;
  const totalLists = (inFav ? 1 : 0) + inLists;


  return (
    <div key={entry.Index} onClick={() => onClick(entry)} className={`bg-white dark:bg-slate-900 p-4 border-b border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${isDimmed ? 'opacity-50 grayscale' : ''} `}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:gap-6">
        {/* Left Column: Primary entry info */}
        <div className={`min-w-0 ${hasMiniPreview ? 'lg:w-[280px] xl:w-[320px] 2xl:w-[360px] shrink-0' : 'flex-1'}`}>
          <div className="flex justify-between items-start mb-2 gap-3">
            {isLinguist && rootEntry ? (
              <div className="flex-1 min-w-0">
                <VerbMorphologyTemplate
                  rootEntry={rootEntry}
                  showMascot={settings?.showClassMascots}
                  onViewRoot={onViewRoot}
                  onViewClass={onViewClass}
                  className="text-base font-bold"
                />
              </div>
            ) : (
              <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                {entry.Syllabary && (
                  <span className="font-noto-cherokee text-lg font-bold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1">
                    <span>{entry.Syllabary}</span>
                    {entry.is_auto_syllabary && (
                      <TranslateCherokee size={14} className="text-amber-600 dark:text-amber-400 shrink-0 opacity-85" title="Auto-transliterated syllabary" />
                    )}
                  </span>
                )}
                <span className="font-noto-serif text-base text-amber-700 dark:text-amber-400 font-bold [overflow-wrap:anywhere] [word-break:normal]">
                  <ColorizedCherokeeWord
                    word={entry.Entry}
                    entry={entry}
                    rootEntry={rootEntry}
                    isColored={isColored}
                    settings={settings}
                  />
                </span>
              </div>
            )}
            <div className="shrink-0 flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <MultiSourceIcon Icon={StickyNote} colors={noteColors} size={15} />
                <MultiSourceIcon Icon={SquaresPlus} colors={formColors} size={13} />
                <MultiSourceIcon Icon={Mic} colors={audioColors} size={13} />
                <SourceBadge source={entry.Source || entry.source} name={customDictionaries[entry.Source || entry.source]?.name} customColor={getPackageColor(entry.Source || entry.source)} />
              </div>
              {totalLists > 0 && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5"><ListIcon size={10} /> {totalLists}</span>}
            </div>
          </div>
          {entry.matchedForm && (
            <div className="text-xs text-amber-600 dark:text-amber-400 italic mb-1.5 font-medium flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
              <span className="text-slate-400 dark:text-slate-500 not-italic">matched form:</span>
              {entry.matchedForm.syllabary && (
                <span className="font-noto-cherokee font-semibold">{entry.matchedForm.syllabary}</span>
              )}
              {entry.matchedForm.translit && (
                <span className="font-noto-serif font-bold">
                  <ColorizedCherokeeWord
                    word={entry.matchedForm.translit}
                    form={entry.matchedForm}
                    formKey={entry.matchedForm.label}
                    entry={entry}
                    rootEntry={rootEntry}
                    isColored={isColored}
                    settings={settings}
                  />
                </span>
              )}
            </div>
          )}
          <p className="font-noto-serif text-slate-600 dark:text-slate-400 text-xs line-clamp-2">
            {entry.is_combined_part_b && entry.definition_source_type && (
              <span className="font-sans font-bold uppercase tracking-wider text-[10px] text-amber-700/80 dark:text-amber-400/80 mr-1.5">
                {entry.definition_source_type === 'infinitive' ? 'Infinitive definition:' : 'Parent definition:'}
              </span>
            )}
            {entry.Definition}
            {/* PoS Moved After Definition */}
            {showPos && entry.PoS && <span className="text-slate-400 dark:text-slate-500 italic ml-1 lowercase">({entry.PoS})</span>}
          </p>
        </div>

        {/* Right Column (Desktop only): Horizontal forms strip */}
        {hasMiniPreview && (
          <div className="hidden lg:block flex-1 min-w-0 overflow-x-auto py-1">
            <DesktopHorizontalFormsStrip
              entry={entry}
              forms={entryForms}
              rootEntry={rootEntry}
              settings={settings}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EntryCard;

