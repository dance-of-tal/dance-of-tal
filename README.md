# Dance of Tal (DOT)
### *The NPM for Vibe Coding.*

**Dance of Tal (DOT)** is a modular AI context manager and global registry designed for the Agentic AI era.

As AI agents become more deeply integrated into engineering workflows, the standard practice of copying and pasting 1000-line monolithic `AGENTS.md` system prompts into codebases is failing. When business logic changes or new paradigms arise, debugging which layer of constraints broke your AI's reasoning becomes near impossible.

DOT solves this by bringing **Dependency Injection and modular architecture** to your AI instructions. It forces you to decouple your AI's Intelligence (`Tal`), its Formatting Constraints (`Dance`), and its Execution Workflows (`Act`) into versioned, shareable micro-contexts.

By publishing these assets to the globally accessible DOT Cloudflare Registry, entire engineering organizations can sync across the exact same AI standard with a single terminal command.

---

## The Core Philosophy (V2 Architecture)

We break down AI context into five strictly typed, URN-driven asset components:

1. **Tal (Intelligence Persona):** `tal/@author/name`
   Defines the analytical thinking, decision-making framework, and philosophical boundaries of the active AI. (e.g. *A strict Rust systems architect who prioritizes memory density.*)
2. **Dance (Format Constraints):** `dance/@author/name`
   Forces structural output behaviors. (e.g. *Strict TDD where tests must be written first, or adherence to a specific JSON Schema.*)
3. **Act (Dynamic Workflow):** `act/@author/name`
   A Directed Acyclic Graph (DAG) workflow engine. Instead of a linear prompt sequence, an Act orchestrates conditional jumps and steps, overriding constraints when needed (e.g. *bypassing tests during an emergency hotfix.*).
4. **Stage (Platform Binding):** `stage/@author/name`
   Translates your assembled payloads perfectly for vendor-specific consumption, bridging the gap between Cursor, Windsurf, or direct Claude API usage.
5. **Combo (The Lockfile):** `combo/@author/name`
   The ultimate static combination mapping. Binds specific versions of Tals and Dances into a single usable Context Profile, much like a `package-lock.json`.

---

## Quick Start Guide

### 1. Installation

Install the Dance of Tal CLI globally using npm:

```bash
npm install -g dance-of-tal
```

### 2. Initialize a Workspace

Set up the required isolated context architecture in your current module, repository, or workspace.

```bash
dot init
```

This will instantly scaffold:
* `.dance-of-tal/registry/` - Your isolated local cache for URN-based assets.
* `.dance-of-tal/runs/` - Temporary sandboxes isolating multi-agent concurrency contexts so multiple Claude instances don't clash.

### 3. Install Remote Contexts

Browse the remote registry (at `https://dance-of-tal-v2.workers.dev`) and pull down an expert AI context using explicit URN notation (`category/@author/name`):

```bash
npx dot install tal/@monarchjuno/system-architect
npx dot install dance/@react-core/strict-tdd
```

### 4. Lock Your Configuration

Bind your downloaded context into a `combo` to define exactly which persona runs with which structural rule set locally.

```bash
dot lock --tal system-architect --dance strict-tdd --name my_app
```

### 5. Compile and Validate

Verify that your locked assets are structurally compatible and that their schemas do not conflict.

```bash
dot compile
```

### 6. Run the Context

Execute the assembled AI workflow payload locally or supply the assembled prompt straight into your LLM.

```bash
dot run my_app
```

---

## Publishing to the DOT Registry

You can contribute your expertly crafted personas and constraints to the global registry!

### 1. Authenticate via GitHub

Link your local CLI to your GitHub account. Your username will become your protected namespace (`@username`).

```bash
dot login
```

### 2. Publish Asset

Upload your component so others can install it using your URN.

```bash
dot publish --category tal --name my-new-vibe --tags "coding,rust,backend"
```

## Model Context Protocol (MCP) Mode

Dance of Tal natively operates as an MCP server. This allows IDEs like Cursor, Windsurf, Codex, Antigravity and Claude Desktop to dynamically invoke your locally locked Context profiles exactly when needed without manually copying the text to the chat window.

*(Check the full GitBook documentation for advanced instructions on hooking the CLI server process to your MCP client.)*

---

> For comprehensive details on advanced commands, writing Act DAG graphs, and modifying Registry behaviors, visit our [GitBook Documentation](https://dance-of-tal.gitbook.io/).
