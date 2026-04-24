import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";

import { DraftsIndicator } from "./ui/main.js";

export default class DraftsExtension extends Extension {
  enable() {
    this._indicator = new DraftsIndicator(this);
    Main.panel.addToStatusArea(this.uuid, this._indicator);
  }

  disable() {
    if (!this._indicator) {
      return;
    }

    this._indicator.destroy();
    this._indicator = null;
  }
}
