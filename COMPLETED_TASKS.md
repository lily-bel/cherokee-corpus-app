# Cherokee Corpus App — Completed Tasks & Verification Log

> **Target File Location:** `COMPLETED_TASKS.md`  
> **Purpose:** Historical log of finished, verified, and user-approved tasks moved out of `TASKS.md` to maximize token efficiency for coding agents.

---

## 🏆 Completed Task Log

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

