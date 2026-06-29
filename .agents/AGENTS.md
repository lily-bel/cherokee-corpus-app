
# Instructions for the usage of Backlog.md CLI Tool

## Backlog.md: Comprehensive Project Management Tool via CLI

### Assistant Objective

Efficiently manage all project tasks, status, and documentation using the Backlog.md CLI, ensuring all project metadata
remains fully synchronized and up-to-date.

### Core Capabilities

- âœ… **Task Management**: Create, edit, assign, prioritize, and track tasks with full metadata
- âœ… **Search**: Fuzzy search across tasks, documents, and decisions with `backlog search`
- âœ… **Acceptance Criteria**: Granular control with add/remove/check/uncheck by index
- âœ… **Definition of Done checklists**: Per-task DoD items with add/remove/check/uncheck
- âœ… **Board Visualization**: Terminal-based Kanban board (`backlog board`) and web UI (`backlog browser`)
- âœ… **Git Integration**: Automatic tracking of task states across branches
- âœ… **Dependencies**: Task relationships and subtask hierarchies
- âœ… **Documentation & Decisions**: Structured docs and architectural decision records
- âœ… **Export & Reporting**: Generate markdown reports and board snapshots
- âœ… **AI-Optimized**: `--plain` flag provides clean text output for AI processing

### Why This Matters to You (AI Agent)

1. **Comprehensive system** - Full project management capabilities through CLI
2. **The CLI is the interface** - All operations go through `backlog` commands
3. **Unified interaction model** - You can use CLI for both reading (`backlog task 1 --plain`) and writing (
   `backlog task edit 1`)
4. **Metadata stays synchronized** - The CLI handles all the complex relationships

### Key Understanding

- **Tasks** live in `backlog/tasks/` as `task-<id> - <title>.md` files
- **You interact via CLI only**: `backlog task create`, `backlog task edit`, etc.
- **Use `--plain` flag** for AI-friendly output when viewing/listing
- **Never bypass the CLI** - It handles Git, metadata, file naming, and relationships
- **No Task, No Work**: ANY work you perform (including updating rules, writing code, or altering files) MUST be attached to a task. If a task does not exist for the work requested by the user, you MUST create and scope a new task before you begin any work.

---

# âš ï¸ CRITICAL: NEVER EDIT TASK FILES DIRECTLY. Edit Only via CLI

**ALL task operations MUST use the Backlog.md CLI commands**

- âœ… **DO**: Use `backlog task edit` and other CLI commands
- âœ… **DO**: Use `backlog task create` to create new tasks
- âœ… **DO**: Use `backlog task edit <id> --check-ac <index>` to mark acceptance criteria
- âŒ **DON'T**: Edit markdown files directly
- âŒ **DON'T**: Manually change checkboxes in files
- âŒ **DON'T**: Add or modify text in task files without using CLI

**Why?** Direct file editing breaks metadata synchronization, Git tracking, and task relationships.

---

## 1. Source of Truth & File Structure

### ðŸ“– **UNDERSTANDING** (What you'll see when reading)

- Markdown task files live under **`backlog/tasks/`** (drafts under **`backlog/drafts/`**)
- Files are named: `task-<id> - <title>.md` (e.g., `task-42 - Add GraphQL resolver.md`)
- Project documentation is in **`backlog/docs/`**
  - You can read a doc by name using `find backlog/docs -name '*<DOC_NAME>*' -exec cat {} \;`
  - Do NOT use "backlog doc view <id>" this is an interactive TUI. It will not produce the text for you.
- Project decisions are in **`backlog/decisions/`**

### ðŸ”§ **ACTING** (How to change things)

- **All task operations MUST use the Backlog.md CLI tool**
- This ensures metadata is correctly updated and the project stays in sync
- **Always use `--plain` flag** when listing or viewing tasks for AI-friendly text output
- Create and update project docs through Backlog.md APIs so frontmatter and paths stay valid. For CLI users, run `backlog doc create "Title" -p guides/setup` or `backlog doc update doc-1 --content "Updated markdown"`; MCP users should use `document_create` / `document_update`.
- Document paths are relative to `backlog/docs/`; absolute paths and `..` traversal are rejected.

---

## 2. Common Mistakes to Avoid

### âŒ **WRONG: Direct File Editing**

```markdown
# DON'T DO THIS:

1. Open backlog/tasks/task-7 - Feature.md in editor
2. Change "- [ ]" to "- [x]" manually
3. Add notes or final summary directly to the file
4. Save the file
```

