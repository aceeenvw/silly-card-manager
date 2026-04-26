<div align="center">

# ⊹ CARD MANAGER ⊹

### A full-screen character card manager for [SillyTavern](https://github.com/SillyTavern/SillyTavern)

**Browse · Organize · Analyze · Showcase · Import · Export** — all without leaving ST.

![Version](https://img.shields.io/badge/version-1.0.0-8a63d2?style=flat-square)
![SillyTavern](https://img.shields.io/badge/SillyTavern-extension-c76a9e?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)
![Author](https://img.shields.io/badge/author-aceenvw-333?style=flat-square)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Highlights](#highlights)
- [Features](#features)
  - [Cards Tab](#-cards-tab)
  - [Folder System](#-folder-system)
  - [Stats Tab](#-stats-tab)
  - [Showcase Tab](#-showcase-tab)
  - [Import Tab](#-import-tab)
  - [Export Tab](#-export-tab)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [FAQ](#faq)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Acknowledgments](#acknowledgments)
- [License](#license)

---

## Overview

**Card Manager** is a full-screen control panel for your SillyTavern character library. It replaces scrolling through ST's native character list with a dedicated workspace built for people who actually have *a lot* of cards.

If you have 20 characters, you probably don't need this. If you have 200, 500, or 2,000 — this is for you.

> **Why another character manager?**
> ST's built-in list works great up to ~50 cards. Beyond that, finding the card you want, spotting broken ones, or organizing them by theme turns into manual scroll-hell. Card Manager adds folders, filters, bulk operations, health reports, and a proper analytics view on top of ST's existing data — no migration, no sync, no separate database.

---

## Highlights

| | |
|---|---|
| 📁 **Nested folders** | Organize cards into collapsible folder trees with drag-and-drop |
| 🔍 **Smart filters** | Quick lenses for *Needs Attention*, *In Groups*, *Has Lorebook*, *No Avatar*, and more |
| 📊 **Full analytics** | Token distribution, rankings, creator/tag charts, health reports, duplicate detection |
| 🎨 **12 showcase themes** | Present any card as a full-screen profile with theme picker, Google Fonts, and PNG screenshot |
| ⚡ **Bulk operations** | Tag, move, export, or delete dozens of cards at once |
| ⌨️ **Keyboard-first** | `Esc`, `Ctrl+A`, `Delete`, `←`, `→` — all wired up |
| 🔌 **Zero-config** | Reads and writes ST's native tag system and character files. No lock-in. |

---

## Features

### 🃏 Cards Tab

The main browser. Everything about a card at a glance.

- **Grid view** with avatar previews, token counts, creator, and tag pills
- **Search** by name, creator, or description (debounced, instant)
- **Smart filters** in the sidebar:
  - `All` · `Active` · `Needs Attention` · `Has Lorebook` · `In Groups`
  - `No Avatar` · `No Description` · `No Personality` · `Very High / Low Tokens`
  - Plus dynamic filters for every tag, creator, and folder
- **Sort** by name, tokens, or creator (asc/desc)
- **Pagination** with configurable page size (10 / 25 / 50 / 100)
- **Bulk selection** — click, Ctrl+A, invert, select-all-visible
- **Bulk actions** — delete, export, tag, move to folder
- **Inline tag editor** — add / remove / create tags per card or across many cards
- **Drag-and-drop** cards directly into folders in the sidebar
- **Random character** button for when you can't decide

### 🗂️ Folder System

Not just tags — real folders, with structure.

- **Nested folders and subfolders** with collapse/expand
- **Create, rename, delete** from the sidebar
- **Drag-and-drop** to assign a card to a folder
- **Bulk folder picker** — move many cards into one folder from a single popover
- **Live card counts** on every folder and subtree
- **Persistent** — folder assignments survive ST restarts (stored in extension settings)
- **Non-destructive** — folders are pure Card Manager metadata. Your actual character files are untouched.

### 📈 Stats Tab

Turn your character library into a dashboard.

<table>
<tr>
<td width="50%" valign="top">

**Overview cards**
- Total characters
- Total tokens across library
- Unique tags
- Unique creators

**Token distribution**
- Tokens per field (description, first message, personality, scenario, examples, creator notes)
- Totals and averages

</td>
<td width="50%" valign="top">

**Rankings**
- Largest and smallest cards
- Top creators by card count

**Health report**
- Missing avatars
- Empty descriptions
- Empty first messages
- Empty personality

**Distributions & coverage**
- Tag distribution chart
- Creator distribution chart
- Coverage report — what fraction of your library has lorebooks, tags, groups, etc.

**Duplicate detection**
- Finds name collisions
- Side-by-side comparison
- Quick-delete either copy

</td>
</tr>
</table>

### 🎭 Showcase Tab

A full-screen "hero" view for any card. Good for screenshots, presentations, or just admiring your own work.

- **Full-screen character profile viewer** with large avatar, name, and all fields laid out
- **12 visual themes** — Default, Fantasy, Cyberpunk, Sci-Fi, Romance, Horror, Noir, Mystery, Historical, Comedy, Wholesome, Slice of Life
- **Custom theme** with accent + background color pickers
- **Customizable fonts** (heading, name, body, label) with Google Fonts integration
- **Clean mode** — hides all UI chrome for a pure card view
- **Avatar size** toggle (S / M / L)
- **Font size** stepper
- **Layout** toggle (card vs. wide)
- **Screenshot to PNG** via `html2canvas`
- **Keyboard navigation** — `←` / `→` cycles through cards

### 📥 Import Tab

- **Drag-and-drop** or file picker for PNG and JSON character cards
- **Batch import** with a progress bar
- **Cancel mid-import**
- **Import history** stays in the panel for the session

### 📤 Export Tab

- **Export individually** as PNG or JSON
- **Bulk export** selected cards as a ZIP archive (via `JSZip`)
- **Scopes** — Export `All`, `Filtered`, or `Selected` with live counts
- **Configurable filename templates** (e.g. `{name}`, `{creator}_{name}`)
- **Preview** generated filenames before export
- **Cancel mid-export**

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
|---|---|---|
| `Esc` | Anywhere | Deselect, or close manager if nothing selected |
| `Ctrl` / `⌘` + `A` | Cards tab | Select all visible cards |
| `Delete` | Cards tab, with selection | Bulk delete selected |
| `←` | Showcase tab | Previous character |
| `→` | Showcase tab | Next character |

All state (active tab, filter, sort, page size, sidebar collapse, theme, folder tree) is persisted across sessions.

---

## Requirements

- **SillyTavern** — any reasonably recent version. The extension uses the modern `SillyTavern.getContext()` API with graceful fallbacks to legacy globals.
- A web browser with modern ES2020+ support (any current Chrome / Firefox / Edge / Safari).
- No server-side setup, no extra dependencies to install manually — bundled libraries are loaded on demand.

---

## Installation

### Option 1 — From within SillyTavern (recommended)

1. Open SillyTavern
2. Go to **Extensions** → **Install Extension**
3. Paste the repository URL:
   ```
   https://github.com/aceeenvw/silly-card-manager
   ```
4. Click **Install** and reload the page

### Option 2 — Manual clone

```bash
cd SillyTavern/data/default-user/extensions/
git clone https://github.com/aceeenvw/silly-card-manager
```

Then reload SillyTavern. The extension will appear under **Extensions** as **⊹ CARD MANAGER ⊹**.

---

## Usage

1. Open SillyTavern and expand the **Extensions** panel.
2. Find the **⊹ CARD MANAGER ⊹** drawer and click **Open Card Manager**.
3. The full-screen UI takes over — switch tabs along the top, filter/folder tree in the sidebar, cards in the main area.
4. Press `Esc` to close and return to normal ST.

<details>
<summary><b>Tips for large libraries</b></summary>

- Start with the **Needs Attention** filter to spot cards with missing fields.
- Use **Stats → Duplicates** to find accidentally-imported twins.
- Build a folder structure first (e.g. *Fantasy / Sci-Fi / NSFW / Testing*), then bulk-move cards in.
- Tag pills in the grid are clickable — they jump straight to a filtered view.
- The **Showcase** tab is great for generating preview images to share.

</details>

<details>
<summary><b>How folders interact with ST</b></summary>

Folders are Card Manager-only metadata. They're stored in `extension_settings[card-manager]` and don't modify your character files. If you uninstall the extension, your characters are unaffected — only the folder structure is lost.

Tags, on the other hand, are **real ST tags** — Card Manager reads from and writes to ST's native tag map, so any tags you add or remove here show up everywhere else in ST.

</details>

---

## FAQ

<details>
<summary><b>Does this modify my character files?</b></summary>

Only when you explicitly ask it to — via delete, rename, tag edit, or import. Browsing, filtering, sorting, folders, and stats are all read-only or Card-Manager-local.
</details>

<details>
<summary><b>Will it slow down SillyTavern?</b></summary>

No. The UI only renders when you open it, and it uses cached token counts + debounced search. The extension's startup footprint is a single button in the Extensions panel.
</details>

<details>
<summary><b>Does it work with groups?</b></summary>

Yes — groups are listed and there's a dedicated **In Groups** filter. Group membership is displayed on the card.
</details>

<details>
<summary><b>Does it support character lorebooks?</b></summary>

Yes. The **Has Lorebook** filter, the coverage report, and export options all recognize character-attached lorebooks.
</details>

<details>
<summary><b>Does it work with SillyTavern's tag system?</b></summary>

Yes — fully. Card Manager reads and writes ST's native `tag_map`, so tags you create or edit here are the same tags ST uses everywhere else.
</details>

<details>
<summary><b>Can I import a folder of PNGs at once?</b></summary>

Drag the whole selection of files into the Import tab. Batch import with progress + cancel is built in.
</details>

---

## Troubleshooting

<details>
<summary><b>The manager doesn't open / button is missing</b></summary>

- Make sure the extension is enabled in **Extensions → Manage Extensions**.
- Hard-reload SillyTavern (`Ctrl+Shift+R`).
- Check the browser DevTools console for errors starting with `[card-manager]`.
</details>

<details>
<summary><b>Token counts look wrong</b></summary>

Token counts are estimated quickly on first render, then refined in the background using ST's tokenizer. Give it a couple of seconds — or hit the **Refresh** button.
</details>

<details>
<summary><b>Folder assignments disappeared</b></summary>

Folder data is stored in `extension_settings[card-manager]`. If you reset extension settings or switch ST users, this resets too. (Your characters themselves are unaffected.)
</details>

<details>
<summary><b>Screenshot in Showcase is blank / cut off</b></summary>

`html2canvas` sometimes struggles with cross-origin avatar URLs. Try toggling **Clean mode** on before taking the screenshot, or use a smaller avatar size.
</details>

---

## Roadmap

Ideas being considered for future versions. No promises, no timeline.

- [ ] Per-folder cover images
- [ ] Custom saved filter presets
- [ ] Compact list view in addition to grid
- [ ] Export entire folder as a single shareable bundle
- [ ] Stats: prompt/response length histogram
- [ ] Showcase: more built-in themes + theme import/export

Open an issue on GitHub if you have a feature you'd like to see.

---

## Acknowledgments

The folder system architecture in this extension was inspired by [ayvencore](https://github.com/ayvencore)'s [SillyTavern Lorebook Manager](https://github.com/ayvencore/SillyTavern-Lorebook-Manager). The overall folder structure concept (nested folders, drag-and-drop assignment, persistent folder state) was used as a starting reference when building Card Manager's own folder system. All code is independently written — no source code was copied.

Also worth checking out ayvencore's [Another Character Library](https://github.com/ayvencore/Sillytavern-Another-Character-Library), which takes a different approach to character management in SillyTavern.

Built on top of SillyTavern's extension API, with [`html2canvas`](https://html2canvas.hertzen.com/) for showcase screenshots and [`JSZip`](https://stuk.github.io/jszip/) for bulk export.

---

## License

MIT © [aceenvw](https://github.com/aceeenvw)

<div align="center">

---

<sub>⊹ If you find Card Manager useful, a ⭐ on the repo is always appreciated ⊹</sub>

</div>
