import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCorpus, Sentence, DictionaryEntry } from './CorpusContext';
import { useReader } from './ReaderContext';
import { usePackageManager } from './PackageManagerContext';
import { GlossPopover } from './GlossPopover';
import { LinkerModal } from './LinkerModal';
import { ArrowLeft, BookOpen, Eye, EyeOff, Type } from './Icons';

type StudyMode = 'study' | 'read';
type ScriptMode = 'both' | 'syllabary' | 'translit';

interface ReaderViewProps {
    bookId: string;
    chapterId: string;
    scrollToSentenceId?: string;
    onBack: () => void;
    customDictionaries?: Record<string, any>;
    onCreateWord?: () => void;
}

const CHUNK_SIZE = 20;
const MAX_VISIBLE_CHUNKS = 4; // Keep enough context to prevent flickering
const ESTIMATED_HEIGHT = 150; // Estimate for height calculation

export const ReaderView: React.FC<ReaderViewProps> = ({
    bookId,
    chapterId,
    scrollToSentenceId,
    onBack,
    customDictionaries,
    onCreateWord
}) => {
    const { glossMap, dictionaryMap, addUserGloss, removeUserGloss, personalWords } = useCorpus();
    const { books, getSentencesForChapter, addToInvestigationQueue } = useReader();
    const { getPackageColor } = usePackageManager();

    const [studyMode, setStudyMode] = useState<StudyMode>('study');
    const [scriptMode, setScriptMode] = useState<ScriptMode>('both');
    const [activePopover, setActivePopover] = useState<{
        sentenceId: string;
        wordIndex: number;
        position: { x: number; y: number };
    } | null>(null);
    const [showLinker, setShowLinker] = useState<{
        sentenceId: string;
        wordIndex: number;
        initialQuery: string;
        targetWord: { syllabary: string; translit: string };
        glossId?: string;
    } | null>(null);
    const [flashingSentenceId, setFlashingSentenceId] = useState<string | null>(null);

    // Virtualization State
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: CHUNK_SIZE });
    const [topSpacerHeight, setTopSpacerHeight] = useState(0);
    const sentenceHeights = useRef<Map<string, number>>(new Map());

    const containerRef = useRef<HTMLDivElement>(null);
    const sentenceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const bottomSentinelRef = useRef<HTMLDivElement>(null);

    const book = books.find(b => b.id === bookId);
    const sentences = useMemo(() => getSentencesForChapter(chapterId), [chapterId, getSentencesForChapter]);

    // Initialize/Reset View on Chapter/Scroll Target Change
    useEffect(() => {
        const total = sentences.length;
        if (total === 0) {
            setVisibleRange({ start: 0, end: 0 });
            setTopSpacerHeight(0);
            return;
        }

        let start = 0;
        let initialTopHeight = 0;

        if (scrollToSentenceId) {
            const index = sentences.findIndex(s => s.id === scrollToSentenceId);
            if (index !== -1) {
                // Center roughly
                start = Math.max(0, index - Math.floor(CHUNK_SIZE / 2));
                // Estimate previous height
                // Use measured heights if we visited before, otherwise estimate
                for (let i = 0; i < start; i++) {
                    initialTopHeight += sentenceHeights.current.get(sentences[i].id) || ESTIMATED_HEIGHT;
                }
            } else {
                // If ID not found, start at 0
                start = 0;
            }
        }

        // If switching chapters, we might want to reset heights or keep them?
        // Since IDs are unique, keeping them in the map is fine/beneficial if we return.
        
        const end = Math.min(total, start + CHUNK_SIZE);
        setVisibleRange({ start, end });
        setTopSpacerHeight(initialTopHeight);

    }, [chapterId, scrollToSentenceId, sentences]);


    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const options = {
            root: containerRef.current,
            rootMargin: '400px', // Load well in advance
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                if (entry.target === bottomSentinelRef.current) {
                    // LOAD MORE DOWN
                    setVisibleRange(prev => {
                        if (prev.end >= sentences.length) return prev;
                        
                        const newEnd = Math.min(sentences.length, prev.end + CHUNK_SIZE);
                        
                        // Unload top if too many
                        let newStart = prev.start;
                        let heightToAdd = 0;
                        const maxItems = CHUNK_SIZE * MAX_VISIBLE_CHUNKS;
                        
                        if (newEnd - prev.start > maxItems) {
                            const unloadCount = CHUNK_SIZE; // Unload a chunk
                            const targetStart = prev.start + unloadCount;
                            
                            for (let i = prev.start; i < targetStart; i++) {
                                const s = sentences[i];
                                const h = sentenceHeights.current.get(s.id) || ESTIMATED_HEIGHT;
                                heightToAdd += h;
                            }
                            newStart = targetStart;
                        }

                        if (heightToAdd > 0) {
                            setTopSpacerHeight(h => h + heightToAdd);
                        }

                        return { start: newStart, end: newEnd };
                    });
                } else if (entry.target === topSentinelRef.current) {
                    // LOAD MORE UP
                    setVisibleRange(prev => {
                        if (prev.start <= 0) return prev;

                        const newStart = Math.max(0, prev.start - CHUNK_SIZE);
                        
                        // Unload bottom if too many
                        let newEnd = prev.end;
                        const maxItems = CHUNK_SIZE * MAX_VISIBLE_CHUNKS;
                        
                        if (prev.end - newStart > maxItems) {
                            newEnd = prev.end - CHUNK_SIZE;
                        }

                        // Remove from spacer
                        let heightToRemove = 0;
                        for (let i = newStart; i < prev.start; i++) {
                            const s = sentences[i];
                            const h = sentenceHeights.current.get(s.id) || ESTIMATED_HEIGHT;
                            heightToRemove += h;
                        }

                        setTopSpacerHeight(h => Math.max(0, h - heightToRemove));

                        return { start: newStart, end: newEnd };
                    });
                }
            });
        }, options);

        const topEl = topSentinelRef.current;
        const botEl = bottomSentinelRef.current;

        if (topEl) observer.observe(topEl);
        if (botEl) observer.observe(botEl);

        return () => observer.disconnect();
    }, [sentences]);


    // Scroll to sentence on mount/update
    useEffect(() => {
        if (scrollToSentenceId) {
            // Wait for render
            const timeout = setTimeout(() => {
                const el = sentenceRefs.current.get(scrollToSentenceId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setFlashingSentenceId(scrollToSentenceId);
                    setTimeout(() => setFlashingSentenceId(null), 2000);
                }
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [scrollToSentenceId, visibleRange]); // Re-run if range changes (might reveal target)

    const tokenizeSentence = (sentence: Sentence) => {
        const syl = sentence.syllabary ? sentence.syllabary.split(' ') : [];
        const tr = sentence.translit ? sentence.translit.split(' ') : [];
        const max = Math.max(syl.length, tr.length);
        const tokens: { syl: string; tr: string; index: number }[] = [];
        for (let i = 0; i < max; i++) {
            tokens.push({ syl: syl[i] || '', tr: tr[i] || '', index: i });
        }
        return tokens;
    };

    const handleWordClick = (sentence: Sentence, wordIndex: number, event: React.MouseEvent) => {
        if (studyMode !== 'study') return;

        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();

        setActivePopover({
            sentenceId: sentence.id,
            wordIndex,
            position: { x: rect.left, y: rect.bottom }
        });
    };

    const handleAddToQueue = () => {
        if (activePopover) {
            addToInvestigationQueue(activePopover.sentenceId, activePopover.wordIndex);
            setActivePopover(null);
        }
    };

    const getGlossColor = (sentenceId: string, wordIndex: number): string | null => {
        const glosses = glossMap.get(sentenceId) || [];
        const wordGlosses = glosses.filter(g =>
            g.word_index ? g.word_index.split(',').map(Number).includes(wordIndex) : false
        );
        if (wordGlosses.length === 0) return null;

        const gloss = wordGlosses[0];
        const color = getPackageColor(gloss.source);
        if (color?.startsWith('#')) return color;
        if (gloss.source === 'user' || customDictionaries?.[gloss.source]) return '#fbbf24';
        return '#cbd5e1';
    };

    const toggleStudyMode = () => {
        setStudyMode(prev => prev === 'study' ? 'read' : 'study');
    };

    const toggleScriptMode = () => {
        setScriptMode(prev => {
            if (prev === 'both') return 'syllabary';
            if (prev === 'syllabary') return 'translit';
            return 'both';
        });
    };

    const getScriptIcon = () => {
        if (scriptMode === 'both') return Type;
        if (scriptMode === 'syllabary') return Eye;
        return EyeOff;
    };

    const getScriptLabel = () => {
        if (scriptMode === 'both') return 'Both';
        if (scriptMode === 'syllabary') return 'ᏣᎳᎩ';
        return 'abc';
    };

    const ScriptIcon = getScriptIcon();

    // visible subset
    const visibleSentences = useMemo(() => {
        return sentences.slice(visibleRange.start, visibleRange.end);
    }, [sentences, visibleRange]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                            onClick={onBack}
                            className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                        >
                            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                {book?.title || 'Reader'}
                            </h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {sentences.length} sentences
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleStudyMode}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm transition-colors ${studyMode === 'study'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                        >
                            {studyMode === 'study' ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{studyMode === 'study' ? 'Study' : 'Read'}</span>
                        </button>

                        <button
                            onClick={toggleScriptMode}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                        >
                            <ScriptIcon size={14} />
                            <span>{getScriptLabel()}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto p-6"
            >
                <div className="max-w-2xl mx-auto relative">
                    {/* Top Spacer */}
                    <div style={{ height: topSpacerHeight }} />
                    
                    {/* Top Sentinel */}
                    <div ref={topSentinelRef} className="h-4 w-full" />

                    {visibleSentences.map((sentence, _sentenceIdx) => {
                        const tokens = tokenizeSentence(sentence);
                        const isFlashing = flashingSentenceId === sentence.id;

                        return (
                            <div
                                key={sentence.id}
                                ref={el => {
                                    if (el) {
                                        sentenceRefs.current.set(sentence.id, el);
                                        // Measure height
                                        const h = el.getBoundingClientRect().height;
                                        // Add margin bottom (mb-6 = 24px)
                                        sentenceHeights.current.set(sentence.id, h + 24);
                                    } else {
                                        sentenceRefs.current.delete(sentence.id);
                                    }
                                }}
                                className={`mb-6 transition-all duration-500 ${isFlashing ? 'bg-amber-100 dark:bg-amber-900/30 rounded-lg p-4 -mx-4 shadow-lg' : ''
                                    }`}
                            >
                                {/* Sentence Content */}
                                <div className={`flex flex-wrap gap-x-1 gap-y-1 leading-relaxed ${studyMode === 'study' && scriptMode === 'both' ? 'gap-x-2' : 'gap-x-1'}`}>
                                    {tokens.map((token, tokenIdx) => {
                                        const glossColor = getGlossColor(sentence.id, tokenIdx);
                                        const isClickable = studyMode === 'study';

                                        if (scriptMode === 'syllabary') {
                                            return (
                                                <span
                                                    key={tokenIdx}
                                                    className={`font-serif text-2xl text-slate-900 dark:text-slate-100 ${isClickable ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded px-0.5' : ''}`}
                                                    onClick={isClickable ? (e) => handleWordClick(sentence, tokenIdx, e) : undefined}
                                                >
                                                    {token.syl}
                                                    {glossColor && studyMode === 'study' && (
                                                        <span className="block h-0.5 rounded-full -mt-1" style={{ backgroundColor: glossColor }} />
                                                    )}
                                                </span>
                                            );
                                        }

                                        if (scriptMode === 'translit') {
                                            return (
                                                <span
                                                    key={tokenIdx}
                                                    className={`text-xl text-slate-700 dark:text-slate-300 ${isClickable ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded px-0.5' : ''}`}
                                                    onClick={isClickable ? (e) => handleWordClick(sentence, tokenIdx, e) : undefined}
                                                >
                                                    {token.tr}
                                                    {glossColor && studyMode === 'study' && (
                                                        <span className="block h-0.5 rounded-full" style={{ backgroundColor: glossColor }} />
                                                    )}
                                                </span>
                                            );
                                        }

                                        return (
                                            <span
                                                key={tokenIdx}
                                                className={`inline-flex flex-col items-center relative ${isClickable ? 'cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded px-0.5 -mx-0.5' : ''}`}
                                                onClick={isClickable ? (e) => handleWordClick(sentence, tokenIdx, e) : undefined}
                                            >
                                                <span className="font-serif text-xl text-slate-900 dark:text-slate-100">
                                                    {token.syl}
                                                </span>
                                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                                    {token.tr}
                                                </span>
                                                {glossColor && studyMode === 'study' && (
                                                    <div
                                                        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                                        style={{ backgroundColor: glossColor }}
                                                    />
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>

                                {studyMode === 'study' && sentence.english && (
                                    <p className="mt-3 text-slate-500 dark:text-slate-400 italic text-sm border-t border-slate-100 dark:border-slate-800 pt-2">
                                        {sentence.english}
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {/* Bottom Sentinel */}
                    <div ref={bottomSentinelRef} className="h-4 w-full" />

                    {sentences.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <BookOpen size={48} className="mb-4 opacity-30" />
                            <p>No sentences in this chapter.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Gloss Popover */}
            {activePopover && (() => {
                const sentence = sentences.find(s => s.id === activePopover.sentenceId);
                if (!sentence) return null;

                const tokens = tokenizeSentence(sentence);
                const targetToken = tokens[activePopover.wordIndex];
                const glosses = glossMap.get(sentence.id) || [];
                const wordGlosses = glosses.filter(g =>
                    g.word_index ? g.word_index.split(',').map(Number).includes(activePopover.wordIndex) : false
                );

                return (
                    <GlossPopover
                        glosses={wordGlosses}
                        targetWord={{ syllabary: targetToken.syl, translit: targetToken.tr }}
                        dictionaryMap={dictionaryMap}
                        position={activePopover.position}
                        onClose={() => setActivePopover(null)}
                        onEntryClick={(id) => {
                            const url = new URL(window.location.href);
                            url.searchParams.set('word', id);
                            window.history.pushState({}, '', url.toString());
                            window.dispatchEvent(new PopStateEvent('popstate'));
                            setActivePopover(null);
                        }}
                        onDelete={(gloss) => {
                            if (gloss.id) removeUserGloss(gloss.id);
                            setActivePopover(null);
                        }}
                        onAdd={() => {
                            setShowLinker({
                                sentenceId: activePopover.sentenceId,
                                wordIndex: activePopover.wordIndex,
                                initialQuery: (targetToken.syl || targetToken.tr || '').replace(/[.,!?;:"()]/g, '').trim(),
                                targetWord: { syllabary: targetToken.syl, translit: targetToken.tr }
                            });
                            setActivePopover(null);
                        }}
                        onAddToQueue={handleAddToQueue}
                        onEdit={(gloss) => {
                            let entry = dictionaryMap.get(gloss.entry_id);
                            if (!entry && personalWords) {
                                const pw = personalWords.find(w => w.Index === gloss.entry_id || w.id === gloss.entry_id);
                                if (pw) entry = { ...pw, id: pw.Index } as DictionaryEntry;
                            }
                            if (entry) {
                                setShowLinker({
                                    sentenceId: activePopover.sentenceId,
                                    wordIndex: activePopover.wordIndex,
                                    initialQuery: entry.translit || '',
                                    targetWord: { syllabary: targetToken.syl, translit: targetToken.tr },
                                    glossId: gloss.id
                                });
                            }
                            setActivePopover(null);
                        }}
                        personalWords={personalWords}
                        customDictionaries={customDictionaries}
                    />
                );
            })()}

            {/* Linker Modal */}
            {showLinker && (
                <LinkerModal
                    initialQuery={showLinker.initialQuery}
                    targetWord={showLinker.targetWord}
                    dictionary={Array.from(dictionaryMap.values())}
                    personalWords={personalWords}
                    customDictionaries={customDictionaries}
                    onClose={() => setShowLinker(null)}
                    onSelect={(entry, notes, breakdownCherokee, breakdownEnglish) => {
                        addUserGloss({
                            sentence_id: showLinker.sentenceId,
                            word_index: showLinker.wordIndex.toString(),
                            entry_id: entry.id || (entry as any).Index,
                            notes,
                            breakdown_cherokee: breakdownCherokee,
                            breakdown_english: breakdownEnglish,
                            source: 'user',
                            id: showLinker.glossId,
                            gloss_syllabary: showLinker.targetWord.syllabary,
                            gloss_phonetic: showLinker.targetWord.translit,
                            gloss_english: entry.definition || entry.Definition
                        });
                        setShowLinker(null);
                    }}
                    onDelete={showLinker.glossId ? () => {
                        if (showLinker.glossId) removeUserGloss(showLinker.glossId);
                        setShowLinker(null);
                    } : undefined}
                    onCreateNew={onCreateWord}
                />
            )}
        </div>
    );
};