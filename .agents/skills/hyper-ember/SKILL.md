---
name: hyper-ember
description: initial and follow up research during task implementation
---

# Instructions for the usage of Hyper Ember Advanced Search Agent

`hyper-ember` is a multi-stage semantic search and synthesis agent built on top of the base `ember` CLI tool. It automates query planning, search execution, chunk-level GenAI evaluation, and context synthesis to deliver highly accurate answers to codebase research questions.

## Hyper Ember: Advanced Codebase Research Agent

### Assistant Objective

Use `hyper-ember` when starting a research task, exploring unfamiliar modules, onboarding to a codebase, or planning complex changes. It automates multi-stage semantic search, filtering out irrelevant chunks and synthesizing context into precise, actionable answers.

### Core Capabilities

- **Automatic Query Planning**: Translates high-level research questions into multiple target-restricted semantic search queries based on project configuration.
- **Concurrent Chunk Evaluation**: Evaluates candidate chunks concurrently using lightweight LLM calls to filter out noise, keeping only highly relevant context.
- **Context Synthesis**: Automatically retrieves approved chunks via `ember cat` and synthesizes a complete, beautifully structured answer.
- **Repository Onboarding (`--create-config`)**: Scans root directories and reads project documentation (like `README.md`, `pyproject.toml`, or custom docs) to generate a `.hyper-ember.md` directory mapping configuration.
- **AI-Optimized Output (`--plain`)**: Suppresses interactive progress logs, outputting only approved chunk IDs and the clean synthesized markdown for consumption by AI agents.

---

## 1. Onboarding & Configuration

To optimize search queries and target them to the correct directories, ensure a `.hyper-ember.md` file exists at the root of the project. If it does not exist, run onboarding to generate it:

```bash
# Automatically analyze project structure & docs to create .hyper-ember.md
hyper-ember --create-config

# Include additional documentation to guide configuration generation
hyper-ember --create-config --doc docs/architecture.md --doc docs/api-spec.md
```

---

## 2. Research and Codebase Search

### ðŸ” **RESEARCHING** (Use `hyper-ember`)

To ask a high-level research question or search for implementations, invoke `hyper-ember`:

```bash
# Standard interactive run
hyper-ember "How is user token validation and session persistence implemented?"

# AI-Friendly Plain Mode (Recommended for Agent context optimization)
hyper-ember "How is user token validation and session persistence implemented?" --plain
```

### Options Reference

| Option | Shorthand | Description | Default |
|--------|-----------|-------------|---------|
| `--plain` | | Suppress progress logs; output only chunk IDs and clean synthesis | False |
| `--create-config` | | Create `.hyper-ember.md` directory mapping config file | False |
| `--model <name>` | `-m` | Gemini model to use for query generation, evaluation, and synthesis | `gemini-2.5-flash` |
| `--top-k <num>` | `-k` | Number of candidate chunks returned per search query | `5` |
| `--max-queries <num>` | | Maximum number of semantic search queries to plan and run | `3` |
| `--doc <path>` | | Additional documentation files to read (used with `--create-config`) | `[]` |

---

## 3. Best Practices & Workflow

1. **Always Check/Create Config first**: Run `hyper-ember --create-config` when onboarding to a new codebase to map directory responsibilities.
2. **Use `--plain` to preserve context**: When running as an AI agent, always append `--plain` to suppress colorful ANSI logging and progress indicators, obtaining a direct, parseable context package.
3. **Refine questions for better results**: Instead of generic keywords, pass fully descriptive questions or tasks (e.g. `"How does the authentication middleware handle expired tokens?"` instead of `"auth token"`).

---

## 4. Quick Reference: DO vs DON'T

| Action | âœ… DO | âŒ DON'T |
|--------|-------|----------|
| **Codebase Research** | Use `hyper-ember "How does X work?" --plain` | Run 5 different `ember find` queries manually and read all results |
| **New Project Onboarding** | Run `hyper-ember --create-config` to generate configuration | Manually read every folder to figure out where things are |
| **Preserving Agent Tokens** | Use `--plain` flag | Read long interactive outputs with ANSI styling |

