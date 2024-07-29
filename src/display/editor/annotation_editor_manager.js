import {getPdfFilenameFromUrl} from "pdfjs-lib";
import {AnnotationEditorPrefix} from "../../shared/util.js";

let storageKey = getPdfFilenameFromUrl(window.location.href);
function getInitAnnotation() {
  const result = window.localStorage.getItem(storageKey);
  return result ? JSON.parse(result) : null;
}

function setAnnotationData(data = []) {
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

function getRandomForUUID() {
  // eslint-disable-next-line no-magic-numbers
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function getUUID() {
  return (getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID() +
      getRandomForUUID());
}

const virtualIdPrefix = "virtualId-";

class AnnotationEditorManager {
  #abortController = new AbortController();

  #uiManager = null;

  #boundOnAnnotationEditorUiManager = this.onAnnotationEditorUiManager.bind(this);

  #dataMap = new Map();

  constructor({
    eventBus,
  }) {
    this._signal = this.#abortController.signal;
    this._eventBus = eventBus;
    this._eventBus._on(
        "annotationeditoruimanager",
        this.#boundOnAnnotationEditorUiManager
    );
  }

  destroy() {
    this.#abortController?.abort();
    this.#abortController = null;
    this._signal = null;

    this._eventBus._off(
        "annotationeditoruimanager",
        this.#boundOnAnnotationEditorUiManager
    );
  }

  onAnnotationEditorUiManager({uiManager}) {
    this.#uiManager = uiManager;
    this.#uiManager.onEditorAddComplete = this.onEditorAddComplete.bind(this);
    this.#uiManager.onEditorEditComplete = this.onEditorEditComplete.bind(this);
    this.#uiManager.onEditorDeleteComplete = this.onEditorDeleteComplete.bind(this);
    this.initEditorParameters(getInitAnnotation());
  }

  initEditorParameters(params) {
    if (!params || params.length === 0) {
      return;
    }

    let maxId = -1;
    for (const param of params) {
      if (!param.id || !param.editor || !param.editor.id) {
        continue;
      }
      const editorId = param.editor.id;
      this.#dataMap.set(editorId, param);
      let number = parseInt(editorId.replace(AnnotationEditorPrefix, ""));
      if (isNaN(number)) {
        continue;
      }
      if (number > maxId) {
        maxId = number;
      }
    }
    this.#uiManager.setId(maxId + 1);
  }

  isVirtualId(id) {
    return String(id).startsWith(virtualIdPrefix);
  }

  getVirtualId() {
    return virtualIdPrefix + getUUID();
  }

  onEditorAddComplete(editor) {
    console.log('data-onEditorAddComplete', editor);
  }

  onEditorEditComplete(editor) {
    console.log('data-onEditorEditComplete', editor);
  }

  onEditorDeleteComplete(editor) {
    console.log('data-onEditorDeleteComplete', editor);
  }
}

export { AnnotationEditorManager };
