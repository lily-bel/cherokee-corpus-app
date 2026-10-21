import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    ChevronLeft,
    ChevronRight,
    Search,
    ListIcon,
    BookOpen,
    Layout,
    Book,
    Box,
    UserIcon,
    CloudCheck,
    Check,
    Play,
    HelpCircle,
    Globe,
    LinkIcon
} from './Icons';
import { useAuth } from './AuthContext';

export interface TutorialModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: any;
    setSettings: React.Dispatch<React.SetStateAction<any>>;
    onOpenAuth: () => void;
}

const tutorialAsset = (filename: string) => {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return `${normalizedBase}data/tutorial/${filename}`;
};

type SlideId =
    | 'welcome'
    | 'basics'
    | 'customization-choice'
    | 'customization-tabs'
    | 'login-backup'
    | 'dictionary-mode'
    | 'video-tour';

export const TutorialModal: React.FC<TutorialModalProps> = ({
    isOpen,
    onClose,
    settings,
    setSettings,
    onOpenAuth
}) => {
    const { user } = useAuth();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showWhatIsThis, setShowWhatIsThis] = useState(false);
    const [isFullScreenVideo, setIsFullScreenVideo] = useState(false);
    const [showDesktopVideo, setShowDesktopVideo] = useState(false);
    const mobileVideoRef = useRef<HTMLVideoElement>(null);
    const desktopVideoRef = useRef<HTMLVideoElement>(null);

    // Touch / swipe state
    const touchStartXRef = useRef<number | null>(null);
    const touchStartYRef = useRef<number | null>(null);

    const customizationEnabled = !settings?.hideCustomization;
    const dictionaryLevel: 'basic' | 'default' | 'linguist' = settings?.dictionaryLevel || 'default';
    const colorWordSegments: boolean = settings?.colorWordSegments !== false;

    // Build dynamic list of slides based on whether customization is enabled
    const slides: SlideId[] = React.useMemo(() => {
        const list: SlideId[] = [
            'welcome',
            'basics',
            'customization-choice'
        ];
        if (customizationEnabled) {
            list.push('customization-tabs', 'login-backup');
        }
        list.push('dictionary-mode', 'video-tour');
        return list;
    }, [customizationEnabled]);

    // Reset slide index when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(0);
            setShowWhatIsThis(false);
            setIsFullScreenVideo(false);
            setShowDesktopVideo(false);
        }
    }, [isOpen]);

    // Clamp index if slides array shrinks
    useEffect(() => {
        if (currentIndex >= slides.length) {
            setCurrentIndex(Math.max(0, slides.length - 1));
        }
    }, [slides.length, currentIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isFullScreenVideo) {
                if (e.key === 'Escape') {
                    setIsFullScreenVideo(false);
                }
                return;
            }
            if (showWhatIsThis) {
                if (e.key === 'Escape') setShowWhatIsThis(false);
                return;
            }
            if (e.key === 'ArrowRight') {
                setCurrentIndex(i => Math.min(slides.length - 1, i + 1));
            } else if (e.key === 'ArrowLeft') {
                setCurrentIndex(i => Math.max(0, i - 1));
            } else if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, slides.length, showWhatIsThis, isFullScreenVideo, onClose]);

    // Helper to determine if current device is mobile
    const isMobileDevice = () => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    };

    // Handle video launch: full-screen on mobile, inline player on desktop
    const handleWatchVideo = () => {
        if (isMobileDevice()) {
            setIsFullScreenVideo(true);
        } else {
            setShowDesktopVideo(true);
        }
    };

    useEffect(() => {
        if (isFullScreenVideo && mobileVideoRef.current) {
            const v = mobileVideoRef.current;
            v.play().catch(() => {});
            if (v.requestFullscreen) {
                v.requestFullscreen().catch(() => {});
            } else if ((v as any).webkitEnterFullscreen) {
                try {
                    (v as any).webkitEnterFullscreen();
                } catch {}
            }
        }
    }, [isFullScreenVideo]);

    if (!isOpen) return null;

    const currentSlide = slides[currentIndex] || 'welcome';
    const isFirstSlide = currentIndex === 0;
    const isLastSlide = currentIndex === slides.length - 1;

    const goNext = () => {
        if (isLastSlide) {
            onClose();
        } else {
            setCurrentIndex(i => Math.min(slides.length - 1, i + 1));
        }
    };

    const goBack = () => {
        if (!isFirstSlide) {
            setCurrentIndex(i => Math.max(0, i - 1));
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartXRef.current === null || touchStartYRef.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
        const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
        touchStartXRef.current = null;
        touchStartYRef.current = null;

        // Only trigger horizontal swipe if horizontal movement dominates vertical scroll
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
            if (deltaX < 0 && !isLastSlide) {
                // Swipe left -> next
                setCurrentIndex(i => Math.min(slides.length - 1, i + 1));
            } else if (deltaX > 0 && !isFirstSlide) {
                // Swipe right -> back
                setCurrentIndex(i => Math.max(0, i - 1));
            }
        }
    };

    const setCustomizationChoice = (enableCustom: boolean) => {
        setSettings((s: any) => ({
            ...s,
            hideCustomization: !enableCustom
        }));
    };

    const setDictionaryModeChoice = (level: 'basic' | 'default' | 'linguist') => {
        setSettings((s: any) => ({
            ...s,
            dictionaryLevel: level,
            combinedCedVerbs: level === 'linguist' ? 'full' : s.combinedCedVerbs,
            separateStativeShims: level === 'linguist'
        }));
    };

    const setColorCodingChoice = (colored: boolean) => {
        setSettings((s: any) => ({
            ...s,
            colorWordSegments: colored
        }));
    };

    // Determine Slide 4 screenshots based on mode + color-coding
    const getModeScreenshot = () => {
        if (dictionaryLevel === 'basic') {
            return colorWordSegments ? tutorialAsset('mode_basic.png') : tutorialAsset('mode_basicB.png');
        }
        if (dictionaryLevel === 'default') {
            return colorWordSegments ? tutorialAsset('mode_default.png') : tutorialAsset('mode_defaultB.png');
        }
        return tutorialAsset('mode_linguist.png');
    };

    const getFormsScreenshot = () => {
        return colorWordSegments ? tutorialAsset('forms_color.png') : tutorialAsset('forms_nocolor.png');
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[19000] bg-[#FAF8F6] dark:bg-slate-950 flex flex-col overflow-hidden animate-fade-in select-none"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Top Bar: Title, Progress Dots, & Close Button */}
            <div className="h-14 sm:h-16 px-4 sm:px-6 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0">
                <div className="w-10">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                        {currentIndex + 1} / {slides.length}
                    </span>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center gap-2" role="tablist" aria-label="Tutorial progress">
                    {slides.map((id, idx) => {
                        const isActive = idx === currentIndex;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => setCurrentIndex(idx)}
                                aria-label={`Go to page ${idx + 1}`}
                                aria-selected={isActive}
                                className={`h-2.5 rounded-full transition-all duration-200 ${
                                    isActive
                                        ? 'w-7 bg-[#af615d] dark:bg-amber-500 shadow-xs'
                                        : idx < currentIndex
                                        ? 'w-2.5 bg-[#af615d]/45 dark:bg-amber-500/45 hover:bg-[#af615d]/70'
                                        : 'w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                                }`}
                            />
                        );
                    })}
                </div>

                <div className="w-10 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Close tutorial"
                        aria-label="Close tutorial"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Slide Content Area (Full screen with centered readable column) */}
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-8 flex justify-center">
                <div className="max-w-xl w-full flex flex-col h-full py-1">
                    {/* SLIDE 1: WELCOME */}
                    {currentSlide === 'welcome' && (
                        <div className="my-auto flex flex-col items-center text-center py-6 space-y-5 animate-fade-in">
                            <div className="w-20 h-20 rounded-2xl bg-[#af615d] dark:bg-amber-600 text-white flex items-center justify-center shadow-lg">
                                <BookOpen size={42} />
                            </div>
                            <div className="space-y-2">
                                <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400 bg-[#ffe7e3]/70 dark:bg-amber-950/50 px-3.5 py-1 rounded-full">
                                    Welcome
                                </span>
                                <h2 className="font-noto-serif text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
                                    Welcome to ganehldiha
                                </h2>
                            </div>
                            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
                                <strong>ganehldiha</strong> is an interactive Cherokee-English dictionary, text reader, and language study companion.
                            </p>
                            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                                Let's take a quick walkthrough to explore the app and set up a few preferences to match how you want to use it. You can change any of these settings later.
                            </p>
                        </div>
                    )}

                    {/* SLIDE 2: BASIC NON-CUSTOMIZATION FEATURES */}
                    {currentSlide === 'basics' && (
                        <div className="my-auto space-y-4 animate-fade-in">
                            <div className="text-center space-y-1 mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                    Core Features
                                </span>
                                <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                                    Exploring the Dictionary &amp; Corpus
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                    Every mode of ganehldiha includes four main study tabs:
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                                        <Search size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Search</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                                            Look up words, verb conjugations, and example sentences by syllabary, transliteration, or English definition, with audio recordings and grammar details.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                                        <ListIcon size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Lists</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                                            Bookmark favorite words and sentences or organize them into your own study lists, alongside official curated lists.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                                        <BookOpen size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Reader</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                                            Read stories and texts in Cherokee and tap any highlighted word to see its dictionary entry and breakdown in context.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-2.5 rounded-xl bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                                        <Layout size={22} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Widgets</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                                            Use interactive mini-apps and study widgets for practice and reference.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SLIDE 3: CUSTOMIZATION CHOICE (Screenshot ABOVE Options) */}
                    {currentSlide === 'customization-choice' && (
                        <div className="h-full flex flex-col justify-between animate-fade-in min-h-[480px]">
                            {/* TOP: Title and Navigation Screenshot anchored to top */}
                            <div className="space-y-3 shrink-0">
                                <div className="text-center space-y-1">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                        Customization
                                    </span>
                                    <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                                        How would you like to use ganehldiha?
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                        In addition to the built-in dictionary, ganehldiha lets you add your own words, sentences, audio recordings, and community packages—or you can hide those tools for a cleaner dictionary view.
                                    </p>
                                </div>

                                {/* 1. Navigation Bar Preview Screenshot (ABOVE options) */}
                                <div>
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 text-center">
                                        Navigation Bar Preview
                                    </span>
                                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white">
                                        <img
                                            src={customizationEnabled ? tutorialAsset('custom_on.png') : tutorialAsset('custom_off.png')}
                                            alt={customizationEnabled ? 'Navigation tabs with customization enabled' : 'Navigation tabs with customization hidden'}
                                            className="w-full h-auto block"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Gap */}
                            <div className="flex-1 min-h-[16px]" />

                            {/* 2. Choice Cards (BELOW the screenshot, anchored to bottom) */}
                            <div className="grid grid-cols-1 gap-2.5 mt-auto shrink-0 pb-1">
                                <button
                                    type="button"
                                    onClick={() => setCustomizationChoice(true)}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                                        customizationEnabled
                                            ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-500 shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                            customizationEnabled
                                                ? 'border-amber-600 bg-amber-600 text-white'
                                                : 'border-slate-300 dark:border-slate-600'
                                        }`}
                                    >
                                        {customizationEnabled && <Check size={12} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                            I want to add / create entries
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                            Enables custom Collections, Packages, audio recording, and entry creation tools.
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setCustomizationChoice(false)}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 ${
                                        !customizationEnabled
                                            ? 'border-amber-600 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-500 shadow-xs'
                                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                            !customizationEnabled
                                                ? 'border-amber-600 bg-amber-600 text-white'
                                                : 'border-slate-300 dark:border-slate-600'
                                        }`}
                                    >
                                        {!customizationEnabled && <Check size={12} />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                                            I only want the dictionary
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                            Hides creation, recording, and package management tools for a streamlined viewing experience. (Favorites and Lists remain available.)
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* SLIDE 3b: EXPLANATION OF CUSTOMIZATION TABS (Collections + Packages) */}
                    {currentSlide === 'customization-tabs' && (
                        <div className="my-auto space-y-4 animate-fade-in">
                            <div className="text-center space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                    Custom Tools
                                </span>
                                <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                                    Collections &amp; Packages
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                    With customization enabled, you have two extra tabs in the bottom bar:
                                </p>
                            </div>

                            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-white">
                                <img
                                    src={tutorialAsset('custom_on.png')}
                                    alt="Navigation bar showing Collections and Packages tabs"
                                    className="w-full h-auto block"
                                />
                            </div>

                            <div className="space-y-3 pt-1">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-3 rounded-xl bg-[#ffe7e3] dark:bg-amber-900/40 text-[#af615d] dark:text-amber-400 shrink-0 mt-0.5">
                                        <Book size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Collections</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                                            Create your own personal notebooks and collections of words and sentences. Add custom definitions, conjugated forms, notes, and voice recordings, or import full stories into the Reader.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
                                    <div className="p-3 rounded-xl bg-[#ffe7e3] dark:bg-amber-900/40 text-[#af615d] dark:text-amber-400 shrink-0 mt-0.5">
                                        <Box size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">Packages</h3>
                                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                                            Browse and install optional expansion packages (such as additional texts), import packages shared by teachers or friends, or export your own collections to share with others.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SLIDE 3c: LOGIN FOR ONLINE BACKUP */}
                    {currentSlide === 'login-backup' && (
                        <div className="my-auto flex flex-col items-center text-center py-6 space-y-5 animate-fade-in">
                            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shadow-md">
                                {user ? <CloudCheck size={36} /> : <UserIcon size={36} />}
                            </div>

                            <div className="space-y-2">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                    Cloud Backup (Optional)
                                </span>
                                <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 max-w-md">
                                    Would you like to log in to save your custom data?
                                </h2>
                            </div>

                            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
                                By default, your custom entries, notes, lists, and collections are saved on this device. Signing in with an account automatically backs them up online and syncs them across your devices.
                            </p>

                            {user ? (
                                <div className="w-full max-w-sm p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-3 text-left">
                                    <div className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                                        <Check size={22} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                            Signed In
                                        </div>
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                                            {user.displayName || user.email}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Cloud backup is active.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onOpenAuth}
                                        className="text-xs font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                                    >
                                        Account
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full max-w-xs space-y-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={onOpenAuth}
                                        className="w-full py-3.5 px-5 bg-[#af615d] hover:bg-[#9b534f] dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 text-sm"
                                    >
                                        <UserIcon size={18} />
                                        <span>Log In / Create Account</span>
                                    </button>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                        You can also skip this for now and log in anytime from the top bar or Settings.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* SLIDE 4: DICTIONARY MODE & COLOR-CODING (Screenshots anchored to top, buttons anchored to bottom) */}
                    {currentSlide === 'dictionary-mode' && (
                        <div className="h-full flex flex-col justify-between animate-fade-in min-h-[580px] sm:min-h-[640px]">
                            {/* TOP: Header + Screenshot Preview anchored to the top */}
                            <div className="space-y-2 shrink-0">
                                <div className="text-center space-y-1">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                        Entry Display
                                    </span>
                                    <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
                                        Choose Your Dictionary Mode
                                    </h2>
                                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                                        Select how much grammatical detail you want to see on word entries:
                                    </p>
                                </div>

                                {/* Live Preview Screenshots (Anchored at top) */}
                                <div className="pt-1">
                                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center mb-1">
                                        Entry View Preview
                                    </span>
                                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-[#FAF8F6] divide-y divide-slate-200/70">
                                        <img
                                            src={getModeScreenshot()}
                                            alt={`Entry header in ${dictionaryLevel} mode`}
                                            className="w-full h-auto block"
                                        />
                                        <img
                                            src={getFormsScreenshot()}
                                            alt={`Verb forms with color-coding ${colorWordSegments ? 'enabled' : 'disabled'}`}
                                            className="w-full h-auto block"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SUFFICIENT GAP: absorbs any height variation of the screenshots above */}
                            <div className="flex-1 min-h-[20px] sm:min-h-[32px]" />

                            {/* BOTTOM: Buttons anchored to the bottom */}
                            <div className="space-y-3.5 mt-auto shrink-0 pb-1">
                                {/* 1. Mode Selector: Basic / Default / Linguistics */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                            Dictionary Mode
                                        </label>
                                        {(dictionaryLevel === 'default' || dictionaryLevel === 'linguist') && (
                                            <button
                                                type="button"
                                                onClick={() => setShowWhatIsThis(true)}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-[#af615d] dark:text-amber-400 hover:underline bg-[#ffe7e3]/60 dark:bg-amber-950/50 px-2.5 py-0.5 rounded-full transition-colors"
                                            >
                                                <HelpCircle size={13} />
                                                <span>What is this?</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                        {([
                                            { value: 'basic', label: 'Basic' },
                                            { value: 'default', label: 'Default' },
                                            { value: 'linguist', label: 'Linguistics' }
                                        ] as const).map(opt => {
                                            const isSelected = dictionaryLevel === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDictionaryModeChoice(opt.value)}
                                                    className={`py-2 px-2 rounded-lg font-bold transition-all text-center ${
                                                        isSelected
                                                            ? 'bg-[#af615d] dark:bg-amber-600 text-white shadow-xs'
                                                            : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="min-h-[2.5rem] mt-1.5 flex items-start">
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {dictionaryLevel === 'basic' &&
                                                'Simplified view: Shows the headword, definition, and forms without root blueprints or root grouping.'}
                                            {dictionaryLevel === 'default' &&
                                                'Standard view: Displays the word alongside its verb root blueprint and groups related verbs by root.'}
                                            {dictionaryLevel === 'linguist' &&
                                                'Linguistics view: Leads directly with the verb root blueprint and morphological structure above conjugated forms.'}
                                        </p>
                                    </div>
                                </div>

                                {/* 2. Color-Coding Selector */}
                                <div>
                                    <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider block mb-1.5">
                                        Verb Part Highlighting
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setColorCodingChoice(true)}
                                            className={`py-2 px-2 rounded-lg font-bold transition-all text-center ${
                                                colorWordSegments
                                                    ? 'bg-[#af615d] dark:bg-amber-600 text-white shadow-xs'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                            }`}
                                        >
                                            Show parts of verb when available
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setColorCodingChoice(false)}
                                            className={`py-2 px-2 rounded-lg font-bold transition-all text-center ${
                                                !colorWordSegments
                                                    ? 'bg-[#af615d] dark:bg-amber-600 text-white shadow-xs'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                                            }`}
                                        >
                                            Do not color-code verb parts
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SLIDE 5: VIDEO EXPLANATION (Full Screen on Mobile, Inline Player on Desktop) */}
                    {currentSlide === 'video-tour' && (
                        <div className="my-auto flex flex-col items-center text-center py-6 space-y-6 animate-fade-in">
                            <div className="w-16 h-16 rounded-2xl bg-[#af615d] dark:bg-amber-600 text-white flex items-center justify-center shadow-lg">
                                <Play size={36} className="fill-current ml-1" />
                            </div>

                            <div className="space-y-2">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-[#af615d] dark:text-amber-400">
                                    Video Walkthrough
                                </span>
                                <h2 className="font-noto-serif text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 max-w-md">
                                    Would you like to watch a more detailed explanation of what the app has to offer?
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                                    Watch an overview of ganehldiha's features, or complete the onboarding and start exploring.
                                </p>
                            </div>

                            {/* Desktop Inline Video Player */}
                            {showDesktopVideo ? (
                                <div className="w-full max-w-lg space-y-4 animate-fade-in pt-1">
                                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black shadow-xl">
                                        <video
                                            ref={desktopVideoRef}
                                            src={tutorialAsset('placeholder.mp4')}
                                            controls
                                            autoPlay
                                            playsInline
                                            className="w-full aspect-video block"
                                        >
                                            Your browser does not support embedded video.
                                        </video>
                                    </div>
                                    <div className="flex justify-center">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-6 py-3 bg-[#af615d] hover:bg-[#9b534f] dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition-all text-sm active:scale-98"
                                        >
                                            Get Started with ganehldiha
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-sm space-y-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleWatchVideo}
                                        className="w-full py-4 px-6 bg-[#af615d] hover:bg-[#9b534f] dark:bg-amber-600 dark:hover:bg-amber-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2.5 text-base active:scale-98"
                                    >
                                        <Play size={20} className="fill-current" />
                                        <span>Yes, Watch Video</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-full py-3.5 px-6 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-2xl transition-colors text-sm"
                                    >
                                        Skip &amp; Start Using ganehldiha
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Navigation Bar: Small Back & Next Buttons */}
            <div className="h-16 sm:h-20 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between shrink-0 pb-safe">
                <div className="max-w-xl w-full mx-auto flex items-center justify-between">
                    <button
                        type="button"
                        onClick={goBack}
                        disabled={isFirstSlide}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                            isFirstSlide
                                ? 'opacity-0 pointer-events-none'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                        }`}
                    >
                        <ChevronLeft size={18} />
                        <span>Back</span>
                    </button>

                    <button
                        type="button"
                        onClick={goNext}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#af615d] hover:bg-[#9b534f] dark:bg-amber-600 dark:hover:bg-amber-500 text-white shadow-md transition-all active:scale-98"
                    >
                        <span>{isLastSlide ? 'Get Started' : 'Next'}</span>
                        {!isLastSlide && <ChevronRight size={18} />}
                    </button>
                </div>
            </div>

            {/* Full Screen Video Overlay (Only triggered on Mobile) */}
            {isFullScreenVideo && (
                <div className="fixed inset-0 z-[22000] bg-black flex flex-col items-center justify-center animate-fade-in">
                    <button
                        type="button"
                        onClick={() => {
                            if (document.fullscreenElement) {
                                document.exitFullscreen().catch(() => {});
                            }
                            setIsFullScreenVideo(false);
                        }}
                        className="absolute top-4 right-4 z-20 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center gap-1.5 backdrop-blur-md transition-colors"
                        aria-label="Close full-screen video"
                    >
                        <X size={18} />
                        <span>Close Video</span>
                    </button>
                    <video
                        ref={mobileVideoRef}
                        src={tutorialAsset('placeholder.mp4')}
                        controls
                        autoPlay
                        playsInline
                        className="w-full h-full max-h-screen object-contain"
                    >
                        Your browser does not support embedded video.
                    </video>
                </div>
            )}

            {/* "What is this?" Segmentation Explanation Popup */}
            {showWhatIsThis && (
                <div
                    className="fixed inset-0 z-[21000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
                    onClick={() => setShowWhatIsThis(false)}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-in overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
                            <div className="flex items-center gap-2">
                                <HelpCircle size={18} className="text-[#af615d] dark:text-amber-400" />
                                <h3 className="font-noto-serif text-base font-bold text-slate-900 dark:text-slate-100">
                                    About Verb Segmentation &amp; Blueprints
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowWhatIsThis(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                                aria-label="Close popup"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed select-text">
                            <p>
                                Cherokee is a polysynthetic language where a single verb is built from multiple meaningful parts (morphemes) joined together.
                            </p>

                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 space-y-2">
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Parts of a Verb
                                </div>
                                <ul className="space-y-1.5 text-xs">
                                    <li>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Prepronominal Prefixes (Green):</span>{' '}
                                        Indicate direction, location, repetition, or negation at the start of a verb.
                                    </li>
                                    <li>
                                        <span className="font-bold text-red-600 dark:text-red-400">Pronominal Prefixes (Red = Set A, </span>
                                        <span className="font-bold text-blue-500 dark:text-blue-400">Blue = Set B):</span>{' '}
                                        Indicate who is performing or experiencing the action.
                                    </li>
                                    <li>
                                        <span className="font-bold text-slate-500 dark:text-slate-400">Middle Voice &amp; Post-Root Morphemes (Gray):</span>{' '}
                                        Add reflexive/middle meaning or modify the verb stem.
                                    </li>
                                    <li>
                                        <span className="font-bold underline text-slate-900 dark:text-white">Verb Root (Underlined):</span>{' '}
                                        The core meaning of the verb. Tap any root in the blueprint to view all verbs that share it.
                                    </li>
                                    <li>
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Aspect Suffixes &amp; Class (Green):</span>{' '}
                                        The ending pattern showing present, imperfective, past, imperative, or infinitive aspect. Tap the bracketed class to explore other verbs with the same conjugation endings.
                                    </li>
                                </ul>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                                    Where does this data come from?
                                </h4>
                                <p>
                                    The verb segmentation and morphological blueprints come from the{' '}
                                    <strong>King Recreation Verb Morphology</strong> project—an analysis of verbs from Durbin Feeling's 1975{' '}
                                    <em>Cherokee-English Dictionary</em> (CED) that identifies their underlying roots, pronominal sets, and aspect classes.
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Because this analysis specifically covers verbs from the CED, segmentation and color-coding are shown automatically whenever a verb has morphological data available, while nouns, particles, and words from other sources display as regular text.
                                </p>
                                <div className="pt-1 flex flex-wrap gap-3">
                                    <a
                                        href="https://github.com/CharlieMcVicker/king-recreation/tree/main"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                    >
                                        <LinkIcon size={13} />
                                        <span>King Recreation Project (GitHub)</span>
                                    </a>
                                    <a
                                        href="https://cherokeenationdictionary.net/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                    >
                                        <Globe size={13} />
                                        <span>Cherokee Nation Dictionary (CED)</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/60 dark:bg-slate-800/40 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowWhatIsThis(false)}
                                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default TutorialModal;
