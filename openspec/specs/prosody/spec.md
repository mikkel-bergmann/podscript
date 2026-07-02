# prosody Specification

## Purpose
Define how a Podscript script controls **prosody** — the delivery of speech on top of the words.
The `prosody` control carries the three continuous attributes `rate`, `pitch`, and `volume` as a
per-voice baseline (§2.3) and a per-line `cue` clause (§5), merged per attribute onto the IR clip
(§5.5, §11.1). Prosody is advisory synthesis guidance (a deliberate exception to fail-closed, §15.4)
that joins the synthesis cache key (§14.3) and never affects timing/resolution; the remaining
prosodic dimensions (stress, pausing, intonation contour, emotion) map onto existing constructs
(`*emphasis*`, breaks, punctuation, `(direction)`).

## Requirements
### Requirement: Voice-level prosody baseline

A voice declaration (§2.3) SHALL accept an optional `prosody` object setting the speaker's
**baseline delivery**, with any of three attributes: `rate` (a positive speaking-rate
multiplier, `1.0` = natural), `pitch` (a signed semitone shift written with the `st` unit,
e.g. `+2st`, `-1st`), and `volume` (a positive vocal-intensity multiplier, `1.0` = natural).
It SHALL parse into the AST field `Voice.prosody` (a `Prosody` object with `rate`/`pitch`/
`volume` numbers, `pitch` in semitones) and SHALL be omitted entirely when absent.

#### Scenario: Voice prosody parses into the AST
- **WHEN** a script declares `sam: { voice: Adam, prosody: { rate: 1.1, pitch: -1st } }`
- **THEN** the AST voice for `sam` has `prosody` equal to `{ "rate": 1.1, "pitch": -1 }`

#### Scenario: Absent prosody omits the field
- **WHEN** a voice declares no `prosody`
- **THEN** the AST voice has no `prosody` key

### Requirement: Line-level prosody clause

A speech line's cue bracket (§5) SHALL accept a `prosody` clause carrying one or more of the
attributes `rate <NUMBER>`, `pitch <±NUMBER>st`, and `volume <NUMBER>`, which override the
speaker's voice-level baseline for that line. The clause SHALL parse into the AST as a
`Clause` of kind `prosody` with the present attributes as numbers (`pitch` in semitones).
Like all clauses it SHALL be order-independent and appear at most once per cue. Prosody
SHALL be a **synthesis** directive: it SHALL NOT affect anchor resolution, timing, or the
gain model.

#### Scenario: Line prosody clause parses into a clause node
- **WHEN** a speech line is written `sam [prosody rate 1.35 pitch +3st volume 1.2]: Wait!`
- **THEN** the line's cue contains a clause `{ "kind": "prosody", "rate": 1.35, "pitch": 3, "volume": 1.2 }`

#### Scenario: Prosody does not change resolved timing
- **WHEN** two otherwise-identical scripts differ only in a line's `prosody` clause, resolved
  against the same supplied durations
- **THEN** every `start`, `dur`, and `end` in the two IRs is identical

### Requirement: Resolver merges effective prosody per attribute

The resolver SHALL emit an effective `prosody` object on each speech clip in the IR (§11),
merged **per attribute**: for each of `rate`/`pitch`/`volume`, the line clause's value if
present, otherwise the speaker's voice-level baseline value if present. Each attribute SHALL
be omitted when its effective value is the natural default (`rate 1.0`, `pitch 0`,
`volume 1.0`), and the whole `prosody` object SHALL be omitted when no attribute remains.

#### Scenario: Line attribute overrides only that attribute of the baseline
- **WHEN** speaker `sam` has voice `prosody: { rate: 1.1, pitch: -1st }` and a line reads
  `sam [prosody rate 1.35 pitch +3st volume 1.2]: ...`
- **THEN** that clip's IR `prosody` is `{ "rate": 1.35, "pitch": 3, "volume": 1.2 }`

#### Scenario: Unset line attributes fall back to the voice baseline
- **WHEN** speaker `sam` has voice `prosody: { rate: 1.1, pitch: -1st }` and a line reads
  `sam: ...` with no prosody clause
- **THEN** that clip's IR `prosody` is `{ "rate": 1.1, "pitch": -1 }`

#### Scenario: Default attributes and empty object are omitted
- **WHEN** a speaker has no voice `prosody` and a line reads `alex [prosody rate 0.9]: ...`
- **THEN** that clip's IR `prosody` is `{ "rate": 0.9 }` (no `pitch`/`volume` keys)

#### Scenario: Fully-natural clip omits prosody entirely
- **WHEN** a speaker has no voice `prosody` and the line has no prosody clause
- **THEN** that clip's IR has no `prosody` key

### Requirement: Prosody is advisory and reproducible

Prosody SHALL be advisory synthesis guidance, a deliberate exception to the fail-closed rule
(§15.4): the `rate`/`pitch`/`volume` attributes are core vocabulary (no `requires`), but a
conforming renderer SHALL apply only what its provider supports, MAY drop an attribute it
cannot honour, and SHALL clamp applied attributes to the provider's range and record the
effective (post-clamp) values in the render manifest (§14.3). Because prosody changes the
synthesized audio, it SHALL be part of the synthesis cache key `params` (§14.3).

#### Scenario: Prosody is part of the cache key
- **WHEN** two renders of the same clip use different effective `prosody` values
- **THEN** they compute different synthesis cache keys and do not share a cached result

#### Scenario: Unsupported attribute is dropped, not an error
- **WHEN** a clip requests `pitch +3st` and the provider has no pitch control
- **THEN** the renderer proceeds, omits the pitch shift, and records the applied prosody in
  the manifest (it does not raise a `capability` error)

### Requirement: Volume is vocal intensity, distinct from mix gain

Prosody `volume` SHALL denote the voice's **vocal intensity/effort** (which also affects
timbre), applied at synthesis, and SHALL be independent of the mix `gain` clause (§5, §9)
that sets a clip's post-synthesis fader level in dB. The two SHALL be expressible together
without conflict.

#### Scenario: Volume and gain are separate controls
- **WHEN** a script uses `prosody volume 1.2` on a line and a `gain -6db` on a bed
- **THEN** `volume` is recorded on the clip's `prosody` (synthesis) and `gain` remains a
  separate mix control; neither is derived from the other
