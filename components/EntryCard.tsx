import { Mic, StickyNote, ListIcon, Audio, SquaresPlus } from './Icons';
import { SourceBadge } from './UI';

import { usePackageManager } from './PackageManagerContext';

const EntryCard = ({ entry, notebooks, userNotes, userAudioMeta, userWordForms, favorites, customLists, onClick, isDimmed = false, showPos = false }: any) => {
  const { getPackageColor, packages } = usePackageManager();
  const isPersonal = !!notebooks[entry.Source];
  const hasUserNote = isPersonal ? (entry.Notes && entry.Notes.trim().length > 0) : (userNotes[entry.Index] !== undefined && userNotes[entry.Index].trim().length > 0);

  // Extra Forms Indicator logic
  const hasUserForms = !!(userWordForms && userWordForms[entry.Index]);
  const entryPkg = packages.find(p => p.id === entry.Source || (p.metadata.source_names && p.metadata.source_names[entry.Source]));
  const isImported = entryPkg?.type === 'imported';
  const hasOtherForms = !!entry.Other_Forms;

  let formsIconColor = "";
  let formsIconStyle = {};
  
  if (hasUserForms || (isPersonal && hasOtherForms)) {
    formsIconColor = "text-amber-500 fill-amber-100";
  } else if (isImported && hasOtherForms) {
    const pColor = entryPkg?.color;
    if (pColor && pColor.startsWith('#')) {
      formsIconStyle = { color: pColor };
    } else if (pColor && pColor !== 'slate') {
      formsIconColor = `text-${pColor}-500 fill-${pColor}-100`;
    } else {
      formsIconColor = "text-slate-400";
    }
  }

  // Audio Indicators
  const hasCnAudio = !!entry.Entry_Audio;
  const activeUserAudio = userAudioMeta && userAudioMeta[entry.Index] ? userAudioMeta[entry.Index].filter((a: any) => {
    if (!a.packageId) {
      const userPkg = packages.find(p => p.id === 'user');
      return userPkg ? userPkg.status === 'active' : true;
    }
    const pkg = packages.find(p => p.id === a.packageId);
    return pkg && pkg.status === 'active';
  }) : [];
  const hasUserAudio = activeUserAudio.length > 0;

  // LIST COUNT
  const inFav = favorites.includes(entry.Index);
  const inLists = Object.keys(customLists).filter(k => {
    const list = customLists[k];
    if (Array.isArray(list)) return list.includes(entry.Index);
    return list?.items?.includes(entry.Index);
  }).length;
  const totalLists = (inFav ? 1 : 0) + inLists;

  const pkgColor = getPackageColor(entry.Source);

  // Determine audio icon color
  let audioIconStyle = {};
  let audioIconClass = "text-amber-500 fill-amber-100"; // Default user audio

  if (hasUserAudio) {
    const audios = activeUserAudio;
    // Find first audio with a package ID (prioritize imported over user-recorded)
    const importedAudio = audios.find((a: any) => a.packageId);
    if (importedAudio) {
      const aColor = getPackageColor(importedAudio.packageId);
      if (aColor && aColor.startsWith('#')) {
        audioIconStyle = { color: aColor };
        audioIconClass = ""; // Clear default class
      } else if (aColor && aColor !== 'slate') {
        audioIconClass = `text-${aColor}-500 fill-${aColor}-100`;
      }
    }
  }

  return (
    <div key={entry.Index} onClick={() => onClick(entry)} className={`bg-white dark:bg-slate-900 p-4 border-b border-slate-100 dark:border-slate-800 active:bg-slate-50 dark:active:bg-slate-800 transition-colors cursor-pointer ${isDimmed ? 'opacity-50 grayscale' : ''} `}>
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1 min-w-0 pr-2">{entry.Syllabary && <span className="font-noto-cherokee text-xl font-bold text-slate-800 dark:text-slate-100 mr-2">{entry.Syllabary}</span>}<span className="font-noto-serif text-lg text-amber-700 dark:text-amber-400 font-medium break-words">{entry.Entry}</span></div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            {hasCnAudio && <Audio size={14} className="text-slate-400" />}
            {hasUserAudio && <Mic size={14} className={audioIconClass} style={audioIconStyle} />}
            {(formsIconColor || formsIconStyle.hasOwnProperty('color')) && <SquaresPlus size={14} className={formsIconColor} style={formsIconStyle} />}
            {hasUserNote && <StickyNote size={16} className="text-amber-500 fill-amber-100" />}
            <SourceBadge source={entry.Source} name={notebooks[entry.Source]?.name} customColor={pkgColor} />
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
