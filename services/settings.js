export const SETTINGS_SCHEMA = "org.gnome.shell.extensions.drafts";
export const FONT_SIZE_KEY = "font-size";
export const CONFIRM_CLEAR_KEY = "confirm-clear";
export const MAX_HISTORY_KEY = "max-history";

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 28;
const DEFAULT_MAX_HISTORY = 25;

export class DraftsSettings {
  constructor(extension) {
    this._settings = extension.getSettings(SETTINGS_SCHEMA);
  }

  get fontSize() {
    return this._clamp(this._settings.get_int(FONT_SIZE_KEY), MIN_FONT_SIZE, MAX_FONT_SIZE);
  }

  set fontSize(value) {
    this._settings.set_int(
      FONT_SIZE_KEY,
      this._clamp(Math.round(value), MIN_FONT_SIZE, MAX_FONT_SIZE)
    );
  }

  get confirmClear() {
    return this._settings.get_boolean(CONFIRM_CLEAR_KEY);
  }

  get maxHistory() {
    return Math.max(5, this._settings.get_int(MAX_HISTORY_KEY) || DEFAULT_MAX_HISTORY);
  }

  connectFontSizeChanged(callback) {
    return this._settings.connect(`changed::${FONT_SIZE_KEY}`, () => {
      callback(this.fontSize);
    });
  }

  connectConfirmClearChanged(callback) {
    return this._settings.connect(`changed::${CONFIRM_CLEAR_KEY}`, () => {
      callback(this.confirmClear);
    });
  }

  connectMaxHistoryChanged(callback) {
    return this._settings.connect(`changed::${MAX_HISTORY_KEY}`, () => {
      callback(this.maxHistory);
    });
  }

  disconnect(signalId) {
    if (signalId) {
      this._settings.disconnect(signalId);
    }
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
}
