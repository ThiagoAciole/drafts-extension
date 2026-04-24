import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Pango from "gi://Pango";
import St from "gi://St";

import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";

import { DraftsSettings } from "../services/settings.js";
import { DraftsStorage } from "../services/storage.js";
import { DraftsHistoryView } from "./history.js";

const AUTOSAVE_DELAY_MS = 800;

export const DraftsIndicator = GObject.registerClass(
  class DraftsIndicator extends PanelMenu.Button {
    _init(extension) {
      super._init(0.0, "Drafts");

      this._extension = extension;
      this._settings = new DraftsSettings(extension);
      this._storage = new DraftsStorage(extension);

      this._autosaveTimeoutId = 0;
      this._focusTimeoutId = 0;
      this._snackbarTimeoutId = 0;
      this._historyDirty = true;
      this._signals = [];

      this._state = this._storage.loadState();

      this._buildLayout();
      this._wireSignals();
      this._applyDraft(this._state.draft);
      this._applyFontSize(this._settings.fontSize);
      this._hideConfirmBar();
    }

    _buildLayout() {
      const icon = new St.Icon({
        icon_name: "accessories-text-editor-symbolic",
        style_class: "system-status-icon",
      });
      this.add_child(icon);

      this.mainBox = new St.BoxLayout({
        vertical: true,
        style_class: "drafts-popup-content",
      });

      this.mainBox.add_child(this._buildHeader());
      this.mainBox.add_child(this._buildEditorView());

      this.historyView = new DraftsHistoryView({
        onOpen: (noteId) => this._openNote(noteId),
      });
      this.mainBox.add_child(this.historyView.container);

      this.mainBox.add_child(this._buildConfirmBar());
      this.mainBox.add_child(this._buildToolbar());

      this.menu.box.add_child(this.mainBox);
    }

    _buildHeader() {
      this.header = new St.BoxLayout({
        style_class: "drafts-header",
        x_expand: true,
      });

      this.headerTitle = new St.Label({
        text: "Drafts",
        style_class: "drafts-title",
        x_expand: true,
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.headerModeButton = this._createHeaderIconButton(
        "view-list-symbolic",
        "Open history",
        () => this._onHeaderModeAction()
      );
      this.headerSaveButton = this._createHeaderIconButton(
        "document-edit-symbolic",
        "Save note and clear",
        () => this._saveAndResetEditor()
      );

      this.header.add_child(this.headerTitle);
      this.header.add_child(this.headerModeButton);
      this.header.add_child(this.headerSaveButton);

      return this.header;
    }

    _buildEditorView() {
      this.editorView = new St.BoxLayout({
        vertical: true,
        style_class: "drafts-editor-view",
        x_expand: true,
        y_expand: true,
      });

      this.scrollView = new St.ScrollView({
        style_class: "drafts-scrollview",
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        overlay_scrollbars: true,
      });

      this.textContainer = new St.BoxLayout({
        style_class: "drafts-text-container",
        x_expand: true,
        y_expand: true,
      });
      this.textContainer.connect("button-press-event", () => {
        global.stage.set_key_focus(this.entry);
        return Clutter.EVENT_STOP;
      });

      this.entry = new Clutter.Text({
        editable: true,
        selectable: true,
        reactive: true,
        single_line_mode: false,
        x_expand: true,
        y_expand: true,
        line_alignment: Pango.Alignment.LEFT,
        margin_top: 10,
        margin_right: 12,
        margin_bottom: 10,
        margin_left: 12,
      });
      this.entry.set_line_wrap(true);
      this.entry.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
      this.entry.set_color(
        new Clutter.Color({
          red: 241,
          green: 245,
          blue: 249,
          alpha: 255,
        })
      );
      this.entry.set_cursor_color(
        new Clutter.Color({
          red: 241,
          green: 245,
          blue: 249,
          alpha: 255,
        })
      );
      this.entry.set_selection_color(
        new Clutter.Color({
          red: 59,
          green: 130,
          blue: 246,
          alpha: 255,
        })
      );
      this.entry.set_selected_text_color(
        new Clutter.Color({
          red: 255,
          green: 255,
          blue: 255,
          alpha: 255,
        })
      );

      this.textContainer.add_child(this.entry);
      this.scrollView.set_child(this.textContainer);
      this.editorView.add_child(this.scrollView);

      return this.editorView;
    }

    _buildConfirmBar() {
      this.confirmBar = new St.BoxLayout({
        style_class: "drafts-confirm-bar",
        visible: false,
        x_expand: true,
      });

      this.confirmBar.add_child(
        new St.Label({
          text: "Limpar o rascunho atual?",
          style_class: "drafts-confirm-label",
          x_expand: true,
          y_align: Clutter.ActorAlign.CENTER,
        })
      );

      const cancelButton = new St.Button({
        label: "Cancelar",
        style_class: "drafts-secondary-btn",
        can_focus: true,
      });
      cancelButton.connect("clicked", () => this._hideConfirmBar());

      const confirmButton = new St.Button({
        label: "Limpar",
        style_class: "drafts-danger-btn",
        can_focus: true,
      });
      confirmButton.connect("clicked", () => this._clearDraft());

      this.confirmBar.add_child(cancelButton);
      this.confirmBar.add_child(confirmButton);
      return this.confirmBar;
    }

    _buildToolbar() {
      this.toolbar = new St.BoxLayout({
        style_class: "drafts-toolbar",
        x_expand: true,
      });

      this.toolbar.add_child(
        this._createIconButton("list-remove-symbolic", "Decrease font size", () => {
          this._settings.fontSize = this._settings.fontSize - 1;
        })
      );
      this.toolbar.add_child(
        this._createIconButton("list-add-symbolic", "Increase font size", () => {
          this._settings.fontSize = this._settings.fontSize + 1;
        })
      );
      this.toolbar.add_child(this._buildSnackbar());

      this.toolbar.add_child(
        this._createIconButton("edit-copy-symbolic", "Copy text", () => this._copyText())
      );
      this.toolbar.add_child(
        this._createIconButton("edit-paste-symbolic", "Paste text", () => this._pasteText())
      );
      this.toolbar.add_child(
        this._createIconButton("edit-cut-symbolic", "Cut text", () => this._cutText())
      );
      this.toolbar.add_child(
        this._createIconButton("user-trash-symbolic", "Clear draft", () => this._requestClear())
      );

      return this.toolbar;
    }

    _buildSnackbar() {
      this.snackbarSlot = new St.BoxLayout({
        style_class: "drafts-snackbar-slot",
        x_expand: true,
      });

      this.snackbar = new St.Label({
        style_class: "drafts-snackbar",
        visible: false,
        opacity: 0,
        x_align: Clutter.ActorAlign.CENTER,
      });

      this.snackbarSlot.add_child(this.snackbar);

      return this.snackbarSlot;
    }

    _wireSignals() {
      this.entry.connect("text-changed", () => this._scheduleAutosave());
      this.entry.connect("key-press-event", (_actor, event) => this._onKeyPress(event));

      this.menu.connect("open-state-changed", (_menu, open) => {
        if (open) {
          if (this.historyView.container.visible) {
            this.historyView.focusSearch();
          } else {
            this._queueFocus();
          }
          return;
        }

        this._hideConfirmBar();
      });

      this._signals.push(
        this._settings.connectFontSizeChanged((size) => this._applyFontSize(size))
      );
      this._signals.push(
        this._settings.connectMaxHistoryChanged((maxHistory) => this._trimHistory(maxHistory))
      );
      this._signals.push(
        this._settings.connectConfirmClearChanged((enabled) => {
          if (!enabled) {
            this._hideConfirmBar();
          }
        })
      );
    }

    _applyDraft(content) {
      this.entry.text = content;
    }

    _applyFontSize(size) {
      this.entry.font_name = `Sans ${size}`;
    }

    _onKeyPress(event) {
      const symbol = event.get_key_symbol();
      const state = event.get_state();
      const hasCtrl = (state & Clutter.ModifierType.CONTROL_MASK) !== 0;

      if (!hasCtrl) {
        return Clutter.EVENT_PROPAGATE;
      }

      if (symbol === Clutter.KEY_a || symbol === Clutter.KEY_A) {
        this.entry.set_selection(0, this.entry.text.length);
        return Clutter.EVENT_STOP;
      }

      if (symbol === Clutter.KEY_x || symbol === Clutter.KEY_X) {
        this._cutText();
        return Clutter.EVENT_STOP;
      }

      if (symbol === Clutter.KEY_s || symbol === Clutter.KEY_S) {
        this._saveAndResetEditor();
        return Clutter.EVENT_STOP;
      }

      if (symbol === Clutter.KEY_h || symbol === Clutter.KEY_H) {
        this._toggleHistory();
        return Clutter.EVENT_STOP;
      }

      if (symbol === Clutter.KEY_c || symbol === Clutter.KEY_C) {
        this._copyText();
        return Clutter.EVENT_STOP;
      }

      if (symbol === Clutter.KEY_v || symbol === Clutter.KEY_V) {
        this._pasteText();
        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_PROPAGATE;
    }

    _copyText() {
      let textToCopy = this.entry.get_selection();
      if (!textToCopy) {
        textToCopy = this.entry.text;
      }

      if (!textToCopy) {
        return;
      }

      St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, textToCopy);
      this._showSnackbar("Texto Copiado");
    }

    _cutText() {
      let textToCut = this.entry.get_selection();
      if (textToCut) {
        St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, textToCut);
        this.entry.delete_selection();
        this._scheduleAutosave();
        this._queueFocus();
        this._showSnackbar("Texto Recortado");
        return;
      }

      textToCut = this.entry.text;
      if (!textToCut) {
        this._queueFocus();
        return;
      }

      St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, textToCut);
      this._clearDraft();
      this._showSnackbar("Texto Recortado");
    }

    _pasteText() {
      St.Clipboard.get_default().get_text(St.ClipboardType.CLIPBOARD, (_clip, text) => {
        if (!text) {
          return;
        }

        this.entry.delete_selection();
        const cursorPosition = this.entry.get_cursor_position();
        this.entry.insert_text(text, cursorPosition);
        this._scheduleAutosave();
        this._showSnackbar("Texto Colado");
      });
    }

    _requestClear() {
      if (!this._settings.confirmClear) {
        this._clearDraft();
        return;
      }

      this.confirmBar.visible = true;
    }

    _hideConfirmBar() {
      this.confirmBar.visible = false;
    }

    _clearDraft() {
      this._hideConfirmBar();
      this.entry.text = "";
      this._scheduleAutosave();
      this._queueFocus();
    }

    _archiveCurrentDraft({ clear = false } = {}) {
      if (!this.entry.text.trim()) {
        return false;
      }

      this._state = this._storage.loadState();
      const latestNote = this._state.notes[0];
      if (latestNote && latestNote.content === this.entry.text) {
        if (clear) {
          this._clearDraft();
        }
        return false;
      }

      this._state = this._storage.saveNote(this.entry.text, this._settings.maxHistory);
      this._historyDirty = true;

      if (clear) {
        this.entry.text = "";
        this._state = this._storage.saveDraft("");
        this._queueFocus();
      }

      if (this.historyView.container.visible) {
        this._refreshHistory();
      }

      return true;
    }

    _saveAndResetEditor() {
      this._archiveCurrentDraft({ clear: true });
    }

    _onHeaderModeAction() {
      if (this.historyView.container.visible) {
        this._showEditor();
        return;
      }

      this._showHistory();
    }

    _openNote(noteId) {
      const result = this._storage.openNote(noteId);
      if (!result) {
        return;
      }

      this._state = result.state;
      this._applyDraft(result.note.content);
      this._showEditor();
      this._queueFocus();
    }

    _toggleHistory() {
      if (this.historyView.container.visible) {
        this._showEditor();
        return;
      }

      this._showHistory();
    }

    _showEditor() {
      this.headerTitle.text = "Drafts";
      this.headerModeButton.set_child(
        new St.Icon({
          icon_name: "view-list-symbolic",
          icon_size: 16,
        })
      );
      this.headerModeButton.accessible_name = "Open history";
      this.headerSaveButton.visible = true;
      this.historyView.container.visible = false;
      this.editorView.visible = true;
      this.toolbar.visible = true;
      this._hideConfirmBar();
      this.historyView.resetSearch();
      this._queueFocus();
    }

    _showHistory() {
      this._archiveCurrentDraft();
      this.headerTitle.text = "Historico";
      this.headerModeButton.set_child(
        new St.Icon({
          icon_name: "go-previous-symbolic",
          icon_size: 16,
        })
      );
      this.headerModeButton.accessible_name = "Back to editor";
      this.headerSaveButton.visible = false;
      this.editorView.visible = false;
      this.historyView.container.visible = true;
      this.toolbar.visible = false;
      this._hideConfirmBar();
      this._refreshHistory();
      this.historyView.focusSearch();
    }

    _refreshHistory() {
      if (!this._historyDirty) {
        return;
      }

      this._state = this._storage.loadState();
      this.historyView.render(this._state.notes);
      this._historyDirty = false;
    }

    _trimHistory(maxHistory) {
      if (this._state.notes.length <= maxHistory) {
        return;
      }

      this._state = this._storage.trimHistory(maxHistory);
      this._historyDirty = true;
      if (this.historyView.container.visible) {
        this._refreshHistory();
      }
    }

    _scheduleAutosave() {
      if (this._autosaveTimeoutId) {
        GLib.source_remove(this._autosaveTimeoutId);
      }

      this._autosaveTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        AUTOSAVE_DELAY_MS,
        () => {
          this._autosaveTimeoutId = 0;
          this._state = this._storage.saveDraft(this.entry.text);
          return GLib.SOURCE_REMOVE;
        }
      );
    }

    _queueFocus() {
      if (this.historyView.container.visible) {
        return;
      }

      if (this._focusTimeoutId) {
        GLib.source_remove(this._focusTimeoutId);
      }

      this._focusTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 40, () => {
        global.stage.set_key_focus(this.entry);
        this._focusTimeoutId = 0;
        return GLib.SOURCE_REMOVE;
      });
    }

    _showSnackbar(message) {
      if (this._snackbarTimeoutId) {
        GLib.source_remove(this._snackbarTimeoutId);
        this._snackbarTimeoutId = 0;
      }

      this.snackbar.text = message;
      this.snackbar.visible = true;
      this.snackbar.opacity = 255;

      this._snackbarTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1200, () => {
        this.snackbar.visible = false;
        this.snackbar.opacity = 0;
        this._snackbarTimeoutId = 0;
        return GLib.SOURCE_REMOVE;
      });
    }

    _createHeaderIconButton(iconName, accessibleName, callback) {
      const button = new St.Button({
        style_class: "drafts-header-icon-btn",
        can_focus: true,
        reactive: true,
      });
      button.accessible_name = accessibleName;
      button.set_child(
        new St.Icon({
          icon_name: iconName,
          icon_size: 16,
        })
      );
      button.connect("clicked", callback);
      return button;
    }

    _createIconButton(iconName, accessibleName, callback) {
      const button = new St.Button({
        style_class: "drafts-toolbar-btn",
        can_focus: true,
        reactive: true,
      });
      button.accessible_name = accessibleName;
      button.set_child(
        new St.Icon({
          icon_name: iconName,
          icon_size: 16,
        })
      );
      button.connect("clicked", callback);
      return button;
    }

    destroy() {
      if (this._autosaveTimeoutId) {
        GLib.source_remove(this._autosaveTimeoutId);
        this._autosaveTimeoutId = 0;
      }

      if (this._focusTimeoutId) {
        GLib.source_remove(this._focusTimeoutId);
        this._focusTimeoutId = 0;
      }

      if (this._snackbarTimeoutId) {
        GLib.source_remove(this._snackbarTimeoutId);
        this._snackbarTimeoutId = 0;
      }

      this._archiveCurrentDraft();
      this._state = this._storage.saveDraft(this.entry.text);

      for (const signalId of this._signals) {
        this._settings.disconnect(signalId);
      }
      this._signals = [];

      super.destroy();
    }
  }
);
