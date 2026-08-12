# Cherokee Corpus App — Main Developer & Agent Task Roadmap

> **Target File Location:** `TASKS.md`  
> **Status:** Active Reference & Execution Specification  
> **Purpose:** Highly specific, agent-readable task specification organized by app module and category. Formatted for autonomous AI coding agents to pick up, implement, and verify tasks with zero ambiguity.

---

## 🤖 Agent Execution & Safety Rules

When working on this repository, all AI agents **MUST** follow these mandatory rules:

1. **NO DIRECT DATA CSV EDITING:**  
   > ⛔ **CRITICAL RULE:** Do NOT edit underlying data CSVs or core dictionary files directly in the codebase. All corpus data correction tasks (Bible verses, Raven Rock sentences, adverb tenses) are managed by the user externally in Google Sheets. Agents work on app logic, UI, parser, search engine, and package storage only.

2. **MOBILE-FIRST UI DESIGN:**  
   > 📱 Test and verify all layout changes against mobile viewport widths (<480px) first. Never rely on 3-column desktop layouts for core workflows like story creation or reading.

3. **CLARIFY UNSTATED SPECIFICATIONS:**  
   > ❓ Whenever a task specification or feature detail is unstated or ambiguous, agents should ask the user for clarification before making assumptions or guessing implementation choices.

4. **ARCHIVING COMPLETED TASKS:**  
   > 📁 Once a task is finished and user-approved, move its detailed spec to [`COMPLETED_TASKS.md`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/COMPLETED_TASKS.md) and leave a 1-line reference in `TASKS.md` to conserve context tokens for future agents.

---

## 📊 Feature & Task Summary Matrix

| Category / Feature Area | Key Target Files | Scope / Phase | Total Tasks |
| :--- | :--- | :--- | :--- |
| **1. Story Creator & Immersion Reader** | `TextImporter.tsx`, `ReaderTab.tsx`, `ReaderView.tsx` | MVP (High Priority) | 5 |
| **2. Search Engine & Ranking** | `utils.tsx`, `App.tsx`, `EntryCard.tsx` | MVP (High Priority) | 3 |
| **3. Dictionary Navigation & Popups** | `EntryDetail.tsx`, `GlossPopover.tsx`, `WordModal.tsx`, `RootView.tsx` | MVP (High Priority) | 4 |
| **4. Package Management & Storage** | `PackageManagerTab.tsx`, `PackageExportModal.tsx`, `usePackageHooks.ts` | MVP & Post-MVP | 4 |
| **5. Audio Recorder & Media** | `AudioRecorder.tsx`, `WordFormsModal.tsx` | MVP (Medium Priority) | 2 |
| **6. Linguistic Utilities & Tone Engine** | `utils.tsx`, `CorpusContext.tsx` | MVP (Medium Priority) | 2 |
| **7. UI Layout & Mobile Design** | `App.tsx`, `UI.tsx`, `ListsTab.tsx` | MVP (High Priority) | 4 |
| **8. System Backup & Storage Architecture** | `CorpusContext.tsx`, `App.tsx` | MVP (High Priority) | 2 |
| **9. Post-MVP Features & Extensions** | `WidgetsTab.tsx`, `MassEditor.tsx`, `StudyTab.tsx` | Post-MVP | 4 |

---

## 📖 Feature Module 1: Story Creator & Immersion Reader

