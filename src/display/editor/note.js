// eslint-disable-next-line max-len
/** @typedef {import("./annotation_editor_layer.js").AnnotationEditorLayer} AnnotationEditorLayer */

import { AnnotationEditorType, shadow } from "../../shared/util.js";
import {
  AnnotationEditorUIManager,
  bindEvents,
  KeyboardManager,
} from "./tools.js";
import { AnnotationEditor } from "./editor.js";

/**
 * Basic text editor in order to create a FreeTex annotation.
 */
class NoteEditor extends AnnotationEditor {
  #editorDivId = `${this.id}-editor`;

  static get _keyboardManager() {
    const proto = NoteEditor.prototype;

    const arrowChecker = self => self.isEmpty();

    const small = AnnotationEditorUIManager.TRANSLATE_SMALL;
    const big = AnnotationEditorUIManager.TRANSLATE_BIG;

    return shadow(
      this,
      "_keyboardManager",
      new KeyboardManager([
        [
          // Commit the text in case the user use ctrl+s to save the document.
          // The event must bubble in order to be caught by the viewer.
          // See bug 1831574.
          ["ctrl+s", "mac+meta+s", "ctrl+p", "mac+meta+p"],
          proto.commitOrRemove,
          { bubbles: true },
        ],
        [
          ["ctrl+Enter", "mac+meta+Enter", "Escape", "mac+Escape"],
          proto.commitOrRemove,
        ],
        [
          ["ArrowLeft", "mac+ArrowLeft"],
          proto._translateEmpty,
          { args: [-small, 0], checker: arrowChecker },
        ],
        [
          ["ctrl+ArrowLeft", "mac+shift+ArrowLeft"],
          proto._translateEmpty,
          { args: [-big, 0], checker: arrowChecker },
        ],
        [
          ["ArrowRight", "mac+ArrowRight"],
          proto._translateEmpty,
          { args: [small, 0], checker: arrowChecker },
        ],
        [
          ["ctrl+ArrowRight", "mac+shift+ArrowRight"],
          proto._translateEmpty,
          { args: [big, 0], checker: arrowChecker },
        ],
        [
          ["ArrowUp", "mac+ArrowUp"],
          proto._translateEmpty,
          { args: [0, -small], checker: arrowChecker },
        ],
        [
          ["ctrl+ArrowUp", "mac+shift+ArrowUp"],
          proto._translateEmpty,
          { args: [0, -big], checker: arrowChecker },
        ],
        [
          ["ArrowDown", "mac+ArrowDown"],
          proto._translateEmpty,
          { args: [0, small], checker: arrowChecker },
        ],
        [
          ["ctrl+ArrowDown", "mac+shift+ArrowDown"],
          proto._translateEmpty,
          { args: [0, big], checker: arrowChecker },
        ],
      ])
    );
  }

  static _type = "note";

  static _editorType = AnnotationEditorType.NOTE;

  constructor(params) {
    super({ ...params, name: "noteEditor" });
    this.content = params.content || "";
    this._isDraggable = true;
  }

  /** @inheritdoc */
  static initialize(l10n, uiManager) {
    AnnotationEditor.initialize(l10n, uiManager);
  }

  getMode() {
    return NoteEditor._editorType;
  }

  /**
   * Helper to translate the editor with the keyboard when it's empty.
   * @param {number} x in page units.
   * @param {number} y in page units.
   */
  _translateEmpty(x, y) {
    this._uiManager.translateSelectedEditors(x, y, /* noCommit = */ true);
  }

  /** @inheritdoc */
  rebuild() {
    if (!this.parent) {
      return;
    }
    super.rebuild();
    if (this.div === null) {
      return;
    }

    if (!this.isAttachedToDOM) {
      // At some point this editor was removed and we're rebuilting it,
      // hence we must add it to its parent.
      this.parent.add(this);
    }
  }

  /** @inheritdoc */
  enableEditMode() {
    if (this.isInEditMode()) {
      return;
    }

    this.parent?.setEditingState(false);
    this.parent?.updateToolbar(AnnotationEditorType.NOTE);
    super.enableEditMode();
  }

  /** @inheritdoc */
  disableEditMode() {
    if (!this.isInEditMode()) {
      return;
    }

    this.parent?.setEditingState(true);
    super.disableEditMode();

    // In case the blur callback hasn't been called.
    this.isEditing = false;
    this.parent?.div.classList.add("noteEditing");
  }

