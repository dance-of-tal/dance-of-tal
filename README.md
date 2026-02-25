# Dance of Tal (DOT)

> **The npm for Vibe Coding.** — Modular, versioned, type-safe AI context management for the Agentic AI era.

[![npm version](https://img.shields.io/npm/v/dance-of-tal)](https://www.npmjs.com/package/dance-of-tal)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)
[![Registry](https://img.shields.io/badge/Registry-Live-emerald)](https://registry.dance-of-tal-v2.workers.dev)

---

## Why DOT Exists

Modern AI-powered development relies on system prompts that have quietly grown into unmaintainable monsters: 1 000-line `AGENTS.md` monoliths copy-pasted across every repo, hardcoded into IDE configs, and impossible to debug when something breaks.

**The real cost:** When your AI starts hallucinating test files or violating your security review checklist, you don't know which part of that blob is responsible. There is no diff, no versioning, no owner, no rollback.

**Dance of Tal** treats AI behaviour the same way good software treats code:

| Software principle | DOT equivalent |
|---|---|
| Dependency Injection | Context assembled from discrete, typed components |
| `package.json` → `package-lock.json` | Combo locks exact Tal + Dance versions |
| npm registry | Global Cloudflare KV registry |
| Multiple CSS classes on one element | Multiple Dances layered in one Combo |
| CI/CD pipeline | Every engineer on every machine runs the **exact** same AI persona |

---

## The Mental Model

Picture a newly onboarded senior engineer at your company.

- Their **Tal** is their *professional mindset* — the thinking framework your company expects. Do they prioritise correctness or delivery speed? Do they design for GDPR compliance by default? This is the **who** of the AI.
- Their **Dance** is their *working methodology* — the rules they follow on every task. Always write tests first. Always output structured JSON. Always flag security implications. This is the **how** of the AI.
- A **Combo** locks a Tal + one or more Dances together — a frozen, versioned snapshot that everyone on the team installs.
- An **Act** is a *workflow choreographer* — a DAG that switches AI behaviour based on context (e.g. normal sprint → incident response mode).

---

## V2 Architecture: The Four Asset Types

All assets use strict **URN notation**: `<category>/@<author>/<name>`

> **Note:** Stage (platform adapters for Cursor, Windsurf, Claude API) is CLI-internal and is **not** a registry asset.

### 1. `Tal` — Intelligence Persona

Encodes the *thinking layer*: how the AI reasons, what it prioritises, and its professional identity.

```jsonc
// tal/@acme-platform/senior-backend-engineer
{
  "type": "tal/@acme-platform/senior-backend-engineer",
  "version": "3.1.0",
  "description": "Backend engineer mindset for ACME's platform team.",
  "thinking": "You are a senior backend engineer at ACME. You build for correctness, observability, and horizontal scale. You always consider failure modes before writing implementation. You default to Kotlin/Spring Boot, PostgreSQL, and Kafka. You never suggest solutions that don't have a rollback path.",
  "tags": ["backend", "kotlin", "spring", "platform"]
}
```

### 2. `Dance` — Format Constraints

Encodes the *output layer*: structural rules, formatting discipline, and JSON Schema enforcement.

```jsonc
// dance/@acme-platform/pr-review-standard
{
  "type": "dance/@acme-platform/pr-review-standard",
  "version": "1.0.0",
  "description": "ACME standard for AI-assisted PR reviews.",
  "rules": "Structure every review as: SUMMARY, RISKS (severity: low|medium|high|critical), REQUIRED CHANGES, OPTIONAL SUGGESTIONS. Flag any code touching payment flows with PAYMENT RISK. Never approve a PR that lacks unit tests on business logic paths.",
  "schema": {
    "type": "object",
    "required": ["summary", "risks", "requiredChanges"],
    "properties": {
      "risks": { "type": "array", "items": { "enum": ["low", "medium", "high", "critical"] } }
    }
  }
}
```

### 3. `Combo` — The Lockfile

Pins a Tal + one **or more** Dances. Multiple Dances are layered in order — rules concatenate, schemas deep-merge — like CSS classes.

```jsonc
// Layered Dances: base coding standard → security layer → output format
{
  "tal": "tal/@acme-platform/senior-backend-engineer",
  "dance": [
    "dance/@acme-platform/kotlin-style-guide",   // base: language standards
    "dance/@acme-security/gdpr-awareness",       // layer: data handling rules
    "dance/@acme-platform/pr-review-standard"    // layer: output format
  ]
}
```

### 4. `Act` — Dynamic Workflow (DAG)

Routes between different Tal+Dance pairs conditionally. Production examples: normal sprint vs. incident response, design review vs. implementation.

```jsonc
// act/@acme-platform/incident-response
// Switches from cautious "architect" persona to fast "fixer" persona on P0
{
  "type": "act/@acme-platform/incident-response",
  "nodes": {
    "triage":  { "tal": "tal/@acme-platform/senior-backend-engineer", "dance": "dance/@acme-platform/incident-triage-format" },
    "hotfix":  { "tal": "tal/@acme-platform/hotfix-specialist",       "dance": "dance/@acme-platform/minimal-change-only" },
    "postmortem": { "tal": "tal/@acme-platform/senior-backend-engineer", "dance": "dance/@acme-platform/postmortem-format" }
  },
  "edges": [
    { "from": "triage",  "to": "hotfix",      "condition": "SEVERITY=P0" },
    { "from": "triage",  "to": "postmortem",  "condition": "SEVERITY=P1" },
    { "from": "hotfix",  "to": "postmortem" }
  ]
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
   (dot run sprint)   (IDE calls MCP tools)
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
# Opens browser for GitHub Device Flow OAuth
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

# During a P0 outage, the AI automatically switches to hotfix persona
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

| Command | Description |
|---|---|
| `dot init` | Scaffold `.dance-of-tal/` workspace |
| `dot login` | GitHub OAuth → `~/.dance-of-tal/auth.json` |
| `dot install <urn>` | Download asset by URN → saved locally |
| `dot lock --tal <urn> --dance <urn>[,<urn>...] --name <name>` | Lock Combo (single or layered Dance) |
| `dot compile <name>` | Validate all locked assets exist and are type-correct |
| `dot run <name> --task <string>` | Compile and print assembled context |
| `dot switch <name>` | Switch active combo |
| `dot publish --category <cat> --name <slug> --tags <tags>` | Publish local asset to registry |

### URN Format

```
<category>/@<author>/<name>

tal/@acme-platform/senior-backend-engineer
dance/@acme-security/gdpr-awareness
act/@acme-platform/incident-response

# Shorthand (category inferred from flag):
@acme-platform/senior-backend-engineer
```

---

## MCP Server Mode

DOT implements the **Model Context Protocol (MCP)**, so AI IDEs can pull the exact compiled context on demand — no copy-pasting prompts.

**Supported:** Cursor · Windsurf · Claude Desktop · Antigravity · Codex

```jsonc
// .cursor/mcp.json (or Windsurf equivalent)
{
  "mcpServers": {
    "dance-of-tal": {
      "command": "npx",
      "args": ["dance-of-tal"]
    }
  }
}
```

### MCP Tools

| Tool | Description |
|---|---|
| `init_run` | Create an isolated sandbox for one agent run |
| `get_run_context` | Return the compiled system prompt for that run |
| `clear_run` | Clean up the sandbox after the run completes |

---

## Publishing Your Own Assets

```bash
dot login

# Place asset at .dance-of-tal/tal/@acme-platform/my-persona.json
dot publish --category tal --name my-persona --tags "backend,kotlin,platform"
# → Live at: tal/@acme-platform/my-persona
```

### Publishing rules

- **Namespace protection** — Your URN namespace is your GitHub username. Nobody can publish under `@yourusername`.
- **Schema enforcement** — Registry validates payload shape per category.
- **Semver** — `version` field must follow `MAJOR.MINOR.PATCH`.

---

## The Registry

**Base URL:** `https://registry.dance-of-tal-v2.workers.dev`

| Endpoint | Description |
|---|---|
| `GET /packages?category=tal` | List all assets for a category |
| `GET /packages/:category/:username/:name` | Fetch asset by URN |
| `POST /publish` | Publish (`Authorization: Bearer <token>`) |
| `POST /auth/device/code` | Start GitHub Device Flow |
| `POST /auth/device/poll` | Poll for access token |

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