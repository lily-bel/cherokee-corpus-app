# Cherokee Corpus App — Agent Execution Rules & Task Backlog

> **Target File Location:** [`BACKLOG.md`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/BACKLOG.md) & [`backlog.json`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/backlog.json)  
> **Status:** Active Execution Specification & JSON Backlog  
> **CLI Tool:** PyPI `backlog` package (`pip install backlog`)  

---

## 🤖 Agent Execution & Safety Rules

When working on this repository, all AI agents **MUST** follow these mandatory rules:

1. **NO DIRECT DATA CSV EDITING:**  
   > ⛔ **CRITICAL RULE:** Do NOT edit underlying data CSVs or core dictionary files directly in the codebase. All corpus data correction tasks (Bible verses, Raven Rock sentences, adverb tenses) are managed by the user externally in Google Sheets. Agents work on app logic, UI, parser, search engine, and package storage only.

2. **MOBILE-FIRST UI DESIGN:**  
   > 📱 Test and verify all layout changes against mobile viewport widths (<480px) first. Never rely on 3-column desktop layouts for core workflows like story creation or reading.

3. **CLARIFY UNSTATED SPECIFICATIONS:**  
   > ❓ Whenever a task specification or feature detail is unstated or ambiguous, agents should ask the user for clarification before making assumptions or guessing implementation choices.

4. **TASK MANAGEMENT VIA `backlog` CLI & JSON:**  
   > 🛠️ All active tasks and detailed specifications are stored in [`backlog.json`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/backlog.json). Agents must interact with the backlog using the `backlog` Python API or CLI commands:
   > - **View All Tasks:** `python -m backlog --path backlog.json show`
   > - **Inspect Task Spec:** `python -m backlog --path backlog.json show --pattern "Task X.Y"`
   > - **Add New Task:** `python -m backlog --path backlog.json add "Title" --priority 10 --note "Spec..."`
   > - **Complete Task:** Remove task via `python -m backlog --path backlog.json remove "Title"` and log implementation summary in [`COMPLETED_TASKS.md`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/COMPLETED_TASKS.md) AFTER user approval.

---

## 📊 Backlog Storage

All active task specifications, priorities, target files, and verification criteria are housed directly in [`backlog.json`](file:///C:/Users/lilyb/Desktop/cherokee/cherokee-corpus-app/backlog.json).
