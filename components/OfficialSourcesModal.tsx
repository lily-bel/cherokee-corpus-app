import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, BookOpen, Globe, LinkIcon, ChevronDown, ChevronRight, Info } from './Icons';

interface OfficialSourcesModalProps {
    onClose: () => void;
}

interface SourceItem {
    code: string;
    name: string;
    description?: string;
}

const CHEROKEE_DICTIONARY_NET_SOURCES: SourceItem[] = [
    { code: 'rrd', name: 'Raven Rock Dictionary' },
    { code: 'cn', name: 'Cherokee Nation' },
    { code: 'cwl', name: 'Consortium Word List' },
    { code: 'noq', name: 'Noquisi Word List' },
    { code: 'msct', name: 'Microsoft Computer Terms' },
    { code: 'cnmed', name: 'Medical terms provided by Cherokee Nation (western dialect)' },
    { code: 'cnld', name: 'CN Language Documents' },
    { code: 'ncmed', name: 'Medical terms in Giduwa (North Carolina/eastern dialect)', description: 'Based on class notes provided by Bo Taylor of the Eastern Band.' },
    { code: 'banks', name: 'Ethnobotany of the Cherokee Indians', description: 'Banks, William H. Jr. (1953). Master\'s Thesis, University of Tennessee.' },
    { code: 'hsbc', name: 'Beginning Cherokee', description: 'Holmes, R. B., & Smith, B. S. (1997). Norman: University of Oklahoma Press.' },
    { code: 'sskil', name: 'The Shadow of Sequoyah', description: 'Social Documents of the Cherokees, 1862-1964.' },
    { code: 'fbgp', name: 'CED FB Group' },
    { code: 'magok', name: 'A Reference Grammar of Oklahoma Cherokee', description: 'Montgomery-Anderson, B. (2008).' },
    { code: 'kpep', name: 'Kituwah Preservation & Education Program, EBCI' },
    { code: 'vrb', name: 'Verb Reference Book Didehloqwasgi', description: 'Kirk, W. (2012). Northeastern State University.' },
    { code: 'cccc', name: 'Carnegie Corporation Cross-Cultural Education Project' }
];

export const OfficialSourcesModal: React.FC<OfficialSourcesModalProps> = ({ onClose }) => {
    const [cdNetExpanded, setCdNetExpanded] = useState(true);

    return createPortal(
        <div 
            className="fixed inset-0 z-[20000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-xs">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <h2 className="font-noto-serif text-lg font-bold text-slate-800 dark:text-slate-100">
                                Official Sources & Data
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Sources for the official app data.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-700 dark:text-slate-300 text-sm">

                    {/* Source 1: Cherokee Nation Dictionary */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    Cherokee Nation Dictionary
                                </span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                    CED
                                </span>
                            </div>
                            <a
                                href="https://cherokeenationdictionary.net/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                                <Globe size={13} />
                                <span>cherokeenationdictionary.net</span>
                            </a>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            The official Cherokee Nation dictionary site. A maintained version of the CED by Durbin Feeling. Includes audio, sentence examples, and some conjugations for each word.
                        </p>
                    </div>

                    {/* Source 2: King Recreation */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    King Recreation Verb Morphology
                                </span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                                    Morphology
                                </span>
                            </div>
                            <a
                                href="https://github.com/CharlieMcVicker/king-recreation/tree/main"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                                <LinkIcon size={13} />
                                <span>GitHub Repository</span>
                            </a>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            An analysis of CED verbs to describe their roots and verb classes. This data is built into the app to enable root navigation and morphological breakdown.
                        </p>
                    </div>

                    {/* Source 3: cherokeedictionary.net + nested list */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 overflow-hidden">
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-slate-100">
                                        cherokeedictionary.net
                                    </span>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                        Compiled Sources
                                    </span>
                                </div>
                                <a
                                    href="https://www.cherokeedictionary.net/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                                >
                                    <Globe size={13} />
                                    <span>cherokeedictionary.net</span>
                                </a>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                The original online dictionary site. Contains CED and additional sources such as Raven Rock Dictionary, Noquisi Word List, Consortium Word List, and other smaller sources.
                            </p>
                        </div>

                        {/* Collapsible Nested Sources */}
                        <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
                            <button
                                onClick={() => setCdNetExpanded(!cdNetExpanded)}
                                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/50 transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <span>Included Sources from cherokeedictionary.net</span>
                                    <span className="px-1.5 py-0.2 bg-slate-200 dark:bg-slate-700 rounded-full text-[10px] font-mono">
                                        {CHEROKEE_DICTIONARY_NET_SOURCES.length}
                                    </span>
                                </span>
                                {cdNetExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                            </button>

                            {cdNetExpanded && (
                                <div className="px-4 pb-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs border-t border-slate-100 dark:border-slate-800">
                                    {CHEROKEE_DICTIONARY_NET_SOURCES.map(source => (
                                        <div
                                            key={source.code}
                                            className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-0.5"
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase shrink-0">
                                                    {source.code}
                                                </span>
                                                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                                    {source.name}
                                                </span>
                                            </div>
                                            {source.description && (
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 pl-1 leading-snug">
                                                    {source.description}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Source 4: Moondove's Spiral */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    Moondove's Spiral
                                </span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                    MDS
                                </span>
                            </div>
                            <a
                                href="https://web.archive.org/web/20160328135446/http://home.earthlink.net/~deanna1jc/moondoves_spiral_dictionary.htm"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                                <Globe size={13} />
                                <span>Web Archive</span>
                            </a>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            A now offline website with a barebones word list. No syllabary, so it is hidden by default in the app, but nonetheless has many idioms and conversational words not covered by other sources (e.g. <em>donadagohvi</em>).
                        </p>
                    </div>

                    {/* Source 5: Cherokee Verb Reference Guide */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                                <em>Cherokee Verb Reference Guide</em> by Wyman Kirk
                            </span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                KIRK
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            A print book containing verbs mostly accounted for in CED, with additional tables of 5x5 conjugations.
                        </p>
                    </div>

                    {/* Source 6: Learning to use the Cherokee Verb */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    <em>Learning to use the Cherokee Verb</em> by Durbin Feeling
                                </span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                    LTU
                                </span>
                            </div>
                            <a
                                href="https://language.cherokee.org/media/vnihnhms/learning-to-use-the-cherokee-verb.pdf"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                                <LinkIcon size={13} />
                                <span>PDF Document</span>
                            </a>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            A print book with deep conjugations of a small number of verbs.
                        </p>
                    </div>

                    {/* Source 7: Cherokee New Testament */}
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                    Cherokee New Testament
                                </span>
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                                    CNT / BIBLE
                                </span>
                            </div>
                            <a
                                href="https://www.cherokeedictionary.net/cnt/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                            >
                                <Globe size={13} />
                                <span>cherokeedictionary.net/cnt</span>
                            </a>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            The New Testament translated into Cherokee. Used as an optional full text for reading and interactive glossing.
                        </p>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OfficialSourcesModal;
