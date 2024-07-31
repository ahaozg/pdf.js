import { getPdfFilenameFromUrl } from "pdfjs-lib";
import { AnnotationEditorPrefix } from "../../shared/util.js";
import { HighlightEditor } from "./highlight.js";

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
    params.color = editor.getColor();
    params.opacity = editor.getOpacity();
    params.thickness = editor.getThickness();
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
    const oldMode = this.#uiManager.getMode();
    let lastValidParams = null;
    for (const [id, { editorParams }] of params) {
      // 两种情况下渲染
      // 一种是 没有传入 layerIndex 按照当前加载的页来渲染
      // 一种是传入了layerIndex，那么就只渲染传入的layerIndex
      if (
        (!layerIndex || editorParams.pageIndex === layerIndex) &&
        editorParams.hidden !== true
      ) {
        lastValidParams = this.show(id) || lastValidParams;
      }
    }
    // 设置layer的可见状态
    if (lastValidParams) {
      this.#uiManager.updateToolbar(lastValidParams.mode);
      this.#uiManager.updateToolbar(oldMode);
    }
    // const id = this.#uiManager.waitToSelect;
    // let editor = null;
    // if (!id || (editor = this.#uiManager.getEditor(id)) === null) {
    //   return;
    // }
    // this.#uiManager.setSelected(editor);
    this.#editorManager._eventBus.dispatch(
      "annotationeditormanagerrenderlayer",
      {
        source: this,
        pageIndex: layerIndex,
      }
    );
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
    return this.doShow(id);
  }

  doShow(id) {
    const { editorParams } = this.#editorManager.getDataMap().get(id);
    const pageIndex = editorParams.pageIndex;
    const layer = this.#uiManager.getLayer(pageIndex);

    if (!layer) {
      return;
    }

    const params = Object.assign({}, editorParams);
    // params.fromCommand = true;
    params.uiManager = this.#uiManager;
    params.parent = layer;

    let editor = null;

    switch (params.name) {
      case "highlightEditor":
        editor = new HighlightEditor(params);
        layer.add(editor);
        break;
    }

    return params;
  }
}

class AnnotationEditorManager {
  #abortController = new AbortController();

  #uiManager = null;

  #editorParamsConverter = new EditorParamsConverter();

  #editorDisplayController = null;

  #boundOnAnnotationEditorUiManager =
    this.onAnnotationEditorUiManager.bind(this);

  #boundOnAnnotationEditorLayerRendered =
    this.onAnnotationEditorLayerRendered.bind(this);

  #dataMap = new Map();

  constructor({ eventBus }) {
    this._signal = this.#abortController.signal;
    this._eventBus = eventBus;
    this._eventBus._on(
      "annotationeditoruimanager",
      this.#boundOnAnnotationEditorUiManager
    );
    this._eventBus._on(
      "annotationeditorlayerrendered",
      this.#boundOnAnnotationEditorLayerRendered
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
    this._eventBus._off(
      "annotationeditorlayerrendered",
      this.#boundOnAnnotationEditorLayerRendered
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

  onAnnotationEditorLayerRendered({ pageNumber }) {
    this.#editorDisplayController.renderPreparedLayerAnnotations(
      this.#dataMap,
      pageNumber - 1
    );
  }

  initEditorParameters(params) {
    if (!params || params.length === 0) {
      return;
    }

    for (const param of params) {
      if (!param.annoId) {
        continue;
      }
      const editorId = param.annoId;
      this.#dataMap.set(editorId, param);
    }
    this.#editorDisplayController.renderPreparedLayerAnnotations(this.#dataMap);
    this.handleDataMapChange("init");
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
    if (params) {
      this.#dataMap.set(params.id, {
        annoId: params.id,
        editorParams: params,
        comment: [],
        creator: { name: "匿名" },
        createTime: Date.now(),
      });
      this.updateStore("add", this.#dataMap.get(params.id));
    }
  }

  onEditorEditComplete(editor) {
    console.log("data-onEditorEditComplete", editor);
    const params = this.#editorParamsConverter.convertToParams(editor);
    if (params) {
      const target = this.#dataMap.get(params.id);
      target.editorParams = params;
      this.updateStore("edit", target);
    }
  }

  onEditorDeleteComplete(editor) {
    console.log("data-onEditorDeleteComplete", editor);
    const params = this.#editorParamsConverter.convertToParams(editor);
    if (params) {
      const target = this.#dataMap.get(params.id);
      this.#dataMap.delete(params.id);
      this.updateStore("delete", target);
    }
  }

  getEditorParamsList() {
    const data = [];
    for (const [, params] of this.#dataMap) {
      data.push(params);
    }
    return data;
  }

  updateStore(type, params) {
    const data = this.getEditorParamsList();
    setAnnotationData(data);
    this.handleDataMapChange(type, params);
  }

  handleDataMapChange(type, data = this.getEditorParamsList()) {
    this._eventBus.dispatch("annotationeditormanagetdatachange", {
      source: this,
      type,
      data,
    });
  }
}

export { AnnotationEditorManager };
