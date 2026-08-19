# Playwright CLI agent-browser layer

Agent-facing interactive browser execution, wrapping the official Microsoft
**@playwright/cli** (never a third-party wrapper, fork, or MCP server — see
backlog ticket "INTEGRATE PLAYWRIGHT CLI AS THE AUTHORITATIVE AGENT BROWSER
EXECUTION LAYER"). This layer owns browser session lifecycle only. It never
re-derives runtime identity, worktree selection, current-main resolution, or
candidate/review SHA — that is the Runtime Provenance Contract's job
(`tools/runtime/`, `npm run runtime:*`), which this layer only ever *calls*
and *reads back from*, never reimplements.

## One-time setup per checkout/worktree

```bash
npm install               # resolves the pinned @playwright/cli (see package.json)
npx playwright-cli install-browser chromium   # downloads the chromium binary this CLI's
                                       # own playwright-core@1.63.0-alpha line needs — a
                                       # SEPARATE cache from @playwright/test's stable
                                       # ^1.62.1 line, run once per machine
npm run browser:agent:setup           # installs the OFFICIAL native skill into
                                       # .claude/skills/playwright-cli/ (Claude Code)
                                       # and .agents/skills/playwright-cli/ (the CLI's
                                       # generic "agents" target)
```

`.claude/` is wholesale git-ignored in this repository, and `.agents/skills/`
is ignored by this task specifically (see `.gitignore`) — both targets are
machine-local, regenerated from the pinned CLI version, never committed.
**Every fresh clone/worktree must run `browser:agent:setup` once**, or an
agent on that checkout silently has no native skill (it still has
`playwright-cli --help`, the CLI's own officially-sanctioned discovery
fallback for skill-less operation).

Consumption is verified for Claude Code (`.claude/skills/`, native). The
`.agents/skills/` target is the CLI's own official second install location;
whether a given Codex/other-provider runtime on this project reads it
natively is **not independently verified** — treat `playwright-cli --help`
as the fallback for any runtime that does not.

## Commands

| Command | Does |
|---|---|
| `npm run browser:agent:open -- --purpose <P> [--lane <lane>] [--expected-sha <sha>] [--persistent]` | Resolve/start the runtime for `<P>`, require the browser-consumer preflight to pass, then open a named Playwright CLI session bound to it. |
| `npm run browser:agent:status` | Non-mutating: lists every tracked session, its purpose/lane/sha/url, and whether it is still CURRENT or SUPERSEDED. |
| `npm run browser:agent:close -- --session <name>` | Closes exactly that one session and removes exactly its own sidecar. Never `close-all`/`kill-all`. |
| `npm run browser:agent:show` | Official `playwright-cli show` dashboard (session grid + live remote control). Observability only — it does not establish provenance. |

`--purpose` is one of `CURRENT_MAIN`, `TASK_CANDIDATE`, `REVIEW_CANDIDATE`
(the Runtime Provenance purposes). `--lane` is required for
`TASK_CANDIDATE`/`REVIEW_CANDIDATE` — it distinguishes concurrent
candidates/reviewers that happen to share a sha (e.g. two lanes reviewing
the same `implementationCommit` at once) and feeds the session name
(`task-<lane>-<sha12>` / `review-<lane>-<sha12>`; `current-main-<sha12>` for
`CURRENT_MAIN`, which never needs one — Runtime Provenance already makes it
a structural singleton).

## Handshake (every `open`)

1. `npm run runtime:main` (CURRENT_MAIN) or `npm run runtime:candidate`
   (TASK_CANDIDATE/REVIEW_CANDIDATE) — the existing Runtime Provenance CLI,
   invoked exactly as documented there.
2. Read the claim that command itself just wrote, via the Runtime
   Provenance registry's own exported functions
   (`tools/runtime/lib/registry.mjs`) — never by parsing the command's
   stdout.
3. `npm run runtime:preflight` against that claim's URL. **Only its exit
   code is read.** The official Playwright CLI does document a global
   `--json` flag, and this layer does not use it here; the Runtime
   Provenance CLI has no `--json` output at all. Either way, this layer
   never parses either command's stdout — human-readable or JSON — for a
   provenance-critical decision; the exit code is the only signal trusted.
   Non-zero → refuse closed, no browser is opened.
4. Only once preflight passes: `playwright-cli -s=<session> open <url>`,
   then a sidecar record is written to
   `.artifacts/browser-agent-sessions/<session>.json` (already
   git-ignored via `.artifacts/`).

## Session isolation & artifacts

- Sessions default to an in-memory profile (`browser.isolated: true` in
  `.playwright/cli.config.json`, tracked) — pass `--persistent` to opt into
  a session-scoped on-disk profile when a workflow genuinely needs it.
- Viewport is pinned at `1440x900` / chromium, matching
  `tests/browser/playwright.config.ts` (the repository's existing
  authoritative desktop contract) — this layer does not bypass or
  reinterpret that contract, it reuses the same numbers.
- Snapshots/screenshots/traces/videos land under `.artifacts/browser-agent/`
  (`outputDir` in the tracked config) — already git-ignored, never
  committed unless a repository policy explicitly requires it.

## Update policy

Bumping `@playwright/cli`'s pinned version in `package.json` is an explicit
tooling change (Review/QA), never an incidental side effect of a product
task. After bumping: re-run `npm install` and `npm run browser:agent:setup`
— the CLI itself checks the installed skill against its own bundled version
on every invocation (except `install`) and prints a warning if they drift,
so a forgotten re-setup after a version bump is not silent.

## Non-goals (see the ticket for the full list)

Does not replace `tools/runtime/` (Runtime Provenance), `@playwright/test`,
or `npm run test:browser:desktop` — those are untouched by this task. Does
not establish Git/worktree authority — a Playwright CLI session is never
"probably correct"; it is only ever opened after the Runtime Provenance
preflight above verifies it. Does not auto-approve UX/QA from a screenshot.

## Deferred follow-up (explicit, not silently done)

Team-node wiring so Discovery/UX Research/CX-Design default to
`CURRENT_MAIN`, CX-Frontend/Engineering-Impl/Calculation-Impl to
`TASK_CANDIDATE`, and CX-Tech-Review/CX-QA/Engineering-QA/Calculation-QA/
Release-Integration to `REVIEW_CANDIDATE` is **not** part of this
repository-integration candidate — it requires a live `teams_save` edit,
which is guardrail-locked while a Team run is active. Land it as a
follow-up once this candidate is released, the same precedent
`tools/gate/`'s own consumer wiring already set.
