import { useMemo } from 'react';
import { StickyNote, ListIcon, Mic, SquaresPlus } from './Icons';
import { SourceBadge } from './UI';

import { usePackageManager } from './PackageManagerContext';

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

const EntryCard = ({ entry, customDictionaries, userNotes, userAudioMeta, userWordForms, favorites, customLists, onClick, isDimmed = false, showPos = false }: any) => {
  const { getPackageColor, packages, importedData } = usePackageManager();

  // --- Audio Colors ---
  const audioColors = useMemo(() => {
    const cols = new Set<string>();

    // 1. Standard Official Audio
    if (entry.Entry_Audio) {
      cols.add(getHexColor('slate'));
    }

    // 2. Extra Audio (User recorded or from Packages)
    if (userAudioMeta && userAudioMeta[entry.Index]) {
      userAudioMeta[entry.Index].forEach((a: any) => {
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
      if (p.status === 'active' && importedData[p.id]?.word_forms) {
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
    <div key={entry.Index} onClick={() => onClick(entry)} className={`bg-white dark:bg-slate-900 p-4 border-b border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer ${isDimmed ? 'opacity-50 grayscale' : ''} `}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1 min-w-0 pr-2">{entry.Syllabary && <span className="font-noto-cherokee text-xl font-bold text-slate-800 dark:text-slate-100 mr-2">{entry.Syllabary}</span>}<span className="font-noto-serif text-lg text-amber-700 dark:text-amber-400 font-medium break-words">{entry.Entry}</span></div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <MultiSourceIcon Icon={StickyNote} colors={noteColors} size={16} />
            <MultiSourceIcon Icon={SquaresPlus} colors={formColors} size={14} />
            <MultiSourceIcon Icon={Mic} colors={audioColors} size={14} />
            <SourceBadge source={entry.Source || entry.source} name={customDictionaries[entry.Source || entry.source]?.name} customColor={getPackageColor(entry.Source || entry.source)} />
          </div>
          {totalLists > 0 && <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-0.5"><ListIcon size={10} /> {totalLists}</span>}
        </div>
      </div>
      <p className="font-noto-serif text-slate-600 dark:text-slate-400 text-sm line-clamp-2">
        {entry.Definition}
        {/* PoS Moved After Definition */}
        {showPos && entry.PoS && <span className="text-slate-400 dark:text-slate-500 italic ml-1 lowercase">({entry.PoS})</span>}
      </p>
    </div>
  );
};

export default EntryCard;

