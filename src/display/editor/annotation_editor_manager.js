import { getPdfFilenameFromUrl } from "pdfjs-lib";
import { AnnotationEditorPrefix } from "../../shared/util.js";

const storageKey = getPdfFilenameFromUrl(window.location.href);
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
  return (
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID() +
    getRandomForUUID()
  );
}

const virtualIdPrefix = "virtualId-";

class EditorParamsConverter {
  convertToParams(editor) {
    const name = editor.name;
    switch (name) {
      case "highlightEditor":
        return this.fromHighlight(editor);
      default:
        return null;
    }
  }

  fromHighlight(editor) {
    const params = this.fromCommon(editor);
    params.text = editor.getText();
    params.mode = editor.getMode();
    params.methodOfCreation = editor.getMethodOfCreation();
    params.boxes = this.cloneBoxes(editor.getBoxes());
    return params;
  }

  fromCommon(editor) {
    const params = {};
    params.pageIndex = editor.pageIndex;
    params.id = editor.id;
    params.x = editor.x;
    params.y = editor.y;
    params.width = editor.width;
    params.height = editor.height;
    params.isCentered = editor._initialOptions?.isCentered;
    params.name = editor.name;
    return params;
  }

  cloneBoxes(boxes) {
    if (!boxes) {
      return [];
    }
    const ret = [];
    for (const p of boxes) {
      ret.push({
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
      });
    }
    return ret;
  }
}

class EditorDisplayController {
  #uiManager = null;

  #editorManager = null;

  constructor({ uiManager, editorManager }) {
    this.#uiManager = uiManager;
    this.#editorManager = editorManager;
  }

  isInUIManager(id) {
    return !!this.#uiManager.getEditor(id);
  }

  isInParamMap(id) {
    const params = this.#editorManager.getDataMap().get(id);
    return !!params;
  }

  renderPreparedLayerAnnotations(params, layerIndex) {
    for (const [id, editorParams] of params) {
      // 两种情况下渲染
      // 一种是 没有传入 layerIndex 按照当前加载的页来渲染
      // 一种是传入了layerIndex，那么就只渲染传入的layerIndex
      if (
        (!layerIndex || editorParams.pageIndex === layerIndex) &&
        editorParams.hidden !== true
      ) {
        this.show(id);
      }
    }
    // const id = this.#uiManager.waitToSelect;
    // let editor = null;
    // if (!id || (editor = this.#uiManager.getEditor(id)) === null) {
    //   return;
    // }
    // this.#uiManager.setSelected(editor);
  }

  show(id) {
    // 已经展示了就不展示
    if (this.isInUIManager(id)) {
      return;
    }
    // 如果没有参数 也不展示
    if (!this.isInParamMap(id)) {
      return;
    }
    this.doShow(id);
  }

  doShow(id) {}
}

class AnnotationEditorManager {
  #abortController = new AbortController();

  #uiManager = null;

  #editorParamsConverter = new EditorParamsConverter();

  #editorDisplayController = null;

  #boundOnAnnotationEditorUiManager =
    this.onAnnotationEditorUiManager.bind(this);

  #dataMap = new Map();

  constructor({ eventBus }) {
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

  getDataMap() {
    return this.#dataMap;
  }

  onAnnotationEditorUiManager({ uiManager }) {
    this.#editorDisplayController = new EditorDisplayController({
      uiManager,
      editorManager: this,
    });
    this.#uiManager = uiManager;
    this.#uiManager.onEditorAddComplete = this.onEditorAddComplete.bind(this);
    this.#uiManager.onEditorEditComplete = this.onEditorEditComplete.bind(this);
    this.#uiManager.onEditorDeleteComplete =
      this.onEditorDeleteComplete.bind(this);
    this.initEditorParameters(getInitAnnotation());
  }

  initEditorParameters(params) {
    if (!params || params.length === 0) {
      return;
    }

    let maxId = -1;
    for (const param of params) {
      if (!param.id) {
        continue;
      }
      const editorId = param.id;
      this.#dataMap.set(editorId, param);
      const number = parseInt(editorId.replace(AnnotationEditorPrefix, ""));
      if (isNaN(number)) {
        continue;
      }
      if (number > maxId) {
        maxId = number;
      }
    }
    this.#uiManager.setId(maxId + 1);
    this.#editorDisplayController.renderPreparedLayerAnnotations(this.#dataMap);
  }

  isVirtualId(id) {
    return String(id).startsWith(virtualIdPrefix);
  }

  getVirtualId() {
    return virtualIdPrefix + getUUID();
  }

  onEditorAddComplete(editor) {
    console.log("data-onEditorAddComplete", editor);
    const params = this.#editorParamsConverter.convertToParams(editor);
    this.#dataMap.set(params.id, params);
    this.updateStore();
  }

  onEditorEditComplete(editor) {
    console.log("data-onEditorEditComplete", editor);
    const params = this.#editorParamsConverter.convertToParams(editor);
    this.#dataMap.set(params.id, params);
    this.updateStore();
  }

  onEditorDeleteComplete(editor) {
    console.log("data-onEditorDeleteComplete", editor);
    const params = this.#editorParamsConverter.convertToParams(editor);
    this.#dataMap.delete(params.id);
    this.updateStore();
  }

  updateStore() {
    const data = [];
    for (const [, editorParams] of this.#dataMap) {
      data.push(editorParams);
    }
    setAnnotationData(data);
  }
}

export { AnnotationEditorManager };
