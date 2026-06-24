## Context

`(direction)` aside, Podscript stores spoken text as typed inline `content` nodes (§3.1). Engines
like Chatterbox synthesize plain text with no phoneme/SSML channel, so the only reliable lever for a
mispronounced proper noun is a phonetic respelling of the text the engine speaks. That correction is
content-intrinsic (engine-independent) and should travel with the script and be deterministic.

## Goals / Non-Goals

**Goals:**
- A portable, core way to fix pronunciation that works on any text-driven engine.
- Recurring proper nouns handled once (header lexicon); one-offs/homographs handled inline.
- Determinism and clean transcripts: stored content + IR + transcript keep the original spelling.

**Non-Goals:**
- No IPA/phoneme input (engine-specific; would be a namespaced §15 extension later).
- No change to timing/resolution — pronunciation is a synthesis-time text rewrite only.

## Decisions

**1. Two surfaces: header lexicon + inline node.**
`pronounce:` (a header sibling of `meta:`/`voices:`/`assets:`) covers terms that recur across a
script; `{say "X" as "Y"}` (a `{…}` inline node, consistent with `{break 500ms}`) covers one-offs and
homographs and overrides the header for that occurrence.
*Alternative:* header-only. Rejected — homographs (*lead* the metal vs. the verb) need per-occurrence
control.

**2. Respell the synthesis text only; never the stored content.**
Application happens when an engine builds the text it sends to the provider. AST `content`, IR, and
the §17 transcript retain the written form. This keeps the resolver deterministic and TTS-independent
(§14) and transcripts accurate (§17). The header map is copied to the IR root (omitted when absent)
so engines can apply it without re-parsing.

**3. Deterministic matching: whole-word, case-insensitive, single-pass, longest-first, no cascades.**
A single left-to-right pass over all terms (longest preferred) with replacement output never
re-scanned guarantees stable, predictable `text_sent` (and a stable synthesis cache key) and prevents
a respelling from triggering another substitution.

**4. Core, not namespaced.**
Respelling is plain spoken-text input every engine can honor, so it carries core semantics and needs
no `requires` (§15). Phoneme/IPA, which only some engines accept, stays out of scope.

## Risks / Trade-offs

- **[Respelling leaks into the transcript]** → Mandated by spec: transcript renders the written form;
  inline node renders its `value`, not its `say`. Covered by the `resolve/pronounce` fixture +
  consumer tests.
- **[Substitution cascades / partial-word matches]** → Whole-word, single-pass, longest-first,
  non-re-entrant matching is normative; a fixture exercises a multi-word term and a homograph.
- **[Quoting of multi-word keys]** → Keys with spaces/punctuation are quoted strings (`"Dee Why"`),
  parsed like `voices`/`assets` scalar values.

## Migration Plan

Additive and backward compatible — `pronounce` is omitted when absent, so all existing parse/resolve
fixtures and scripts are unchanged. Engines adopt at their own pace; until then a `pronounce:` block
is simply carried through and the original text is spoken.
