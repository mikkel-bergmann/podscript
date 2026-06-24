<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Audio jargon glossary

Podscript borrows established sound-production terms. If you're not steeped in audio
production, here's what they mean in plain language and how they map to the language. You
never *have* to use the jargon — most terms have a plainer alias. The normative
definitions live in [`SPEC.md`](SPEC.md); this is an informative reference.

## Layout terms — the building blocks of a script

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

## Mixing terms — how the layers combine

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **Ducking** | Automatically lowering one layer (music) while another (speech) plays, so the voice stays clear. | `duck-under` |
| **Fade in / out** | Gradually raising from / lowering to silence over a span of time. | `fade-in` / `fade-out … over <dur>` |
| **Crossfade / segue** | One bed fading out *while* the next fades in, overlapping — a smooth handover. | `crossfade <dur>` |
| **Pot up / pot down / fade under** | Old radio terms for raising/lowering a level (e.g. "pot the music down under the VO"). | `gain` automation |
| **Sweetening** | Adding music/SFX/polish to a raw recording. | what the whole mix stage does |
| **Headroom** | The safety margin in dB left below digital clipping (0 dBFS). | renderer concern |

## Loudness terms — final delivery

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **LUFS** | The standard loudness measure for delivery. Podcasts target **−16 LUFS**. | `meta: lufs` |
| **True peak (dBTP)** | Peak level accounting for playback overshoot; kept below ~−1 to avoid distortion. | `meta: true_peak` |
| **Normalize** | Adjust a program to a target level (we use *loudness* normalization, to LUFS). | final render pass |
| **dBFS vs dB** | dBFS is absolute (0 = digital max); plain dB in `gain` clauses is relative attenuation. | `gain -6db` = 6 dB down |

## Voice / cleanup terms — handled by DSP presets

| Production term | Plain meaning | In the DSL |
|---|---|---|
| **Plosive / pop** | The thump from "p"/"b" sounds. | tamed inside a `preset` |
| **Sibilance / de-essing** | Harsh "s" sounds, and the processing that softens them. | tamed inside a `preset` |
| **Wet / dry** | "Dry" = no effects; "wet" = with effects (reverb, EQ). | configured in a `preset` |
| **Radio voice** | The warm, compressed, EQ'd broadcast vocal tone. | a named `preset` |
