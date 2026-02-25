# Getting Started

## 1. Installation

Install the Dance of Tal CLI globally using npm:

```bash
npm install -g dance-of-tal
```

## 2. Initialize a Project

Set up the required isolated context architecture in your current module or repository.

```bash
dot init
```

This will instantly scaffold:
* `.dance-of-tal/registry/` - Your isolated local cache for URN-based assets.
* `.dance-of-tal/runs/` - Temporary sandboxes isolating multi-agent concurrency contexts.

## 3. Remote Registry Login

DOT manages assets via a global, type-safe Cloudflare Registry namespace. Log in securely using GitHub OAuth:

```bash
dot login
```
Follow the browser prompts to verify your device code. Your secure token will be saved to `~/.dance-of-tal/auth.json`.

## 4. Install a Package

Browse the remote registry and pull down an expert AI context using explicit URN notation (`category/@author/name`):

```bash
npx dot install tal/@monarchjuno/system-architect
```

## 5. Lock Combinations

Bind the downloaded context into a `combo` to define exactly which persona runs with which structural rule set.

```bash
dot lock --tal system-architect --dance strict-tdd --name my_app
```

Now, your IDE or MCP Client can request the `my_app` combo, guaranteeing the system prompt forces TDD format output under a system-architect thinking model.
