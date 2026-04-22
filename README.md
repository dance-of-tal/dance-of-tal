# Dance of Tal (`dot`)

> **The Package Manager for AI Agents**  
> Build, share, and choreograph multi-agent systems like you do with `npm`.

[![npm version](https://img.shields.io/npm/v/dance-of-tal)](https://www.npmjs.com/package/dance-of-tal)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE)

You're juggling scattered prompts, copy-pasting markdown skills, and manually wiring up MCPs for every new project. It's a mess. 
We built the package manager for agents. Tested the choreography. Kept what actually scales.

Install `dot`. Type `dot add`. Done.

```bash
npm install -g dance-of-tal
dot init
```

### For Humans
Copy and paste this prompt to your LLM agent (Claude Code, Cursor, Windsurf, etc.):

```
Install dance-of-tal globally via npm, run `dot init`, and use `dot --help` to scaffold my agent setup. Do not ask me about URN formats.
```

Or read the rest of this page manually. But seriously, let an agent do it. Humans fat-finger configs.

### For LLM Agents
You are a software engineer building an AI agent workspace. Your tools, personas, and choreographies are accessed via the `dot` CLI. 
Run `dot --help` to see available commands. All resources use the strict URN format: `kind/@owner/stage/name`.

---

## The Package Manager (Not Another Framework)

We're past the era of monolithic agent frameworks. Just compose blocks like you write `package.json`.

- **Tal**: The core identity/persona. Who the agent is.
- **Dance**: The skill package. Isolated, reusable capabilities pulled straight from GitHub repos (via `SKILL.md`). Dance implementations strictly follow the standard Agent Skill format.
- **Performer**: Your composed agent instance. A Tal + arbitrary Dances + a specific LLM model config. 
- **Act**: The choreography script. Define execution topologies where performers communicate via explicitly defined relations (`direction: one-way` or `both`).

## `dot add`

```bash
dot add monarchjuno/sprint-reviewer
```

You're actually manually copying prompts across repositories? Wild.
`dot add` pulls standard Dance skills straight from GitHub. Prompts, MCPs, and system context—all securely packaged into a URN. Repo-local shared folders, including symlinked `assets/`, `references/`, and `scripts/`, are copied into the installed bundle. You touch nothing.

## Choreography that actually works

```bash
dot create --kind act --name my-workflow --stage mvp --author my-company
```

When your Lead agent delegates to a Sub-agent, it doesn't need prompt-engineering boilerplate. It needs an address.
In an **Act**, you choreograph `performer/@my-company/mvp/lead` to talk to `performer/@my-company/mvp/worker`. 
Zero complex hand-holding. The system resolves the contracts locally.

## Workspace Structure (Local vs Global)

Like `node_modules`, standard Dance of Tal environments use a hidden directory: `.dance-of-tal/`. 

- **Local (`./.dance-of-tal/`)**: Project-specific agents and skills. Installed here by default so you can version control them alongside your code.
- **Global (`~/.dance-of-tal/`)**: Machine-level registry for reusing your favorite Tals and Dances across any project. (Use the `-g` or `--global` flag when installing).

The directory perfectly mirrors the strict URN structure:
```text
.dance-of-tal/
  ├── act/
  │   └── @my-company/mvp/workflow.json
  ├── performer/
  │   └── @my-company/mvp/lead.json
  ├── tal/
  │   └── @acme/core/code-reviewer.json
  └── dance/
      └── @open-source/tools/github-search/SKILL.md
```

## Usage & Commands

The `dot` CLI communicates with the Dance of Tal Registry and your local workspace. 

> **Tip:** You can always run `dot --help` or `dot <command> --help` to see detailed information and options.

### Local Management
- `dot init` - Scaffolds a `.dance-of-tal/` local workspace
- `dot init dance --name <name>` - Scaffolds a new Dance skill directory
- `dot create --kind <kind> --name <n> --stage <s> --author <a>` - Scaffolds a new Tal, Performer, or Act locally

### Registry & Remote Packages
Like `npm registry`, but for agents.
- `dot login` - Authenticate via GitHub to publish assets
- `dot add <owner>/<repo>` - Install a Dance skill from any GitHub repo
- `dot install <urn>` - Download typed definitions from the Registry
- `dot search <keyword>` - Search the Registry for Tal, Performers, or Acts
- `dot list` - List available packages
- `dot check` / `dot update` - Keep installed Agent Skills up to date
- `dot publish` - Publish a composed asset to the global Registry

### Programmatic Usage
Everything is strictly typed under the hood. For the 1% of humans who write the code:

```typescript
import { parseDotAsset, AssetKind } from 'dance-of-tal/contracts';

const myAsset = { /* ... */ };
const validated = parseDotAsset(myAsset, AssetKind.Performer); // Fails aggressively if malformed.
```


## License
MIT © monarchjuno
