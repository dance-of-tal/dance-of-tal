# CLI Reference

The `dance-of-tal` (alias `dot`) CLI is the primary mechanism for interacting with the Registry, your local Workspace, and compiling context payloads.

## Global Options
* `-p, --project <path>` : Define a custom root directory (defaults to current working directory).
* `-v, --verbose` : Outputs execution traces (useful for Act DAG workflows).

## Commands

### `init`
Initializes a new `dance-of-tal` workspace.
```bash
dot init
```
Generates the `.dance-of-tal/` directory containing your `registry/` schema files, isolated `runs/` for execution contexts, and the inter-agent `mailbox/`.

### `login`
Authenticates your CLI against the remote Cloudflare registry utilizing GitHub OAuth.
```bash
dot login
```

### `install <urn>`
Downloads a registry item and saves it inside your local `.dance-of-tal/registry/` folder.
```bash
dot install tal/@username/persona-name
```

### `lock`
Secures a `Tal` and `Dance` pair into a static `Combo` file to guarantee Type-Safe execution locally.
```bash
dot lock --tal my-tal-name --dance my-dance-name --name my_app
```

### `compile`
Validates that locked dependencies structurally match and that Type schema overrides do not clash.
```bash
dot compile
```

### `publish`
Pushes your local asset to the remote Cloudflare Registry under your namespace.
```bash
dot publish --category tal --name my-new-vibe --tags "coding,rust,backend"
```
*(Requires `dot login` authentication)*

### `run <combo>`
Assembles and invokes the AI runner (either simulated standard-out or direct API).
```bash
dot run my_app
```