### âœ… **CORRECT: Using CLI Commands**

```bash
# DO THIS INSTEAD:
backlog task edit 7 --check-ac 1  # Mark AC #1 as complete
backlog task edit 7 --notes "Implementation complete"  # Add notes
backlog task edit 7 --final-summary "PR-style summary"  # Add final summary
backlog task edit 7 -s "In Progress" -a @agent-k  # Multiple commands: change status and assign the task when you start working on the task
```

---

## 3. Understanding Task Format (Read-Only Reference)

âš ï¸ **FORMAT REFERENCE ONLY** - The following sections show what you'll SEE in task files.
**Never edit these directly! Use CLI commands to make changes.**

### Task Structure You'll See

```markdown
---
id: task-42
title: Add GraphQL resolver
status: To Do
assignee: [@sara]
labels: [backend, api]
modified_files:
  - src/server/api.ts
  - src/web/components/TaskList.tsx
---

## Description

Brief explanation of the task purpose.

## Acceptance Criteria

<!-- AC:BEGIN -->

- [ ] #1 First criterion
- [x] #2 Second criterion (completed)
- [ ] #3 Third criterion

<!-- AC:END -->

## Definition of Done

<!-- DOD:BEGIN -->

- [ ] #1 Tests pass
- [ ] #2 Docs updated

<!-- DOD:END -->

## Implementation Plan

1. Research approach
2. Implement solution

## Implementation Notes

Progress notes captured during implementation.

## Final Summary

PR-style summary of what was implemented.
```

### How to Modify Each Section

| What You Want to Change | CLI Command to Use                                             |
| ----------------------- | -------------------------------------------------------------- |
| Title                   | `backlog task edit 42 -t "New Title"`                          |
| Status                  | `backlog task edit 42 -s "In Progress"`                        |
| Assignee                | `backlog task edit 42 -a @sara`                                |
| Labels                  | `backlog task edit 42 -l backend,api`                          |
| Description             | `backlog task edit 42 -d "New description"`                    |
| Add AC                  | `backlog task edit 42 --ac "New criterion"`                    |
| Add DoD                 | `backlog task edit 42 --dod "Ship notes"`                      |
| Check AC #1             | `backlog task edit 42 --check-ac 1`                            |
| Check DoD #1            | `backlog task edit 42 --check-dod 1`                           |
| Uncheck AC #2           | `backlog task edit 42 --uncheck-ac 2`                          |
| Uncheck DoD #2          | `backlog task edit 42 --uncheck-dod 2`                         |
| Remove AC #3            | `backlog task edit 42 --remove-ac 3`                           |
| Remove DoD #3           | `backlog task edit 42 --remove-dod 3`                          |
| Add Plan                | `backlog task edit 42 --plan "1. Step one\n2. Step two"`       |
| Add Notes (replace)     | `backlog task edit 42 --notes "What I did"`                    |
| Append Notes            | `backlog task edit 42 --append-notes "Another note"`           |
| Add Final Summary       | `backlog task edit 42 --final-summary "PR-style summary"`      |
| Append Final Summary    | `backlog task edit 42 --append-final-summary "Another detail"` |
| Clear Final Summary     | `backlog task edit 42 --clear-final-summary`                   |

---

## 4. Typical Workflow

```bash
# 1. Identify work
backlog task list -s "To Do" --plain

# 2. Read task details
backlog task 42 --plain

# 3. Start work: assign yourself & change status
backlog task edit 42 -s "In Progress" -a @myself

# 4. Add implementation plan
backlog task edit 42 --plan "1. Analyze\n2. Refactor\n3. Test"

# 5. Share the plan with the user and wait for approval (do not write code yet)

# 6. Work on the task (write code, test, etc.)

# 7. Mark acceptance criteria as complete (supports multiple in one command)
backlog task edit 42 --check-ac 1 --check-ac 2 --check-ac 3  # Check all at once
# Or check them individually if preferred:
# backlog task edit 42 --check-ac 1
# backlog task edit 42 --check-ac 2
# backlog task edit 42 --check-ac 3

# 8. Add Final Summary (PR Description)
backlog task edit 42 --final-summary "Refactored using strategy pattern, updated tests"

# 9. Mark task as done
backlog task edit 42 -s Done
```

---

## 5. Definition of Done (DoD)

A task is **Done** only when **ALL** of the following are complete:

