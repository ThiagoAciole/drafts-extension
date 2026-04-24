import Clutter from "gi://Clutter";
import St from "gi://St";

import { formatTimestamp } from "../utils/date.js";

export class DraftsHistoryView {
  constructor({ onOpen }) {
    this._onOpen = onOpen;
    this._notes = [];

    this.container = new St.BoxLayout({
      vertical: true,
      style_class: "drafts-history-view",
      visible: false,
    });

    this.searchEntry = new St.Entry({
      style_class: "drafts-search-entry",
      hint_text: "Pesquisar",
      can_focus: true,
      x_expand: true,
    });
    this.searchText = this.searchEntry.get_clutter_text();
    this.searchText.connect("text-changed", () => this._renderFiltered());
    this.container.add_child(this.searchEntry);

    this.list = new St.BoxLayout({
      vertical: true,
      style_class: "drafts-history-list",
      x_expand: true,
      y_expand: true,
    });

    this.scrollView = new St.ScrollView({
      style_class: "drafts-history-scrollview",
      hscrollbar_policy: St.PolicyType.NEVER,
      vscrollbar_policy: St.PolicyType.AUTOMATIC,
      overlay_scrollbars: true,
      x_expand: true,
      y_expand: true,
    });
    this.scrollView.set_child(this.list);

    this.container.add_child(this.scrollView);
  }

  render(notes) {
    this._notes = notes;
    this._renderFiltered();
  }

  focusSearch() {
    global.stage.set_key_focus(this.searchText);
  }

  resetSearch() {
    this.searchText.set_text("");
  }

  _renderFiltered() {
    this.list.destroy_all_children();
    const query = this.searchText.get_text().trim().toLowerCase();
    const notes = query
      ? this._notes.filter(
          (note) =>
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query)
        )
      : this._notes;

    if (!notes.length) {
      this.list.add_child(
        new St.Label({
          text: query ? "Nenhuma anotacao encontrada." : "Nenhuma anotacao salva ainda.",
          style_class: "drafts-empty-state",
        })
      );
      return;
    }

    for (const note of notes) {
      const button = new St.Button({
        style_class: "drafts-history-item",
        can_focus: true,
        x_expand: true,
      });

      const content = new St.BoxLayout({
        vertical: true,
        x_expand: true,
      });

      content.add_child(
        new St.Label({
          text: note.title,
          style_class: "drafts-history-item-title",
          x_expand: true,
        })
      );
      content.add_child(
        new St.Label({
          text: formatTimestamp(note.updatedAt),
          style_class: "drafts-history-item-date",
          x_expand: true,
        })
      );

      button.set_child(content);
      button.connect("clicked", () => this._onOpen(note.id));
      this.list.add_child(button);
    }
  }
}
