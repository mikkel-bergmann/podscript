# Podscript conformance suite

Normative test fixtures for the three conformance classes defined in
[`../docs/SPEC.md` §13](../docs/SPEC.md). A change that alters any golden fixture is
a breaking (major) change per SPEC §20.

```
conformance/
├── parse/      # script → canonical AST
│   └── <case>/
│       ├── input.podscript
│       └── expected.ast.json
├── resolve/    # script + supplied durations → canonical IR (no TTS involved)
│   └── <case>/
│       ├── input.podscript
│       ├── durations.json        # clip/asset durations, in ms
│       └── expected.ir.json
└── render/     # IR → audio, checked by measurable properties (not byte-equality)
    └── <case>/
        ├── input.ir.json
        └── expected.checks.json  # loudness ±1 LUFS, true-peak ceiling, envelope tolerances
```

The **resolve** tier is the heart of the suite: it exercises binding, anchor
resolution, the gain model, and crossfade expansion **without any audio**, because
durations are supplied as input. That is what makes the timing engine verifiable by
independent implementers.

A conforming implementation states which classes it targets (parser / resolver /
renderer) and MUST pass every fixture for each class it claims.

## Seeded fixtures

| Tier | Case | Covers |
|---|---|---|
| `parse` | `cold_open` | version stamp, meta/voices/assets headers, bed directive with gain+fade clauses, label, speech with `cue` anchor + inline emphasis/break, auto-sequenced speech, sfx with `after` anchor |
| `resolve` | `cold_open` | anchor-to-event (`with intro.fade-out`), self-timed fade-out + bed-end rule, default 250 ms inter-line gap, `after`-anchored one-shot, per-kind ID assignment |
| `resolve` | `full_episode` | the above plus: continuous cross-scene timeline, bed placement at the playhead, bed lifetime across scenes, two instances of one asset, `duck-under speech` (declarative), and a cross-scene `crossfade` paired with a forward-anchored (`at signoff.end`) fade-out |
| `parse` | `pronounce` | `pronounce:` header lexicon (quoted multi-word term), inline `{say "X" as "Y"}` pronunciation node alongside emphasis/break (§2.5, §3.1) |
| `resolve` | `pronounce` | `pronounce` map copied to the IR root; speech `content` (incl. the inline `pronounce` node) preserved verbatim with original spelling; timing unaffected |
| `parse` | `prosody` | voice-level `prosody: { rate, pitch }` baseline object and per-line `prosody rate/pitch/volume` clauses in the speech `cue` (§2.3, §5.5); pitch parsed from semitones (`-1st` → `-1`); a voice without `prosody` omits it |
| `resolve` | `prosody` | per-attribute effective-prosody merge onto the clip (line clause overrides voice baseline attribute-by-attribute; attributes at their natural default and the empty object omitted); prosody is synthesis metadata and does not perturb `start`/`dur`/`end` |

The semantic questions the multi-scene episode raised — multi-scene timing, bed
lifetime/placement, cross-scene crossfade, duck envelope, and how to add automation
to a bed later — have been **resolved and pinned in the spec**; the decisions are
logged in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md). What remains open there is a
`render/`-tier fixture for the duck envelope and whether `meta` may override default
constants.

These first fixtures were authored by hand from the spec; the reference
implementation will be developed to satisfy them (spec-first / TDD). Contributions of
edge-case fixtures are welcome via the governance process in SPEC §20.
