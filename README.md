# Dance of Tal (DOT)

> **Agent Manager for Agentic AI.** — Modular, type-safe AI context management for the Agentic AI era.

[![npm version](https://img.shields.io/npm/v/dance-of-tal)](https://www.npmjs.com/package/dance-of-tal)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Registry](https://img.shields.io/badge/Registry-Live-emerald)](https://registry.dance-of-tal.workers.dev)

---

## Why DOT Exists

Modern AI-powered development relies on system prompts that have quietly grown into unmaintainable monsters: 1 000-line `AGENTS.md` monoliths copy-pasted across every repo, hardcoded into AI tool configs, and impossible to debug when something breaks.

**The real cost:** When your AI starts hallucinating test files or violating your security review checklist, you don't know which part of that blob is responsible. There is no diff, no versioning, no owner, no rollback.

**Dance of Tal** treats AI behaviour the same way good software treats code:

| Software principle                   | DOT equivalent                                                     |
| ------------------------------------ | ------------------------------------------------------------------ |
| Dependency Injection                 | Context assembled from discrete, typed components                  |
| `package.json` + `node_modules`      | Performer bundles exact Tal + Dance references                     |
| npm registry                         | Global Cloudflare KV registry                                      |
| Multiple CSS classes on one element  | Multiple Dances layered in one Performer                               |
| CI/CD pipeline                       | Every engineer on every machine runs the **exact** same AI persona |

---

## The Mental Model

Picture a newly onboarded senior engineer at your company.

- Their **Tal** is their _professional identity and core rules_ — the thinking framework, role, tone, and non-negotiable rules your company expects. Do they prioritise correctness or delivery speed? Do they design for GDPR compliance by default? This is the **who + always-on rules** of the AI — always applied as the system prompt.
- Their **Dance** is their _skill repertoire_ — techniques they can invoke when needed. Run a security audit. Generate a test suite. Produce structured JSON output. This is the **what the AI can do on-demand**. Only the Dance `description` is included in the prompt; the full `content` is loaded via MCP tool when the Performer needs it.
- A **Performer** bundles a Tal + one or more Dances together — a versioned composition that everyone on the team installs.
- An **Act** is a _participant choreography_ — a shared work scene where multiple performers enter as participants with explicit relations, subscriptions, and shared context. Use it when the AI's identity or collaboration pattern changes mid-task (e.g. normal sprint → incident response mode).

---

## The Four Asset Types

All assets use strict **URN notation**: `<kind>/@<author>/<name>`

> **Note:** Host environment integration (Cursor, Windsurf, Claude, Codex, etc.) is configuration-level behavior, not a registry asset type.

### 1. `Tal` — Persona & Rules

Encodes the AI's _identity and core rules_: role, tone, mental model, and non-negotiable rules that are always applied as the system prompt.

```jsonc
// tal/@acme-platform/senior-backend-engineer
{
  "$schema": "https://schemas.danceoftal.com/assets/tal.v1.json",
  "kind": "tal",
  "urn": "tal/@acme-platform/senior-backend-engineer",
  "description": "Backend engineer mindset for ACME's platform team.",
  "tags": ["backend", "kotlin", "spring", "platform"],
  "payload": {
    "content": "You are a senior backend engineer at ACME. You build for correctness, observability, and horizontal scale. You always consider failure modes before writing implementation. You default to Kotlin/Spring Boot, PostgreSQL, and Kafka. You never suggest solutions that don't have a rollback path."
  }
}
```

### 2. `Dance` — Skills

Encodes on-demand _skills and techniques_ the Performer can invoke when needed. Only the `description` is included in the prompt for discoverability; the full `content` is loaded when the Performer decides to use it.

```jsonc
// dance/@acme-platform/pr-review-standard
{
  "$schema": "https://schemas.danceoftal.com/assets/dance.v1.json",
  "kind": "dance",
  "urn": "dance/@acme-platform/pr-review-standard",
  "description": "ACME standard for AI-assisted PR reviews.",
  "tags": ["review", "backend", "security"],
  "payload": {
    "content": "Structure every review as: SUMMARY, RISKS (severity: low|medium|high|critical), REQUIRED CHANGES, OPTIONAL SUGGESTIONS. Flag any code touching payment flows with PAYMENT RISK. Never approve a PR that lacks unit tests on business logic paths."
  }
}
```

### 3. `Performer` — The Composition

Bundles a Tal and/or Dances into a versioned composition. Multiple Dances are layered in order — rules concatenate, schemas deep-merge — like CSS classes. **Both tal and dance are optional** (at least one required), enabling tal-only, dance-only, or full performer compositions. Optionally includes model preference and MCP tool configuration.

```jsonc
// performer/@acme-platform/sprint
{
  "$schema": "https://schemas.danceoftal.com/assets/performer.v1.json",
  "kind": "performer",
  "urn": "performer/@acme-platform/sprint",
  "description": "Daily sprint performer with backend posture and layered skills.",
  "tags": ["backend", "sprint"],
  "payload": {
    "tal": "tal/@acme-platform/senior-backend-engineer",
    "dances": [
      "dance/@acme-platform/kotlin-style-guide",
      "dance/@acme-security/gdpr-awareness",
      "dance/@acme-platform/pr-review-standard"
    ],
    "model": {
      "provider": "anthropic",
      "modelId": "claude-sonnet-4"
    }
  }
}
```

### 4. `Act` — Participant Choreography

Defines a shared work scene built from participants and their relations.
Each participant references a performer and optionally overrides
active dances or subscriptions for that act.

```jsonc
// act/@acme-platform/incident-response
{
  "$schema": "https://schemas.danceoftal.com/assets/act.v1.json",
  "kind": "act",
  "urn": "act/@acme-platform/incident-response",
  "description": "Lead-worker incident choreography.",
  "tags": ["workflow", "incident"],
  "payload": {
    "participants": [
      {
        "id": "lead",
        "performer": "performer/@acme-platform/sisyphus",
        "subscriptions": {
          "callboardKeys": ["incident/*"]
        }
      },
      {
        "id": "worker",
        "performer": "performer/@acme-platform/implementer"
      }
    ],
    "relations": [
      {
        "id": "lead-worker-delegate",
        "between": ["lead", "worker"],
        "direction": "one-way",
        "name": "delegate_and_review",
        "description": "Lead delegates implementation and reviews output.",
        "maxCalls": 10,
        "timeout": 300
      }
    ]
  }
}
```

---

## How the Pieces Fit Together

```
┌──────────────────────────────────────────────────────────┐
│                    Global DOT Registry                    │
│    registry.dance-of-tal.workers.dev (Cloudflare KV)     │
│                                                          │
│  tal/@acme-platform/senior-backend-engineer              │
│  dance/@acme-platform/kotlin-style-guide                 │
│  dance/@acme-security/gdpr-awareness                     │
│  act/@acme-platform/incident-response                    │
└────────────────────┬─────────────────────────────────────┘
                     │  dot install
                     ▼
┌──────────────────────────────────────────────────────────┐
│                  Your Project Workspace                   │
│  .dance-of-tal/                                          │
│  ├── assets/                                             │
│  │   ├── tal/@acme-platform/senior-backend-engineer.json │
│  │   ├── dance/@acme-platform/kotlin-style-guide.json    │
│  │   ├── dance/@acme-security/gdpr-awareness.json        │
│  │   └── performer/@acme-platform/sprint.json            │
│  └── registry.json                                       │
└────────────────────┬─────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
      CLI Mode             MCP Mode
   (dot install)      (AI tool calls MCP tools)
   Installs assets    Returns compiled
   + dependencies     context on demand
```

---

## Quick Start

### 1. Install

```bash
npm install -g dance-of-tal
```

### 2. Initialize workspace

```bash
cd your-repo
dot init
# Creates .dance-of-tal/ with registry.json
```

### 3. Login with GitHub

Your GitHub username becomes your protected registry namespace.

```bash
dot login
# Opens browser for Supabase PKCE OAuth (GitHub provider)
# Token + username saved to ~/.dance-of-tal/auth.json
```

### 4. Install your team's assets

```bash
dot install tal/@acme-platform/senior-backend-engineer
dot install dance/@acme-platform/kotlin-style-guide
dot install dance/@acme-security/gdpr-awareness
dot install dance/@acme-platform/pr-review-standard
```

### 5. Install a Performer

```bash
# Daily sprint profile: backend persona + company style + security layer
dot install performer/@acme-platform/sprint

# PR review profile: same persona + review output format
dot install performer/@acme-platform/pr-review
```

Performer install cascading-installs all Tal/Dance dependencies.

---

## Real-World Team Workflows

### Scenario A: Onboarding a new engineer

```bash
# New engineer runs these 2 commands and gets the exact same AI context as the team
dot init
dot install performer/@acme-platform/sprint
```

Instead of sending a Confluence doc with "our AI prompting standards," you send one command.

### Scenario B: Incident response mode

```bash
# Install the P0 incident choreography
dot install act/@acme-platform/incident-response
```



---

## CLI Reference

| Command                                                       | Description                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dot init`                                                    | Scaffold `.dance-of-tal/` workspace                                                               |
| `dot login`                                                   | GitHub OAuth → `~/.dance-of-tal/auth.json`                                                        |
| `dot install <urn>`                                           | Download asset by URN. Performer → cascading install of dependencies                              |
| `dot search <keyword>`                                        | Search global registry by keyword                                                                 |
| `dot list [--mine] [--kind <kind>]`                           | List registry packages                                                                            |
| `dot create --kind <kind> --name <slug>`                      | Scaffold a new asset locally                                                                      |
| `dot publish --kind <kind> --name <slug> --tags <tags>`       | Publish local asset to registry (requires `dot login`)                                            |

### URN Format

```
<kind>/@<author>/<name>

tal/@acme-platform/senior-backend-engineer
dance/@acme-security/gdpr-awareness
act/@acme-platform/incident-response
```

---

## MCP Server Mode

DOT implements the **Model Context Protocol (MCP)**, so AI IDEs can pull the exact compiled context on demand — no copy-pasting prompts.

**Supported:** Cursor · Windsurf · Claude Desktop · Antigravity · Codex · OpenCode · Claude

```jsonc
// .cursor/mcp.json (or Windsurf equivalent)
{
  "mcpServers": {
    "dance-of-tal": {
      "command": "npx",
      "args": ["-y", "dance-of-tal@latest"],
      "env": {
        // Optional: specify only when you need to target a specific project directory.
        // "DANCE_OF_TAL_PROJECT_DIR": "/path/to/your/project"
      }
    }
  }
}
```

By default, DOT auto-discovers the nearest parent containing `.dance-of-tal/` from the MCP process working directory. If no workspace is found, tools like `setup_workspace` and `install_asset` will auto-initialize one at `process.cwd()`. Set `DANCE_OF_TAL_PROJECT_DIR` only when the IDE's working directory differs from your project root.

### MCP Tools (4 tools)

| Tool              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `setup_workspace`    | Initialize `.dance-of-tal/` directory (MCP-driven, no CLI needed) |
| `install_asset`      | Install a Tal or Dance asset from registry into `.dance-of-tal/` |
| `list_assets`        | List locally installed Tal and Dance assets |
| `load_capability_context` | Load full content of an installed capability (Tal or Dance) by URN |

---

## Creating and Publishing Your Own Assets

```bash
dot login
# Your GitHub username becomes your protected namespace

# Create a new asset locally
dot create --kind tal --name my-persona
# → .dance-of-tal/assets/tal/@yourusername/my-persona.json  (local file, not yet in registry)

# Edit the generated template, then publish
dot publish --kind tal --name my-persona --tags "backend,kotlin,platform"
# → Live at: tal/@yourusername/my-persona
```

No `--author` needed — your GitHub login is the namespace. The create → edit → publish flow mirrors npm exactly.

> **Without login:** pass `--author <name>` to `dot create` to specify the namespace manually. You'll need to log in before publishing.

### Publishing rules

- **Namespace protection** — Your URN namespace is your GitHub username. Nobody can publish under `@yourusername`.
- **Schema enforcement** — Registry validates payload shape per asset kind.
- **Immutability** — Once published, a URN cannot be re-published. Payload and description are permanent. Only `tags` can be updated.
- **Cascading publish** — Publishing a Performer or Act auto-publishes missing dependencies (your namespace only).

---

## The Registry

**Base URL:** `https://registry.dance-of-tal.workers.dev`

| Endpoint                                   | Description                               |
| ------------------------------------------ | ----------------------------------------- |
| `GET /registry?kind=tal`                   | List all assets for an asset kind         |
| `GET /registry/:kind/:username/:name`      | Fetch asset by URN                        |
| `POST /publish`                            | Publish (`Authorization: Bearer <token>`) |

---

## Repository Structure

```
dot/
└── src/
    ├── cli/              ← thin CLI adapters (init, install, create, publish, search, list, login)
    │   ├── commands/     ← individual CLI commands
    │   └── utils/        ← shared CLI utilities (ui, update checker)
    ├── contracts/        ← canonical asset schemas (tal, dance, performer, act)
    ├── data/             ← shared type re-exports
    ├── lib/              ← shared core (MCP + CLI both call these)
    │   ├── registry.ts   ← local file I/O (dot dir, asset read/write)
    │   ├── installer.ts  ← registry fetch + install + dependency cascading
    │   ├── publishing.ts ← publish to registry + dependency resolution
    │   ├── identifiers.ts ← URN parsing and validation
    │   └── kinds.ts      ← type definitions for asset kinds
    └── server/index.ts   ← MCP server (3 tools)
```

---

## License

MIT © [monarchjuno](https://github.com/monarchjuno)
