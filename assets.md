# The 5 Core Components (Assets)

Dance of Tal relies on five foundational asset shapes, each strictly typed via URN references.

## 1. Tal (Intelligence)
**URN Pattern:** `tal/@username/name`

**Purpose:** Defines the conceptual, philosophical, and analytical thinking behavior of the AI.

**Shape Properties:**
* `thinking`: The core system prompt driving decision making.
* `extends`: (Optional) URN inheritance to layer personas.

## 2. Dance (Constraint Pattern)
**URN Pattern:** `dance/@username/name`

**Purpose:** Enforces strict execution rules, formatting, boundaries, and validation. Used to guarantee AI output complies to a mechanical structure.

**Shape Properties:**
* `rules`: Detailed system prompt outlining the constraints (e.g. "always output tests first").
* `schema`: (Optional) JSON Schema that the LLM payload must adhere to.

## 3. Combo (The Lockfile)
**URN Pattern:** `combo/@username/name`

**Purpose:** Combines specific versions of Tals and Dances into a single usable Context Profile. Think of this as the `package.json` vs `package-lock.json` mapping.

## 4. Act (Workflow Engine)
**URN Pattern:** `act/@username/name`

**Purpose:** Overrides static behavior conditionally, orchestrating DAG (Directed Acyclic Graph) workflow steps instead of a simple linear path.

**Shape Properties:**
* `nodes`: Array of execution steps.
* `edges`: Directed edges enabling parallel execution and dependencies.

## 5. Stage (Platform Integration)
**URN Pattern:** `stage/@username/name`

**Purpose:** Translates the locked combo payloads into vendor-specific API shapes (e.g. Cursor, Windsurf, Anthropic API, OpenAI API).
