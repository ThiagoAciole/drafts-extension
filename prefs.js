import Adw from "gi://Adw";
import Gio from "gi://Gio";
import Gtk from "gi://Gtk";

import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import {
  CONFIRM_CLEAR_KEY,
  FONT_SIZE_KEY,
  MAX_HISTORY_KEY,
  SETTINGS_SCHEMA,
} from "./services/settings.js";

export default class DraftsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings(SETTINGS_SCHEMA);

    window.set_default_size(560, 420);

    const editorPage = new Adw.PreferencesPage({
      title: "Drafts",
      icon_name: "accessories-text-editor-symbolic",
    });

    const editorGroup = new Adw.PreferencesGroup({
      title: "Editor",
      description: "Personalize o comportamento do editor e os limites de persistencia.",
    });

    const fontSizeRow = new Adw.ActionRow({
      title: "Tamanho da fonte",
      subtitle: "Usado pelo editor no popup do painel.",
    });

    const fontSizeAdjustment = new Gtk.Adjustment({
      lower: 10,
      upper: 28,
      step_increment: 1,
      page_increment: 2,
      value: settings.get_int(FONT_SIZE_KEY),
    });
    const fontSizeSpin = new Gtk.SpinButton({
      adjustment: fontSizeAdjustment,
      climb_rate: 1,
      numeric: true,
      valign: Gtk.Align.CENTER,
    });
    settings.bind(FONT_SIZE_KEY, fontSizeSpin, "value", Gio.SettingsBindFlags.DEFAULT);
    fontSizeRow.add_suffix(fontSizeSpin);
    fontSizeRow.activatable_widget = fontSizeSpin;

    const confirmClearRow = new Adw.ActionRow({
      title: "Confirmar antes de limpar",
      subtitle: "Exibe uma barra de confirmacao antes de apagar o rascunho atual.",
    });
    const confirmClearSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
    });
    settings.bind(
      CONFIRM_CLEAR_KEY,
      confirmClearSwitch,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );
    confirmClearRow.add_suffix(confirmClearSwitch);
    confirmClearRow.activatable_widget = confirmClearSwitch;

    const maxHistoryRow = new Adw.ActionRow({
      title: "Limite do historico",
      subtitle: "Quantidade maxima de anotacoes salvas mantidas no historico.",
    });
    const maxHistoryAdjustment = new Gtk.Adjustment({
      lower: 5,
      upper: 100,
      step_increment: 1,
      page_increment: 5,
      value: settings.get_int(MAX_HISTORY_KEY),
    });
    const maxHistorySpin = new Gtk.SpinButton({
      adjustment: maxHistoryAdjustment,
      climb_rate: 1,
      numeric: true,
      valign: Gtk.Align.CENTER,
    });
    settings.bind(
      MAX_HISTORY_KEY,
      maxHistorySpin,
      "value",
      Gio.SettingsBindFlags.DEFAULT
    );
    maxHistoryRow.add_suffix(maxHistorySpin);
    maxHistoryRow.activatable_widget = maxHistorySpin;

    editorGroup.add(fontSizeRow);
    editorGroup.add(confirmClearRow);
    editorGroup.add(maxHistoryRow);
    editorPage.add(editorGroup);

    const storageGroup = new Adw.PreferencesGroup({
      title: "Armazenamento",
      description:
        "O Drafts salva seus dados no diretorio de configuracao do sistema em ~/.config/drafts@thiago.aciole/",
    });
    storageGroup.add(
      new Adw.ActionRow({
        title: "Rascunho atual",
        subtitle: "Salvo automaticamente apos edicoes, com um pequeno debounce para evitar escritas excessivas.",
      })
    );
    storageGroup.add(
      new Adw.ActionRow({
        title: "Anotacoes salvas",
        subtitle: "Criadas manualmente pelo botao de salvar e acessiveis pela tela de historico.",
      })
    );
    editorPage.add(storageGroup);

    window.add(editorPage);
  }
}