### âœ… Via CLI Commands:

1. **All acceptance criteria checked**: Use `backlog task edit <id> --check-ac <index>` for each
2. **All Definition of Done items checked**: Use `backlog task edit <id> --check-dod <index>` for each
3. **Final Summary added**: Use `backlog task edit <id> --final-summary "..."`
4. **Status set to Done**: Use `backlog task edit <id> -s Done`

### âœ… Via Code/Testing:

5. **Tests pass**: Run test suite and linting
6. **Documentation updated**: Update relevant docs if needed
7. **Code reviewed**: Self-review your changes
8. **No regressions**: Performance, security checks pass

âš ï¸ **NEVER mark a task as Done without completing ALL items above**

---

## 8. Finding Tasks and Content with Search

When users ask you to find tasks related to a topic, use the `backlog search` command with `--plain` flag:

```bash
# Search for tasks about authentication
backlog search "auth" --plain

# Search only in tasks (not docs/decisions)
backlog search "login" --type task --plain

# Search with filters
backlog search "api" --status "In Progress" --plain
backlog search "bug" --priority high --plain

# Find tasks that modified a project file path
backlog search --modified-file src/server/api.ts --plain
```

**Key points:**

- Uses fuzzy matching - finds "authentication" when searching "auth"
- Searches task titles, descriptions, and content
- Also searches `modified_files`; `--modified-file` applies a case-insensitive path substring filter
- Also searches documents and decisions unless filtered with `--type task`
- Always use `--plain` flag for AI-readable output

---

## 6. Quick Reference: DO vs DON'T

### Viewing and Finding Tasks

| Task          | âœ… DO                           | âŒ DON'T                        |
| ------------- | ------------------------------- | ------------------------------- |
| View task     | `backlog task 42 --plain`       | Open and read .md file directly |
| List tasks    | `backlog task list --plain`     | Browse backlog/tasks folder     |
| Check status  | `backlog task 42 --plain`       | Look at file content            |
| Find by topic | `backlog search "auth" --plain` | Manually grep through files     |

### Modifying Tasks

| Task              | âœ… DO                                        | âŒ DON'T                          |
| ----------------- | -------------------------------------------- | --------------------------------- |
| Check AC          | `backlog task edit 42 --check-ac 1`          | Change `- [ ]` to `- [x]` in file |
| Add notes         | `backlog task edit 42 --notes "..."`         | Type notes into .md file          |
| Add final summary | `backlog task edit 42 --final-summary "..."` | Type summary into .md file        |
| Change status     | `backlog task edit 42 -s Done`               | Edit status in frontmatter        |
| Add AC            | `backlog task edit 42 --ac "New"`            | Add `- [ ] New` to file           |

---

## Remember: The Golden Rule

**ðŸŽ¯ If you want to change ANYTHING in a task, use the `backlog task edit` command.**
**ðŸ“– Use CLI to read tasks, exceptionally READ task files directly, never WRITE to them.**

Full help available: `backlog --help`

Rich text documentation for complete CLI reference may be found in backlog docs for this project using `backlog search`.



# Instructions for the usage of Ember Semantic Search Tool

The cli tool `ember` is your primary way of searching code. Listing directories and analyzing files with built-in tools should be avoided to minimize token usage.

## Ember: Semantic Code Search and Retrieval

### Assistant Objective

Select the most efficient search tool based on your search intent to minimize token usage, speed up discovery, and keep your context window focused.

### ðŸ› ï¸ Search Tool Selection Protocol

| Search Type / Intent | Tool to Use | Why / Notes |
|---|---|---|
| **Broad, open-ended research questions** | `hyper-ember "<question>" --plain` | Plans multi-stage queries, filters out noise, and synthesizes answers. |
| **Specific semantic/conceptual questions** | `ember find "<concept>"` | Finds conceptual logic (e.g. "validate session persistence"). *Do NOT use `--json`.* |
| **Exact identifier, function, or string matches** | `rg "<pattern>"` / `grep_search` | Perfect for direct symbol tracking (e.g., finding all imports or definitions of `load_api_key`). |

### Why This Matters to You (AI Agent)

1. **Token Efficiency**: Viewing large files or raw JSON payloads consumes massive token context. Selecting the right tool preserves context space.
2. **High Signal-to-Noise**: Semantic tools find conceptual matches, while `rg` finds exact matches, eliminating manual filtering of irrelevant results.

---

## 1. Searching for Code

