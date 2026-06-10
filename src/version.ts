import { createRequire } from 'node:module'

// Read the version from package.json at runtime so it can never drift from
// the published package. createRequire resolves relative to this module:
// dist/version.js -> ../package.json (package root) in the published build,
// and src/version.ts -> ../package.json when running from source.
const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

export const VERSION = pkg.version
