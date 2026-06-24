#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 Mikkel Bergmann
# SPDX-License-Identifier: CC-BY-4.0
"""Guard the docs against example drift — parser-free, stdlib only.

Every fenced ```podscript block in README.md / docs/*.md that is tagged with an
`<!-- example: <path> -->` marker MUST be byte-identical to that committed example
file (trailing newline ignored). This keeps the documentation's canonical scripts
single-sourced from real files under examples/, so prose can never silently drift
from a tracked, parseable script. Validity of the example files themselves is the
reference implementation's job; this only enforces consistency.

Usage: python3 .github/scripts/check_doc_examples.py
Exit code 1 if any tagged block is missing its file or doesn't match it.
"""
import glob
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MARKED = re.compile(
    r"<!--\s*example:\s*(?P<path>\S+)\s*-->\s*\n+```podscript\n(?P<body>.*?)\n```",
    re.S,
)

docs = ["README.md"] + sorted(
    str(pathlib.Path(p).relative_to(ROOT)) for p in glob.glob(str(ROOT / "docs/*.md"))
)

checked, problems = 0, []
for doc in docs:
    path = ROOT / doc
    if not path.exists():
        continue
    for m in MARKED.finditer(path.read_text(encoding="utf-8")):
        checked += 1
        target = ROOT / m.group("path")
        if not target.exists():
            problems.append(f"{doc}: marker points at missing file {m.group('path')}")
            continue
        want = target.read_text(encoding="utf-8").rstrip("\n")
        got = m.group("body").rstrip("\n")
        if want != got:
            problems.append(
                f"{doc}: tagged ```podscript block is out of sync with {m.group('path')}"
            )

for p in problems:
    print("DRIFT:", p)
print(f"checked {checked} tagged example block(s); {len(problems)} problem(s)")
if checked == 0:
    print("note: no tagged example blocks found (add `<!-- example: path -->` markers)")
sys.exit(1 if problems else 0)
