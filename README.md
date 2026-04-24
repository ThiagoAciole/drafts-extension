# Drafts

**Drafts** is a GNOME Shell extension that adds a minimal notepad to the top bar for quick notes, snippets, and temporary writing.

## Features

- Fixed-size popup designed for fast capture
- Automatic draft persistence in the system configuration directory
- Dedicated history list for manually saved notes
- Clipboard actions for copy and paste
- Configurable font size through GNOME extension preferences
- Optional confirmation before clearing the current draft

## Project Structure

```text
.
├── extension.js
├── prefs.js
├── services/
│   ├── settings.js
│   └── storage.js
├── ui/
│   ├── history.js
│   └── main.js
├── utils/
│   ├── date.js
│   └── note.js
├── schemas/
│   └── org.gnome.shell.extensions.drafts.gschema.xml
├── stylesheet.css
└── metadata.json
```

## Installation

1. Copy the extension directory to:

   ```bash
   ~/.local/share/gnome-shell/extensions/drafts@thiago.aciole
   ```

2. Compile the bundled schema:

   ```bash
   glib-compile-schemas ~/.local/share/gnome-shell/extensions/drafts@thiago.aciole/schemas
   ```

3. Restart GNOME Shell or log out and back in.

4. Enable the extension with `Extensions` or:

   ```bash
   gnome-extensions enable drafts@thiago.aciole
   ```

## Usage

- Click the top bar icon to open the draft editor
- `Save` stores the current note in History
- `History` opens the list of saved notes
- `Ctrl+A` selects all text
- `Ctrl+X` clears the current draft
- `Ctrl+S` saves the current note into history
- `Ctrl+H` toggles the History panel

## Persistence

- Current draft and saved notes are stored in:

  ```text
  ~/.config/drafts@thiago.aciole/state.json
  ```

- Preferences are stored through GSettings using the schema:

  ```text
  org.gnome.shell.extensions.drafts
  ```

## Preferences

The preferences window currently supports:

- Font size
- Confirm before clearing
- Maximum history size

## Supported Version

- GNOME Shell 46

## Screenshots

Add screenshots to `docs/screenshots/` and reference them here when publishing the extension repository.

## Development Notes

- UI code lives in `ui/`
- Persistence and settings logic live in `services/`
- Small formatting helpers live in `utils/`
- Storage writes use a dedicated configuration directory and atomic replacement
