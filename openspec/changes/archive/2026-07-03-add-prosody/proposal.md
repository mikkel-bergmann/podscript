## Why

Podscript has no unified way to control **prosody** — the delivery of speech on top of the
words. It can hint emotion (`(excited)`), stress a word (`*emphasis*`), and insert pauses
(`...`, `{break 500ms}`), but these are scattered and there is no control over speaking
**rate**, **pitch**, or **vocal intensity**. Natural narration needs the whole prosodic
range, and authors — including LLMs writing scripts — need one coherent model for it.

Prosody (linguistics) spans pitch (intonation), duration (tempo/rhythm), intensity
(loudness), plus stress, pausing, and emotional/attitudinal delivery. Real TTS engines
constrain *how* we can offer it: ElevenLabs parses **no SSML** and exposes only a
whole-request `speed`; offline engines (Piper `length_scale`, XTTS) expose only global
rate; true per-word prosody exists only in espeak-ng, at robotic quality. So Podscript
models prosody as a **per-utterance, advisory** envelope: portable where engines support
it, gracefully dropped where they don't, and never affecting the deterministic mix.

## What Changes

- Introduce a core **prosody** model in the SPEC (`docs/SPEC.md`, §5.5) that names every
  prosodic dimension and maps each to a Podscript control:
  - Three **continuous** attributes carried by a new `prosody` control — `rate` (tempo
    multiplier), `pitch` (semitone shift, `±Nst`), `volume` (vocal-intensity multiplier):
    - a **voice-level baseline** object (§2.3): `sam: { voice: Adam, prosody: { rate: 1.1, pitch: -1st } }`
    - a **per-line clause** (§5): `sam [prosody rate 1.35 pitch +3st volume 1.2]: ...`,
      overriding the baseline **per attribute**.
  - The existing constructs, reframed and cross-referenced as the rest of the model:
    **stress** = `*emphasis*`, **rhythm/pausing** = `...`/`{break}`, **intonation contour**
    = sentence punctuation, **emotion/attitude/voice-quality** = `(direction)`.
- Add a `SEMITONES` token (`±Nst`); define semantics: attributes default to natural
  (`rate 1.0`, `pitch +0st`, `volume 1.0`); engines **clamp** and record effective values
  in the manifest; `volume` (vocal effort) is explicitly distinct from mix `gain`.
- Prosody is a **synthesis** directive, not a timing one: the resolver bakes the
  **effective** (per-attribute merged) prosody onto the IR clip and omits defaults — so
  resolution stays deterministic and TTS-independent (§14.1).
- Prosody joins the §14.3 synthesis cache-key `params`. It is **advisory** — a deliberate
  exception to fail-closed (§15.4): core vocabulary, but engines drop attributes they can't
  honour (like `(direction)`), degrading expressiveness, never mix correctness.
- Add AST/IR types (`Voice.prosody?`, a `Prosody` interface, a `prosody` `Clause` variant,
  IR-clip `prosody`) and two conformance fixtures (`parse/prosody`, `resolve/prosody`).
- **Authoring guidance** (`docs/AUTHORING.md`, non-normative): a *Prosody* section with the
  dimension→control table, the baseline+override pattern, the split-into-cues pattern for
  within-line variation, a recommended `(direction)` vocabulary, and engine portability notes.

- **Version bump to 0.2.0 (minor).** Prosody is an additive, backward-compatible feature, so
  the spec moves from `0.1` to **`0.2.0`** under Semantic Versioning. Adopt three-part
  `MAJOR.MINOR.PATCH` stamps (`PATCH` optional, defaults to `0`; `0.1` ≡ `0.1.0` remains valid
  input), record the release in a new `CHANGELOG.md`, and bump the spec-version references (SPEC
  header/§1.2/§20, README, `llms.txt`). As a one-time pre-1.0 housekeeping step, **normalize
  every bundled example and conformance-fixture stamp to `0.2.0`** so the repo uses one
  consistent current version (a stamp-only change; no script's meaning changes).

Not in scope (to keep the grammar bounded): inline per-word prosody spans (unshippable on
flagship engines), pitch *contours*/SSML curves, and emphasis *degrees* — a possible follow-up.

## Capabilities

### New Capabilities
- `prosody`: the `prosody` voice-baseline object and per-line clause (`rate`/`pitch`/
  `volume`), the `SEMITONES` token, per-attribute effective-merge into the IR clip (defaults
  omitted), inclusion in the synthesis cache key, the advisory/best-effort contract, the
  `volume`-vs-`gain` distinction, and the mapping of the remaining prosodic dimensions onto
  existing constructs (`*emphasis*`, breaks, punctuation, `(direction)`). Prosody does not
  affect timing/resolution.

### Modified Capabilities
<!-- none — the only existing capability spec is `pronunciation`, whose requirements are unchanged. -->

## Impact

- `docs/SPEC.md` — §1.5 `SEMITONES` token, §2.3 `prosody` voice object, §3/§3.1 cross-refs,
  §5 clause grammar (`prosody`), §5.5 Prosody model + dimension table, §10 `Voice`/`Prosody`/
  `Clause` types, §11 IR clip example + §11.1 effective-prosody convention, §14.3 cache key.
- `docs/AUTHORING.md` — *Prosody* section, clause-table row, voices field list.
- `examples/prosody.podscript` — canonical runnable example, single-sourced into AUTHORING via a
  CI-guarded tagged block and linked from `README.md`.
- `conformance/` — new `parse/prosody` and `resolve/prosody` fixtures; all fixtures restamped
  `0.2.0`; README coverage table.
- Versioning — SPEC header/§1.2/§20, `README.md`, `llms.txt` bumped to `0.2.0`; every example and
  fixture stamp normalized to `0.2.0`; new top-level `CHANGELOG.md` (SPDX-headed, CC-BY-4.0).
- Consuming engines parse prosody, pass IR prosody through to the provider's rate/pitch/volume
  controls (dropping unsupported attributes), and record effective values in the manifest.
- Backward compatible at the language level: `prosody` is omitted when absent and a `0.1` script
  parses unchanged; the fixture re-stamp is a stamp-only housekeeping change, not a semantic one.
