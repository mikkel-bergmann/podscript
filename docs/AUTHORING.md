<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Authoring Podscript — a cheatsheet for LLMs (and humans)

This is a compact, self-contained guide to writing a valid `.podscript` file. It is
intended to be pasted into a model's context. It is **informative**; the normative source
is [`SPEC.md`](SPEC.md). When something here is unclear or unstated, follow `SPEC.md`.

**Golden rule:** the output must *parse*. The first non-blank, non-comment line is always the
version stamp — `podscript: "0.2.0"` (the current version). Every speaker must be declared in
`voices:`; every asset referenced by
`bed`/`sfx` must be declared in `assets:`. Levels are in dB; times carry a unit (`s`/`ms`).

## Minimal example

<!-- example: examples/minimal.podscript -->
```podscript
podscript: "0.2.0"

voices:
  host:  { voice: Adam,   preset: host }
  guest: { voice: Rachel, preset: warm-host }

assets:
  theme: music/theme.mp3 once

scene open:
  bed theme gain -4db duck-under speech to -15db fade-out over 3s at 12s
  host: Welcome back to the show — I'm here with our guest.
  guest (warm): Thanks for having me.
  host: Let's get into it.
```

Music starts at −4 dB, automatically dips to −15 dB whenever someone speaks, and fades out
over 3 s starting at 12 s. The three lines of dialogue play in order with a small gap
between them.

## File skeleton

A file is a version line, then optional header blocks **in any order**, then one or more
`scene` blocks. Indent block bodies by 2 spaces.

```podscript
podscript: "0.2.0"

# Comments are whole-line only — a line whose first character is '#'. (A '#' after
# text is a label, not a comment; see Speech lines.) Blank lines are ignored.

meta:
  title: "Episode title"
  description: "One-line summary"
  lufs: -16
  true_peak: -1

voices:
  sam:  { voice: Adam, preset: host }
  alex: { voice: Rachel, style: "warm", language: "en-US" }

assets:
  intro: music/intro.mp3 once
  bedmusic: music/bed.mp3 loop
  whoosh: sfx/whoosh.wav

pronounce:
  Seibold: "SY-bold"
  "Dee Why": "Dee Why"

scene intro:
  sam: Every scene has at least one line.
```

Block-by-block:

- `meta:` (optional) — `title`, `description`, `lufs` (loudness target, default −16),
  `true_peak` (dBTP ceiling, default −1).
