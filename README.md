<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Podscript

A declarative language for producing podcasts from a single script.

Write one human-readable file that describes **what is said**, **how it's said**,
and **how it all mixes together** — speech, music beds, sound effects, fades, and
ducking — and compile it into a finished audio file. Deterministically, the same
way every time.

```
podscript: "0.1"

voices:
  sam: { voice: Adam, preset: host }

assets:
  intro: music/intro_theme.mp3

scene cold_open:
  bed intro gain -3db fade-out over 4s at 8s
  sam [with intro.fade-out]: Hey everyone — welcome to the show. Today we're digging into...
```

That compiles to: intro music at −3 dB, fading out over 4 seconds starting at 8s,
with Sam's narration beginning exactly as the fade starts and continuing over the
fading tail.

## Why a language instead of a tool

Today a podcast is assembled across three disconnected stages — scripting in an
LLM, voices in a TTS engine, mixing in a DAW. Podscript collapses all three into
one source-controllable file.

A deliberate line is drawn between two worlds:

- **Generation** (non-deterministic): an LLM or a human *writes* the script.
- **Rendering** (deterministic): Podscript *compiles* a script to identical audio,
  every run.

The language owns only the second world. It contains no behavioral logic
("interrupt host B if host A talks >30s") — that belongs to whoever authors the
script. This is what keeps output reproducible, diff-able, and debuggable.

## The core idea: timing is solved, not typed

