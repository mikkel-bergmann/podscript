## Why

Text-driven TTS engines mispronounce proper nouns — local place names and surnames (e.g. *Seibold*,
*Foran*, *Corso*, *Dee Why*) — and the model accepts only plain text (no SSML/IPA). How a word is
pronounced is a property of the **content**, not of any one engine: it should sound right on any
backend and travel with the script. The language had no portable way to express this.

## What Changes

- Add a core, engine-agnostic **pronunciation** feature to the Podscript SPEC (`docs/SPEC.md`):
  - A new `pronounce:` **header block** (§2.5): a per-script lexicon mapping a written term to a
    sound-alike respelling (`Seibold: "SY-bold"`, `"Dee Why": "Dee Why"`).
  - A new inline content node `{say "X" as "Y"}` (§3.1) for one-off / homograph overrides, which
    takes precedence over the header map for that occurrence.
- Define normative application semantics: whole-word, case-insensitive, single-pass, longest-term
  first, no cascades; respelling affects only the text handed to the engine.
- Preserve fidelity: the stored AST `content`, the IR, and the §17 transcript retain the **original**
  spelling. The header map is copied to the IR root; resolution/timing are unaffected.
- Add the AST/IR types (`Script.pronounce?`, the `Inline` `pronounce` variant, IR-root passthrough)
  and two conformance fixtures (`parse/pronounce`, `resolve/pronounce`).
- Classified as **core** (not a namespaced §15 extension): respelling is plain spoken-text input
  every engine can honor. IPA/phoneme input remains out of scope (would be a namespaced extension).

## Capabilities

### New Capabilities
- `pronunciation`: the `pronounce:` header lexicon and inline `{say … as …}` node, their application
  semantics, and the requirement that transcripts/IR preserve original spelling.

### Modified Capabilities
<!-- none — the spec repo has no prior live capability specs; this is the first -->

## Impact

- `docs/SPEC.md` — §2 header grammar (`pronounce_decl`), new §2.5, §3.1 inline node, §10 `Script` +
  `Inline` types, §11 IR root + §11.1 passthrough convention, §17 transcript note, §15 core-vs-ext
  clarification.
- `conformance/README.md` + new fixtures `conformance/parse/pronounce/` and
  `conformance/resolve/pronounce/`.
- Consuming engines (e.g. the Voice API in `podscript-app`) implement parsing, IR passthrough, and
  synthesis-time respelling; transcripts must show the original term.
- Backward compatible: `pronounce` is omitted when absent, so existing scripts and fixtures are
  unaffected.
