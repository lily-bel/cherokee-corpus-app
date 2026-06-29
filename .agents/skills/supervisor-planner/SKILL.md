---
name: supervisor-planner
description: Use this rule when you are passing implementation plans off to subagents
---

# Supervisory Planner Rule

When handing off an implementation to a subagent, **do not write the code yourself**. Your role is to plan, delegate, monitor, and integrate.

## 1. Launching a Subagent

Use `invoke_subagent` with `Workspace: branch` so the subagent gets an isolated git branch:

- **Type**: `self` (gives the subagent the same tools and rules as you)
- **Workspace**: `branch` (creates an isolated branch; name will follow `subagent-<Role>-<Type>-<uuid>`)
- **Prompt**: Include the full task id, acceptance criteria, and any constraints. The subagent should be able to execute without asking you further questions.

Example prompt structure to give the subagent:
> "Implement TASK-42. Read the task with `backlog task 42 --plain` for full context. Follow the backlog-task-implementor rule. Report back via send_message when done."

## 2. Subagent Responsibilities (what to put in the prompt)

Instruct the subagent to:

1. **Claim the task immediately**:
   ```bash
   backlog task edit 42 -s "In Progress" -a @subagent
   ```
2. **Write an implementation plan** before coding:
   ```bash
   backlog task edit 42 --plan "1. ...\n2. ..."
   ```
3. **Commit incrementally** after each logical step using:
   ```
   TASK-42: <short description of what this commit does>
   ```
4. **Track modified files** on the task:
   ```bash
   backlog task edit 42 --modified-file src/foo.py
   ```
5. **Mark ACs done** as they are completed.
6. **Write a final summary** (PR-style) when done:
   ```bash
   backlog task edit 42 --final-summary "..."
   ```
7. **Report back** via `send_message` to the parent with: âœ… done / âŒ blocked + reason.

## 3. Parent Responsibilities (after the subagent reports back)

1. Review the final-summary on the task (`backlog task 42 --plain`).
2. Inspect the diff on the subagent's branch.
3. Merge the branch (squash or fast-forward depending on commit cleanliness).
4. Mark the task Done: `backlog task edit 42 -s Done`.
5. Delete the subagent branch if no longer needed.

## 4. What NOT to do

- âŒ Don't implement the task yourself â€” delegate.
- âŒ Don't mark a task Done before verifying the subagent's final-summary and ACs.
- âŒ Don't leave subagent branches unmerged indefinitely.