You never write timestamps for fades, sound effects, or ducking. You can't — the
length of a spoken line isn't known until the voice is synthesized. So instead you
describe timing **relationally** ("start as the fade begins", "after Sam", "under
the speech") and the compiler resolves it to absolute time.

This forces a two-pass compiler:

```
PASS 1 — durations
  parse → AST
  synthesize all speech via TTS (cached by content hash) → real durations
  probe asset durations

PASS 2 — resolve + mix
  topologically sort anchor dependencies (cycles → clear compile error)
  resolve every start/end to absolute seconds
  build the multitrack mix graph (the IR)
  render → master audio
```

The **IR** (intermediate representation) — a resolved, absolute-time JSON document —
is the stable contract between the front-end language and the renderer. Everything
downstream consumes the IR; the syntax can evolve without touching the mix engine.

## Architecture

```
 .pod script
     │  parse (tokeniser + grammar)
     ▼
   AST  ──────────────  purely syntactic, no resolution yet
     │  bind (name resolution: assets, speakers, anchors)
     ▼
 bound AST
     │  pass 1: TTS (cached) + asset probe → durations
     │  pass 2: topo-sort → resolve anchors → absolute time
     ▼
    IR  ──────────────  resolved, absolute-time, JSON. the freeze line.
     │  render
     ▼
  master.wav  (per-voice DSP → mix → duck/fade automation → loudness normalise)
```

Planned implementation stack:

- **Parser** — small PEG/Lark grammar (or a hand-rolled line parser).
- **TTS** — provider-pluggable, cached by hash of `(text, voice, params)`.
- **Per-voice DSP** — [Pedalboard](https://github.com/spotify/pedalboard) presets
  (EQ, compression, de-ess, "radio voice").
- **Mix / fades / ducking / loudness** — ffmpeg filtergraph (`loudnorm` to −16 LUFS;
  optional `sidechaincompress` for signal-driven ducking).

## Audio jargon glossary

Podscript borrows established sound-production terms. If you're not steeped in
audio production, here's what they mean in plain language and how they map to the
language. You never *have* to use the jargon — most terms have a plainer alias.

### Layout terms — the building blocks of a script

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **Bed** | A continuous background layer (music or ambience) that voices sit on top of. | `bed` (alias `music`) |
| **Ambience / atmos / room tone** | The quiet background "sound of a space" (café, rain, room hum) under a scene. | `bed` (alias `ambience` / `atmos`) |
| **SFX** | A one-shot sound effect that fires at a single moment (a whoosh, a click). | `sfx` |
| **Stinger / sting** | A very short musical accent used as punctuation between segments. | `sfx` (alias `sting`) |
| **Bumper** | A brief music/voice clip that bridges segments or ad breaks ("back in a sec…"). | a short `bed` between scenes |
| **Drop** | A pre-made clip (a catchphrase, a listener voicemail) dropped in on cue. | `sfx` |
| **Cold open** | Content that plays *before* the intro/titles. | a `scene` (convention) |
| **VO (voiceover)** | Narration not tied to an on-scene character. | a speaker in `voices` |

### Mixing terms — how the layers combine

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **Ducking** | Automatically lowering one layer (music) while another (speech) plays, so the voice stays clear. | `duck-under` |
| **Fade in / out** | Gradually raising from / lowering to silence over a span of time. | `fade-in` / `fade-out … over <dur>` |
| **Crossfade / segue** | One bed fading out *while* the next fades in, overlapping — a smooth handover. | `crossfade <dur>` |
| **Pot up / pot down / fade under** | Old radio terms for raising/lowering a level (e.g. "pot the music down under the VO"). | `gain` automation |
| **Sweetening** | Adding music/SFX/polish to a raw recording. | what the whole mix stage does |
| **Headroom** | The safety margin in dB left below digital clipping (0 dBFS). | renderer concern |

### Loudness terms — final delivery

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **LUFS** | The standard loudness measure for delivery. Podcasts target **−16 LUFS**. | `meta: lufs` |
| **True peak (dBTP)** | Peak level accounting for playback overshoot; kept below ~−1 to avoid distortion. | `meta: true_peak` |
| **Normalize** | Adjust a program to a target level (we use *loudness* normalization, to LUFS). | final render pass |
| **dBFS vs dB** | dBFS is absolute (0 = digital max); plain dB in `gain` clauses is relative attenuation. | `gain -6db` = 6 dB down |

### Voice / cleanup terms — handled by DSP presets

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **Plosive / pop** | The thump from "p"/"b" sounds. | tamed inside a `preset` |
| **Sibilance / de-essing** | Harsh "s" sounds, and the processing that softens them. | tamed inside a `preset` |
| **Wet / dry** | "Dry" = no effects; "wet" = with effects (reverb, EQ). | configured in a `preset` |
| **Radio voice** | The warm, compressed, EQ'd broadcast vocal tone. | a named `preset` |

## Status

**v0.1 — first public draft.** The grammar and IR are stable; the normative
conformance, determinism, extensibility, and security sections are open for
implementer feedback before v1.0. See [`docs/SPEC.md`](docs/SPEC.md) for the full
specification and [`examples/`](examples/) for sample scripts.

What the spec pins down for implementers:

- **Conformance classes** — *parser*, *resolver*, *renderer* — with the IR as the
  exact, audio-free conformance anchor (SPEC §13). A `conformance/` fixture suite
  (`script → AST`, `script + durations → IR`) makes the spec testable by anyone.
- **Honest determinism** (SPEC §14) — the resolution/mix layer is reproducible
  across engines; speech *synthesis* is provider-dependent and reproducible only when
  pinned via a **render manifest** (lockfile of engine/model versions + asset hashes).
- **Extensibility** (SPEC §15) — three surfaces: resource providers (no grammar
  change, preferred), namespaced syntax extensions (`vendor:verb`), and a `requires`
  capability block. The rule is **fail-closed**: an engine never silently drops a
  construct it doesn't understand, because a dropped duck/fade is a wrong-but-
  successful mix.
- **Security** (SPEC §16) — path containment, remote-asset/SSRF controls, resource
  limits, and a declarative no-code-execution guarantee.
- **Accessibility** (SPEC §17) — a canonical transcript falls out of the IR for free.

Next: build the vertical slice — parser + resolver + IR emitter against a stubbed
(offline) TTS, then a real provider behind the same interface — and seed the
`conformance/` suite from it.

## File format

Podscript scripts use the **`.podscript`** extension and the proposed media type
`text/vnd.podscript` (charset UTF-8). Every script begins with a `podscript:`
version line.

## License

The specification text and conformance fixtures are licensed **CC BY 4.0** — anyone
may implement, quote, and redistribute with attribution. A reference implementation,
when published, will be licensed separately under **Apache-2.0**.
