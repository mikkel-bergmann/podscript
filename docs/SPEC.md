<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Podscript Specification — v0.2.0

This is the specification of the Podscript language for declaratively producing
podcasts: lexical structure, grammar, AST, semantics (anchors, two-pass resolution,
the gain model), the resolved IR schema, and the conformance, determinism,
extensibility, and security rules an implementation must follow.

**Status:** v0.2.0 — the grammar and IR are stable; normative sections (§13–§21) are
open for implementer feedback before v1.0. This version adds the prosody model (§5.5) as
a backward-compatible (minor) addition over v0.1; see [`CHANGELOG.md`](../CHANGELOG.md).
The spec follows [Semantic Versioning](https://semver.org/) (§20).

**License:** This specification text is licensed **CC BY 4.0**. A reference
implementation, when published, is licensed separately (Apache-2.0). See §21.

## Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHOULD**,
**SHOULD NOT**, **MAY**, and **OPTIONAL** in this document are to be interpreted as
described in [RFC 2119] and [RFC 8174] when, and only when, they appear in all
capitals. A requirement on "the engine" applies to a conforming implementation as a
whole; requirements on "the parser", "the resolver", and "the renderer" apply to
those conformance classes individually (§13).

## Guiding principles

1. **Deterministic where it can be.** The resolution and mix layers are fully
   deterministic: given a set of clip durations, anchor resolution, the gain model,
   and the IR are reproducible across conforming engines (§14). Speech *synthesis*
   is provider-dependent and is reproducible only when pinned via a render manifest.
   No behavioral/conditional logic lives in the language.
2. **Relational timing.** Authors never write timestamps (except as an explicit
   escape hatch); they describe timing relative to events, and the compiler
   resolves absolute time after voices are synthesized.
3. **Regular and sigil-light.** One structural rule (`speaker:` = speech, anything
   else = a directive) disambiguates the whole grammar. Directives are keyword-driven
   so the language is robust both to human typing and to LLM generation, and survives
   pasting into chat UIs.
4. **Fail-closed.** An engine MUST NOT silently ignore a construct it does not
   understand; a dropped directive produces a wrong-but-successful mix. Unknown
   constructs are errors unless explicitly declared optional (§15.4).

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174

---

## 1. Lexical structure

### 1.1 Encoding and lines

- A script MUST be encoded in **UTF-8** (no byte-order mark). An engine MUST reject
  input that is not valid UTF-8.
- Text MUST be treated as **Unicode NFC**-normalised for the purposes of identifier
  and string comparison; an engine SHOULD normalise on input.
- Lines are separated by **LF** (`U+000A`). A CR before LF MUST be tolerated and
  stripped; a lone CR is not a line separator.
- The script is parsed **line by line**; lines are significant.

### 1.2 Version stamp

The first non-blank, non-comment line of a script MUST be a version declaration:

```
podscript: "0.2.0"
```

The value is a **semantic version** (`MAJOR.MINOR.PATCH`, §20). The `PATCH` component
MAY be omitted and defaults to `0`, so `0.1` and `0.1.0` are equivalent. A script MUST
declare a version that supports every feature it uses (a script using prosody, added in
`0.2.0`, MUST declare at least `0.2.0`); authoring against the current version is always
valid. An engine matches on `MAJOR.MINOR` — `PATCH` differences are always compatible —
and MUST refuse a script whose `MAJOR.MINOR` it does not implement, with a clear error,
rather than attempt a best-effort parse.

### 1.3 Indentation and blocks

- A block body is indented relative to its header (`voices:`, `assets:`, `scene …:`).
- Indentation MUST use spaces only (no tabs). A block MUST use a consistent indent
  width throughout; mixing widths within one block is an error. Two spaces per level
  is RECOMMENDED.
- Blank lines and lines containing only a comment are ignored for block structure.

### 1.4 Comments, labels, and escaping

- `#` begins a comment to end of line, **except** when it forms a trailing `#label`
  token on a directive or speech line (§6). A `#label` is recognised only as the
  final token of such a line; a `#` anywhere else, or mid-text, is a comment unless
  escaped.
- Inside spoken `TEXT`, the characters `#`, `*`, `[`, `]`, `{`, `}`, and `\` are
  escaped with a backslash (`\#`, `\*`, `\\`) to be taken literally. An unescaped
  `#` in spoken text terminates the text and begins a label or comment, so authors
  MUST escape literal hashes.
- `(` immediately after a speaker id opens a `direction`; to write a literal
  parenthesis in spoken text, place it after the `:` and it is taken literally
  (directions are only recognised before the `:`).

### 1.5 Token classes

```
IDENT      := [A-Za-z_][A-Za-z0-9_-]*
NUMBER     := -?[0-9]+ ("." [0-9]+)?     # decimal point is always "." (locale-independent)
DURATION   := NUMBER ("s" | "ms")
DB         := NUMBER "db"            # case-insensitive; "-6db", "-18dB"
SEMITONES  := ("+" | "-") NUMBER "st"   # signed pitch shift, e.g. +2st, -1st
TIMECODE   := NUMBER ":" NUMBER ("." NUMBER)?   # m:ss(.ms), e.g. 0:23, 1:04.5
              | DURATION                          # e.g. 8s, also accepted
```

All times resolve internally to an integer number of **milliseconds**; see §14.2
for rounding rules.

---

## 2. Top-level structure

A script opens with a version stamp, then header sections, then one or more scenes:

```ebnf
script    := version_decl header* scene+
version_decl := "podscript" ":" STRING NEWLINE
header    := meta_decl | requires_decl | voices_decl | assets_decl | pronounce_decl
scene     := "scene" IDENT ":" NEWLINE INDENT line+ DEDENT
line      := speech | directive
```

A header section MAY appear at most once. `meta` and `requires` are OPTIONAL;
`voices` is REQUIRED if any speech lines are present; `assets` is REQUIRED if any
asset is referenced.

### 2.1 `meta`

```ebnf
meta_decl := "meta" ":" NEWLINE INDENT kv+ DEDENT
```

Free-form key/value metadata. Recognised keys:

- `title`, `description` — informational.
- `lufs` — target integrated loudness for the final loudness-normalisation pass
  (default `-16`, the podcast standard).
- `true_peak` — true-peak ceiling in dBTP for the final pass (default `-1`), to
  avoid inter-sample clipping on playback.

Unknown keys are preserved into the IR but otherwise ignored by the renderer.

### 2.2 `requires`

Declares the extension capabilities a script depends on, so an engine can fail fast
if it cannot honour them (§15).

```ebnf
requires_decl := "requires" ":" NEWLINE INDENT requirement+ DEDENT
requirement   := "-" NAMESPACE ("optional")?
NAMESPACE     := IDENT ("." IDENT)+      # e.g. elevenlabs.emotion, x.binaural-pan
```

An engine MUST error if it does not implement a required capability, **unless** that
requirement is marked `optional`, in which case the engine MAY proceed and MUST omit
the corresponding constructs (§15.4).

### 2.3 `voices`

```ebnf
voices_decl := "voices" ":" NEWLINE INDENT voice+ DEDENT
voice       := IDENT ":" "{" voice_field ("," voice_field)* "}"
voice_field := "voice" ":" IDENT            # provider voice name/id
             | "provider" ":" IDENT         # default: project default
             | "preset" ":" IDENT           # named DSP chain (see §7)
             | "style" ":" IDENT            # provider style/emotion hint
             | "prosody" ":" prosody_obj    # baseline delivery: rate/pitch/volume (§5.5)

prosody_obj := "{" prosody_kv ("," prosody_kv)* "}"
prosody_kv  := "rate" ":" NUMBER            # speaking-rate multiplier; 1.0 = natural
             | "pitch" ":" SEMITONES        # baseline pitch shift, e.g. +2st, -1st
             | "volume" ":" NUMBER          # vocal-intensity multiplier; 1.0 = natural
```

The `IDENT` before the colon is the **speaker id** used in speech lines and
anchors. A voice MAY also carry a `language` field (BCP 47 tag, e.g. `en-US`,
`da-DK`) to select the synthesis language; see §19. The optional `prosody` object
sets the speaker's **baseline delivery** — its habitual `rate`, `pitch`, and
`volume` (§5.5); a per-line `prosody` clause (§5.5) overrides it per attribute.
Prosody is advisory synthesis guidance (§5.5), not a mix or timing control.

### 2.4 `assets`

```ebnf
assets_decl := "assets" ":" NEWLINE INDENT asset+ DEDENT
asset       := IDENT ":" PATH ("loop" | "once")?
```

`IDENT` is the asset id referenced by `bed`/`music`/`sfx` targets. `loop`/`once`
sets the default loop behavior when an asset must cover a region longer than itself
(default: `once`).

### 2.5 `pronounce`

How a word *sounds* is a property of the content, not of any one TTS engine — a
surname or place name should be spoken correctly regardless of provider, and the
correction should travel with the script. The `pronounce` header is a per-script
**pronunciation lexicon**: a map from a word or phrase to a **sound-alike
respelling** that engines speak in its place.

```ebnf
pronounce_decl := "pronounce" ":" NEWLINE INDENT pron_entry+ DEDENT
pron_entry     := (IDENT | STRING) ":" STRING        # term : respelling
```

The key is the term as written in the spoken text (quote it if it contains spaces
or punctuation, e.g. `"Dee Why"`); the value is an engine-agnostic respelling
spelled the way it should sound (e.g. `Seibold: "SY-bold"`).

**Application (normative).** A conforming engine, before sending a speech clip's
text to its provider, rewrites occurrences of each lexicon term in `Text` and
`Emphasis` inline nodes (§3.1) with its respelling. Matching is:

- **whole-word** — a term matches only at word boundaries, never inside a longer word;
- **case-insensitive** — `Foran`, `foran`, and `FORAN` all match;
- **single-pass, longest-term-first** — all terms are considered together in one
  left-to-right pass, preferring the longest matching term at each position; the
  output of a replacement is **not** re-scanned, so a respelling can never trigger
  another substitution (no cascades).

The respelling affects **only the text handed to the synthesis engine**. The stored
`content` (§10), the IR (§11), and the exported transcript (§17) retain the original
spelling. The respelling is provider-independent input text, so it is covered by the
synthesis cache key the same way the spoken words are; resolution and timing are
unaffected. A one-off or homograph-specific override is expressed inline with
`{say … as …}` (§3.1), which takes precedence over the header map for that
occurrence.

This is a **core** feature, not a namespaced extension (§15): respelling is plain
spoken-text input that every text-driven engine can honour, so it carries core
semantics and needs no `requires`. (Phoneme/IPA input, which only some engines
accept, remains out of scope and would be a namespaced extension.)

---

## 3. Speech lines

A line is **speech** if and only if its first token is a declared speaker id
followed (after an optional directive/direction block) by a colon.

```ebnf
speech     := SPEAKER cue? direction? ":" TEXT label?
cue        := "[" clause ("," clause)* "]"     # machine directives (timing/eng.)
direction  := "(" WORDS ")"                     # delivery direction → TTS prosody
```

- **`SPEAKER`** — a speaker id from `voices`.
- **`cue` `[ … ]`** — timing/engineering clauses (same clause grammar as directives,
  §5). This is how a speech line carries an anchor without polluting the spoken text.
- **`direction` `( … )`** — a human-language delivery note (e.g. `(skeptical)`,
  `(warm)`), passed to the TTS engine as the emotional/attitudinal prosody hint (§5.5).
  Not timing.
- **`TEXT`** — the spoken words. This is the *only* freeform text in the language.
  It is stored as a typed `content` array of inline nodes (§3.1), not a raw string.
- **`label`** — optional `#name` to make this clip referenceable by anchors (§6).

### 3.1 Inline content

The spoken text is parsed into inline nodes so prosody is structural, not smuggled
markup:

```
*word*             → Emphasis
...                → a short Break (pause)
{break 500ms}      → an explicit Break of a given length
{say "lead" as "led"} → a Pronounce node: speak the first word as the second
```

Anything else is `Text`. Inline markup is optional; plain prose is valid. Emphasis and
breaks are the inline prosodic controls — word-level stress and phrasing/rhythm
respectively; the continuous prosody attributes (rate, pitch, volume) and the full
prosody model are in §5.5.

A **Pronounce** node respells one occurrence of a word for the synthesis engine
(`{say "<written>" as "<spoken>"}`). It overrides the `pronounce` header lexicon
(§2.5) for that occurrence — use it for one-offs and homographs (e.g. *lead* the
metal vs. the verb). The engine speaks the `as` text; the transcript (§17) and IR
retain the `written` form. Both arguments are quoted strings.

### 3.2 Speech spine (default sequencing)

Speech lines auto-sequence: each speech clip starts at the end of the previous
speech clip plus an inter-line gap (default 250 ms, configurable; overridable per
line). A speech line carrying an explicit anchor in its `cue` block **overrides**
this default and is placed relationally instead (e.g. parallel/overlapping speech,
or starting against a music event).

The speech spine is **continuous across scenes**: a scene boundary is a grouping
label only — it neither resets the timeline to zero nor adds any gap beyond the
normal inter-line gap. The first speech clip of a later scene follows the last
speech clip of the previous scene by exactly one inter-line gap. Use an explicit
`pause` to insert additional space.

---

## 4. Directives

A line that is not speech is a **directive**.

```ebnf
directive := verb target? clause* label?
verb      := bed_verb | sfx_verb | "pause"
bed_verb  := "bed" | "music" | "ambience" | "atmos"
sfx_verb  := "sfx" | "sting"
target    := IDENT          # an asset id (or, for pause, omitted)
```

- **`bed`** — a sustained background track (music/ambience) on a parallel track.
  - **`music`** — alias for `bed`; identical semantics, reads better for musical beds.
  - **`ambience`** / **`atmos`** — aliases for `bed`; read better for room tone /
    environmental ambience.
- **`sfx`** — a one-shot sound effect.
  - **`sting`** — alias for `sfx`; reads better for a short musical accent/punctuation.
- **`pause`** — insert silence on the speech spine. `pause 700ms`.

Aliases are purely cosmetic — they parse to the same node (`verb` is normalised to
`bed` or `sfx` in the AST). They exist so a script can use the term that reads most
naturally for the material.

`target` is an asset id, resolved during binding (§8).

### 4.1 Bed placement and lifetime

- **Placement.** A bed with no explicit anchor starts at the **playhead** — the end
  time of the most recently placed speech clip (or `pause`) that precedes it in
  document order, or `0` if none precedes it. A bed MAY instead carry an `anchor`
  clause to start relative to another element. Because placement is by document
  position, a bed declared at the top of a scene begins where the prior scene's
  speech left off (the spine is continuous, §3.2).
- **Lifetime.** A bed plays until the earliest of: (a) it is replaced by the next bed
  on the same track (including via `crossfade`), (b) it is ended by a `fade-out` to
  `-inf`, or (c) its asset reaches its natural end (`start + asset_duration`). Scene
  boundaries do **not** end a bed; a bed spans scenes.
- **Instances.** Each `bed` directive is a distinct bed instance with its own id,
  even when two instances reference the same asset. Two `bed intro …` directives
  produce `b1` and `b2` sharing `src: "intro"`, not one bed. To add automation to an
  existing bed later (e.g. a fade-out after a future line), give the bed a `#label`
  and anchor the fade to a forward reference (§5.1, §6) rather than re-declaring it.

---

## 5. Clauses

Clauses modify a directive or a speech `cue`. **Clauses are an order-independent
set**: `sfx whoosh after sam gain -3db` ≡ `sfx whoosh gain -3db after sam`. Each
clause *kind* may appear at most once per line (a duplicate is a validation error).

```ebnf
clause   := anchor | gain | fade | crossfade | duck | at | loopmode | prosody

anchor    := ("after" | "with" | "before") ref offset?
ref       := IDENT ("." event)?         # clip id, speaker, or asset event
event     := "start" | "end" | "fade-in" | "fade-out"
offset    := ("+" | "-") DURATION       # +0.4s, -200ms

gain      := "gain" DB                  # static base level, e.g. gain -6db
fade      := ("fade-in" | "fade-out") "over" DURATION ("at" anchor_or_time)?
crossfade := "crossfade" DURATION ("at" anchor_or_time)?
duck      := "duck-under" IDENT ("to" DB)? ("attack" DURATION)? ("release" DURATION)?
at        := "at" TIMECODE              # absolute placement (escape hatch)
loopmode  := "loop" | "once"
prosody   := "prosody" prosody_attr+    # one or more delivery attributes (§5.5)
prosody_attr := "rate" NUMBER | "pitch" SEMITONES | "volume" NUMBER

anchor_or_time := anchor | TIMECODE
```

A `prosody` clause is only meaningful on a speech `cue`; it is **advisory synthesis**
guidance, not a timing or mix directive (see §5.5).

### 5.1 Anchors (`after` / `with` / `before`)

| Form              | Resolved start/position                          |
|-------------------|--------------------------------------------------|
| `after sam`       | end of the referenced clip                       |
| `with alex`       | start of the referenced clip (parallel)          |
| `before sam`      | positioned to end at the referenced clip's start |
| `after sam +0.4s` | end of clip + offset                             |
| `with intro.fade-out` | the moment that event occurs on `intro`      |

A bare `ref` that is a **speaker id** resolves to *the nearest preceding speech
clip by that speaker* — speaker references never look forward. A `ref` that is a
**label** (§6) resolves **globally** to the single element bearing that label
anywhere in the script, so a label MAY be referenced before it is defined (a forward
reference); this is how a bed fades out against a line that comes later. A `ref` with
an `.event` suffix references a named event on a directive instance (a bed exposes
`start`, `fade-in`, `fade-out`, `end`). Forward references that form a dependency
cycle are a `cycle` error (§8, §13.1).

### 5.2 Fades

A fade is a self-timed event carrying its own duration and optional start. If `at`
is omitted, a `fade-in` is anchored to the track's start and a `fade-out` to a
duration before its end.

```
fade-in over 2s
fade-out over 4s at 8s
fade-out over 3s at intro.end-3s
```

### 5.3 Crossfade

`crossfade <dur>` on a **bed** ties it to the previously-active bed on the same
track: the incoming bed fades *in* over `<dur>` while the outgoing bed fades *out*
over the same window, overlapping — a single declaration for a "segue" between two
beds. The crossfade is anchored to the incoming bed's start unless `at` is given.

```
bed verse1 gain -8db
bed verse2 crossfade 1.5s        # verse2 fades up as verse1 fades down, over 1.5s
```

`crossfade <dur>` is shorthand: it expands during resolution into a `fade-out over
<dur>` on the outgoing bed and a `fade-in over <dur>` on the incoming bed, sharing a
start time. It therefore composes with the gain model (§9) like any other fade.

Crossfade is **track-scoped, not scene-scoped**: "the previous bed" is the bed that
is active on the same track when the incoming bed starts, even if it was declared in
an earlier scene. The crossfade ends the outgoing bed: its `end` is set to
`incoming.start + <dur>` (fade-out completion). Both expanded fades are tagged
`"src": "crossfade"` in the IR (§11.1).

### 5.4 Ducking

`duck-under <track>` attenuates this track during the resolved regions of the
referenced track (typically `speech`). Defaults: `to -18db`, `attack 60ms`,
`release 350ms`. Ducking is **scored** by default (computed from resolved regions,
fully deterministic); a signal-driven sidechain mode is available as a per-bed
option in the renderer.

**Affected regions and envelope (renderer, normative for the render tier).** The
ducked regions are *every* clip on the referenced track whose extent overlaps this
bed's active window (§4.1). For each such region the duck attenuation begins ramping
**before** the region start — the attack runs over `attack_ms` ending at the region
start, so the bed is fully ducked by the first sample of speech — and **releases**
linearly over `release_ms` after the region end. Overlapping or near-adjacent
regions whose ramps would intersect are merged so the bed does not bob back up
between them. This duck envelope is one of the envelopes combined under §9's
`base + min(...)` rule.

### 5.5 Prosody (delivery)

**Prosody** is the suprasegmental shape of speech — the properties of syllables and
larger units rather than the individual phonemes. Podscript models it along the
dimensions listed below; the three *continuous* ones are set with the `prosody` control
(a voice-level baseline, §2.3, or a per-line `cue` clause), and the rest are expressed
with constructs defined elsewhere in this spec.

| Prosodic dimension (acoustic correlate) | Podscript control |
|---|---|
| **Rate** — tempo / duration | `prosody rate <n>` — multiplier, `1.0` = natural |
| **Pitch** — fundamental frequency, baseline intonation | `prosody pitch <±n>st` — semitone shift |
| **Volume** — intensity / vocal effort | `prosody volume <n>` — multiplier, `1.0` = natural |
| **Stress / focus / emphasis** — prominence | `*word*` emphasis inline (§3.1) |
| **Rhythm / pausing** — phrasing, chunking | `...` and `{break <dur>}` (§3.1) |
| **Intonation contour** — sentence type (question / statement) | sentence punctuation in the spoken text |
| **Emotional / attitudinal / voice quality** — timbre, affect | `(direction)` delivery note (§3) |

`prosody volume` is **vocal intensity** (how forcefully the voice speaks — which also
changes timbre), **not** a mix level: post-synthesis level is the `gain` clause (§5, §9)
in dB. Overall loudness of a finished line is therefore two independent things — how the
voice performs (`volume`) and where its fader sits (`gain`).

A voice-level `prosody` object (§2.3) sets a speaker's habitual delivery; a per-line
`prosody` clause **overrides it per attribute** (a line that sets only `pitch` keeps the
voice's baseline `rate`). Attributes left unset fall back to the voice baseline, then to
the natural default (`rate 1.0`, `pitch +0st`, `volume 1.0`).

Prosody is a **synthesis** concern, not a timing one. It changes the speech audio the
provider returns (and therefore a clip's measured duration), but it is **not** an input
to anchor resolution or the gain model: the resolver takes clip durations as supplied
input (§8), so a `prosody` clause never alters `start`/`dur`/`end`. The resolver carries
the resolved **effective** prosody onto the clip (§11.1); the renderer applies each
attribute to the provider's corresponding control, **clamping** to the provider's
supported range and recording the effective (post-clamp) values in the render manifest
(§14.3). Because prosody changes the returned audio, it is part of the synthesis cache
key (§14.3).

Prosody is **advisory**, and this is a deliberate exception to the fail-closed rule
(§15.4): the three continuous attributes are **core** vocabulary (no `requires`), but an
engine applies only what its provider supports and MAY drop an attribute it cannot honour
(recording what it applied). Unlike a dropped `duck` or `fade`, an unhonoured prosody hint
degrades *expressiveness*, not *mix correctness* — the same best-effort contract as
`(direction)`. Rate is honoured by essentially every engine; pitch and volume vary more.
Podscript models a per-utterance envelope only; finer, within-line variation is authored
by splitting a line into consecutive cues, each with its own prosody.

---

## 6. Labels and references

Any directive or speech line may carry a trailing `#label`:

```
sam: Welcome back.        #intro_line
bed intro fade-out over 4s at 8s   #music
sfx sting with intro_line
```

A label creates a referenceable id for anchors. Speech clips are otherwise
anonymous and are referenced by speaker (nearest-preceding rule, §5.1).

---

## 7. DSP presets

`preset: <name>` on a voice references a named DSP chain (EQ / compression /
de-ess / "radio voice"), defined in project configuration (not in the script).
Presets are reused across voices and resolved by the renderer. The script only
names them; their definition is out of band so scripts stay portable.

---

## 8. Compilation pipeline

```
tokens → AST → bound AST → IR → audio
```

1. **Parse** — produce the AST. Purely syntactic; no resolution. Every line maps to
   a typed node; nothing is stored as an unparsed string except inline `Text`.
2. **Bind / name-resolution** — resolve every `target` to a declared asset, every
   speaker to a voice, and every anchor `ref` to a concrete clip/event. Unresolved
   references are compile errors *with source location*.
3. **Pass 1 — durations** — synthesize all speech via TTS (cached by hash of
   `(text, voice, params)`); probe asset durations via `ffprobe`. Trim TTS head/tail
   silence so inter-line gaps are authored, not random TTS padding.
4. **Pass 2 — resolve + mix** — topologically sort anchor dependencies (a cycle is a
   compile error), resolve every `start`/`end` to absolute seconds, build the IR.
5. **Render** — per-clip DSP (Pedalboard presets) → ffmpeg mix with fade/duck gain
   automation → loudness-normalise (default −16 LUFS).

---

## 9. The gain model

Every track's gain is one base level plus the quietest active automation envelope:

```
effective_gain(t) = base_level + min( fade_env(t), duck_env(t), … )
```

- **base_level** — the static `gain` clause (default 0 dB).
- Each envelope outputs an **attenuation ≤ 0 dB**. `min` selects the most negative
  (quietest) at every instant.
- Fades and ducks are both just envelopes; the renderer evaluates all of them and
  takes the min. New automation sources compose with zero new mixing logic.

This makes fade+duck interaction well-defined: a fading-out bed that also ducks is
governed by whichever envelope is quieter at each instant — never louder than
either intends, no double-dip.

---

## 10. AST node reference

The AST root is a `Script`:

```ts
interface Script {
  podscript: string                       // declared version
  meta:     Record<string, unknown>        // raw key/values (§2.1)
  requires: Requirement[]                   // [] when absent
  voices:   Record<string, Voice>          // keyed by speaker id
  assets:   Record<string, Asset>          // keyed by asset id
  pronounce?: Record<string, string>        // term → respelling (§2.5); omitted when absent
  scenes:   Scene[]
}
interface Requirement { ns: string; optional: boolean }
interface Voice  { voice?: string; provider?: string; preset?: string; style?: string; language?: string; prosody?: Prosody }
interface Asset  { path: string; loop?: "loop" | "once" }
interface Prosody { rate?: number; pitch?: number; volume?: number }   // pitch in semitones; §5.5
```

```ts
type Node = Scene | Speech | Directive

interface Scene    { kind: "scene"; name: string; body: (Speech | Directive)[]; loc: Span }

interface Speech {
  kind: "speech"
  speaker: string
  cue?: Clause[]           // timing/engineering directives from [ ... ]
  direction?: string       // delivery note from ( ... )
  content: Inline[]        // typed spoken text — never a bare string
  label?: string
  loc: Span
}

interface Directive {
  kind: "directive"
  verb: "bed" | "sfx" | "pause"   // aliases (music/ambience/atmos/sting) normalised here
  target: Ident | null
  clauses: Clause[]
  ext?: ExtClause[]               // namespaced extension clauses, preserved verbatim (§15)
  label?: string
  loc: Span
}

type Clause =
  | { kind: "anchor"; rel: "after" | "with" | "before"; ref: string; event?: Event; offset?: number }
  | { kind: "gain";      db: number }
  | { kind: "fade";      dir: "in" | "out"; seconds: number; at?: AnchorOrTime }
  | { kind: "crossfade"; seconds: number; at?: AnchorOrTime }
  | { kind: "duck";      track: string; toDb?: number; attackMs?: number; releaseMs?: number }
  | { kind: "at";     seconds: number }
  | { kind: "loop";   mode: "loop" | "once" }
  | { kind: "prosody"; rate?: number; pitch?: number; volume?: number }  // delivery (§5.5); speech cue only; pitch in semitones

type Event  = "start" | "end" | "fade-in" | "fade-out"
type Inline = { kind: "text"; value: string }
            | { kind: "emphasis"; value: string }
            | { kind: "break"; ms?: number }
            | { kind: "pronounce"; value: string; say: string }   // {say "value" as "say"} (§2.5, §3.1)
```

### 10.1 AST conventions (normative for conformance)

- **`loc` is informative.** Every node carries a source `loc` (`{ line, col }`) for
  diagnostics, but `loc` is **excluded from conformance comparison** — fixtures omit
  it, and an engine's `loc` values are not checked. This keeps fixtures independent
  of incidental whitespace.
- **Optional fields are omitted when absent**, never emitted as `null` (e.g. a speech
  line with no `cue`/`direction`/`label` omits those keys; an asset with no explicit
  `loop` omits `loop`).
- **Aliases are normalised** in the AST: `verb` is always `bed`/`sfx`/`pause`
  (§4); `music`/`ambience`/`atmos`/`sting` never appear.
- **Comparison is structural**, not textual: two ASTs are equal if they are equal as
  JSON values after dropping `loc`. Object key order is insignificant.

---

## 11. IR schema (the freeze line)

The IR is resolved, absolute-time JSON. It is the contract consumed by the renderer
and by any future tooling (visual timeline, preview renderer).

```jsonc
{
  "podscript": "0.2.0",
  "meta": { "title": "…", "lufs": -16, "true_peak": -1 },
  "pronounce": { "Seibold": "SY-bold" },   // term → respelling (§2.5); omitted when absent
  "clips": [
    {
      "id": "c1", "track": "speech", "voice": "sam", "preset": "host",
      "prosody": { "rate": 1.1, "pitch": -1 },
      "start": 8.0, "dur": 6.5, "end": 14.5,
      "content": [ { "kind": "text", "value": "…" } ],
      "anchor": { "rel": "with", "ref": "b1", "event": "fade-out" }
      // no "src": the renderer adds the synthesised audio path post-TTS (§11.1)
    }
  ],
  "beds": [
    {
      "id": "b1", "src": "intro", "track": "music",
      "start": 0.0, "end": 12.0, "gain_db": -3, "loop": false,
      "automation": [
        { "src": "fade", "t": 8.0, "dir": "out", "dur": 4.0, "to_db": "-inf" }
      ],
      "events": { "start": 0.0, "fade-out": 8.0, "end": 12.0 }
    }
  ],
  "oneshots": [
    { "id": "s1", "src": "whoosh", "at": 4.1, "dur": 0.6, "end": 4.7 }
  ]
}
```

- Every time field is absolute seconds.
- `beds[].automation` is the list of gain envelopes (fades + ducks); the renderer
  applies §9's `base + min(envelopes)`.
- `beds[].events` exposes the resolved time of each named event, so anchors that
  targeted them are already baked into dependent clips' `start`.

### 11.1 IR conventions (normative for conformance)

- **Resolver IR vs rendered IR.** The *resolver* produces timing-complete IR that
  carries no synthesised-audio paths: speech clips carry `voice`, `preset`, and the
  `content` to synthesise, but **no `src`**. The *renderer* synthesises speech and
  adds `src` (and may add a `synth_hash`). Conformance for the resolver class (§13)
  is checked against resolver IR — so it is fully deterministic and TTS-independent.
- **Identifiers.** IDs are assigned per kind in source document order: speech clips
  `c1, c2, …`; beds `b1, b2, …`; one-shots `s1, s2, …`. The counters are independent
  and start at 1.
- **Times.** All times are absolute seconds at **millisecond precision**. Numbers
  are compared after rounding to the nearest millisecond, so `8`, `8.0`, and `8.000`
  are equal; trailing zeros are not required.
- **Optional fields omitted when absent**, never `null`.
- **Pronunciation passthrough.** A non-empty `pronounce` header (§2.5) is copied to
  the IR root verbatim and omitted when absent. It is applied at synthesis time, so
  speech clips' `content` retains the original spelling (inline `pronounce` nodes,
  §3.1, are preserved within `content`); timing and resolution are unaffected.
- **Effective prosody.** A speech clip carries a `prosody` object (§5.5) holding the
  resolved delivery attributes, merged **per attribute**: the line's `prosody` clause
  value if present, else the speaker's voice-level `prosody` baseline (§2.3). Each
  attribute is **omitted at its natural default** (`rate 1.0`, `pitch 0`, `volume 1.0`),
  and the whole `prosody` object is omitted when no attribute remains. `pitch` is in
  semitones. Prosody is synthesis metadata and does not affect timing, so
  `start`/`dur`/`end` are identical whether or not `prosody` is present.
- **Bed end.** A `fade-out` to `-inf` sets the bed's `end` to the moment the fade
  completes. Otherwise a bed ends at `start + asset_duration` (or where explicitly
  cut). `loop: true` beds have no intrinsic end and MUST be bounded by a fade or cut.
- **Ducking is declarative in the IR.** A `duck-under` clause becomes a single
  automation entry `{ "src": "duck", "track": "speech", "to_db": -18, "attack_ms":
  …, "release_ms": … }`. The renderer derives the affected regions from the resolved
  `clips` of the referenced track; the resolver does **not** pre-expand per-region
  segments. Keeps the IR compact and the speech regions single-sourced.
- **Crossfade expansion.** A `crossfade <d>` becomes a `fade-in` automation on the
  incoming bed and a `fade-out` automation on the outgoing bed, both tagged
  `"src": "crossfade"`, sharing one start time (§5.3).
- **One-shots are self-contained.** A `oneshots` entry carries `at`, plus `dur` and
  `end` (`= at + dur`) from the probed asset length, so downstream tooling can reason
  about overlap without re-probing.
- **Bed events** record the begin time of each named event the bed has: `start`
  always; `fade-in` if the bed fades in (explicitly or via `crossfade`); `fade-out`
  if it fades out; `end`. Absent events are omitted.
- **Comparison is structural** (JSON-value equality with the millisecond rounding
  above), not byte equality.

---

## 12. Worked example

See [`../examples/cold_open.pod`](../examples/cold_open.pod) for the canonical
fade-out-with-overlapping-narration scenario this spec was validated against.

---

## 13. Conformance

An implementation MAY conform at one or more of three classes. Higher classes
include the obligations of lower ones.

1. **Parser.** Given a script, produces the AST of §10, or rejects it with a
   located error. A conforming parser MUST produce the canonical AST for every
   fixture in `conformance/parse/`.
2. **Resolver.** A conforming parser that additionally performs binding (§8 step 2)
   and timing resolution (§8 step 4) to produce the IR of §11, given a table of clip
   and asset durations supplied as input (so the test is independent of any TTS).
   MUST produce the canonical IR for every fixture in `conformance/resolve/`, which
   pairs `(input.podscript, durations.json) → expected.ir.json`.
3. **Renderer.** A conforming resolver that additionally produces audio from an IR.
   Because audio is perceptual, renderer conformance is defined by *measurable*
   properties rather than byte-equality: integrated loudness within ±1 LUFS of the
   `meta.lufs` target, true peak at or below `meta.true_peak`, and gain-automation
   envelopes matching the IR within a stated tolerance. Fixtures live in
   `conformance/render/`.

The **IR is the conformance anchor**: classes 1–2 are exactly testable without
audio, which is what makes the spec verifiable by independent implementers. The
`conformance/` suite is normative; a change that alters any golden fixture is a
breaking change (§20).

### 13.1 Error model

Errors fall into categories, and every error reported by an engine MUST carry a
source location (`line`, and where meaningful `column`):

| Category | Examples | Class that raises it |
|---|---|---|
| **version** | unsupported `podscript:` version | parser |
| **syntax** | malformed directive, bad indentation, unterminated `[` | parser |
| **binding** | unknown asset/speaker/anchor reference | resolver |
| **cycle** | circular anchor dependency | resolver |
| **validation** | duplicate clause kind, conflicting placement | resolver |
| **capability** | unimplemented required extension (§15) | resolver |
| **resource** | missing asset file, TTS provider failure | renderer |

All categories except `resource` are deterministic and MUST be raised before any
synthesis or rendering begins. Warnings (non-fatal) MAY be emitted but MUST NOT
change the rendered output.

---

## 14. Determinism and reproducibility

### 14.1 Two layers of guarantee

- **Resolution + mix (deterministic, normative).** Given a fixed set of clip and
  asset durations, two conforming resolvers MUST produce **structurally-equal** IR
  (JSON equality at millisecond precision, §11.1), and two conforming renderers MUST
  produce audio identical within the §13 renderer tolerances. Anchor math, the gain model (§9), and crossfade expansion (§5.3)
  contain no implementation-defined behaviour.
- **Synthesis (provider-dependent).** Speech audio depends on the TTS provider and
  its model version, which an engine does not control and which changes over time.
  The spec therefore makes **no** cross-engine guarantee about synthesised audio.
  Reproducibility holds only relative to a pinned set of providers/models.

A spec-conformant engine MUST NOT claim that a script reproduces identical audio
without also pinning a render manifest (§14.3).

### 14.2 Numeric precision

- All authored durations and timecodes are converted to an integer number of
  **milliseconds** at parse time, rounding half to even.
- All anchor arithmetic is performed in integer milliseconds; the IR expresses times
  in seconds as a decimal with millisecond precision (3 fractional digits).
- Sample-rate alignment of these millisecond boundaries is a renderer concern and
  MUST be applied consistently (round to nearest sample).

### 14.3 Render manifest (lockfile)

To make a render reproducible, a renderer SHOULD emit a **render manifest** sidecar
recording everything outside the script that affected the output:

```jsonc
{
  "podscript": "0.2.0",
  "engine": { "name": "…", "version": "…" },
  "voices": { "sam": { "provider": "elevenlabs", "model": "…", "version": "…", "seed": 42 } },
  "assets": { "intro": { "sha256": "…", "dur_ms": 30000 } },
  "tts_cache": { "c1": { "hash": "…", "dur_ms": 6500 } }
}
```

Speech SHOULD be cached by a content hash of `(text, voice, provider, model,
version, prosody, params)`; a cache hit MUST return byte-identical audio. The effective
prosody (§5.5 — `rate`, `pitch`, `volume`) is part of the key because it changes the
returned audio, and its post-clamp values are recorded per voice in the manifest. Given a
script plus its manifest and cache, a re-render MUST reproduce the prior output.

---

## 15. Extensibility

Podscript is extended through three surfaces, in order of preference. The goal is
that an unsupported feature fails loudly, never silently changes the mix, and never
prevents a conforming parser from parsing the file.

### 15.1 Resource providers (preferred — no grammar change)

TTS engines, asset stores, and DSP **presets** are referenced *by name* and resolved
by engine configuration, not by the grammar (§2.3, §7). Adding a new voice provider,
a custom EQ/compression chain, a new ducking algorithm, or a new asset source is
done here. Because the grammar is untouched, every conforming parser still parses the
script unchanged. Most "you don't support X" needs SHOULD be met this way.

### 15.2 Namespaced syntax extensions

When a genuinely new verb or clause is needed, it MUST be namespaced with a vendor or
`x.` prefix so it cannot collide with current or future core keywords:

```
bed intro elevenlabs:emotion happy
sam [x.binaural:pan -30deg]: Over here on your left.
```

- Core keywords are unprefixed and reserved; implementations MUST NOT add unprefixed
  verbs/clauses.
- A parser MUST tokenise a namespaced construct structurally (verb/clause name plus
  its arguments) and preserve it verbatim in the AST (`ext`/`ExtClause`), so files
  round-trip and pretty-print even through an engine that does not implement the
  extension.
- A namespaced construct carries no core semantics; only an engine implementing that
  namespace assigns meaning.

### 15.3 Capability negotiation

A script that depends on an extension MUST declare it in `requires` (§2.2). This lets
an engine decide *before* rendering whether it can honour the script.

### 15.4 Fail-closed rule (normative)

- Encountering an **unknown core construct** (an unprefixed verb/clause not in this
  spec) is a `syntax` error.
- Encountering a **namespaced construct whose namespace the engine does not
  implement** is a `capability` error — **unless** that namespace is listed in
  `requires` as `optional`, in which case the engine MUST drop the construct and
  SHOULD emit a warning.
- An engine MUST NOT silently ignore any construct that is not declared optional.
  Rationale: a dropped `duck`, `fade`, or pan yields audio that sounds finished but
  is wrong; silent degradation is unacceptable for a mixing format.

```ts
interface ExtClause { kind: "ext"; ns: string; name: string; args: string[]; loc: Span }
```

---

## 16. Security considerations

A script is untrusted input; an engine processes asset paths and ships speaker text
to third parties. Implementations MUST address the following.

- **Path containment.** Asset `PATH`s MUST be resolved within a configured project
  root. An engine MUST reject paths that escape the root (`..`, absolute paths,
  symlinks leading outside) unless explicitly permitted by configuration.
- **Remote assets.** If an engine supports remote (`http(s)://`) assets, it MUST
  treat fetching as a network-egress/SSRF surface: deny by default, allow only via an
  explicit allowlist, enforce size/time limits, and never follow redirects to private
  address ranges.
- **Resource limits.** An engine SHOULD bound total script size, scene/line counts,
  asset count and size, and synthesis volume, to resist denial-of-service via
  pathological input.
- **Privacy.** Synthesis transmits speaker text to the configured TTS provider. An
  engine SHOULD document this and SHOULD support a fully local provider for sensitive
  content. The render manifest (§14.3) records which providers received text.
- **No code execution.** The language is purely declarative and contains no
  expression evaluation, includes, or shell-out. An engine MUST NOT add such
  facilities to the core language; capability extensions (§15) are configuration, not
  arbitrary code embedded in scripts.

---

## 17. Transcript export (accessibility)

A Podscript script is, in effect, a structured transcript. A conforming resolver
SHOULD be able to emit a canonical transcript from the IR without rendering audio:
speaker-labelled, in playback order, with absolute start/end timestamps per speech
clip and optional inclusion of `direction` notes. This makes an accessible transcript
a near-free by-product of production and is RECOMMENDED for any publishing pipeline.

The transcript reflects the **original** spoken text: pronunciation respellings
(§2.5) — both the header lexicon and inline `{say "X" as "Y"}` nodes — are
synthesis-only and MUST NOT appear in the transcript, which renders the written
form (`X`).

---

## 18. File identity and media type

- **Extension:** `.podscript`.
- **Media type (proposed):** `text/vnd.podscript`; charset MUST be UTF-8.
- **Magic / sniffing:** a conforming file begins with a `podscript:` version line
  (§1.2), which MAY be used to identify the format.

---

## 19. Internationalisation

- Spoken `TEXT` MAY contain any Unicode, including right-to-left and bidirectional
  text; an engine MUST preserve it unaltered through to synthesis.
- Synthesis language is selected per voice via the `language` field (BCP 47 tag,
  §2.3); absent that, the provider default applies.
- Numeric literals are locale-independent: the decimal separator is always `.` and
  digit grouping is not permitted (§1.5). This keeps scripts portable across locales.
- Identifiers (`IDENT`) are restricted to ASCII to keep references unambiguous;
  spoken text has no such restriction.

---

## 20. Versioning and governance

- The spec is versioned with **[Semantic Versioning](https://semver.org/)**
  (`MAJOR.MINOR.PATCH`). **The current version is 0.2.0.** A change that alters the
  meaning of an existing valid script, or any golden conformance fixture, is a
  **major** change. Additive, backward-compatible features are **minor** (0.2.0 added
  the prosody model, §5.5, over 0.1). Clarifications are **patch**. Every release is
  recorded in [`CHANGELOG.md`](../CHANGELOG.md).
- Scripts declare the version they target (§1.2); engines refuse versions they do
  not implement.
- Core keyword additions, IR schema changes, and the extension-namespace registry are
  governed through a public process (issues/RFCs in the project repository) with a
  maintained `CHANGELOG`. Vendor namespaces (§15.2) are owned by their vendors and do
  not require core review.

---

## 21. License

This specification text is licensed under **Creative Commons Attribution 4.0
International (CC BY 4.0)** — anyone may implement, quote, and redistribute it with
attribution. The conformance fixtures are provided under the same terms. A reference
implementation, when published, is licensed separately under **Apache-2.0** (which
includes an explicit patent grant); the choice to license code separately is
deliberate and does not affect the freedom to implement this specification.
