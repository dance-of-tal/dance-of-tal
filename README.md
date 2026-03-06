# Dance of Tal (DOT)

> **Agent Manager for Agentic AI.** — Modular, versioned, type-safe AI context management for the Agentic AI era.

[![npm version](https://img.shields.io/npm/v/dance-of-tal)](https://www.npmjs.com/package/dance-of-tal)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Registry](https://img.shields.io/badge/Registry-Live-emerald)](https://registry.dance-of-tal-v2.workers.dev)

---

## Why DOT Exists

Modern AI-powered development relies on system prompts that have quietly grown into unmaintainable monsters: 1 000-line `AGENTS.md` monoliths copy-pasted across every repo, hardcoded into AI tool configs, and impossible to debug when something breaks.

**The real cost:** When your AI starts hallucinating test files or violating your security review checklist, you don't know which part of that blob is responsible. There is no diff, no versioning, no owner, no rollback.

**Dance of Tal** treats AI behaviour the same way good software treats code:

| Software principle                   | DOT equivalent                                                     |
| ------------------------------------ | ------------------------------------------------------------------ |
| Dependency Injection                 | Context assembled from discrete, typed components                  |
| `package.json` → `package-lock.json` | Performer locks exact Tal + Dance versions                             |
| npm registry                         | Global Cloudflare KV registry                                      |
| Multiple CSS classes on one element  | Multiple Dances layered in one Performer                               |
| CI/CD pipeline                       | Every engineer on every machine runs the **exact** same AI persona |

---

## The Mental Model

Picture a newly onboarded senior engineer at your company.

- Their **Tal** is their _professional identity and core rules_ — the thinking framework, role, tone, and non-negotiable rules your company expects. Do they prioritise correctness or delivery speed? Do they design for GDPR compliance by default? This is the **who + always-on rules** of the AI — always applied as the system prompt.
- Their **Dance** is their _skill repertoire_ — techniques they can invoke when needed. Run a security audit. Generate a test suite. Produce structured JSON output. This is the **what the AI can do on-demand**. Only the Dance `description` is included in the prompt; the full `content` is loaded via MCP tool when the Performer needs it.
- A **Performer** locks a Tal + one or more Dances together — a frozen, versioned snapshot that everyone on the team installs.
- An **Act** _(advanced, experimental)_ is a _context router_ — a DAG that switches AI persona and rules based on runtime conditions (e.g. normal sprint → incident response mode). Act is for multi-phase orchestration where the AI's entire identity changes.

---

## V2 Architecture: The Four Asset Types

All assets use strict **URN notation**: `<kind>/@<author>/<name>`

> **Note:** Host environment integration (Cursor, Windsurf, Claude, Codex, etc.) is configuration-level behavior, not a registry asset type.

### 1. `Tal` — Persona & Rules

Encodes the AI's _identity and core rules_: role, tone, mental model, and non-negotiable rules that are always applied as the system prompt.

```jsonc
// tal/@acme-platform/senior-backend-engineer
{
  "type": "tal/@acme-platform/senior-backend-engineer",
  "version": "3.1.0",
  "description": "Backend engineer mindset for ACME's platform team.",
  "content": "You are a senior backend engineer at ACME. You build for correctness, observability, and horizontal scale. You always consider failure modes before writing implementation. You default to Kotlin/Spring Boot, PostgreSQL, and Kafka. You never suggest solutions that don't have a rollback path.",
  "tags": ["backend", "kotlin", "spring", "platform"],
}
```

### 2. `Dance` — Skills

Encodes on-demand _skills and techniques_ the Performer can invoke when needed. Only the `description` is included in the prompt for discoverability; the full `content` is loaded via MCP tool (`get_dance`) when the Performer decides to use it.

```jsonc
// dance/@acme-platform/pr-review-standard
{
  "type": "dance/@acme-platform/pr-review-standard",
  "version": "1.0.0",
  "description": "ACME standard for AI-assisted PR reviews.",
  "tags": ["review", "backend", "security"],
  "content": "Structure every review as: SUMMARY, RISKS (severity: low|medium|high|critical), REQUIRED CHANGES, OPTIONAL SUGGESTIONS. Flag any code touching payment flows with PAYMENT RISK. Never approve a PR that lacks unit tests on business logic paths.",
  "schema": {
    "type": "object",
    "required": ["summary", "risks", "requiredChanges"],
    "properties": {
      "risks": {
        "type": "array",
        "items": { "enum": ["low", "medium", "high", "critical"] },
      },
    },
  },
}
```

### 3. `Performer` — The Lockfile

Pins a Tal and/or Dances. Multiple Dances are layered in order — rules concatenate, schemas deep-merge — like CSS classes. **Both tal and dance are optional** (at least one required), enabling tal-only, dance-only, or full performer compositions.

```jsonc
// Full performer: tal + layered dances
{
  "tal": "tal/@acme-platform/senior-backend-engineer",
  "dance": [
    "dance/@acme-platform/kotlin-style-guide",
    "dance/@acme-security/gdpr-awareness",
    "dance/@acme-platform/pr-review-standard",
  ],
}

// Tal-only: persona & rules without additional skills
{ "tal": "tal/@acme-platform/senior-backend-engineer" }

// Dance-only: skills without persona
{ "dance": "dance/@acme-platform/pr-review-standard" }
```

### 4. `Act` — Context Router _(Advanced / Experimental)_

Routes between different Tal+Dance pairs conditionally. Use this when the AI's entire persona or ruleset needs to switch mid-task.

```jsonc
// act/@acme-platform/incident-response
// Switches from cautious "architect" persona to fast "fixer" persona on P0
{
  "type": "act/@acme-platform/incident-response",
  "nodes": {
    "triage": {
      "tal": "tal/@acme-platform/senior-backend-engineer",
      "dance": "dance/@acme-platform/incident-triage-format",
    },
    "hotfix": {
      "tal": "tal/@acme-platform/hotfix-specialist",
      "dance": "dance/@acme-platform/minimal-change-only",
    },
    "postmortem": {
      "tal": "tal/@acme-platform/senior-backend-engineer",
      "dance": "dance/@acme-platform/postmortem-format",
    },
  },
  "edges": [
    { "from": "triage", "to": "hotfix", "condition": "SEVERITY=P0" },
    { "from": "triage", "to": "postmortem", "condition": "SEVERITY=P1" },
    { "from": "hotfix", "to": "postmortem" },
  ],
}
```

---

## How the Pieces Fit Together

```
┌──────────────────────────────────────────────────────────┐
│                    Global DOT Registry                    │
│    registry.dance-of-tal-v2.workers.dev (Cloudflare KV)  │
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
│  ├── tal/@acme-platform/senior-backend-engineer.json     │
│  ├── dance/@acme-platform/kotlin-style-guide.json        │
│  ├── dance/@acme-security/gdpr-awareness.json            │
│  ├── performer/sprint.json           ← locked Performer          │
│  └── runs/{uuid}/                ← per-agent sandboxes   │
└────────────────────┬─────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
      CLI Mode             MCP Mode
   (dot install)      (AI tool calls MCP tools)
   Installs assets    Returns compiled
   + auto-locks       context on demand
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
# Creates .dance-of-tal/performer/, .dance-of-tal/runs/
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

Performer install auto-locks and cascading-installs all Tal/Dance dependencies.

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
# Install the P0 ACT workflow
dot install act/@acme-platform/incident-response
```

### Scenario C: Parallel agents in CI

Using MCP mode, your CI pipeline spawns multiple isolated agents:

```
Agent A (run-uuid-001): reviews security implications
Agent B (run-uuid-002): generates test cases
Agent C (run-uuid-003): writes the implementation

Each runs under its own Performer, isolated in .dance-of-tal/runs/{uuid}/
```

---

## CLI Reference

| Command                                                       | Description                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dot init`                                                    | Scaffold `.dance-of-tal/` workspace                                                               |
| `dot login`                                                   | GitHub OAuth → `~/.dance-of-tal/auth.json`                                                        |
| `dot install <urn>`                                           | Download asset by URN. Performer → cascading install + auto-lock (`--no-lock` to skip) |
| `dot search <keyword>`                                        | Search global registry by keyword                                                                 |
| `dot list [--mine] [--kind <kind>]`                           | List registry packages                                                                            |
| `dot create --kind <kind> --name <slug>`                      | Scaffold a new asset locally                                                                      |
| `dot publish --kind <kind> --name <slug> --tags <tags>`       | Publish local asset to registry (requires `dot login`)                                            |
| `dot agents set --agent <name> --performer <performerName>`           | Assign a performer to an agent name (`.dance-of-tal/agents.json`)                                     |
| `dot agents list`                                             | List all agent → performer mappings                                                                   |
| `dot agents remove --agent <name>`                            | Remove an agent from the manifest                                                                 |

### URN Format

```
<kind>/@<author>/<name>

tal/@acme-platform/senior-backend-engineer
dance/@acme-security/gdpr-awareness
act/@acme-platform/incident-response

# Shorthand (kind inferred from flag):
@acme-platform/senior-backend-engineer
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

By default, DOT auto-discovers the nearest parent containing `.dance-of-tal/performer` from the MCP process working directory. If no workspace is found, tools like `setup_workspace` and `install_performer` will auto-initialize one at `process.cwd()`. Set `DANCE_OF_TAL_PROJECT_DIR` only when the IDE's working directory differs from your project root.

### MCP Tools (8 tools)

| Tool              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `get_project_status` | Check workspace init status, performers, agent mappings |
| `setup_workspace`    | Initialize `.dance-of-tal/` directory (MCP-driven, no CLI needed) |
| `search_registry`    | Search the DOT registry for packages |
| `install_performer`      | Install a performer + all deps + auto-lock (MCP-driven) |
| `list_performers`     | List local performers with mode (tal-only/dance-only/performer/act) |
| `init_run`        | Create an isolated run (performerName OR agentName) |
| `get_run_context` | Return the compiled system prompt for that run |
| `clear_run`       | Clean up the sandbox after the run completes   |

---

## Creating and Publishing Your Own Assets

```bash
dot login
# Your GitHub username becomes your protected namespace

# Create a new asset locally
dot create --kind tal --name my-persona --display-name "My Persona"
# → .dance-of-tal/tal/@yourusername/my-persona.json  (local file, not yet in registry)

# Edit the generated template, then publish
dot publish --kind tal --name my-persona --tags "backend,kotlin,platform"
# → Live at: tal/@yourusername/my-persona
```

No `--author` needed — your GitHub login is the namespace. The create → edit → publish flow mirrors npm exactly.

> **Without login:** pass `--author <name>` to `dot create` to specify the namespace manually. You'll need to log in before publishing.

### Publishing rules

- **Namespace protection** — Your URN namespace is your GitHub username. Nobody can publish under `@yourusername`.
- **Schema enforcement** — Registry validates payload shape per asset kind.
- **Semver** — `version` field must follow `MAJOR.MINOR.PATCH`.

---

## The Registry

**Base URL:** `https://registry.dance-of-tal-v2.workers.dev`

| Endpoint                                   | Description                               |
| ------------------------------------------ | ----------------------------------------- |
| `GET /registry?kind=tal`                   | List all assets for an asset kind         |
| `GET /registry?kind=tal&tier=verified`     | List only verified (official) assets      |
| `GET /registry/:kind/:username/:name`      | Fetch asset by URN                        |
| `POST /publish`                            | Publish (`Authorization: Bearer <token>`) |

### Registry Tiers

| Tier        | Namespace                       | Who can publish         | Description                        |
| ----------- | ------------------------------- | ----------------------- | ---------------------------------- |
| `verified`  | `@dot-official`                  | System (admin token)    | Curated official assets            |
| `community` | `@yourusername`                 | Anyone with `dot login` | GitHub-namespaced community assets |

Assets you create with `dot create` live only on your local disk until you run `dot publish`. There is no separate "local tier" — unpublished assets are just local files, identical to how npm treats packages before `npm publish`.

---

## Repository Structure

```
dance-of-tal/
├── mcp/                  ← CLI (dot) + MCP Server — this package
│   └── src/
│       ├── cli/          ← thin CLI adapters (init, install, create, publish, search, list, agents, login)
│       │   ├── commands/ ← individual CLI commands
│       │   └── utils/    ← shared CLI utilities
│       ├── lib/          ← shared core (MCP + CLI both call these)
│       │   ├── registry.ts  ← local file I/O + Performer type
│       │   ├── installer.ts ← registry fetch + install + auto-lock
│       │   ├── engine.ts    ← Tal? + Dance?[] → compiled system prompt
│       │   ├── runs.ts      ← multi-agent run isolation + resolvePerformerName
│       │   ├── agents.ts    ← agents.json read/write
│       │   ├── identifiers.ts ← URN parsing and validation
│       │   └── kinds.ts     ← type definitions for asset kinds
│       └── server/index.ts  ← MCP server (8 tools)
│
├── registry/             ← Cloudflare Worker (Hono + KV) — private
└── front/                ← Next.js registry browser — private
```

---

## License

MIT © [monarchjuno](https://github.com/monarchjuno)
