# Daily Kastenator

An Obsidian plugin for systematic atomisation of your Zettelkasten quarry notes.

## Overview

Daily Kastenator sends you a daily notification suggesting a random note from your quarry (notes marked with `Migration:: quarry`). Tapping the notification opens a guided quiz workflow that helps you transform fleeting and source notes into atomic knowledge.

## Features

### Current (v0.1.0)

- **Daily notification** at a configurable time
- **Random quarry selection** from specified folders
- **Dataview integration** for filtering notes by inline field
- **Guided atomisation quiz**:
    - Introduction phase: review the source note
    - Identification phase: identify atomic concepts
    - Explanation phase: explain each concept in your own words
    - Critique phase: receive honest feedback on your explanations
    - Refinement phase: improve based on critique
    - Confirmation phase: select which atoms to create
    - Creation phase: generate atom files with proper templates

### Planned

- **Spaced repetition**: timed review of earlier atomisation quizzes
- **Semantic selection**: use file modification times, git logs, and activity patterns to intelligently suggest relevant notes instead of random selection

## Installation

### Manual Installation

1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/daily-kastenator/` directory
3. Enable the plugin in Obsidian Settings > Community Plugins

### Development

```bash
# Clone the repository
git clone <repo-url> daily-kastenator
cd daily-kastenator

# Install dependencies
npm install

# Build for development (with watch mode)
npm run dev

# Build for production
npm run build
```

## Configuration

### Quarry Setup

Your quarry notes must:

1. Be located in one of the configured folders (default: `Fleeting notes`, `Source notes`)
2. Contain the Dataview inline field `Migration:: quarry`

Example note:

```markdown
# My Fleeting Note

Migration:: quarry

Some interesting thoughts captured quickly...
```

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Enable daily notification | Toggle daily reminders | On |
| Notification time | When to receive the notification | 09:00 |
| Quarry folders | Folders to search for quarry notes | Fleeting notes, Source notes |
| Migration field | Dataview inline field name | Migration |
| Quarry value | Field value indicating quarry status | quarry |
| Atom folder | Where to create new atoms | Atoms |
| Atom template | Template file for new atoms | (none) |

### Atom Templates

You can specify a template file for new atoms. Available variables:

- `{{title}}` - Atom title
- `{{concept}}` - Original concept text
- `{{explanation}}` - Your explanation
- `{{evidence}}` - Supporting evidence
- `{{tags}}` - Comma-separated tags
- `{{date}}` - Creation date (YYYY-MM-DD)
- `{{content}}` - Default atom content

Example template:

```markdown
---
created: {{date}}
type: atom
---

# {{title}}

{{explanation}}

## Evidence

> {{evidence}}

## Related

```

## Usage

### Starting a Session

1. **Automatic**: Wait for the daily notification at your configured time
2. **Manual**: Click the pickaxe icon in the ribbon
3. **Command**: Use "Daily Kastenator: Start atomisation session"

### The Quiz Workflow

1. **Introduction**: Read through your source note carefully
2. **Identification**: List each atomic concept you can extract
3. **Explanation**: For each concept, provide:
    - A clear title
    - An explanation that stands alone without the source
    - Supporting evidence from the source
4. **Critique**: Review the feedback on your explanations
5. **Refinement**: Address any issues raised
6. **Confirmation**: Select which atoms to create
7. **Creation**: Files are generated in your atom folder

### Critique Philosophy

The critique phase provides direct, objective feedback. It does not offer:

- Praise or commiseration
- Emotional encouragement
- Hedging language

Instead, it identifies:

- Vague or hedging language
- Explanations that merely repeat the concept
- Multiple concepts bundled together
- Missing evidence or context

## Commands

- **Start atomisation session**: Begin the atomisation workflow
- **Open random quarry note**: Just open a quarry note without the workflow
- **Show quarry statistics**: Display count and configuration

## Dependencies

- **Obsidian** >= 1.4.0
- **Dataview** (optional, but recommended for inline field queries)

Without Dataview, the plugin falls back to frontmatter-only field detection.

## Architecture

```
src/
├── main.ts                 # Plugin entry point
├── types.ts                # TypeScript interfaces
├── settings.ts             # Settings tab
├── services/
│   ├── scheduler.ts        # Notification scheduling
│   ├── quarry.ts           # Quarry note discovery
│   └── atomisation.ts      # Atomisation workflow logic
└── ui/
    ├── atomisation-view.ts # Main quiz view
    └── atomisation-modal.ts # Notification modal
```

## Licence

MIT
