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
| `package.json` → `package-lock.json` | Combo locks exact Tal + Dance versions                             |
| npm registry                         | Global Cloudflare KV registry                                      |
| Multiple CSS classes on one element  | Multiple Dances layered in one Combo                               |
| CI/CD pipeline                       | Every engineer on every machine runs the **exact** same AI persona |

---

## The Mental Model

Picture a newly onboarded senior engineer at your company.

- Their **Tal** is their _professional mindset_ — the thinking framework your company expects. Do they prioritise correctness or delivery speed? Do they design for GDPR compliance by default? This is the **who** of the AI.
- Their **Dance** is their _working methodology_ — the rules they follow on every task. Always write tests first. Always output structured JSON. Always flag security implications. This is the **how** of the AI.
- A **Combo** locks a Tal + one or more Dances together — a frozen, versioned snapshot that everyone on the team installs.
- An **Act** _(advanced, experimental)_ is a _context router_ — a DAG that switches AI persona and rules based on runtime conditions (e.g. normal sprint → incident response mode). Most workflows are handled by Dance Skills; Act is for multi-phase orchestration where the AI's entire identity changes.

---

## V2 Architecture: The Four Asset Types

All assets use strict **URN notation**: `<kind>/@<author>/<name>`

> **Note:** Host environment integration (Cursor, Windsurf, Claude, Codex, etc.) is configuration-level behavior, not a registry asset type.

### 1. `Tal` — Intelligence Persona

Encodes the _thinking layer_: how the AI reasons, what it prioritises, and its professional identity.

```jsonc
// tal/@acme-platform/senior-backend-engineer
{
  "type": "tal/@acme-platform/senior-backend-engineer",
  "version": "3.1.0",
  "description": "Backend engineer mindset for ACME's platform team.",
  "thinking": "You are a senior backend engineer at ACME. You build for correctness, observability, and horizontal scale. You always consider failure modes before writing implementation. You default to Kotlin/Spring Boot, PostgreSQL, and Kafka. You never suggest solutions that don't have a rollback path.",
  "tags": ["backend", "kotlin", "spring", "platform"],
}
```

### 2. `Dance` — Rules & Skills

Encodes the _behavior and capability layer_: structural rules, formatting discipline, JSON Schema enforcement, and executable skills.

```jsonc
// dance/@acme-platform/pr-review-standard
{
  "type": "dance/@acme-platform/pr-review-standard",
  "version": "1.0.0",
  "description": "ACME standard for AI-assisted PR reviews.",
  "tags": ["review", "backend", "security"],
  "rules": "Structure every review as: SUMMARY, RISKS (severity: low|medium|high|critical), REQUIRED CHANGES, OPTIONAL SUGGESTIONS. Flag any code touching payment flows with PAYMENT RISK. Never approve a PR that lacks unit tests on business logic paths.",
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

### 3. `Combo` — The Lockfile

Pins a Tal + one **or more** Dances. Multiple Dances are layered in order — rules concatenate, schemas deep-merge — like CSS classes.

```jsonc
// Layered Dances: base coding standard → security layer → output format
{
  "tal": "tal/@acme-platform/senior-backend-engineer",
  "dance": [
    "dance/@acme-platform/kotlin-style-guide", // base: language standards
    "dance/@acme-security/gdpr-awareness", // layer: data handling rules
    "dance/@acme-platform/pr-review-standard", // layer: output format
  ],
}
```

### 4. `Act` — Context Router _(Advanced / Experimental)_

Routes between different Tal+Dance pairs conditionally. Use this when the AI's entire persona or ruleset needs to switch mid-task. For most workflows, Dance Skills are sufficient.

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
│  ├── combo/sprint.json           ← locked Combo          │
│  └── runs/{uuid}/                ← per-agent sandboxes   │
└────────────────────┬─────────────────────────────────────┘
                     │
           ┌─────────┴─────────┐
      CLI Mode             MCP Mode
   (dot run sprint)   (AI tool calls MCP tools)
   Prints compiled     Returns compiled
   system prompt       context on demand
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
# Creates .dance-of-tal/combo/, .dance-of-tal/runs/
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

### 5. Lock a Combo

```bash
# Daily sprint profile: backend persona + company style + security layer
dot lock \
  --tal   tal/@acme-platform/senior-backend-engineer \
  --dance dance/@acme-platform/kotlin-style-guide,dance/@acme-security/gdpr-awareness \
  --name  sprint

# PR review profile: same persona + review output format
dot lock \
  --tal   tal/@acme-platform/senior-backend-engineer \
  --dance dance/@acme-platform/pr-review-standard \
  --name  pr-review
