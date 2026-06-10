---
name: anki
description: Create Anki decks and add flashcards via AnkiConnect. Use when the user wants to create spaced repetition cards from source material, add individual cards, or generate a deck for learning a topic.
---

# Anki

Create Anki decks and add flashcards via the AnkiConnect API
(`localhost:8765`). Anki must be running on the host with the
AnkiConnect plugin installed.

## Prerequisites

- Anki running on the host with AnkiConnect plugin (code `2055492159`)
- Port 8765 forwarded into the container (or direct host access)

## CLI tool

All API calls go through the helper script:

```bash
./scripts/anki-api <command> [args]
```

| Command | Purpose |
|---------|---------|
| `list-decks` | Print all deck names |
| `create-deck <name>` | Create a deck (use `::` for nesting) |
| `list-models` | Print all note type names |
| `model-fields <model>` | Print field names for a model |
| `deck-notes <deck>` | Dump all notes in a deck as JSON |
| `add-note --deck D --model M --field K=V --tag T` | Add one note |
| `add-notes <file.json>` | Add notes from JSON array |
| `sync` | Sync to AnkiWeb |

All cards are automatically tagged `pi-generated`.

## Supported note types

- **Basic** — fields: `Front`, `Back`
- **Basic (and reversed card)** — fields: `Front`, `Back` (generates a reverse card automatically)
- **Cloze** — fields: `Text`, `Extra` (use `{{c1::answer}}` syntax in Text)

## Workflow

### Before adding cards

Always check what exists first to avoid duplicates:

```bash
./scripts/anki-api list-decks
./scripts/anki-api deck-notes "DeckName"
```

Review the existing notes and ensure new cards do not overlap with them
semantically. The API also rejects exact duplicates per-deck as a safety
net.

### Adding cards

1. Generate proposed cards following the card formulation rules below.
2. Present the proposed cards to the user for approval before adding.
   Show them in a readable format (e.g. a numbered list with Front/Back
   or cloze text). Ask the user to confirm, remove, or edit cards.
3. On approval, write a temporary JSON file and use `add-notes`, or use
   `add-note` for individual cards.
4. Call `sync` after adding cards.

### JSON format for add-notes

```json
[
  {
    "deckName": "MyDeck",
    "modelName": "Basic",
    "fields": {"Front": "question", "Back": "answer"},
    "tags": ["topic"]
  },
  {
    "deckName": "MyDeck",
    "modelName": "Cloze",
    "fields": {"Text": "The {{c1::mitochondria}} is the powerhouse of the cell", "Extra": ""},
    "tags": ["biology"]
  }
]
```

## Card formulation rules

Follow these rules when generating cards. They are derived from the
20 Rules of Formulating Knowledge (Piotr Wozniak).

### 1. Understand before memorizing

Never create cards for material you (or the user) do not understand.
If the source material is unclear, ask for clarification first.

### 2. Minimum information principle

Each card tests exactly ONE atomic fact. Keep questions short. Keep
answers as short as possible — ideally a single word, number, or
brief phrase.

BAD: "What are the characteristics of the Dead Sea?" → long answer
GOOD: Split into separate cards:
- "Where is the Dead Sea located?" → "border of Israel and Jordan"
- "What is the lowest point on Earth's surface?" → "Dead Sea shoreline"
- "How much saltier is the Dead Sea than the ocean?" → "7 times"

### 3. Use cloze deletions

Cloze deletion is the most efficient way to convert prose into cards.
Use it liberally for factual and definitional material.

```
The {{c1::mitochondria}} is the powerhouse of the cell.
```

For sequences or related facts, use overlapping cloze deletions:
```
The alphabet starts with {{c1::A}}, {{c2::B}}, {{c3::C}}.
```

### 4. Avoid sets

Never ask "list all X". Break sets into individual cards, ideally
using historical, logical, or categorical groupings that give each
member a unique context.

### 5. Avoid enumerations

If order matters, use overlapping cloze deletions rather than asking
for the full sequence.

### 6. Optimize wording

Strip questions to their essential core. Remove filler words and
redundant context. Shorter items = faster reviews = better retention.

### 7. Build basics first

Order cards from fundamental concepts to details. Ensure prerequisite
knowledge is covered before dependent facts.

### 8. Use context cues

Prefix cards with short context labels when there is ambiguity risk:
`bio:`, `hist:`, `chem:`, etc. This prevents interference between
similar items from different domains.

### 9. Combat interference

If two facts are easily confused, add distinguishing context,
examples, or mnemonic hints. Personal examples are particularly
effective.

### 10. One card, two directions

For vocabulary and definitions, consider creating both a forward card
(term → definition) and a reverse card (definition → term). Use the
"Basic (and reversed card)" model for this rather than making two
separate Basic cards.