- `voices:` (required if there's dialogue) — `speaker-id: { fields }`. Fields: `voice`
  (required), `provider`, `preset`, `style`, `language`, `prosody`. The speaker-id is what
  you use on dialogue lines. `prosody: { rate, pitch, volume }` sets the speaker's baseline
  delivery (e.g. `prosody: { rate: 1.1, pitch: -1st }`); see *Prosody* below.
- `assets:` (required if any `bed`/`sfx` is used) — `id: path [loop|once]` (default `once`).
- `pronounce:` (optional) — `term: "respelling"`; quote keys that contain spaces or
  punctuation (e.g. `"Dee Why"`).
- `scene <name>:` — one or more; a scene is just a grouping label (it does not reset time).

## Speech lines

```
speaker [cue] (direction): spoken text #label
```

Only `speaker:` and the text are required. Examples:

```podscript
sam: Plain line of dialogue.
sam (skeptical): A delivery note in parentheses — a free-text hint for the voice.
sam [with intro.fade-out]: A timing cue in square brackets (see clauses below).
sam [after alex] (warm): Both: start after Alex's last line, read warmly.
sam: A line I can refer to later. #thesis
```

- `(direction)` is a **freeform** delivery hint (`skeptical`, `warm`, `urgent`). Any words
  are valid; engines map what they can and ignore the rest. Not timing.
- `[cue]` carries timing/engineering clauses — the same clauses as directives (below).
- `#label` makes the line referenceable by anchors (`after thesis`, `at thesis.end`).

**Inline content** inside spoken text:

```podscript
sam: I'm *really* excited... {break 750ms} but it's complicated.
sam: We found {say "lead" as "led"} in the pipes near Dee Why.
```

- `*word*` — emphasis · `...` — a short pause · `{break 500ms}` — an exact pause.
- `{say "written" as "spoken"}` — pronounce this one occurrence as "spoken"; the transcript
  keeps "written". Overrides the `pronounce:` header for that spot.
- Escape `#`, `*`, `[`, `]`, `{`, `}`, `\` with a backslash to use them literally.

## Directives and clauses

Background audio and effects are directives: `bed` (a sustained layer; aliases `music`,
`ambience`, `atmos`), `sfx` (a one-shot; alias `sting`), and `pause` (silence on the
speech timeline).

```podscript
bed intro gain -3db fade-out over 4s at 8s
bed bedmusic gain -8db duck-under speech to -18db
sfx whoosh after alex
sfx sting with intro.fade-out
pause 700ms
```

Clauses (each at most once per directive/cue, order-independent):

| Clause | Form | Meaning |
|---|---|---|
| Gain | `gain -6db` | Static base level in dB (`0db` = unchanged). |
| Fade in | `fade-in over 2s [at <time/anchor>]` | Ramp up over a duration. |
| Fade out | `fade-out over 4s [at <time/anchor>]` | Ramp down to silence; this also ends a bed. |
| Crossfade | `crossfade 2s` | Segue: previous bed fades out while this one fades in. |
| Duck | `duck-under speech [to -18db] [attack 60ms] [release 350ms]` | Auto-dip under another track while it sounds. |
| At | `at 8s` / `at 0:23` / `at signoff.end+3s` | Place at an absolute time or an anchor. |
| Loop | `loop` / `once` | Override the asset's default repeat behaviour. |
| Anchor | `after <ref>` / `with <ref>` / `before <ref>` | Relative placement (see below). |
| Prosody | `prosody rate 1.15 pitch +2st volume 1.1` | Speech-only: delivery for this line — any of `rate`/`pitch`/`volume` (`1.0`/`+0st` = natural). |

Units are required: levels end in `db`, durations in `s` or `ms`, timecodes are `8s`,
`500ms`, or `M:SS(.ms)` like `0:23`.

## How timing works

You never type a timestamp for dialogue. Speech **auto-sequences**: each line starts a
short gap (default 250 ms) after the previous one, continuously — scene boundaries are
just labels and do **not** reset time. You only place things relationally:

- **Anchors** start something against another element:
  - `after sam` — after Sam's most recent line · `after thesis` — after the `#thesis` line.
  - `with intro.fade-out` — at the moment that event happens on the `#intro`-labelled bed.
  - `before signoff` — positioned to end right as `#signoff` starts. Optional offset:
    `after thesis +0.5s`, `at signoff.end+3s`.
- **Events** you can anchor to on a labelled element: `.start`, `.end`, `.fade-in`,
  `.fade-out`.
- **Speaker refs** (`after sam`) look backward to the nearest matching line; **label refs**
  (`after thesis`) are global and may point forward.
- A **bed** with no anchor starts at the current playhead and plays until it's faded out,
  replaced by the next bed, or its file ends; beds span scenes.

## Prosody

**Prosody** is *how* a line is spoken — the delivery on top of the words. Every prosody
control is a hint to the voice engine and never touches timing: the mix is unchanged, only
the speech audio differs. Podscript covers the full range of prosody with a mix of the
`prosody` control and a few constructs you've already seen:

| Prosodic dimension | Write it as |
|---|---|
| **Rate** (tempo) | `prosody rate 1.15` — multiplier, `1.0` = natural |
| **Pitch** (baseline) | `prosody pitch +2st` / `-1st` — semitone shift |
| **Volume** (vocal effort) | `prosody volume 1.2` — multiplier; *not* the mix level (`gain`) |
| **Emphasis** (stress on a word) | `*word*` inside the text |
| **Pauses** (rhythm) | `...` (a beat) or `{break 500ms}` (exact) |
| **Question vs statement** (intonation) | sentence punctuation — `?` `.` `!` |
| **Emotion / attitude** | `(direction)` — e.g. `(excited)`, `(somber)` |

The three continuous knobs (`rate`, `pitch`, `volume`) travel together in one `prosody`
control. Set a **baseline** on the voice for a character's habitual delivery, and
**override any attribute per line** (unset attributes keep the baseline):

```podscript
voices:
  sam: { voice: Adam, preset: host, prosody: { rate: 1.1, pitch: -1st } }  # Sam: brisk, low

scene chat:
  sam: Normal delivery for the setup.
  sam [prosody rate 1.35 pitch +3st volume 1.2]: Wait — it actually *worked*!   # this line pops
  sam [prosody rate 0.9]: ...which, if you think about it, changes everything.   # keeps pitch -1st
```

`(direction)` is a free-text emotional note; any words work and the engine maps what it can.
A small, consistent vocabulary keeps LLM-authored scripts predictable: `excited`, `measured`,
`urgent`, `warm`, `deadpan`, `skeptical`, `somber`.

**Within a sentence, some parts different from others?** There is no per-word prosody — real
voice engines don't expose one. Author it by **splitting the thought into consecutive cues**,
each with its own prosody; the speech spine chains them tightly:

```podscript
sam (measured): So here's the thing.
sam [prosody rate 1.3 pitch +2st] (excited): It actually worked, first try, no changes!
```

**Portability note:** engines honour what they can and drop the rest — `rate` works almost
everywhere; `pitch`/`volume` vary. On engines that don't take fine markup (e.g. ElevenLabs,
which reads punctuation and bracketed audio tags rather than SSML), emphasis, pauses, and
punctuation still land, because they map onto cues the engine already understands.