### ðŸ” **FINDING** (Use `ember find`)

Use `ember find <query> <directory?> -k <num_results>` to search the codebase.

- This is the **default** way to search for code.
- Ember uses semantic searching. You don't need to search for "def foo" or a specific class name, unless that is what you need. You can search for "login" and it will find implementations of login. You can either use "noun-oriented" or "verb-oriented" searches, modelled below.
- For searching for exact names or definitions, grep is a fine solution. Ember is for finding functionality you don't know the name of.
- _Note:_ Non-code assets (like documentation, decisions, or tasks) may still use other search tools (e.g., `backlog search`).
- Use `-k <max-results>` to limit the number of results. Default is 20, but attempt with 5 or 10 first, to reduce the amount of junk you have to read.
- for piping to other processes, you may use --json flag. this adds to much bloat for normal text-based processing though. Do not use --json if you plan on reading the output directly.

```bash
# Example search (noun-oriented)
ember find "authentication middleware"
# Example search (action-oriented)
ember find "validate user token before request"
```

Full command help:

```
Usage: ember find [OPTIONS] QUERY [PATH]

  Search for code matching the query.

  Performs hybrid search (BM25 + semantic embeddings). Can be run from any
  subdirectory within the repository.

  If PATH is provided, searches only within that path (relative to current
  directory). Examples:     ember find "query"           # Search entire repo
  ember find "query" .          # Search current directory subtree     ember
  find "query" src/       # Search src/ subtree

Options:
  -k, --topk INTEGER     Number of results to return (default: from config).
  --json                 Output results as JSON.
  --in TEXT              Filter results by path glob (e.g., '*.py'). Cannot be
                         used with PATH argument.
  --lang TEXT            Filter results by language (e.g., 'py', 'ts').
  --no-sync              Skip auto-sync check before searching (faster but may
                         return stale results).
  -C, --context INTEGER  Number of surrounding lines to show for each result.
  --help                 Show this message and exit.
```

---

## 2. Reading Code

### ðŸ“– **READING** (Use `ember cat`)

Instead of reading entire files with standard file viewing tools, use `ember cat` with the specific chunk identifiers returned by `ember find`.

```bash
# Example reading a chunk
ember cat <chunk_id>
```

Full command help:

```
Usage: ember cat [OPTIONS] IDENTIFIER

  Display content of a search result by index or chunk ID.

  Use after 'find' to view full chunk content. Can be run from any
  subdirectory within the repository.

  IDENTIFIER can be:   - Numeric index (e.g., '1', '2') from recent search
  results   - Full chunk ID (e.g., 'blake3:a1b2c3d4...')   - Short hash prefix
  (e.g., 'a1b2c3d4') - minimum 8 characters

Options:
  -C, --context INTEGER  Number of surrounding lines to show.
  --help                 Show this message and exit.
```

---

## 3. High-Level Research (Use `hyper-ember`)

For broad or open-ended research questions, codebase onboarding, or module discovery:
- Use the advanced multi-stage wrapper: `hyper-ember "<your question>" --plain`.
- It will automatically plan targeted search queries, execute them via `ember find`, filter out noise concurrently, and synthesize a clear markdown report for your context.

---

## 4. Dealing with Poor Search Results or Bad Matching

If your search requires multiple queries, manual file traversal, or extensive digging due to:

- Poor code/module documentation
- Bad matching or naming conventions

You **MUST** create a ticket in the Backlog to improve the codebase documentation, comment quality, or matching context.

```bash
# Example creating a backlog task for improving documentation
backlog task create "Improve documentation for auth middleware" -d "Semantic search via 'ember find' required multiple attempts due to lack of descriptive comments and docstrings in the auth module." --ac "Add docstrings to all middleware functions" --ac "Document authorization flow in README"
```

---

## 5. Quick Reference: DO vs DON'T

| Action                      | âœ… DO                                            | âŒ DON'T                                                  |
| --------------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| **Broad Research**          | `hyper-ember "How is X done?" --plain`          | Run 5 different manual `ember find` queries and read all |
| **Search Code (Targeted)**  | `ember find "query"` (Do NOT use `--json` as it is a waste of tokens!) | Use `grep_search` or manual terminal search commands      |
| **Read Code Snippets**      | `ember cat <chunk>`                              | Use `view_file` on entire source files (unless necessary) |
| **UX Gaps & Poor Matching** | Create a backlog task to improve docs / comments | Keep searching manually without documenting the gaps      |



