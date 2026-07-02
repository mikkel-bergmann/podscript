## 1. SPEC grammar + types (`docs/SPEC.md`)

- [x] 1.1 Add the `SEMITONES := ("+"|"-") NUMBER "st"` token to §1.5.
- [x] 1.2 Add `| "prosody" ":" prosody_obj` to §2.3 `voice_field`, with `prosody_obj`/
      `prosody_kv` (rate/pitch/volume) and a sentence defining the baseline delivery object.
- [x] 1.3 Add `prosody := "prosody" prosody_attr+` (rate/pitch/volume) to the §5 `clause`
      alternation; note it is advisory synthesis (does not affect timing/gain) and overrides
      the voice baseline per attribute. (New §5.5 carries the semantics.)
- [x] 1.4 Rewrite §5.5 as **Prosody**: the dimension→control table (rate/pitch/volume +
      emphasis/pauses/punctuation/direction), per-attribute merge, synthesis-not-timing, the
      advisory/best-effort contract, `volume`-vs-`gain`, and the split-into-cues note.
- [x] 1.5 Add `prosody?: Prosody` to the `Voice` interface, a `Prosody` interface
      (`rate?/pitch?/volume?`), and a `{ kind: "prosody"; rate?; pitch?; volume? }` `Clause`
      variant (§10); cross-ref §3/§3.1 to §5.5.
- [x] 1.6 Add `"prosody": { ... }` to the §11 speech-clip IR example and a §11.1 convention:
      the resolver emits the per-attribute effective prosody, omitting defaults and the empty
      object.
- [x] 1.7 Add `prosody` (rate/pitch/volume) to the §14.3 synthesis cache-key `params` and note
      post-clamp effective values are recorded in the render manifest.

## 2. Conformance fixtures (`conformance/`)

- [x] 2.1 `conformance/parse/prosody/{input.podscript, expected.ast.json}` — a voice with a
      `prosody: { rate, pitch }` baseline and per-line `prosody` clauses (incl. `+3st`
      semitone parse and a `volume`), alongside inline emphasis, plus a voice/line with no
      prosody.
- [x] 2.2 `conformance/resolve/prosody/{input.podscript, durations.json, expected.ir.json}` —
      per-attribute merge: baseline inheritance (c1), full override incl. volume (c2), line-only
      rate on a voice with no baseline (c3), fully-natural clip with prosody omitted (c4).
      Timing chain (`0.0 / 3.25 / 5.3 / 8.15`, 250 ms gap) is independent of prosody.
- [x] 2.3 Update the `conformance/README.md` coverage table with the two new cases.
- [x] 2.4 REUSE headers: new fixtures fall under the existing `conformance/**` aggregate
      annotation in `REUSE.toml`; `reuse lint` passes.

## 3. Authoring guidance (`docs/AUTHORING.md`, non-normative)

- [x] 3.1 Rewrite the delivery section as **Prosody**: the dimension→control table, the
      voice-baseline + per-line-override pattern, and the "split a thought into consecutive
      cues" pattern for within-line variation (+ clause-table row and voices field list).
- [x] 3.2 Recommended (non-normative) `(direction)` vocabulary and portability notes on how
      `rate`/`pitch`/`volume`, `*emphasis*`, pauses, and punctuation map onto engines like
      ElevenLabs (which read tags/punctuation, not SSML).
- [x] 3.3 Add a canonical runnable `examples/prosody.podscript`, single-sourced into AUTHORING
      via a `<!-- example: -->` tagged block (CI-guarded) and referenced from the README.

## 4. Versioning (semver → 0.2.0)

- [x] 4.0a Adopt three-part semver in §1.2 (`MAJOR.MINOR.PATCH`, `PATCH` optional/defaults to 0,
      match on major/minor) and record the current version + CHANGELOG link in §20.
- [x] 4.0b Bump spec-version references to `0.2.0`: SPEC header/status, §11 IR example (now
      carries prosody) and §14.3 manifest example, `README.md`, `llms.txt`, and the AUTHORING
      golden-rule/hard-rule stamps.
- [x] 4.0c Normalize **all** example and conformance-fixture stamps to `0.2.0` (prosody scripts,
      the non-prosody examples, and every existing golden fixture) so the repo uses one
      consistent current version — a stamp-only pre-1.0 housekeeping change.
- [x] 4.0d Add top-level `CHANGELOG.md` (SPDX-headed) with 0.2.0 and 0.1.0 entries.

## 5. Validation

- [x] 5.1 Existing parse/resolve fixtures (`cold_open`, `full_episode`, `pronounce`) differ from
      `0.1` only by the version stamp (`0.2.0`); AST/IR structure and all timing values are
      otherwise unchanged.
- [x] 5.2 Docs-drift guard (`check_doc_examples.py`) passes and `reuse lint` reports full
      compliance (incl. the new `CHANGELOG.md`).
- [x] 5.3 New `parse/prosody` and `resolve/prosody` fixtures verified internally consistent
      (JSON valid; `0.2.0` stamp; per-attribute merge and default-omission match §5.5/§11.1;
      timing recomputed).
