## ADDED Requirements

### Requirement: Pronunciation header lexicon

A script SHALL be able to declare a `pronounce:` header block (a sibling of `meta:`/`voices:`/
`assets:`, at most once) mapping a written term to a sound-alike respelling; keys MAY be quoted to
contain spaces or punctuation. The block SHALL parse into the AST field `Script.pronounce` (a
string-to-string map) and SHALL be omitted entirely when absent (never an empty object emitted into
existing fixtures).

#### Scenario: Header lexicon parses into the AST
- **WHEN** a script contains `pronounce:` with `Seibold: "SY-bold"` and `"Dee Why": "Dee Why"`
- **THEN** the AST's `pronounce` is `{ "Seibold": "SY-bold", "Dee Why": "Dee Why" }`

#### Scenario: Absent block omits the field
- **WHEN** a script declares no `pronounce:` block
- **THEN** the AST has no `pronounce` key

### Requirement: Inline pronunciation node

Spoken text SHALL be able to contain an inline `{say "written" as "spoken"}` node (§3.1), which a
conforming parser SHALL parse into an `Inline` variant of kind `pronounce` carrying the written
`value` and the spoken `say` string. It SHALL override the header lexicon for that occurrence, and
both arguments are quoted strings.

#### Scenario: Inline node parses into a content node
- **WHEN** a speech line contains `{say "lead" as "led"}`
- **THEN** that content node is `{ "kind": "pronounce", "value": "lead", "say": "led" }`

### Requirement: Respelling applies to synthesis text only

A conforming engine SHALL, before sending a clip's text to its provider, replace occurrences of each
lexicon term in `text`/`emphasis` nodes with its respelling, and SHALL speak an inline pronunciation
node's `say` text. Matching SHALL be whole-word, case-insensitive, in a single left-to-right pass
preferring the longest matching term, with replacement output never re-scanned (no cascades). The
inline node SHALL take precedence over the header map for its occurrence. Resolution and timing SHALL
be unaffected.

#### Scenario: Header term is respelled at word boundaries only
- **WHEN** the lexicon maps `Seibold → "SY-bold"` and the text contains `Seibold` and `seibolds`
- **THEN** the synthesized text contains `SY-bold` for the standalone word and leaves `seibolds`
  unchanged

#### Scenario: Inline node overrides the header map
- **WHEN** the lexicon maps `lead → "LEED"` and the text contains `{say "lead" as "led"}`
- **THEN** the synthesized text speaks `led` for that occurrence

### Requirement: Original spelling preserved in IR and transcript

The stored `content`, the IR, and the exported transcript (§17) SHALL retain the original spelling.
A non-empty header lexicon SHALL be copied verbatim to the IR root as `pronounce` (omitted when
absent), and inline pronunciation nodes SHALL be preserved within clip `content`.

#### Scenario: IR carries the lexicon and the original content
- **WHEN** a script with a `pronounce:` block and an inline `{say "lead" as "led"}` node is resolved
- **THEN** the IR root contains the `pronounce` map **AND** the clip's `content` still contains the
  original `text` and the `{ "kind": "pronounce", "value": "lead", "say": "led" }` node

#### Scenario: Transcript shows the written form
- **WHEN** a transcript is exported from that IR
- **THEN** it renders `lead` (the written form), not the respelling `led`, and renders header-lexicon
  terms with their original spelling
