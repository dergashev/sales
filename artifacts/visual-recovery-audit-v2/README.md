# Visual Recovery Audit V2

Audit date: 2026-08-29  
Authority: CURRENT_MAIN `6fcb567628f26f02cac0e74674378a79e6ac13b8`  
Runtime: `http://127.0.0.1:63976` · purpose `CURRENT_MAIN` · provenance verified

This directory contains current-runtime captures, a target comparison board, and the authoritative recovery programme. No production source was modified.

## Evidence inventory

- `current/` — Playwright CLI captures from the verified runtime at 1440×900 and 1280×800.
- `board/current-vs-target.html` — direct Before / approved target / current comparison index.
- `findings-report.md` — product-wide audit, scorecard, target status and five-second results.
- `target-status-matrix.md` — exact disposition for all 17 approved target cases.
- `design-system-consumption.md` — capability-to-runtime-consumer audit and dead-design record.
- `root-cause-and-programme.md` — ranked root causes, 10 implementation contracts, DAG, checkpoints and stop conditions.
- `executive-summary.md` — concise outcome, first task and first review checkpoint.

## Scope boundary

Screens are audit evidence, not product implementation. The saved screenshots contain fixture data and no live customer delivery was sent. A pre-existing “sent” fixture was inspected read-only and routes to the product's explicit incomplete-prototype state.
