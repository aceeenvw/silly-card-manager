# Card Manager

A full-screen character card manager for [SillyTavern](https://github.com/SillyTavern/SillyTavern).

Browse, organize, analyze, and showcase your character cards without leaving ST.

![Version](https://img.shields.io/badge/version-1.0.0-blue)

---

## Features

### Cards Tab
- Grid view with avatar previews, token counts, and creator info
- Search by name, creator, or description
- Smart filters — All, Active, Needs Attention, Has Lorebook, In Groups, No Avatar, No Description, No Personality, Very High/Low Tokens, and more
- Sort by name, tokens, or creator
- Pagination with configurable page size
- Bulk select (Ctrl+A, click, invert) with bulk delete and export
- Inline tag editor — add, remove, and create tags per card or in bulk
- Drag-and-drop cards into folders

### Folder System
- Nested folders and subfolders for organizing cards
- Create, rename, and delete folders from the sidebar
- Drag-and-drop assignment
- Bulk folder picker for moving multiple cards at once
- Folder tree with card counts
- Persistent folder assignments saved to extension settings

### Stats Tab
- Overview cards (total characters, tokens, unique tags, creators)
- Token distribution by field (description, first message, personality, scenario, examples, creator notes)
- Rankings — largest/smallest cards, top creators
- Health report — flags cards with missing avatars, empty descriptions, empty first messages, or no personality
- Tag and creator distribution charts
- Coverage report
- Duplicate detection with side-by-side comparison and quick delete

### Showcase Tab
- Full-screen character profile viewer
- 12 visual themes — Default, Fantasy, Cyberpunk, Sci-Fi, Romance, Horror, Noir, Mystery, Historical, Comedy, Wholesome, Slice of Life, plus a Custom theme with accent/background color pickers
- Customizable fonts (heading, body, label, name) with Google Fonts integration
- Clean mode for minimal UI
- Avatar size options (S / M / L)
- Layout toggle (card vs. wide)
- Screenshot to PNG (via html2canvas)
- Keyboard navigation (← →)

### Import Tab
- Drag-and-drop or file picker for importing character cards (PNG, JSON)
- Batch import with progress bar
- Cancel support mid-import

### Export Tab
- Export individual cards as PNG or JSON
- Bulk export selected cards as a ZIP archive (via JSZip)
- Configurable filename templates

### General
- Full keyboard shortcuts — Escape to close/deselect, Ctrl+A to select all, Delete for bulk delete, arrow keys for Showcase nav
- All state persisted across sessions
- Works with SillyTavern's tag system (reads and writes ST tag maps)
- Non-blocking popups for confirmations and prompts (uses ST's Popup API with graceful fallback)

---

## Installation

1. Open SillyTavern
2. Go to **Extensions** → **Install Extension**
3. Paste the repository URL:
   ```
   https://github.com/aceeenvw/silly-card-manager
   ```
4. Click **Install** and reload

Or manually clone into your extensions folder:
```bash
cd data/default-user/extensions/
git clone https://github.com/aceeenvw/silly-card-manager
```

---

## Acknowledgments

The folder system architecture in this extension was inspired by [ayvencore](https://github.com/ayvencore)'s [SillyTavern Lorebook Manager](https://github.com/ayvencore/SillyTavern-Lorebook-Manager). The overall folder structure concept (nested folders, drag-and-drop assignment, persistent folder state) was used as a starting reference when building Card Manager's own folder system. All code is independently written — no source code was copied.

Also worth checking out ayvencore's [Another Character Library](https://github.com/ayvencore/Sillytavern-Another-Character-Library), which takes a different approach to character management in SillyTavern.

---

## License

MIT
