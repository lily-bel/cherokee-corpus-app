# Cherokee Corpus App — Completed Tasks & Verification Log

> **Target File Location:** `COMPLETED_TASKS.md`  
> **Purpose:** Historical log of finished, verified, and user-approved tasks moved out of `BACKLOG.md` to maximize token efficiency for coding agents.

---

## 🏆 Completed Task Log

### Task: Firebase Integration for Cloud Data Backup, Auth, & Public Package Link Sharing
- **Completion Date:** 2026-09-04
- **Status:** `[Completed]`
- **Target Files:** [`firebase.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/firebase.ts), [`components/AuthContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/AuthContext.tsx), [`components/AuthModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/AuthModal.tsx), [`components/PackageLinkImportView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageLinkImportView.tsx), [`components/PackageExportModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageExportModal.tsx), [`components/PackageImportModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageImportModal.tsx), [`components/PackageDetailView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageDetailView.tsx), [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/packageParser.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/packageParser.ts), [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts), [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`components/Icons.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/Icons.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`public/404.html`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/public/404.html), [`index.html`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/index.html), [`index.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/index.tsx)
- **Implementation Summary:**
  1. **Strict Database Wrapper (`DictionaryDB` in `firebase.ts`):** Forces all Realtime Database operations strictly underneath the parent `dictionary/` path (`/dictionary/...`) and prevents directory traversal attempts (`..`). Provides key encoding/decoding (`encodeFirebaseData`/`decodeFirebaseData`) to escape illegal RTDB characters (`.`, `#`, `$`, `/`, `[`, `]`).
  2. **Shared Authentication (`AuthContext.tsx` & `AuthModal.tsx`):** Shares Firebase project credentials with the Cherokee online lesson site (`cherokee-language-exerci-5bac5`). Supports Google, Facebook, and Email/Password sign in, registration, password reset, and user metadata updating under `dictionary/users/$userId/metadata`.
  3. **Cloud Data Backup & Debounced Auto-Sync:** Debounce-syncs local library data (custom dictionaries, personal words, user sentences, glosses, word forms, notes, lists, favorites) and installed package IDs to `dictionary/users/$userId/library` and `installedPackages` (excluding heavy audio blobs and widgets). Performs two-way merge on initial login.
  4. **Public Package Sharing via Link:** Exporting packages with "Share via Public Link" enabled saves package JSON under `dictionary/users/$userId/packages/$packageId` (matching ZIP bundle JSON structure) and publishes the pointer `dictionary/public_packages/$packageId -> { author: $userId }`.
  5. **Package Versioning (`updateOf`):** Added version lineage support allowing users to declare updates of existing packages via dropdown in `PackageExportModal` and direct "Export New Version" action in `PackageDetailView`.
  6. **Public Link Resolution & Import View (`PackageLinkImportView.tsx` & `PackageImportModal.tsx`):** Visiting `/:packageId` (or `?package=:packageId`) renders a package inspection and import screen with auth prompt, statistics preview, and one-click installation. Added "From Link" tab in `PackageImportModal` for manual link or ID retrieval. Added GitHub Pages SPA redirect (`public/404.html` and `index.html` decoder).
  7. **Header UI Integration:** Topbar user account button with live sync status badge and `user.svg` icon design, wired to `AuthModal` across the main header, Package Manager, and Settings dialog.


### Task 4.4: Sentence Deletion Confirmation Modal
- **Completion Date:** 2026-09-02
- **Status:** `[Completed]`
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`components/SentenceCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/SentenceCard.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx)
- **Implementation Summary:**
  1. Replaced browser `window.confirm` alerts on sentence deletion with a styled confirmation `Modal` matching dictionary, word, chapter, and book deletion modals.
  2. Implemented `sentenceToDelete` state in `App.tsx` with a confirm dialog displaying a preview snippet of the sentence, a red `Delete` action button, and a `Cancel` button.
  3. Integrated full cascade cleanup on confirmed sentence deletion: removes associated user glosses, removes references in favorites/custom lists, and pops the navigation stack if the deleted sentence was open in detail view.
  4. Added fallback modal in `SentenceCard.tsx` and wired `onDeleteSentence` through `EntryDetail.tsx`.

### Task 4.1: My Library Gold Package & Package Export Settings
- **Completion Date:** 2026-09-02
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/PackageExportModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageExportModal.tsx)
- **Implementation Summary:**
  1. User-created personal words, sentences, custom dictionary entries, and lists are encapsulated under the default `"My Library"` package.
  2. Distinct Gold/Amber accent badge styling applied to `"My Library"` across package manager views and color picker restrictions.

### Task 4.2: Built-in JSON Data Format Package Export & Import Architecture
- **Completion Date:** 2026-09-02
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts), [`components/PackageManagerContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerContext.tsx), [`components/PackageDetailView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageDetailView.tsx)
- **Implementation Summary:**
  1. Overhauled package export/import architecture to strictly match the built-in data schemas in `public/data/`.
  2. Standardized pure JSON package bundles containing `metadata.json`, `base_forms.json` (nested source objects), `sentences.json` (with reader metadata), `sentence_joins.json` (glosses and alignments), `conjugations.json` (inflection paradigm forms), `entry_data.json` (user notes), `audio_mapping.json` + `audio/` directory, and `lists/*.json`.
  3. Integrated unified normalization for imported packages preserving word forms, custom dictionaries, sentence alignments, and audio blobs.

### Task 4.3: Package Import ZIP Validation & Error Banners
- **Completion Date:** 2026-09-02
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts), [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/UI.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/UI.tsx)
- **Implementation Summary:**
  1. Implemented strict ZIP archive integrity verification and `metadata.json` requirement validation during package import.
  2. Added JSON syntax and structure validation across all package files (`base_forms.json`, `sentences.json`, `sentence_joins.json`, `conjugations.json`, `entry_data.json`, `audio_mapping.json`, `lists/*.json`).
  3. Configured explicit, informative red error toasts in `PackageManagerTab` that surface specific corrupted file names and validation issues without crashing the app.

### Task 1.1: Mobile-First Multi-Step Chapter & Story Creator (Line-by-Line Alignment)
- **Completion Date:** 2026-08-26
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/TextImporter.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/TextImporter.tsx), [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx), [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Overhauled `TextImporter` into a 3-step mobile-first wizard: Step 1 (Book Title & Chapter Name inputs), Step 2 (3 stacked textareas with strict `\n` sentence splitting, live sentence counter badges, alignment validation banner, and clean neutral placeholders), and Step 3 (Interactive Sentence Cards review).
  2. Implemented two-way sync: clicking `Back` from the Review step reconstructs textarea contents from edits made on individual sentence cards.
  3. Created books directly with clean 2-level hierarchy (Book &rarr; Chapters &rarr; Sentences).

### Task 1.2: Add Chapter to Existing Story / Book Support
- **Completion Date:** 2026-08-26
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx), [`components/TextImporter.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/TextImporter.tsx), [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`components/ReaderContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderContext.tsx)
- **Implementation Summary:**
  1. Added toggle in `TextImporter` to "Create New Book" vs "Add Chapter to Existing Book" with dropdown selection of editable books.
  2. Updated `ReaderTab` navigation flow so tapping any book (including 1-chapter books) opens the Chapter selection page.
  3. Added topbar `+` button and bottom dashed `+ Add new chapter` card in chapter view for editable stories.
  4. Added delete functionality for books and chapters with confirmation modals (`Modal`).
  5. Added up/down icon button reordering for chapters, persisting `chapter_order` across user sentences and sorting dynamically in `ReaderContext`.
  6. Cleaned up chapter naming in `ReaderContext` to display exact names without forced `"Chapter "` prefixes.

### Task 1.3: Immersion Reader Expandable Sentence Cards
- **Completion Date:** 2026-08-26
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/ReaderView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderView.tsx), [`components/SentenceCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/SentenceCard.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Added expandable accordion functionality to `ReaderView`: tapping the chevron icon seamlessly expands the row into a full `SentenceCard` with audio controls, recorder, personal notes, and list actions.
  2. Replaced the simple sentence row on expansion to prevent duplicate text display, with a `ChevronUp` header button to collapse back to the compact reader line.
  3. Preserved virtualized container scroll position and height measurements during inline expansion.

### Task 3.2: Gloss Popover & Linker Word Forms Search, Root Headers, & Form Alignment
- **Completion Date:** 2026-08-26
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/GlossPopover.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/GlossPopover.tsx), [`components/LinkerModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/LinkerModal.tsx), [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`components/ReaderView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderView.tsx), [`components/SentenceCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/SentenceCard.tsx), [`components/InvestigationQueue.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/InvestigationQueue.tsx), [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Connected `LinkerModal` search with `wordFormsLookupMap` to search across base entries, official inflections (`Other_Forms`), package forms, and custom user forms.
  2. Rendered `matched form: [syllabary] [translit] ([form_name])` and grouped `-root-` header pills in Linker search results.
  3. Clicking a matched inflected search result auto-captures that specific inflection into the gloss.
  4. Added a unified "Word Form" selector dropdown in Step 2 of `LinkerModal` listing all paradigm forms without detached base-form duplication. If a word only has 1 form, it is listed as `Base Form`.
  5. Added `form_name`, `form_syllabary`, and `form_translit` to the `Gloss` interface, package export/import, and reader gloss editing workflows.
  6. Updated `GlossPopover` to display the `matched form:` sub-label when an inflected form is linked, and added an expandable "Other Forms / Inflections" accordion listing all forms and highlighting the linked form.
- **Verification:** Built cleanly via `npm run build` (`vite v5.4.21 built in 15.95s`), tested, and approved by user.

### Task 7.2: Single-Level Folders for Custom Lists
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/ListsTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ListsTab.tsx), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`components/PackageManagerContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerContext.tsx), [`components/PackageExportModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageExportModal.tsx), [`components/PackageDetailView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageDetailView.tsx), [`scripts/generate_official_lists.py`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/scripts/generate_official_lists.py), [`public/data/lists/official_lists_ced_verbs.json`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/public/data/lists/official_lists_ced_verbs.json)
- **Implementation Summary:**
  1. Implemented single-level list folder structure using `[folder]|[name]` representation with input sanitization (`sanitizeListName`).
  2. Created expandable/collapsible folders with drag-and-drop reordering for folders (`folder:FolderName` tokens in `customListOrder`) and lists.
  3. Isolated pointer events and click handlers on folder headers so drag interactions on grip handles do not trigger expand/collapse.
  4. Optimized item count calculations to instant `$O(1)$` length checks, eliminating drag rendering lag.
  5. Created `"Auto Lists"` folder grouping built-in dynamic lists, and `"Official Lists"` folder containing `"CED Verbs"` (862 CED verb entries generated via script and stored in `public/data/lists/`).
- **Verification:** Built cleanly via `npm run build`, tested folder reordering, collapse toggles, and package export/import parity, approved by user.

### Task 7.1: Mobile Header & Compact Navigation Bar
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx), [`components/ListsTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ListsTab.tsx), [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/WidgetsTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WidgetsTab.tsx), [`components/RootView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/RootView.tsx), [`components/ClassView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ClassView.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx)
- **Implementation Summary:**
  1. Reduced top bar taskbar height across the app from 60px (`h-[60px]`/`py-3`) to 48px (`h-12`).
  2. Applied clean truncation (`truncate`) for header titles to prevent overflow on mobile narrow screens.
  3. Formatted touch targets for header action buttons (`Menu`, `Plus`, `ArrowLeft`, `Upload`) with consistent compact padding.
- **Verification:** Built cleanly via `npm run build`, verified top headers across all tabs and full-screen overlay views.

### Task 5.1: Fix Audio Recording Modal Target Form Prompt
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/AudioRecorder.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/AudioRecorder.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx), [`components/SentenceCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/SentenceCard.tsx)
- **Implementation Summary:**
  1. Updated `AudioRecorder` signature to accept `formLabel` prop and display formatted target prompt headers (e.g. `"Recording for Base Form"`, `"Recording for Present: gawoniha"`, `"Recording for Sentence"`).
  2. Updated `EntryDetail.tsx` and `SentenceCard.tsx` to pass explicit `formLabel`, form transliteration, syllabary, and form notes to `AudioRecorder`.
- **Verification:** Built cleanly via `npm run build`, verified modal headings when recording base words, sentence lines, and inflected word forms.

### Task 5.2: Human-Readable Audio File Naming Format & Package Mapping
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx)
- **Implementation Summary:**
  1. Refactored `saveAudio` in `CorpusContext.tsx` to save local recordings using human-readable IDs (`cherokee_audio_[type]_[id]_[formIndex?]_[slug]_[speaker]_[timestamp]`).
  2. Updated package export in `usePackageHooks.ts` to write clean human-readable audio filenames into the `audio/` directory in the package ZIP.
  3. Added `audio_mapping.json` generation during package export, storing a complete JSON array mapping each exported audio file to its target entry ID (`target_id` / `merged_id`), type (`base_form` / `sentence` / `conjugation`), form index, speaker, and word slug.
  4. Updated package import in `usePackageHooks.ts` to parse `audio_mapping.json` when importing package ZIPs, with regex fallbacks for legacy package ZIPs.
- **Verification:** Built cleanly via `npm run build`, verified ZIP package export and import data structures.

### Task 3.7: Fix Other Forms Click Z-Order & Search Match Priority
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/WordFormsModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordFormsModal.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx)
- **Implementation Summary:**
  1. Updated `WordFormsModal` container z-index to `z-[15000]`. Previously set to `z-[9999]`, causing the modal to render behind `EntryDetail` (`z-[10000]`).
  2. Added click handler (`onClick={() => setShowWordFormsModal(true)}`) and hover feedback to the conjugations/forms block in `EntryDetail.tsx` so clicking word forms opens `WordFormsModal`.
  3. Implemented match priority segment tier checking in `utils.tsx` search engine (Tier 3: Exact Match, Tier 2: Starts With, Tier 1: Contains).
  4. If the base form matches within the same or higher priority segment tier as an inflected form (`mainTier >= otherFormTier`), the search engine assumes the user was typing the base form, returning the entry without displaying redundant `"matched form:"` sub-labels. Sub-labels are only rendered when an inflected form reaches a strictly higher match tier than the base form.
- **Verification:** Built cleanly via `npm run build`, verified search tier matching and modal z-index interactions, approved by user.

### Task 3.1: Strict Back-Stack Navigation (`Root -> Class -> Verb`)
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/RootView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/RootView.tsx), [`components/ClassView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ClassView.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Introduced `NavItem` discriminated union type (`root`, `class`, `entry`) and `navStack` state in `App.tsx` replacing scattered `selectedEntry` / `selectedRoot` / `selectedClass` state variables.
  2. `RootView`, `ClassView`, and `EntryDetail` receive a `style` prop with dynamic `zIndex` (`10000 + index`) so each overlay layer remains mounted in the DOM, preserving scroll position and expanded state behind the top view.
  3. Pressing Back or Close pops exactly 1 level from the stack: `EntryDetail → ClassView → RootView → main page`.
  4. Navigation is synchronized with the HTML5 History API via `updateUrlAndHistory`, storing the serialized nav stack in `window.history.state` on every push/replace so the browser's native Back/Forward buttons restore the exact view stack across unlimited consecutive navigation steps.
  5. Removed `animate-fade-in` from all full-screen overlays for instant, crisp transitions.
- **Verification:** Built cleanly via `npm run build`, Back/Forward verified across multiple navigation levels, approved by user.

### Task 3.3: Word Creation Modal Auto-Syllabary Engine & Transliteration Settings
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/WordModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordModal.tsx), [`components/WordFormsEditor.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordFormsEditor.tsx), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`components/Icons.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/Icons.tsx)
- **Implementation Summary:**
  1. Extracted complete transliteration engine into exported utility functions in `utils.tsx` supporting classic CED, Uchihara aspiration, and reverse aspiration modes.
  2. Added Preferred Transliteration Style selector control to Settings modal.
  3. Added embedded Auto-Syllabary icon button (`TranslateCherokee`) inside the right side of Syllabary input fields in WordModal and WordFormsEditor.
  4. Clicking Auto-Syllabary button converts entered transliteration to Cherokee Syllabary according to active transliteration style setting.
  5. Placed Transliteration field before Syllabary in create/edit form areas and updated Tone input placeholder to `e.g. tsa2la2gi`.
- **Verification:** Built cleanly via `npm run build`, verified form interactions, and approved by user.

---

### Task 2.4: Dedicated Search Bar Settings Dropdown & Search Options
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`components/Icons.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/Icons.tsx)
- **Implementation Summary:**
  1. Added dedicated Filter/Sliders icon button directly inside the search bar.
  2. Clicking button opens a quick popover with search settings, Dictionary/Sentences search mode toggle, filter data sources dropdown, and search options.
  3. Replaced text label "Show PoS in Lists" with "Show Part of Speech".
- **Verification:** Built cleanly via `npm run build`, tested popover functionality, and approved by user.

---

### Task 2.3: Deduplicate 'Other Forms' in Search Results
- **Completion Date:** 2026-08-12
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx)
- **Implementation Summary:**
  1. Updated `performSearch()` in `utils.tsx` to filter out duplicate inflected form cards that share identical surface strings and definition targets.
- **Verification:** Built cleanly via `npm run build`, tested search output deduplication, and approved by user.

---

### Task 2.2: Matched "Other Form" Sub-Labeling on Search Entry Cards
- **Completion Date:** 2026-08-06
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`components/EntryCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryCard.tsx), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Updated `performSearch()` in `utils.tsx` to detect when a search query matches an inflected or other form (from legacy `Other_Forms` or imported `word_forms` / custom forms).
  2. Populated `matchedForm: { syllabary, translit }` on the result item when an inflected form match occurs.
  3. Added rendering logic in `EntryCard.tsx` to display `matched form: [syllabary] [transliteration]` in small italics below the main header.
  4. Updated `wordFormsLookupMap` in `App.tsx` to include `userWordForms`.
- **Verification:** Built cleanly via `npm run build` (`vite v5.4.21 built in 8.18s`), tested, and approved by user.

---

### Task 2.1: CED Search Algorithm Ranking & Length-Weighted Sort
- **Completion Date:** 2026-08-06
- **Status:** `[Completed]` (User Approved)
- **Target Files:** [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Implementation Summary:**
  1. Implemented string normalization (`cleanStr`) in `performSearch()` stripping tone numbers (`1-4`, `¹-⁴`), glottal stops (`ʔ`, `'`, `’`), and spaces when evaluating exact, starts-with, and contains matches.
  2. Exact inflected form matches now score `155` (Exact Tier), cleanly beating partial substring forms (e.g. `ga'i` over `ga'iso'i`).
  3. Applied length ratio scoring (`query.length / target.length * 35`) and entry length tie-breaker so shorter entries consistently rank first within CED and non-CED search tiers.
- **Verification:** Built cleanly via `npm run build` (`vite v5.4.21 built in 7.92s`), tested, and approved by user.

