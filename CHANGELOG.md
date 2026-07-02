<!--
SPDX-FileCopyrightText: 2026 Mikkel Bergmann
SPDX-License-Identifier: CC-BY-4.0
-->

# Changelog

All notable changes to the Podscript specification are recorded here. The spec follows
[Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`, SPEC §20): a change that
alters the meaning of an existing valid script or any golden conformance fixture is
**major**; additive, backward-compatible features are **minor**; clarifications are
**patch**. Scripts declare the lowest version whose features they use (§1.2).

## 0.2.0 — 2026-07-03

### Added
- **Prosody model (SPEC §5.5).** A `prosody` control for speaking delivery — the continuous
  attributes `rate` (tempo multiplier), `pitch` (semitone shift), and `volume` (vocal-intensity
  multiplier) — as a per-voice baseline object (§2.3) and a per-line `cue` clause (§5), merged
  **per attribute** onto the IR clip (§11.1) and omitted at natural defaults. The section maps
  the remaining prosodic dimensions onto existing constructs (`*emphasis*`, breaks, sentence
  punctuation, `(direction)`).
- New `SEMITONES` token (§1.5); AST `Voice.prosody`, `Prosody` interface, and `prosody` clause
  variant (§10); IR-clip `prosody` (§11).
- Prosody is **advisory** synthesis guidance — a deliberate exception to fail-closed (§15.4):
  core vocabulary, but engines drop attributes they cannot honour, degrading expressiveness not
  mix correctness. It joins the synthesis cache key (§14.3) and does **not** affect
  timing/resolution.
- Conformance fixtures `conformance/parse/prosody` and `conformance/resolve/prosody`; runnable
  example `examples/prosody.podscript`.

### Changed
- Adopted three-part semantic-version stamps (`MAJOR.MINOR.PATCH`; `PATCH` optional, defaults
  to `0`, §1.2). Normalized every bundled example and conformance-fixture stamp from `0.1` to
  `0.2.0` so the repository uses one consistent current version — a one-time pre-1.0 housekeeping
  step. Two-part `0.1` stamps remain valid input (`0.1` ≡ `0.1.0`).

### Compatibility
- The prosody feature is additive and backward-compatible at the language level: `prosody` is
  omitted when absent, and a `0.1` script parses unchanged under a 0.2.0 engine. The version
  *stamps* in the bundled examples and golden fixtures were re-stamped to `0.2.0` as part of the
  semver normalization above — a housekeeping change to the stamp only, not a semantic change to
  any script's meaning.

## 0.1.0 — 2026-06-24

### Added
- Initial public draft: lexical grammar; `meta` / `voices` / `assets` / `pronounce` headers;
  speech lines with typed inline content (emphasis, breaks, pronunciation); clauses (anchors,
  `gain`, `fade`, `crossfade`, `duck-under`, `at`, loop); the relational timing model and speech
  spine; the resolved IR schema; the gain model; determinism and the render manifest;
  extensibility (namespaced extensions, fail-closed); security; and transcript export.
