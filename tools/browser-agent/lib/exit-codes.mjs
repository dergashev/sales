// Same 4-code convention as tools/runtime/main.mjs and tools/gate/gate.mjs:
// 0 OK · 2 PROVENANCE (unverifiable/mismatched/stale runtime or session
// identity) · 3 LIFECYCLE (git/argument failure) · 4 TOOLING (spawn/process
// failure). Reused verbatim, not reinvented, so a caller scripting against
// this repo's tooling never has to learn a second exit-code vocabulary.
export const EXIT = Object.freeze({ OK: 0, PROVENANCE: 2, LIFECYCLE: 3, TOOLING: 4 })
