/** @typedef {import("./event_utils.js").EventBus} EventBus */
/** @typedef {import("./interfaces.js").IL10n} IL10n */

import { AnnotationEditorType } from "../src/shared/util.js";

/**
 * @typedef {Object} PDFAnnotationViewer
 * @property {PDFSidebarElements} elements - The DOM elements.
 * @property {EventBus} eventBus - The application event bus.
 * @property {IL10n} l10n - The localization service.
 */

class PDFAnnotationViewer {
  #abortController = new AbortController();

  #boundOnDocumentNumPages = this.onDocumentNumPages.bind(this);

  #boundOnAnnotationEditorManagerDataChange =
    this.onAnnotationEditorManagerDataChange.bind(this);

  #pages = new Map();

  constructor({ elements, eventBus }) {
    this.commentContainer = elements.commentContainer;
    this._signal = this.#abortController.signal;
    this._eventBus = eventBus;
    this._eventBus._on("documentnumpages", this.#boundOnDocumentNumPages);
    this._eventBus._on(
      "annotationeditormanagetdatachange",
      this.#boundOnAnnotationEditorManagerDataChange
    );
  }

  destroy() {
    this.#abortController?.abort();
    this.#abortController = null;
    this._signal = null;

    this._eventBus._off("documentnumpages", this.#boundOnDocumentNumPages);
    this._eventBus._off(
      "annotationeditormanagetdatachange",
      this.#boundOnAnnotationEditorManagerDataChange
    );
  }

  onDocumentNumPages(numPages) {
    this.commentContainer.innerHTML = "";
    for (let i = 1; i <= numPages; i++) {
      const div = document.createElement("div");
      div.className = "anno-comment-page";
      div.setAttribute("data-page-number", i);
      div.setAttribute("aria-label", `第 ${i} 页`);
      div.hidden = true;
      // const titleDiv = document.createElement("div");
      // titleDiv.className = "anno-comment-title";
      // titleDiv.innerText = `第 ${i} 页`;
      // div.append(titleDiv);
      this.commentContainer.append(div);
      this.#pages.set(i, {
        pageContainer: div,
        editors: [],
      });
    }
  }

  onAnnotationEditorManagerDataChange({ type, data }) {
    console.log("onAnnotationEditorManagerDataChange", type, data);
    switch (type) {
      case "init":
        this.handleInitData(data);
        break;
      case "add":
        this.addEditor(data);
        break;
      case "edit":
        this.editEditor(data);
        break;
      case "delete":
        this.deleteEditor(data);
        break;
    }
  }

  handleInitData(data) {
    if (Array.isArray(data)) {
      for (const editorParams of data) {
        this.addEditor(editorParams);
      }
    }
  }

  addEditor(editorParams) {
    const pageIndex = editorParams.pageIndex;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    targetPage.editors.push(
      new PDFAnnotationComment(targetPage.pageContainer, editorParams)
    );
  }

  editEditor(editorParams) {
    const pageIndex = editorParams.pageIndex;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    const editors = targetPage.editors || [];
    const target = editors.find(editor => editor.id === editorParams.id);
    if (target) {
      target.updateTitle(editorParams);
    }
  }

  deleteEditor(editorParams) {
    const pageIndex = editorParams.pageIndex;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    const targetIndex = targetPage.editors.findIndex(
      editor => editor.id === editorParams.id
    );
    if (targetIndex > -1) {
      targetPage.editors[targetIndex].destroy();
      targetPage.editors.splice(targetIndex, 1);
    }
  }
}

class PDFAnnotationComment {
  constructor(parentContainer, options) {
    this.parentContainer = parentContainer;
    const container = document.createElement("div");
    container.className = "comment-card";
    const main = document.createElement("div");
    main.className = "comment-card-main";
    const mainContent = document.createElement("div");
    mainContent.className = `comment-card-main-content type-${AnnotationEditorType[options.mode]}`;
    mainContent.append(this.renderMainContent(options));
    main.append(mainContent);
    container.append(main);
    parentContainer.append(container);
    this.mainContent = mainContent;
    this.container = container;
    parentContainer.hidden = false;
  }

  renderMainContent(options) {
    const span = document.createElement("span");
    span.className = "comment-title-wrap";
    span.style.color = options.color;
    span.style.textDecorationColor = options.color;
    switch (options.name) {
      case "highlightEditor":
        span.className += ` type-${AnnotationEditorType[options.mode]}`;
        const innerSpan = document.createElement("span");
        innerSpan.className = "comment-title";
        innerSpan.textContent = options.text;
        span.append(innerSpan);
        break;
    }
    return span;
  }

  destroy() {
    this.container = null;
  }

  updateTitle(options) {
    this.mainContent.innerHTML = "";
    this.mainContent.append(this.renderMainContent(options));
  }
}

export { PDFAnnotationViewer };
