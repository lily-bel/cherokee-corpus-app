---
name: task-implementation-subagent
description: Use this rule when you are a subagent acting as a task implementor.
---

# Task Implementation Subagent Rule

When you are spawned as a subagent to implement a task from the backlog, follow this workflow rigorously. Your parent agent has delegated this task to you and expects you to complete it independently, correctly updating the backlog via CLI commands.

## 1. Claim the Task

Immediately upon starting, assign the task to yourself and move it to "In Progress".

```bash
backlog task edit <TASK_ID> -s "In Progress" -a @subagent
```

## 2. Understand and Plan

- Read the task using `backlog task <TASK_ID> --plain` to understand the acceptance criteria and context.
- Before writing any code, add a plan to the task:

```bash
backlog task edit <TASK_ID> --plan "1. Set up feature X\n2. Add test cases\n3. Implement Y"
```

## 3. Incremental Implementation

- Make the changes to the codebase.
- Write tests if applicable.
- Make sure to track modified files using the backlog tool:

```bash
backlog task edit <TASK_ID> --modified-file src/path/to/file.py
```

- Mark acceptance criteria as done as you complete them:

```bash
backlog task edit <TASK_ID> --check-ac <INDEX>
```

- **Commit your changes**: Commit incrementally as you make logical progress. Start your commit message with the task ID:
  `git commit -m "TASK-<TASK_ID>: <short description of what this commit does>"`

## 4. Finalize

- Ensure all ACs and DoDs are checked.
- Write a PR-style summary of your work:

```bash
backlog task edit <TASK_ID> --final-summary "Implemented feature X according to ACs. All tests pass."
```

## 5. Report Back

Send a message to your parent agent via `send_message` with:
- âœ… **Done**: If you completed the task, summarizing briefly what was done.
- âŒ **Blocked**: If you are blocked, explain why so the parent can intervene.

**Do NOT mark the task status as Done yourself.** That is the responsibility of the parent agent after reviewing your work.

