---
name: backlog-task-creator
description: when creating tasks using `backlog`
---

## Defining Tasks

### Creating New Tasks

**Always use CLI to create tasks:**

```bash
# Example
backlog task create "Task title" -d "Description" --ac "First criterion" --ac "Second criterion"
```

### Title (one liner)

Use a clear brief title that summarizes the task.

### Description (The "why")

Provide a concise summary of the task purpose and its goal. Explains the context without implementation details.

### Acceptance Criteria (The "what")

**Understanding the Format:**

- Acceptance criteria appear as numbered checkboxes in the markdown files
- Format: `- [ ] #1 Criterion text` (unchecked) or `- [x] #1 Criterion text` (checked)

**Managing Acceptance Criteria via CLI:**

âš ï¸ **IMPORTANT: How AC Commands Work**

- **Adding criteria (`--ac`)** accepts multiple flags: `--ac "First" --ac "Second"` âœ…
- **Checking/unchecking/removing** accept multiple flags too: `--check-ac 1 --check-ac 2` âœ…
- **Mixed operations** work in a single command: `--check-ac 1 --uncheck-ac 2 --remove-ac 3` âœ…

```bash
# Examples

# Add new criteria (MULTIPLE values allowed)
backlog task edit 42 --ac "User can login" --ac "Session persists"

# Check specific criteria by index (MULTIPLE values supported)
backlog task edit 42 --check-ac 1 --check-ac 2 --check-ac 3  # Check multiple ACs
# Or check them individually if you prefer:
backlog task edit 42 --check-ac 1    # Mark #1 as complete
backlog task edit 42 --check-ac 2    # Mark #2 as complete

# Mixed operations in single command
backlog task edit 42 --check-ac 1 --uncheck-ac 2 --remove-ac 3

# âŒ STILL WRONG - These formats don't work:
# backlog task edit 42 --check-ac 1,2,3  # No comma-separated values
# backlog task edit 42 --check-ac 1-3    # No ranges
# backlog task edit 42 --check 1         # Wrong flag name

# Multiple operations of same type
backlog task edit 42 --uncheck-ac 1 --uncheck-ac 2  # Uncheck multiple ACs
backlog task edit 42 --remove-ac 2 --remove-ac 4    # Remove multiple ACs (processed high-to-low)
```

### Definition of Done checklist (per-task)

Definition of Done items are a second checklist in each task. Defaults come from `definition_of_done` in the project config file (`backlog/config.yml`, `.backlog/config.yml`, or `backlog.config.yml`) or from Web UI Settings, and can be disabled per task.

**Managing Definition of Done via CLI:**

```bash
# Add DoD items (MULTIPLE values allowed)
backlog task edit 42 --dod "Run tests" --dod "Update docs"

# Check/uncheck DoD items by index (MULTIPLE values supported)
backlog task edit 42 --check-dod 1 --check-dod 2
backlog task edit 42 --uncheck-dod 1

# Remove DoD items by index
backlog task edit 42 --remove-dod 2

# Create without defaults
backlog task create "Feature" --no-dod-defaults
```

**Key Principles for Good ACs:**

- **Outcome-Oriented:** Focus on the result, not the method.
- **Testable/Verifiable:** Each criterion should be objectively testable
- **Clear and Concise:** Unambiguous language
- **Complete:** Collectively cover the task scope
- **User-Focused:** Frame from end-user or system behavior perspective

Good Examples:

- "User can successfully log in with valid credentials"
- "System processes 1000 requests per second without errors"
- "CLI preserves literal newlines in description/plan/notes/final summary; `\\n` sequences are not autoâ€‘converted"

Bad Example (Implementation Step):

- "Add a new function handleLogin() in auth.ts"
- "Define expected behavior and document supported input patterns"

### Task Breakdown Strategy

1. Identify foundational components first
2. Create tasks in dependency order (foundations before features)
3. Ensure each task delivers value independently
4. Avoid creating tasks that block each other

### Task Requirements

- Tasks must be **atomic** and **testable** or **verifiable**
- Each task should represent a single unit of work for one PR
- **Never** reference future tasks (only tasks with id < current task id)
- Ensure tasks are **independent** and don't depend on future work

---

