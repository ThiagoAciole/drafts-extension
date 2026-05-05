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

  async loadState() {
    const state = await this._readState();
    return this._normalizeState(state);
  }

  async saveDraft(content) {
    const state = await this.loadState();
    state.draft = content;
    await this._writeState(state);
    return state;
  }

  async saveNote(content, maxHistory) {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      return this.loadState();
    }

    const state = await this.loadState();
    const note = {
      id: GLib.uuid_string_random(),
      title: buildNoteTitle(trimmedContent),
      content,
      updatedAt: new Date().toISOString(),
    };

    state.draft = content;
    state.notes.unshift(note);
    state.notes = state.notes.slice(0, Math.max(5, maxHistory));

    await this._writeState(state);
    return state;
  }

  async trimHistory(maxHistory) {
    const state = await this.loadState();
    state.notes = state.notes.slice(0, Math.max(5, maxHistory));
    await this._writeState(state);
    return state;
  }

  async openNote(noteId) {
    const state = await this.loadState();
    const note = state.notes.find((item) => item.id === noteId);
    if (!note) {
      return null;
    }

    state.draft = note.content;
    await this._writeState(state);
    return {
      note,
      state,
    };
  }

  _readState() {
    return new Promise((resolve) => {
      try {
        const file = Gio.File.new_for_path(this._statePath);
        file.load_contents_async(null, (source, result) => {
          try {
            const [success, contents] = source.load_contents_finish(result);
            if (!success) {
              resolve(this._defaultState());
              return;
            }

            resolve(JSON.parse(new TextDecoder().decode(contents)));
          } catch (error) {
            global.logError(
              error,
              `Drafts: failed to read state file at ${this._statePath}`,
            );
            resolve(this._defaultState());
          }
        });
      } catch (error) {
        global.logError(
          error,
          `Drafts: failed to read state file at ${this._statePath}`,
        );
        resolve(this._defaultState());
      }
    });
  }

  async _writeState(state) {
    try {
      await this._ensureDirectory();
      const payload = JSON.stringify(this._normalizeState(state), null, 2);
      const file = Gio.File.new_for_path(this._statePath);

      return new Promise((resolve, reject) => {
        file.replace_contents_async(
          payload,
          null,
          false,
          Gio.FileCreateFlags.REPLACE_DESTINATION,
          null,
          (source, result) => {
            try {
              source.replace_contents_finish(result);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
        );
      });
    } catch (error) {
      global.logError(
        error,
        `Drafts: failed to write state file at ${this._statePath}`,
      );
    }
  }

  _ensureDirectory() {
    return new Promise((resolve, reject) => {
      const directory = Gio.File.new_for_path(this._configDir);
      directory.make_directory_with_parents_async(null, (source, result) => {
        try {
          source.make_directory_with_parents_finish(result);
          resolve();
        } catch (error) {
          if (error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
            resolve();
            return;
          }
          reject(error);
        }
      });
    });
  }

  _normalizeState(state) {
    const normalizedNotes = Array.isArray(state.notes)
      ? state.notes
          .filter(
            (note) =>
              note &&
              typeof note.id === "string" &&
              typeof note.content === "string" &&
              typeof note.updatedAt === "string",
          )
          .map((note) => ({
            id: note.id,
            title:
              typeof note.title === "string"
                ? note.title
                : buildNoteTitle(note.content),
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