### Task 1.1: Mobile-First Multi-Step Chapter & Story Creator (Line-by-Line Alignment)
- **Tags:** `[MVP]` `[Priority: High]` `[Feature]` `[Mobile-First]`
- **Target Files:** [`components/TextImporter.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/TextImporter.tsx), [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx)
- **Problem Statement:** 3-column side-by-side text editors fail on mobile screens. Punctuation-based splitting creates sentence count mismatches.
- **Specification:**
  1. **Step 1 — Raw Text Inputs:** Provide 3 stacked full-width textareas for:
     - Cherokee Syllabary (e.g. ᏣᎳᎩ)
     - Transliteration / Phonetic (e.g. Tsalagi)
     - English Translation
  2. **Step 2 — Strict Line-by-Line Tokenization & Live Counters:**
     - Split inputs strictly by line breaks (`\n`). Each line equals 1 sentence (`1 line = 1 sentence`).
     - Render live counter badges above textareas: `# Syllabary lines`, `# Transliteration lines`, `# English lines`.
     - **Alignment Validation:**
       - If line counts match across all 3 inputs -> Show green readiness banner: *"Sentences Aligned (X lines)"*. Enable "Next: Review Sentences" button.
       - If line counts differ -> Show red warning banner: *"Sentence count mismatch: Syllabary (X lines), Transliteration (Y lines), English (Z lines). Please adjust text before proceeding."* Disable Next button.
  3. **Step 3 — Mobile Sentence Card Review & Save:**
     - Render vertical list of cards (Line 1, Line 2, ...) displaying Syllabary, Transliteration, and English with inline edit capabilities.
- **Verification Criteria:**
  - Paste 10 lines in each textarea -> Green banner shows 10 sentences -> Clicking Next creates chapter with 10 aligned sentences.
  - Paste 10 lines in Syllabary and 9 in English -> Warning banner displays exact line counts and disables Next button.

---

### Task 1.2: Add Chapter to Existing Story Support
- **Tags:** `[MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx), [`components/TextImporter.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/TextImporter.tsx)
- **Specification:**
  1. Add a toggle in `TextImporter`: `[Create New Story]` vs `[Add Chapter to Existing Story]`.
  2. When adding a chapter, display dropdown selector of existing books in `ReaderContext`.
  3. Automatically assign `chapter_number = existingChapters.length + 1` and append the new chapter data to the selected book object.
- **Verification Criteria:**
  - Select existing story -> Import 3 sentences -> Appends new chapter to existing book without overwriting existing chapters.

---

### Task 1.3: Immersion Reader Expandable Sentence Cards
- **Tags:** `[MVP]` `[Priority: High]` `[Feature]`
- **Target Files:** [`components/ReaderView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderView.tsx), [`components/SentenceCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/SentenceCard.tsx)
- **Specification:**
  1. In `ReaderView`, add a discrete chevron / caret icon (`ChevronDown` / `ChevronUp`) on the right side of each sentence line.
  2. Tapping the chevron expands an unpadded inline `SentenceCard` directly below the sentence line.
  3. Expanded card reveals full sentence utility features:
     - Sentence audio playback button.
     - "Add to Custom List / Group" button.
     - Sentence source and reference details.
  4. Individual word taps within the sentence line continue to launch the `GlossPopover`.
- **Verification Criteria:**
  - Tap word in reader -> `GlossPopover` opens.
  - Tap caret icon on right side of sentence -> Inline sentence card expands with audio playback and list controls.

---

### Task 1.4: Pre-packaged Cherokee Narratives & Stories Catalog (Post-MVP)
- **Tags:** `[Post-MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/ReaderTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ReaderTab.tsx)
- **Specification:**
  1. Add a "Story Catalog" tab in `ReaderTab` listing pre-packaged Cherokee narrative packages.
  2. One-click "Import to Reader" loads narrative chapters directly into local storage.
- **Verification Criteria:**
  - Select story in catalog -> Import -> Story immediately becomes readable in `ReaderView`.

---

## 🔍 Feature Module 2: Search Engine & Ranking

### Task 2.1: CED Search Algorithm Ranking & Length-Weighted Sort
- **Status:** `[Completed]` (Archived in [`COMPLETED_TASKS.md`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/COMPLETED_TASKS.md))

---

### Task 2.2: Matched "Other Form" Sub-Labeling on Search Entry Cards
- **Status:** `[Completed]` (Archived in [`COMPLETED_TASKS.md`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/COMPLETED_TASKS.md))

---

### Task 2.3: Deduplicate 'Other Forms' in Search Results
- **Tags:** `[MVP]` `[Priority: Medium]` `[Bug]`
- **Target Files:** [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`components/EntryCard.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryCard.tsx)
- **Specification:**
  1. Filter out duplicate inflected form cards that share identical surface strings and definition targets.
