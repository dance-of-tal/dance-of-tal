// Barrel re-export for `dot add` functionality.
// Used by Studio server to install Dance skills from GitHub repos.

export { parseSource, getOwnerRepo } from './source-parser.js'
export type { ParsedSource } from './source-parser.js'

export { shallowClone } from './git-fetcher.js'
export type { CloneResult } from './git-fetcher.js'

export { discoverSkills } from './skills.js'
export type { DiscoveredSkill } from './skills.js'

export { copySkillDir } from './fs-utils.js'

export { upsertSkillLockEntry } from './skill-lock.js'

export { readPluginManifest } from './plugin-manifest.js'
