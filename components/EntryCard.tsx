import { Mic, StickyNote, ListIcon, Audio } from './Icons';
import { SourceBadge } from './UI';

import { usePackageManager } from './PackageManagerContext';

const EntryCard = ({ entry, notebooks, userNotes, userAudioMeta, favorites, customLists, onClick, isDimmed = false, showPos = false }: any) => {
  const { getPackageColor, packages } = usePackageManager();
  const isPersonal = !!notebooks[entry.Source];
  const hasUserNote = isPersonal ? (entry.Notes && entry.Notes.trim().length > 0) : (userNotes[entry.Index] !== undefined && userNotes[entry.Index].trim().length > 0);

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
  const inLists = Object.keys(customLists).filter(k => customLists[k].includes(entry.Index)).length;
  const totalLists = (inFav ? 1 : 0) + inLists;

  const pkgColor = getPackageColor(entry.Source);
  // If pkgColor is a hex code (starts with #), use it directly. 
  // If it's a tailwind color name (like 'slate'), map it or fallback.
  // Based on PackageManagerTab, colors are hex codes.
  // Official/User packages might use 'slate' or 'amber' strings?
  // Let's check getPackageColor return value.
  // Assuming it returns what is stored in package.color.

  const isCustomColor = pkgColor && pkgColor.startsWith('#');

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