- **Verification Criteria:**
  - Search verb root with duplicate gloss paradigms -> Output list displays unique deduplicated forms.

---

### Task 2.4: Dedicated Search Bar Settings Dropdown
- **Tags:** `[MVP]` `[Priority: Medium]` `[UI]`
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Specification:**
  1. Add a dedicated Filter/Sliders button directly inside the search bar.
  2. Clicking button opens a quick popover with search language toggles (Syllabary, Transliteration, English, Tone) and search scope toggles (Main entries, Other forms, Sentences, Notes, Roots).
- **Verification Criteria:**
  - Click filter icon in search bar -> Popover opens and updates active search scope instantly.

---

## 📖 Feature Module 3: Dictionary Views, Navigation & Popups

### Task 3.1: Strict Back-Stack Navigation (`Root -> Class -> Verb`)
- **Tags:** `[MVP]` `[Priority: High]` `[Bug]`
- **Target Files:** [`components/RootView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/RootView.tsx), [`components/ClassView.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ClassView.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Specification:**
  1. Maintain a strict navigation stack array: `[RootView, ClassView, VerbEntryDetail]`.
  2. Pressing the Back button or Close icon pops 1 level off the navigation stack:
     - From Verb Entry Detail -> Returns to Class View.
     - From Class View -> Returns to Root View.
     - From Root View -> Returns to main search/tab page.
- **Verification Criteria:**
  - Open Root -> Select Class -> Select Verb -> Press Back -> Returns to Class View without losing state.

---

### Task 3.2: Gloss Popover Quick 'Other Forms' Accordion
- **Tags:** `[MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/GlossPopover.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/GlossPopover.tsx)
- **Specification:**
  1. Add an expandable section in `GlossPopover` titled `"Other Forms / Inflections"`.
  2. When expanded, query `wordFormsLookupMap` and render inflected forms list with syllabary and transliteration.
- **Verification Criteria:**
  - Click glossed word -> Popover opens -> Expand 'Other Forms' -> List of inflections displays.

---

### Task 3.3: Word Creation Modal Auto-Transliteration
- **Tags:** `[MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/WordModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordModal.tsx), [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx)
- **Specification:**
  1. When typing Cherokee Syllabary in `WordModal`, auto-populate matching Transliteration in `Entry` field if currently blank.
- **Verification Criteria:**
  - Type "ᏣᎳᎩ" in Syllabary field -> Transliteration field automatically populates "tsalagi".

---

### Task 3.4: Solitary Form Labeling & Part of Speech Formatting
- **Tags:** `[MVP]` `[Priority: Medium]` `[Bug]` `[UI]`
- **Target Files:** [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx), [`components/WordFormsModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordFormsModal.tsx)
- **Specification:**
  1. If entry has only 1 form (`forms.length === 1`), display form header as `"Base Form"` instead of `"Singular"`.
- **Verification Criteria:**
  - Open single-form entry -> Header reads "Base Form".

---

## 📦 Feature Module 4: Package Management & Storage Architecture

### Task 4.1: "My Library" Gold Package & Package Export Settings
- **Tags:** `[MVP]` `[Priority: High]` `[Feature]`
- **Target Files:** [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/PackageExportModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageExportModal.tsx)
- **Specification:**
  1. Encapsulate all user-created words, sentences, and custom dictionary entries into a default package named **"My Library"**.
  2. Highlight "My Library" in UI with a distinct **Gold color badge/accent**.
  3. In `PackageExportModal`, add a checkbox: `[ ] Allow package to be edited by importer`.
- **Verification Criteria:**
  - User's personal entries render under "My Library" (Gold badge).
  - Export package modal includes "Allow package to be edited" checkbox option.

---

### Task 4.2: Fix Package Import Compatibility (v1 vs v2 JSON schemas)
- **Tags:** `[MVP]` `[Priority: High]` `[Bug]`
- **Target Files:** [`components/PackageManagerContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerContext.tsx), [`components/usePackageHooks.ts`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/usePackageHooks.ts)
- **Specification:**
  1. Write schema normalizer `normalizePackageData()` supporting legacy and updated JSON keys for `word_forms`, `sentences`, `dictionary`, and metadata.
- **Verification Criteria:**
  - Import legacy package ZIP -> Import succeeds cleanly.

---

### Task 4.3: Package Import ZIP Error Banners
- **Tags:** `[MVP]` `[Priority: High]` `[UI]` `[Bug]`
- **Target Files:** [`components/PackageManagerTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerTab.tsx), [`components/UI.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/UI.tsx)
- **Specification:**
  1. If imported ZIP file is corrupted or missing `manifest.json`, display explicit red error toast without crashing app: *"Import Failed: Invalid package ZIP format."*
- **Verification Criteria:**
  - Drop invalid zip -> Red error toast displays cleanly.

---

### Task 4.4: Editable Packages & Version Control (Post-MVP)
- **Tags:** `[Post-MVP]` `[Priority: Low]` `[Feature]` `[Architecture]`
- **Target Files:** [`components/PackageManagerContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/PackageManagerContext.tsx)
- **Specification:**
  1. Defer editable package sync to Post-MVP Firebase/Cloud Sync architecture.
  2. Implement primitive version control saving historical revisions of packages without complex merging.

---

## 🎙️ Feature Module 5: Audio & Media Management

### Task 5.1: Fix Audio Recording Modal Target Form Prompt
- **Tags:** `[MVP]` `[Priority: Medium]` `[Bug]`
- **Target Files:** [`components/AudioRecorder.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/AudioRecorder.tsx), [`components/WordFormsModal.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WordFormsModal.tsx)
- **Specification:**
  1. Pass explicit form title prop to `AudioRecorder` when recording an inflected form.
- **Verification Criteria:**
  - Recording modal heading displays *"Recording for ᎠᏓᏬᎠ"*.

---

### Task 5.2: Human-Readable Audio File Naming Format
- **Tags:** `[MVP]` `[Priority: Low]` `[Feature]`
- **Target Files:** [`components/AudioRecorder.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/AudioRecorder.tsx)
- **Specification:**
  1. Save audio blobs using format `cherokee_audio_[entry_id]_[word_slug]_[timestamp].webm`.
- **Verification Criteria:**
  - Export recorded audio -> Filename contains entry word title slug.

---

## 🧬 Feature Module 6: Linguistic Utilities & Tone Engine

*(Note: Data corrections for Bible verses, Raven Rock, and adverb tenses are handled externally in Google Sheets by the user per Rule 1).*

### Task 6.1: Tone Regex Engine & Tone Rendering Preferences
- **Tags:** `[MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`utils.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/utils.tsx), [`components/EntryDetail.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/EntryDetail.tsx)
- **Specification:**
  1. Implement tone conversion utilities supporting underdot notation (`ạ`, `ẹ`), superscript numbers (`a¹`, `e²³`), and syllabary tone annotations.
  2. Add tone style selection toggle in settings menu.
- **Verification Criteria:**
  - Select underdot tone setting -> Dictionary entries update tone display dynamically.

---

## 🎨 Feature Module 7: UI Layout & Mobile Optimization

### Task 7.1: Mobile Header & Compact Navigation Bar
- **Tags:** `[MVP]` `[Priority: High]` `[UI]` `[Mobile-First]`
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`index.css`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/index.css)
- **Specification:**
  1. Reduce top bar height from `h-14` to `h-12` on mobile breakpoints (<480px).
  2. Truncate long header titles with ellipsis. Ensure hit targets for menu icons are min 44x44px.
- **Verification Criteria:**
  - Preview at 320px width -> No text overflow or horizontal scrollbar in header.

---

### Task 7.2: Single-Level Folders for Custom Lists
- **Tags:** `[MVP]` `[Priority: Medium]` `[UI]`
- **Target Files:** [`components/ListsTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/ListsTab.tsx)
- **Specification:**
  1. Allow grouping custom lists into single-level expandable/collapsible folders (lists can be placed inside a folder, but folders cannot contain sub-folders).
