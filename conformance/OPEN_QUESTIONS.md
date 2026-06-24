# Decisions log (formerly open questions)

Seeding the fixtures forced a batch of decisions. The serialization conventions are
pinned in SPEC §10.1 / §11.1; the timeline/bed/crossfade/duck semantics below were
resolved to build `resolve/full_episode` and are now normative in the spec.

## Resolved

| # | Question | Decision | Pinned in |
|---|----------|----------|-----------|
| Q1 | Multi-scene timing | One continuous timeline; a scene boundary neither resets time nor adds a gap beyond the normal 250 ms inter-line gap. `pause` adds space explicitly. | §3.2 |
| Q2 | Bed lifetime | A bed plays until replaced by the next bed on its track, ended by a fade-out to `-inf`, or its asset ends — whichever is first. Scene boundaries don't end a bed. | §4.1 |
| Q2b | Bed placement | A bed with no anchor starts at the *playhead* = end of the most recent preceding speech clip (0 if none), by document order. | §4.1 |
| Q3 | Cross-scene crossfade | Crossfade is track-scoped, not scene-scoped; it ends the outgoing bed at `incoming.start + dur`; both expanded fades are tagged `src:"crossfade"`. | §5.3, §11.1 |
| Q4 | Duck envelope shape | Affected regions = all clips on the referenced track overlapping the bed's active window; attack ramps to full duck *ending at* region start; linear release over `release_ms`; intersecting ramps merge. | §5.4 |
| Q5 | One-shot `dur`/`end` in IR | Yes — one-shots carry `at`, `dur`, `end`. | §11.1 |
| Q6 | Repeated asset → instances | Each `bed` directive is a distinct instance (`b1`, `b2`) sharing one `src`. | §4.1, §11.1 |
| Q7 | Adding automation to a bed later | Do **not** re-declare the bed. Give it a `#label` and anchor a later fade to a forward label reference (e.g. `fade-out over 3s at signoff.end`). Label refs resolve globally; speaker refs never look forward. | §4.1, §5.1 |

Q7 arose from the original example's two `bed outro …` lines, which were ambiguous
(one bed modified, or two overlapping copies?). The example and the `full_episode`
fixture now use the forward-anchored form, which is unambiguous and needs no new
"modify existing instance" grammar.

## Still open

- **Q4 render fixture.** The duck envelope is specified, but there is no
  `render/` fixture yet pinning the measurable envelope (loudness/automation
  tolerances). Needs the renderer to exist, or a hand-authored `expected.checks.json`.
- **Configurability of defaults.** The 250 ms inter-line gap and duck attack/release
  defaults are fixed constants today. Whether (and how) `meta` may override them
  project-wide is not yet decided.
