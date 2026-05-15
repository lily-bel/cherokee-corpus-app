import { useState } from 'react';
import { AlertCircle, Volume2, ChevronUp, ChevronDown, Pencil, ArrowUp, ArrowDown, Trash2 } from './Icons';

export const Toast = ({ show, message, type = 'error' }) => {
  if (!show) return null;
  return (
    <div className="fixed bottom-24 left-4 right-4 z-[80] flex justify-center pointer-events-none animate-slide-up-toast">
      <div className={`px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 ${type === 'error' ? 'bg-red-100 dark:bg-red-900/80 text-red-800 dark:text-red-100 border border-red-200 dark:border-red-800' : 'bg-green-100 dark:bg-green-900/80 text-green-800 dark:text-green-100 border border-green-200 dark:border-green-800'}`}>
        <AlertCircle size={20} />
        <span className="font-bold text-sm">{message}</span>
      </div>
    </div>
  );
};

export const AudioPlayer = ({ src, label = "Audio", icon: Icon = Volume2, variant = "gray", showNoAudioMessage = false, onDelete = undefined, customColor = undefined }: any) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(false);
  const playAudio = () => {
    if (!src) return;
    setError(false); const audio = new Audio(src);
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => { setIsPlaying(false); setError(true); setTimeout(() => setError(false), 3000); };
    audio.play().catch(() => { setError(true); setTimeout(() => setError(false), 3000); });
  };

  if (!src) {
    if (showNoAudioMessage) return <div className="flex items-center gap-2 text-gray-400 dark:text-slate-600 text-xs italic"><Icon size={16} className="opacity-50" /><span>No audio available</span></div>;
    return null;
  }

  const baseClass = "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors shadow-sm group";
  let activeClass = variant === 'gold'
    ? (isPlaying ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100' : 'bg-amber-500 text-white hover:bg-amber-600')
    : (isPlaying ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600');

  let style = {};
  if (customColor) {
    if (customColor.startsWith('#')) {
      if (isPlaying) {
        style = { backgroundColor: customColor + '20', color: customColor, borderColor: customColor };
      } else {
        style = { backgroundColor: customColor, color: '#fff' };
      }
      activeClass = "";
    } else if (customColor !== 'slate' && customColor !== 'amber') {
      activeClass = isPlaying ? `bg-${customColor}-100 dark:bg-${customColor}-900 text-${customColor}-800 dark:text-${customColor}-100` : `bg-${customColor}-500 text-white hover:bg-${customColor}-600`;
    }
  }

  return (
    <div className="relative flex items-center">
      <div className={`${baseClass} ${activeClass}`} style={style}>
        <button onClick={playAudio} disabled={isPlaying} className="flex items-center gap-2">
          <Icon size={16} className={isPlaying ? 'animate-pulse' : ''} /> <span>{isPlaying ? 'Playing...' : label}</span>
        </button>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="ml-2 pl-2 border-l border-white/20 hover:text-red-200 transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {error && <div className="absolute top-full left-0 mt-2 z-50 bg-red-600 text-white text-xs px-3 py-1 rounded shadow-lg whitespace-nowrap animate-fade-in">Audio file not found: {src}</div>}
    </div>
  );
};

export const SourceBadge = ({ source, name, customColor }: { source: string, name?: string, customColor?: string }) => {
  let colorClass = "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300";
  let style = {};

  if (customColor) {
    style = { backgroundColor: customColor, color: '#fff' }; // Assuming white text for custom colors, or could calculate contrast
    colorClass = "";
  }

  if (source && (source === 'pd' || source.startsWith('nb_') || source === 'user')) {
    let initials = "NB";
    if (name) { initials = name.substring(0, 4).trim().toUpperCase(); }

    // Respect customColor if provided, otherwise default to a thematic amber/gold for user content
    const style = customColor ? { backgroundColor: customColor, color: '#fff', borderColor: 'transparent' } : {};
    const colorClasses = customColor ? "" : "bg-amber-500 text-white border-transparent";

    return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide ${colorClasses}`} style={style}>{initials}</span>;
  }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${colorClass}`} style={style}>{source?.toUpperCase()}</span>;
};

export const CollapsibleCard = ({ title, icon: Icon, count, children, defaultOpen = false, onDelete = undefined, onMoveUp = undefined, onMoveDown = undefined, isReordering, onEdit = undefined }: any) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-4 transition-all ${!isOpen ? 'opacity-95' : ''}`}>
      <div className={`w-full px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between ${isOpen ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/50'}`}>
        <button onClick={() => !isReordering && setIsOpen(!isOpen)} className={`flex-1 flex items-center text-left ${isReordering ? 'cursor-default' : 'cursor-pointer'}`}>
          <div className="flex items-center gap-2">
            {Icon && <Icon size={18} className={isOpen ? "text-amber-500 dark:text-amber-400 fill-amber-500" : "text-slate-400 dark:text-slate-500"} />}
            <span className={`font-bold ${isOpen ? "text-amber-900 dark:text-amber-200" : "text-slate-600 dark:text-slate-300"}`}>{title} {count !== undefined && `(${count})`}</span>
            {!isReordering && (isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />)}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {isReordering && (<>
            {onEdit && <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-100 rounded"><Pencil size={18} /></button>}
            {onMoveUp && <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded"><ArrowUp size={18} /></button>}
            {onMoveDown && <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-100 rounded"><ArrowDown size={18} /></button>}
          </>)}
          {onDelete && isReordering && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors ml-2"><Trash2 size={18} /></button>}
        </div>
      </div>
      {isOpen && !isReordering && <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-fade-in">{children}</div>}
    </div>
  );
};

export const Modal = ({ title, children, onClose }: any) => (
  <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-scale-in max-h-[90vh] overflow-y-auto border dark:border-slate-800" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">{title}</h3>
      {children}
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-500 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800">Cancel</button></div>
    </div>
  </div>
);