- **Verification Criteria:**
  - Create folder -> Move list into folder -> Collapse folder -> Folder toggles cleanly.

---

### Task 7.3: Interactive Onboarding Tutorial
- **Tags:** `[MVP]` `[Priority: Medium]` `[UI]`
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`components/UI.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/UI.tsx)
- **Specification:**
  1. Build a 3-step first-time walkthrough overlay introducing Search, Reader, and Custom Lists. Store `hasSeenTutorial` in localStorage.
- **Verification Criteria:**
  - Clear localStorage -> Refresh app -> Tutorial overlay appears.

---

### Task 7.4: App-wide UI Aesthetics Overhaul
- **Tags:** `[MVP]` `[Priority: High]` `[UI]`
- **Target Files:** [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx), [`index.css`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/index.css), [`tailwind.config.js`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/tailwind.config.js)
- **Specification:**
  1. Modern design system with dark/light HSL palettes, glassmorphism cards, Inter/Outfit typography, and micro-animations.
- **Verification Criteria:**
  - Validate visual aesthetics across dark and light themes.

---

## 💾 Feature Module 8: System Backup & Master ZIP Storage Architecture

### Task 8.1: Full App Master ZIP Backup Export & Restore
- **Tags:** `[MVP]` `[Priority: High]` `[Bug]` `[Architecture]`
- **Target Files:** [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx), [`App.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/App.tsx)
- **Problem Statement:** Current backup uses simple JSON dump that drops audio files and package distinctions.
- **Specification:**
  1. Refactor `exportBackup()` to generate a single master `.zip` file (`cherokee_corpus_full_backup_[date].zip`).
  2. **Master ZIP Structure:**
     - `manifest.json`: Master backup index & app configuration.
     - `packages/my_library.zip`: Standalone ZIP archive for "My Library" (Gold package containing user words, sentences, notes, lists).
     - `packages/[package_id].zip`: Standalone ZIP archives for each loaded user package.
  3. **Standalone Usability:** Users can extract any individual `package.zip` from the master backup and re-import or share it independently!
  4. Refactor `restoreBackup()` to unzip master backup and restore all package `.zip` files into IndexedDB.