Putting it together — the repo's [`examples/prosody.podscript`](../examples/prosody.podscript):

<!-- example: examples/prosody.podscript -->
```podscript
podscript: "0.2.0"

# prosody.podscript — controlling delivery
#
# Prosody is *how* a line is spoken. Sam has a brisk, slightly low baseline;
# individual lines override rate / pitch / volume. Within-sentence variation is
# authored as consecutive cues, each with its own prosody.

voices:
  sam:  { voice: Adam,   preset: host, prosody: { rate: 1.1, pitch: -1st } }
  alex: { voice: Rachel, preset: warm-host }

scene demo:
  sam: Normal delivery for the setup — this uses Sam's baseline.
  sam [prosody rate 1.35 pitch +3st volume 1.2] (excited): Wait — it actually *worked*!
  sam [prosody rate 0.9]: ...which, if you think about it, changes everything.
  alex (skeptical): Does it, though?
```

## Hard rules (break these and the file won't compile)

1. A version stamp is the first line — `podscript: "0.2.0"` (the current version).
2. Every speaker appears in `voices:`; every `bed`/`sfx` asset appears in `assets:`.
3. Levels carry `db`; durations carry `s`/`ms`; timecodes carry a unit. No bare numbers.
4. Identifiers (speaker/asset/label names) are ASCII: `[A-Za-z_][A-Za-z0-9_-]*`.
5. Put delivery notes in `(parens)` and timing in `[brackets]` — don't swap them.
6. Anchors must not form a cycle (A waits for B waits for A).
7. Unknown verbs/clauses are an error — the engine never silently drops audio. Don't invent
   syntax; use only the clauses above (vendor extensions must be namespaced, e.g.
   `elevenlabs:emotion`, and declared in a `requires:` block).

## Common mistakes to avoid

- Starting with `meta:` instead of the `podscript:` version line.
- Using a speaker or asset that wasn't declared.
- `gain -6` or `gain 0.5` → must be `gain -6db`. `fade-out over 4` → `over 4s`. `at 8` → `at 8s`.
- Writing `fade-out` with no `over <dur>`.
- Putting a direction in brackets (`sam [skeptical]:`) — use `sam (skeptical):`.
- Anchoring to a speaker event (`with sam.end`) — speakers have no events; label the line
  (`#x`) and use `with x.end`, or just `with sam` for the nearest line.
- A `loop` bed that never fades out or ends — it will loop forever.
- Trailing `# comments` don't exist — a `#` after text is a **label**, and comments are
  whole-line only. A literal `#` inside speech must be escaped: `\#`.

## A fuller example

This is the repo's canonical [`examples/cold_open.podscript`](../examples/cold_open.podscript) verbatim:

<!-- example: examples/cold_open.podscript -->
```podscript
podscript: "0.2.0"

# cold_open.podscript — canonical example
#
# Intro music plays at -3 dB, fades out over 4s starting at 8s, and Sam's
# narration begins exactly as the fade starts (overlapping the fading tail).

meta:
  title: "Episode 12 — The Thing"
  lufs: -16
  true_peak: -1

voices:
  sam:  { voice: Adam,   preset: host }
  alex: { voice: Rachel, preset: warm-host }

assets:
  intro:  music/intro_theme.mp3  once
  outro:  music/outro_theme.mp3  once
  whoosh: sfx/whoosh_01.wav

scene cold_open:
  bed intro gain -3db fade-out over 4s at 8s        #music
  sam [with intro.fade-out]: Hey everyone — welcome to the show. Today we're *digging in*...
  alex: ...and it's a strange one.
  sfx whoosh after alex

scene main:
  bed intro gain -8db fade-in over 1s duck-under speech to -18db
  sam: So here's where it gets interesting.
  alex (skeptical): Does it, though?

scene outro:
  # outro music segues in over the intro bed and plays out under the sign-off
  bed outro gain -6db crossfade 2s fade-out over 3s at signoff.end
  sam: That's all for this week — thanks for listening.   #signoff
```

For everything not covered here — the full grammar, the gain/duck model, the IR, and
conformance — see [`SPEC.md`](SPEC.md). Audio terms (bed, duck, sting, LUFS…) are defined in
[`GLOSSARY.md`](GLOSSARY.md).
