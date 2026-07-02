<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Podscript

[![REUSE status](https://api.reuse.software/badge/github.com/mikkel-bergmann/podscript)](https://api.reuse.software/info/github.com/mikkel-bergmann/podscript)

A declarative, plain-text language for producing podcasts from a single script — speech,
music beds, sound effects, fades, and ducking — that compiles deterministically to a
finished audio file.

```podscript
podscript: "0.2.0"

voices:
  sam: { voice: Adam, preset: host }

assets:
  intro: music/intro_theme.mp3

scene cold_open:
  bed intro gain -3db fade-out over 4s at 8s
  sam [with intro.fade-out]: Hey everyone — welcome to the show. Today we're digging into...
```

That renders intro music at −3 dB, fading out over four seconds starting at 8s, with
Sam's narration beginning exactly as the fade starts and continuing over the tail.

> **This repository is the specification**, its conformance suite, and examples — not an
> implementation. The normative document is [`docs/SPEC.md`](docs/SPEC.md).

## Writing Podscript with an LLM

Podscript is built for this: a model (or a person) *writes* the script, and the renderer
turns it into identical audio every time. To have an LLM author scripts, give it the
**[authoring cheatsheet](docs/AUTHORING.md)** — a single, self-contained guide to the whole
syntax — then describe your episode in plain prose:

> *Paste [`docs/AUTHORING.md`](docs/AUTHORING.md) into your model (or point your agent /
> editor at it), then ask: "Write a 2-minute news-recap cold open for hosts Sam and Alex,
> with an intro music bed that ducks under the voices and fades out."*

The cheatsheet is dense enough to fit in context and complete enough to produce valid
files. [`llms.txt`](llms.txt) is a machine-readable index of the repo's docs for AI tools.

## Why a language

A produced podcast is normally assembled across three disconnected stages — scripting,
text-to-speech, and mixing in a DAW. Podscript collapses them into one human-readable,
version-controllable file, and draws a hard line through the middle:

- **Generation** is non-deterministic — an LLM or a person *writes* the script.
- **Rendering** is deterministic — Podscript *compiles* that script to identical audio on
  every run.

The language owns only the second half. It carries no behavioural logic; it describes a
fixed production, which keeps the output reproducible, diff-able, and debuggable.

## Timing is relational

You never write timestamps for fades, effects, or ducking — you can't, because a spoken
line's length isn't known until it's synthesized. Instead you describe timing by
relationship ("start as the fade begins", "after Sam", "under the speech"), and the
compiler resolves it to absolute time, producing an **intermediate representation (IR)**:
a resolved, absolute-time JSON document that is the stable contract between the language
and any renderer. Source → IR → audio.

## The specification

[`docs/SPEC.md`](docs/SPEC.md) is the normative v0.2.0 specification: lexical grammar,
speakers and voices, cues and directions, the gain / duck / fade model, the relational
timing model, the IR schema, determinism, extensibility, security, and transcript export.
This README is informative; where they differ, the spec wins. Domain terms (bed, duck,
sting, LUFS, …) are defined in [`docs/GLOSSARY.md`](docs/GLOSSARY.md).

## Conformance

An implementation may conform at one or more classes — **parser**, **resolver**, or
**renderer** — and the [`conformance/`](conformance/) suite is the oracle:

- `conformance/parse/*` — `script → canonical AST`
- `conformance/resolve/*` — `script + supplied durations → canonical IR`

Because durations are supplied as input, the resolver tier is fully deterministic and
testable without any audio or TTS. Determinism is honest about its boundary (SPEC §14):
resolution and mixing are reproducible across engines, while speech *synthesis* is
provider-dependent and reproducible only when pinned via a render manifest.

## Examples

[`examples/`](examples/) holds runnable sample scripts, including
[`cold_open.podscript`](examples/cold_open.podscript) and
[`prosody.podscript`](examples/prosody.podscript) (controlling delivery — rate, pitch,
volume, emphasis).

## Implementations

No reference implementation ships in this repository. The specification plus the
conformance suite are enough to build one independently, and "Podscript-compatible" tools
are encouraged — see [`TRADEMARK.md`](TRADEMARK.md) for use of the name.

## File format

Scripts use the **`.podscript`** extension and the proposed media type
`text/vnd.podscript` (UTF-8). Every script begins with a `podscript:` version line.

## Contributing

Design discussion happens in GitHub issues. Substantive changes are drafted as OpenSpec
changes under [`openspec/`](openspec/) before landing in the spec. A change that alters
any golden fixture in `conformance/` is a breaking change.

## License

The specification text and conformance fixtures are **CC BY 4.0** — implement, quote, and
redistribute freely with attribution. Reference implementations are published separately
under Apache-2.0. See [`LICENSE.md`](LICENSE.md).