- **Verification Criteria:**
  - Export full backup -> Extract master ZIP -> Sub-directory contains valid `.zip` files for "My Library" and loaded packages -> Restore master ZIP -> 100% of state restored.

---

### Task 8.2: Online Cloud Backup & Accounts (Post-MVP)
- **Tags:** `[Post-MVP]` `[Priority: Low]` `[Feature]`
- **Target Files:** [`components/CorpusContext.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/CorpusContext.tsx)
- **Specification:**
  1. Firebase / Cloud authentication & remote sync integration.

---

## 🚀 Feature Module 9: Post-MVP Extensions

### Task 9.1: Widgets System Completion
- **Tags:** `[Post-MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/WidgetsTab.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WidgetsTab.tsx), [`components/WidgetViewer.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/WidgetViewer.tsx)
- **Specification:**
  1. Complete and polish the 5 built-in widget modules referenced in `README.md`:
     - **Syllabary Learner:** Interactive tracing, writing, and reading practice for Cherokee syllabary.
     - **Transliteration Utility:** Syllabary <-> Phonetics converter operating in 3 modes.
     - **Pronoun Game:** Practice tool for pronominal prefixes.
     - **Grammar Guide:** Embedded CED online grammar reference guide.
     - **Custom Widget Importer:** Allow users to import custom HTML widget files or embed external learning URLs.

### Task 9.2: Finish Mass Editor Tool
- **Tags:** `[Post-MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** [`components/InvestigationQueue.tsx`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/components/InvestigationQueue.tsx)

### Task 9.3: Flashcards & Spaced Repetition "Study Mode"
- **Tags:** `[Post-MVP]` `[Priority: Medium]` `[Feature]`
- **Target Files:** `components/StudyTab.tsx`

### Task 9.4: Public API & Export Layer
- **Tags:** `[Post-MVP]` `[Priority: Low]` `[Feature]`
- **Target Files:** `scripts/export_api.ts`