  /** @inheritdoc */
  focusin(event) {
    if (!this._focusEventsAllowed) {
      return;
    }
    super.focusin(event);
    if (event.target !== this.editorDiv) {
      this.editorDiv.focus();
    }
  }

  /** @inheritdoc */
  onceAdded() {
    this.enableEditMode();
    this.div.focus();

    if (!this._uiManager.getInitStatus()) {
      this._uiManager._eventBus.dispatch("switchannotationeditormode", {
        source: this,
        mode: AnnotationEditorType.NONE,
      });

      this._uiManager._eventBus.dispatch("pdfsidebarannotationopenstate", {
        source: this,
        toOpen: true,
      });

      this._uiManager._eventBus.dispatch("annotationviewerpositionbyid", {
        source: this,
        id: this.id,
        pageIndex: this.pageIndex,
      });
    }
  }

  /** @inheritdoc */
  isEmpty() {
    return false;
  }

  /** @inheritdoc */
  remove() {
    this.isEditing = false;
    if (this.parent) {
      this.parent.setEditingState(true);
      this.parent.div.classList.add("noteEditing");
    }
    super.remove();
  }

  /**
   * Commit the content we have in this editor.
   * @returns {undefined}
   */
  commit() {
    if (!this.isInEditMode()) {
      return;
    }

    super.commit();
    this.disableEditMode();
    // const savedText = this.#content;
    // const newText = (this.#content = this.#extractText().trimEnd());
    // if (savedText === newText) {
    //   return;
    // }
    //
    // const setText = text => {
    //   this.#content = text;
    //   if (!text) {
    //     this.remove();
    //     return;
    //   }
    //   this.#setContent();
    //   this._uiManager.rebuild(this);
    //   this.#setEditorDimensions();
    // };
    // this.addCommands({
    //   cmd: () => {
    //     setText(newText);
    //   },
    //   undo: () => {
    //     setText(savedText);
    //   },
    //   mustExec: false,
    // });
    // this.#setEditorDimensions();
  }

  /** @inheritdoc */
  shouldGetKeyboardEvents() {
    return this.isInEditMode();
  }

  /** @inheritdoc */
  enterInEditMode() {
    this.enableEditMode();
    // this.editorDiv.focus();
  }

  /**
   * click callback.
   * @param {MouseEvent} event
   */
  click(event) {
    // this.enterInEditMode();
  }

  /** @inheritdoc */
  render() {
    if (this.div) {
      return this.div;
    }

    super.render();
    this.editorDiv = document.createElement("div");
    this.editorDiv.className = "internal";

    this.editorDiv.setAttribute("id", this.#editorDivId);
    this.editorDiv.setAttribute("data-l10n-id", "pdfjs-free-text");

    const div = document.createElement("div");
    div.className = "annotation-note";
    this.editorDiv.append(div);

    this.div.append(this.editorDiv);

    bindEvents(this, this.div, ["click"]);

    return this.div;
  }

  updateContent({ inputType, value } = {}) {
    if (inputType === "confirm") {
      this.content = value;
      if (this._uiManager.onEditorEditComplete) {
        this._uiManager.onEditorEditComplete(this);
      }
    } else if (inputType === "cancel" && !this.content) {
      this.remove();
    }
  }

  /** @inheritdoc */
  get contentDiv() {
    return this.editorDiv;
  }

  /** @inheritdoc */
  static deserialize(data, parent, uiManager) {
    const editor = super.deserialize(data, parent, uiManager);
    editor.annotationElementId = data.id || null;

    return editor;
  }

  /** @inheritdoc */
  serialize(isForCopying = false) {
    if (this.isEmpty()) {
      return null;
    }

    if (this.deleted) {
      return {
        pageIndex: this.pageIndex,
        id: this.annotationElementId,
        deleted: true,
      };
    }

    const serialized = {
      annotationType: AnnotationEditorType.NOTE,
      pageIndex: this.pageIndex,
      rotation: this.rotation,
      structTreeParentId: this._structTreeParentId,
    };

    if (isForCopying) {
      // Don't add the id when copying because the pasted editor mustn't be
      // linked to an existing annotation.
      return serialized;
    }

    if (this.annotationElementId) {
      return null;
    }

    serialized.id = this.annotationElementId;

    return serialized;
  }
}

export { NoteEditor };