```

### 6. Compile & validate

```bash
dot compile sprint
# ✔ Compilation sequence completed without errors.
```

### 7. Run

```bash
dot run sprint --task "Implement the /payments/refund endpoint"
```

```
[BEHAVIOR MODE: tal/@acme-platform/senior-backend-engineer]
You are a senior backend engineer at ACME. You build for correctness,
observability, and horizontal scale...

[OUTPUT FORMATTING]
[dance/@acme-platform/kotlin-style-guide]
Use Kotlin idioms. All functions must have explicit return types...

[dance/@acme-security/gdpr-awareness]
Flag any code that stores or transmits PII. Default to data minimisation...

[CURRENT TASK]
Implement the /payments/refund endpoint
```

---

## Real-World Team Workflows

### Scenario A: Onboarding a new engineer

```bash
# New engineer runs these 3 commands and gets the exact same AI context as the team
dot init
dot install tal/@acme-platform/senior-backend-engineer
dot install dance/@acme-platform/kotlin-style-guide
dot install dance/@acme-security/gdpr-awareness
dot lock --tal @acme-platform/senior-backend-engineer \
         --dance @acme-platform/kotlin-style-guide,@acme-security/gdpr-awareness \
         --name sprint
```

Instead of sending a Confluence doc with "our AI prompting standards," you send one command.

### Scenario B: Incident response mode

```bash
# Install the P0 ACT workflow
dot install act/@acme-platform/incident-response

# Lock a combo that includes the incident routing workflow
dot lock \
  --tal   @acme-platform/senior-backend-engineer \
  --dance @acme-platform/kotlin-style-guide \
  --act   act/@acme-platform/incident-response \
  --name  incident

# During a P0 outage, the compiled context includes incident workflow guidance
dot run incident --task "Payment service returning 500 on all POST /charge requests since 03:12 UTC"
```

### Scenario C: Parallel agents in CI

Using MCP mode, your CI pipeline spawns multiple isolated agents:

```
Agent A (run-uuid-001): reviews security implications
Agent B (run-uuid-002): generates test cases
Agent C (run-uuid-003): writes the implementation

Each runs under its own Combo, isolated in .dance-of-tal/runs/{uuid}/
```

---

## CLI Reference

| Command                                                       | Description                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dot init`                                                    | Scaffold `.dance-of-tal/` workspace                                                               |
| `dot login`                                                   | GitHub OAuth → `~/.dance-of-tal/auth.json`                                                        |
| `dot install <urn>`                                           | Download asset by URN → saved locally. Combo URNs trigger cascading install of all tal/dance deps |
| `dot search <keyword>`                                        | Search global registry by keyword (matches name, author, description, tags)                       |
| `dot list [--mine] [--kind <kind>]`                           | List registry packages; `--mine` filters to logged-in user's packages                             |
| `dot create --kind <kind> --name <slug>`                      | Scaffold a new asset locally under your namespace (login auto-sets author; or pass `--author`)    |
| `dot lock --tal <urn> --dance <urn>[,<urn>...] --name <name>` | Lock Combo (single or layered Dance)                                                              |
| `dot compile <name>`                                          | Validate all locked assets exist and are type-correct                                             |
| `dot run <name> --task <string>`                              | Compile and print assembled context                                                               |
| `dot switch <name>`                                           | Switch active combo                                                                               |
| `dot publish --kind <kind> --name <slug> --tags <tags>`       | Publish local asset to registry (requires `dot login`)                                            |
| `dot agents set --role <name> --combo <comboName>`            | Assign a combo to an agent role (saved in `.dance-of-tal/agents.json`)                            |
| `dot agents list`                                             | List all agent role → combo mappings                                                              |
| `dot agents remove --role <name>`                             | Remove an agent role from the manifest                                                            |

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
      "args": ["-y", "dance-of-tal"],
      "env": {
        "DANCE_OF_TAL_PROJECT_DIR": "/absolute/path/to/your-repo"
      }
    },
  },
}
```

`DANCE_OF_TAL_PROJECT_DIR` is optional but recommended when your MCP host launches from a different working directory.

### MCP Tools

| Tool              | Description                                    |
| ----------------- | ---------------------------------------------- |
| `get_project_status` | Check initialization, available combos, agent role mappings, and active combo |
| `list_combos`     | List local combos with Tal/Dance/Act metadata plus `agents.json` mappings |
| `init_run`        | Create an isolated sandbox for one agent run   |
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
│       ├── cli/          ← init, install, lock, compile, run, publish, login, switch
│       ├── lib/
│       │   ├── registry.ts  ← local file I/O + Combo type
│       │   ├── engine.ts    ← Tal + Dance[] → compiled system prompt
│       │   └── runs.ts      ← multi-agent run isolation
│       └── server/index.ts  ← MCP server tools
│
├── registry/             ← Cloudflare Worker (Hono + KV) — private
└── front/                ← Next.js registry browser — private
```

---

## License

MIT © [monarchjuno](https://github.com/monarchjuno)
