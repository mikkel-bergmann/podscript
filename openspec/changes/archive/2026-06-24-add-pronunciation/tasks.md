## 1. SPEC grammar + types (`docs/SPEC.md`)

- [ ] 1.1 Add `pronounce_decl` to the §2 header grammar and a new **§2.5 Pronunciation** (grammar,
      application semantics, core-not-namespaced note).
- [ ] 1.2 Add the `{say "X" as "Y"}` inline syntax to §3.1 with its override semantics.
- [ ] 1.3 Add `pronounce?: Record<string,string>` to the `Script` interface (§10) and the
      `{ kind: "pronounce"; value; say }` variant to the `Inline` union.
- [ ] 1.4 Add `pronounce` to the IR root example (§11) and a §11.1 passthrough convention
      (copied when present; content keeps original spelling).
- [ ] 1.5 Add the §17 note that transcripts render the original (written) form.

## 2. Conformance fixtures

- [ ] 2.1 `conformance/parse/pronounce/{input.podscript, expected.ast.json}` — header lexicon
      (incl. a quoted multi-word key) + an inline `{say … as …}` node.
- [ ] 2.2 `conformance/resolve/pronounce/{input.podscript, durations.json, expected.ir.json}` —
      `pronounce` at the IR root; content (incl. the inline node) preserved verbatim.
- [ ] 2.3 Update `conformance/README.md` coverage table with the two new cases.

## 3. Validation

- [ ] 3.1 Confirm existing parse/resolve fixtures still pass (pronounce omitted when absent).
- [ ] 3.2 Confirm a reference consumer (the `podscript-app` parser/resolver/transcript) reproduces
      the new fixtures exactly and that transcripts show original spelling.
