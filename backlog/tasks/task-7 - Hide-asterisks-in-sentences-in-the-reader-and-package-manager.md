---
id: TASK-7
title: Hide asterisks in sentences in the reader and package manager
status: Done
assignee:
  - '@antigravity'
created_date: '2026-06-29 18:39'
updated_date: '2026-06-29 22:04'
labels:
  - UI Fixes
dependencies: []
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
UI Fix
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Remove asterisks from sentences in ReaderView.tsx
- [x] #2 Remove asterisks from sentences in InvestigationQueue.tsx
- [x] #3 Remove asterisks from sentences in PackageDetailView.tsx
- [x] #4 Remove asterisks from sentences in ListsTab.tsx
- [x] #5 Remove asterisks from sentences in WordFormsModal.tsx
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Import renderStyledText from '../utils' in ReaderView.tsx, InvestigationQueue.tsx, PackageDetailView.tsx, ListsTab.tsx, and WordFormsModal.tsx.\n2. Update tokenizeSentence / token parsing in ReaderView.tsx, InvestigationQueue.tsx, and PackageDetailView.tsx to strip asterisks from syllabary and transliteration tokens.\n3. Wrap English sentence/definition rendering in renderStyledText(...) across ReaderView.tsx, InvestigationQueue.tsx, PackageDetailView.tsx, ListsTab.tsx, and WordFormsModal.tsx.\n4. Verify that asterisks are no longer visible in these components and formatting/bolding works correctly.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Hid asterisks from sentences rendered in ReaderView, InvestigationQueue, PackageDetailView, ListsTab, and WordFormsModal. Used renderStyledText to style/bold highlighted words in English sentence translations, and replaced asterisks with empty strings for Cherokee syllabary and transliteration words. Verified with successful project build.
<!-- SECTION:FINAL_SUMMARY:END -->
