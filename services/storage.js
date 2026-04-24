import Gio from "gi://Gio";
import GLib from "gi://GLib";

import { buildNoteTitle } from "../utils/note.js";

const STATE_FILE_NAME = "state.json";

export class DraftsStorage {
  constructor(extension) {
    this._configDir = GLib.build_filenamev([
      GLib.get_user_config_dir(),
      extension.uuid,
    ]);
    this._statePath = GLib.build_filenamev([this._configDir, STATE_FILE_NAME]);
  }

  loadState() {
    const state = this._readState();
    return this._normalizeState(state);
  }

  saveDraft(content) {
    const state = this.loadState();
    state.draft = content;
    this._writeState(state);
    return state;
  }

  saveNote(content, maxHistory) {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return this.loadState();
    }

    const state = this.loadState();
    const note = {
      id: GLib.uuid_string_random(),
      title: buildNoteTitle(trimmedContent),
      content,
      updatedAt: new Date().toISOString(),
    };

    state.draft = content;
    state.notes.unshift(note);
    state.notes = state.notes.slice(0, Math.max(5, maxHistory));

    this._writeState(state);
    return state;
  }

  trimHistory(maxHistory) {
    const state = this.loadState();
    state.notes = state.notes.slice(0, Math.max(5, maxHistory));
    this._writeState(state);
    return state;
  }

  openNote(noteId) {
    const state = this.loadState();
    const note = state.notes.find((item) => item.id === noteId);
    if (!note) {
      return null;
    }

    state.draft = note.content;
    this._writeState(state);
    return {
      note,
      state,
    };
  }

  _readState() {
    try {
      if (!GLib.file_test(this._statePath, GLib.FileTest.EXISTS)) {
        return this._defaultState();
      }

      const file = Gio.File.new_for_path(this._statePath);
      const [success, contents] = file.load_contents(null);
      if (!success) {
        return this._defaultState();
      }

      return JSON.parse(new TextDecoder().decode(contents));
    } catch (error) {
      console.error(`Drafts: failed to read state file at ${this._statePath}`, error);
      return this._defaultState();
    }
  }

  _writeState(state) {
    try {
      this._ensureDirectory();
      const payload = JSON.stringify(this._normalizeState(state), null, 2);
      GLib.file_set_contents(this._statePath, payload);
    } catch (error) {
      console.error(`Drafts: failed to write state file at ${this._statePath}`, error);
    }
  }

  _ensureDirectory() {
    try {
      const directory = Gio.File.new_for_path(this._configDir);
      directory.make_directory_with_parents(null);
    } catch (error) {
      if (!error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw error;
      }
    }
  }

  _normalizeState(state) {
    const normalizedNotes = Array.isArray(state.notes)
      ? state.notes
          .filter(
            (note) =>
              note &&
              typeof note.id === "string" &&
              typeof note.content === "string" &&
              typeof note.updatedAt === "string"
          )
          .map((note) => ({
            id: note.id,
            title: typeof note.title === "string" ? note.title : buildNoteTitle(note.content),
            content: note.content,
            updatedAt: note.updatedAt,
          }))
      : [];

    return {
      draft: typeof state.draft === "string" ? state.draft : "",
      notes: normalizedNotes,
    };
  }

  _defaultState() {
    return {
      draft: "",
      notes: [],
    };
  }
}
