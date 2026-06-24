# Licensing

This repository contains **the specification, its conformance fixtures, and examples** —
not an implementation. Everything here is licensed under the **Creative Commons
Attribution 4.0 International License (CC BY 4.0)**.

- SPDX-License-Identifier: `CC-BY-4.0`
- Full text: [`LICENSES/CC-BY-4.0.txt`](LICENSES/CC-BY-4.0.txt) ·
  https://creativecommons.org/licenses/by/4.0/legalcode

You are free to implement, quote, adapt, and redistribute the specification and
fixtures, including for commercial purposes, provided you give appropriate attribution.

## Reference implementations

Implementations (parser / resolver / renderer) are published in **separate
repositories** under the **Apache License 2.0**, which adds an explicit patent grant for
implementers. Code is licensed apart from the specification deliberately: the Apache-2.0
terms on any implementation do not restrict anyone's freedom to implement the CC BY 4.0
specification independently. (If implementation code is ever added to *this* repository,
its Apache-2.0 license text will be added under `LICENSES/` at that time.)

## Per-file licensing

This repository follows the [REUSE](https://reuse.software) convention, so every file's
license is explicit and machine-readable: prose docs carry an inline
`SPDX-License-Identifier` header, and structured files (conformance fixtures, examples,
metadata) are covered by [`REUSE.toml`](REUSE.toml). Run `reuse lint` to verify.

The **"Podscript" name** is covered by a separate naming policy:
[`TRADEMARK.md`](TRADEMARK.md).
