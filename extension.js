import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Pango from "gi://Pango";

const DraftsButton = GObject.registerClass(
  class DraftsButton extends PanelMenu.Button {
    _init(extension) {
      super._init(0.0, "Drafts");
      this._extension = extension;
      this._fontSize = 11;
      this._timeoutId = 0;
      this._saveTimeoutId = null;

      this._cacheFile = GLib.build_filenamev([
        GLib.get_user_cache_dir(),
        "drafts_data.txt",
      ]);

      let icon = new St.Icon({
        icon_name: "accessories-text-editor-symbolic",
        style_class: "system-status-icon",
      });
      this.add_child(icon);

      this.mainBox = new St.BoxLayout({
        vertical: true,
        style_class: "drafts-popup-content",
      });

      this.headerBox = new St.BoxLayout({
        vertical: false,
        style_class: "drafts-header",
        x_expand: true,
      });

      let title = new St.Label({
        text: "Drafts",
        y_align: Clutter.ActorAlign.CENTER,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style_class: "drafts-title",
      });

      this.headerBox.add_child(title);
      this.mainBox.add_child(this.headerBox);

      this.scrollView = new St.ScrollView({
        hscrollbar_policy: St.PolicyType.NEVER,
        vscrollbar_policy: St.PolicyType.AUTOMATIC,
        style_class: "drafts-scrollview",
        overlay_scrollbars: true,
        reactive: true,
      });

      this.textContainer = new St.BoxLayout({
        vertical: true,
        x_expand: true,
        y_expand: true,
        reactive: true,
        style_class: "drafts-text-container",
      });

      this.textContainer.connect("button-press-event", () => {
        global.stage.set_key_focus(this.entry);
        return Clutter.EVENT_STOP;
      });

      // --- CORREÇÃO AQUI: Removida a propriedade style_class ---
      this.entry = new Clutter.Text({
        line_alignment: Pango.Alignment.LEFT,
        margin_left: 5,
        margin_right: 5,
        activatable: false,
        selectable: true,
        editable: true,
        single_line_mode: false,
        reactive: true,
        x_expand: true,
        y_expand: true,
        // style_class: 'drafts-text-entry' <--- REMOVIDO PARA EVITAR O ERRO
      });

      this._updateFont();

      // --- Cores Restauradas via JS ---
      let white = new Clutter.Color({
        red: 255,
        green: 255,
        blue: 255,
        alpha: 255,
      });
      let purple = new Clutter.Color({
        red: 155,
        green: 89,
        blue: 182,
        alpha: 255,
      });

      this.entry.set_color(white);
      this.entry.set_cursor_color(white);
      this.entry.set_selection_color(purple);
      this.entry.set_selected_text_color(white);

      this.entry.set_line_wrap(true);
      this.entry.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

      this.entry.connect("key-press-event", (actor, event) => {
        let symbol = event.get_key_symbol();
        let state = event.get_state();
        let ctrl = state & Clutter.ModifierType.CONTROL_MASK;

        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
          let pos = this.entry.get_cursor_position();
          this.entry.insert_text("\n", pos);
          return Clutter.EVENT_STOP;
        }

        if (ctrl) {
          if (symbol === Clutter.KEY_c) {
            let selection = this.entry.get_selection();
            if (selection) {
              St.Clipboard.get_default().set_text(
                St.ClipboardType.CLIPBOARD,
                selection
              );
              return Clutter.EVENT_STOP;
            }
          } else if (symbol === Clutter.KEY_v) {
            St.Clipboard.get_default().get_text(
              St.ClipboardType.CLIPBOARD,
              (clip, text) => {
                if (text) {
                  this.entry.delete_selection();
                  let pos = this.entry.get_cursor_position();
                  this.entry.insert_text(text, pos);
                }
              }
            );
            return Clutter.EVENT_STOP;
          }
        }
        return Clutter.EVENT_PROPAGATE;
      });

      this.textContainer.add_child(this.entry);
      this.scrollView.set_child(this.textContainer);
      this.mainBox.add_child(this.scrollView);

      this.toolbar = new St.BoxLayout({
        vertical: false,
        style_class: "drafts-toolbar",
        x_expand: true,
      });

      this._addToolBtn("list-add-symbolic", () => {
        this._fontSize++;
        this._updateFont();
      });

      this._addToolBtn("list-remove-symbolic", () => {
        if (this._fontSize > 6) {
          this._fontSize--;
          this._updateFont();
        }
      });

      let spacer = new St.Widget({ x_expand: true });
      this.toolbar.add_child(spacer);

      this.btnPaste = this._createButton("edit-paste-symbolic");
      this.btnPaste.connect("clicked", () => {
        St.Clipboard.get_default().get_text(
          St.ClipboardType.CLIPBOARD,
          (clip, text) => {
            if (text) {
              this.entry.delete_selection();
              let pos = this.entry.get_cursor_position();
              this.entry.insert_text(text, pos);
              this._scheduleSave();
            }
          }
        );
      });
      this.toolbar.add_child(this.btnPaste);

      this.btnCopy = this._createButton("edit-copy-symbolic");
      this.btnCopy.connect("clicked", () => {
        let textToCopy = this.entry.get_selection();
        if (!textToCopy) textToCopy = this.entry.text;
        St.Clipboard.get_default().set_text(
          St.ClipboardType.CLIPBOARD,
          textToCopy
        );
      });
      this.toolbar.add_child(this.btnCopy);

      this.btnClear = this._createButton("user-trash-symbolic");
      this.btnClear.connect("clicked", () => {
        this.entry.text = "";
        this._scheduleSave();
      });
      this.toolbar.add_child(this.btnClear);

      this.mainBox.add_child(this.toolbar);
      this.menu.box.add_child(this.mainBox);

      this._loadText();

      this.entry.connect("text-changed", () => this._scheduleSave());

      this.menu.connect("open-state-changed", (menu, open) => {
        if (open) {
          if (this._timeoutId) {
            GLib.source_remove(this._timeoutId);
          }
          this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
            global.stage.set_key_focus(this.entry);
            this._timeoutId = 0;
            return GLib.SOURCE_REMOVE;
          });
        }
      });
    }

    _updateFont() {
      this.entry.font_name = `Sans ${this._fontSize}`;
    }

    _createButton(iconName) {
      let btn = new St.Button({
        style_class: "drafts-toolbar-btn button",
        can_focus: true,
        reactive: true,
      });
      let icon = new St.Icon({ icon_name: iconName, icon_size: 16 });
      btn.set_child(icon);
      return btn;
    }

    _addToolBtn(iconName, callback) {
      let btn = this._createButton(iconName);
      btn.connect("clicked", callback);
      this.toolbar.add_child(btn);
    }

    _scheduleSave() {
      if (this._saveTimeoutId) {
        GLib.source_remove(this._saveTimeoutId);
      }

      this._saveTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        1000,
        () => {
          this._saveText();
          this._saveTimeoutId = null;
          return GLib.SOURCE_REMOVE;
        }
      );
    }

    _saveText() {
      try {
        GLib.file_set_contents(this._cacheFile, this.entry.text);
      } catch (e) {
        console.error("Drafts: Error saving text", e);
      }
    }

    _loadText() {
      try {
        if (GLib.file_test(this._cacheFile, GLib.FileTest.EXISTS)) {
          let [success, content] = GLib.file_get_contents(this._cacheFile);
          if (success) {
            this.entry.text = new TextDecoder().decode(content);
          }
        }
      } catch (e) {
        console.error("Drafts: Error loading text", e);
      }
    }

    destroy() {
      if (this._saveTimeoutId) {
        GLib.source_remove(this._saveTimeoutId);
        this._saveText();
        this._saveTimeoutId = null;
      }

      if (this._timeoutId) {
        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;
      }
      super.destroy();
    }
  }
);

export default class DraftsExtension extends Extension {
  enable() {
    this._indicator = new DraftsButton(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (this._indicator) {
      this._indicator.destroy();
      this._indicator = null;
    }
  }
}
