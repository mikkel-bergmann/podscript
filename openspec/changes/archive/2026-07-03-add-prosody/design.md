## Context

Podscript already carries fragments of prosody — `(direction)` (emotion), `*emphasis*`
(stress), and breaks (rhythm) — but nothing unifies them and there is no control over rate,
pitch, or intensity. Prosody (linguistics) spans pitch (F0/intonation), duration
(tempo/rhythm), intensity (loudness), plus stress, pausing, and emotional/attitudinal
delivery. Real engines constrain how we can offer it: ElevenLabs parses no SSML and exposes
only a whole-request `speed`; Piper exposes `length_scale`; only espeak-ng honours per-word
`<prosody>`, at robotic quality. So the portable unit is a **per-utterance envelope**. This
repo is the spec + conformance suite (no reference implementation); the change lands as SPEC
edits + fixtures via an OpenSpec change, mirroring the archived `add-pronunciation` change.

## Goals / Non-Goals

**Goals:**
- One coherent prosody model that names every prosodic dimension and gives each a concrete
  Podscript control — covering the whole space "to an extent," honestly bounded by engines.
- Continuous knobs (`rate`, `pitch`, `volume`) at two granularities: a per-voice baseline
  (character consistency) and a per-line override (a beat of delivery).
- Preserve determinism: prosody is synthesis-only and MUST NOT perturb resolution/timing.

**Non-Goals:**
- No inline per-word prosody spans — unshippable on flagship engines and hostile to
  fail-closed (most engines would silently drop them).
- No pitch *contours*/SSML curves, no emphasis *degrees* — possible follow-ups.
- No change to timing math, the gain model, or existing fixtures.

## Decisions

**1. One `prosody` control, SSML-shaped, carrying `rate` / `pitch` / `volume`.**
Grouping the three continuous attributes under a single `prosody` keyword (voice object +
line clause) mirrors SSML `<prosody rate= pitch= volume=>` and reads as one delivery unit.
These map onto the three primary acoustic correlates: duration → `rate` (multiplier),
fundamental frequency → `pitch` (semitones, `±Nst`), intensity → `volume` (multiplier).
*Alternative:* three separate top-level clauses. Rejected — noisier and loses the grouping.
*Alternative:* rate only (the earlier `pace` scope). Rejected — the user asked to cover the
full prosodic range.

**2. Cover the rest of prosody by reframing existing constructs, not new grammar.**
Stress/focus = `*emphasis*`; rhythm/pausing = `...`/`{break}`; intonation contour = sentence
punctuation; emotion/attitude/voice-quality = `(direction)`. §5.5 presents a dimension→control
table so the model is visibly complete while the new grammar stays minimal.

**3. `volume` is vocal intensity, explicitly distinct from mix `gain`.**
`volume` asks the *voice* to speak more/less forcefully (which changes timbre), at synthesis;
`gain` sets the clip's post-synthesis fader level in dB. Documenting the split prevents the
obvious confusion and lets both appear on one line.
*Alternative:* omit volume, fold loudness into emphasis. Rejected — leaves a named acoustic
correlate uncovered.

**4. Prosody never enters resolver timing; the resolver bakes the *effective* value per attribute.**
Durations are supplied input, so prosody (which only changes the returned audio/duration) is
carried as clip metadata, like `preset`/`direction`. The resolver merges per attribute
(`line ?? voice`), omits attributes at their natural default, and omits an empty object.
Keeps resolver conformance deterministic (§14.1); a fixture asserts timing is unchanged.

**5. Prosody is advisory — a deliberate exception to fail-closed (§15.4).**
The attributes are core vocabulary (no `requires`), but an engine applies only what its
provider supports and MAY drop the rest, recording what it applied. Unlike a dropped
`duck`/`fade`, an unhonoured prosody hint degrades expressiveness, not mix correctness — the
same best-effort contract as `(direction)`. Rate is near-universal; pitch/volume vary.

**6. Prosody joins the synthesis cache key.**
It changes the returned audio, so it is added to the §14.3 `params`; post-clamp effective
values are recorded in the manifest for reproducibility.

## Risks / Trade-offs

- **[Within-line variation is not expressible inline]** → Documented pattern: split the
  thought into consecutive cues, each with its own prosody, chained by relational timing.
- **[`volume` confused with `gain`]** → Explicit normative distinction (§5.5) + a fixture/
  requirement showing they coexist independently.
- **[Pitch/volume unsupported on flagship engines]** → Advisory contract: engines drop and
  record; §14.1 already scopes synthesis as provider-dependent.
- **[Prosody leaking into resolver timing would break determinism]** → Normative synthesis-only;
  a fixture asserts IR timing is unchanged by a prosody clause.
- **[Out-of-range values, e.g. `rate 3.0`]** → Parsed as authored; the renderer clamps and
  records effective values. The language hard-codes no one engine's range.

## Migration Plan

Additive and backward compatible — `prosody` is omitted when absent, so all existing
parse/resolve fixtures and scripts are byte-unchanged. Engines adopt incrementally; until then
a `prosody` value is carried through the IR and the clip is synthesized at natural delivery.

## Open Questions

- Follow-ups if wanted: emphasis *degrees* (`**strong**`), pitch *contours*, and a
  beat/breath pause vocabulary — deferred so the model can grow coherently later.
