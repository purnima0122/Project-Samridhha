**Lesson Seed Schema**

Use the nested curriculum format when you want to manage lesson content directly in code.
The live curriculum seed at `backend-nest/seed/lessons.nepal-finlit-curriculum.json` now follows this structure.

Top level:

```json
{
  "topic": {
    "title": "Nepal Share Market",
    "slug": "nepal-share-market",
    "shortInfo": "One-line overview of the whole topic"
  },
  "chapters": []
}
```

Chapter fields:

- `title`: chapter name shown in the app
- `slug`: stable id for updates
- `shortInfo`: short chapter intro
- `order`: chapter order
- `color`, `darkColor`, `emoji`: chapter styling
- `lessons`: array of lessons inside the chapter

Lesson fields:

- `title`: lesson name
- `slug`: stable id for updates
- `summary`: short lesson intro
- `order`: lesson order inside the chapter
- `duration`: estimated minutes
- `xp`: xp reward
- `icon`: icon name already used by the app
- `cards`: flip cards
- `quiz`: quiz questions
- `facts`: optional reference facts for vault-style lessons
- `type`: optional, `lesson` or `vault`
- `isPublished`: optional, defaults to `true`
- `content`: optional, auto-generated if omitted

Flip card fields:

- `front`: curiosity hook, question, scenario, or setup
- `back`: revealed learning when flipped
- `label`: optional tag like `Risk`, `Ownership`, `IPO`

Quiz fields:

- `question`: quiz prompt
- `choices`: answer choices
- `correctIndex`: zero-based correct answer index
- `explanation`: optional explanation after answering

Commands:

```bash
node backend-nest/seed/run-lesson-seed.js --file seed/curriculum.seed.example.json --dry-run
node backend-nest/seed/run-lesson-seed.js --file seed/curriculum.seed.example.json
node backend-nest/seed/run-lesson-seed.js --file seed/curriculum.seed.example.json --mode replace-module --module "Share Market Basics"
```

Backward compatibility:

- The seed runner still supports the old flat lesson array format.
- For safer updates, prefer `slug` in both chapters and lessons.
