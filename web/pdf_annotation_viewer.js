/** @typedef {import("./event_utils.js").EventBus} EventBus */
/** @typedef {import("./interfaces.js").IL10n} IL10n */

import { AnnotationEditorType } from "../src/shared/util.js";
import { TextareaPrompt } from "./textarea_prompt.js";

function timestampToYMDHMS(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  // const year = date.getFullYear();
  const month = ("0" + (date.getMonth() + 1)).slice(-2);
  const day = ("0" + date.getDate()).slice(-2);
  const hours = ("0" + date.getHours()).slice(-2);
  const minutes = ("0" + date.getMinutes()).slice(-2);
  // const seconds = ("0" + date.getSeconds()).slice(-2);

  return `${month}-${day} ${hours}:${minutes}`;
}

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

  #boundEditorFocusOut = this.onEditorFocusOut.bind(this);

  #boundAnnotationeditormanagerrenderlayer =
    this.onAnnotationeditormanagerrenderlayer.bind(this);

  #boundSidebarAnnotationToggle = this.onSidebarAnnotationToggle.bind(this);

  #boundAnnotationViewerPositionById =
    this.onAnnotationViewerPositionById.bind(this);

  #pages = new Map();

  constructor({ elements, eventBus, pdfViewer }) {
    this.commentContainer = elements.commentContainer;
    this.pdfViewer = pdfViewer;
    this._signal = this.#abortController.signal;
    this._eventBus = eventBus;
    this._eventBus._on("documentnumpages", this.#boundOnDocumentNumPages);
    this._eventBus._on(
      "annotationeditormanagetdatachange",
      this.#boundOnAnnotationEditorManagerDataChange
    );
    this._eventBus._on("editorfocusout", this.#boundEditorFocusOut);
    this._eventBus._on(
      "annotationeditormanagerrenderlayer",
      this.#boundAnnotationeditormanagerrenderlayer
    );
    this._eventBus._on(
      "sidebarannotationtoggle",
      this.#boundSidebarAnnotationToggle
    );
    this._eventBus._on(
      "annotationviewerpositionbyid",
      this.#boundAnnotationViewerPositionById
    );
  }

  destroy() {
    this.#abortController?.abort();
    this.#abortController = null;
    this._signal = null;

    for (const page of this.#pages) {
      page.editors.forEach(editor => {
        editor.destroy();
      });
    }

    this._eventBus._off("documentnumpages", this.#boundOnDocumentNumPages);
    this._eventBus._off(
      "annotationeditormanagetdatachange",
      this.#boundOnAnnotationEditorManagerDataChange
    );
    this._eventBus._off("editorfocusout", this.#boundEditorFocusOut);
    this._eventBus._off(
      "annotationeditormanagerrenderlayer",
      this.#boundAnnotationeditormanagerrenderlayer
    );
    this._eventBus._off(
      "sidebarannotationtoggle",
      this.#boundSidebarAnnotationToggle
    );
    this._eventBus._off(
      "annotationviewerpositionbyid",
      this.#boundAnnotationViewerPositionById
    );
  }

  onDocumentNumPages(numPages) {
    this.commentContainer.innerHTML = "";
    for (let i = 1; i <= numPages; i++) {
      const div = document.createElement("div");
      div.className = "anno-comment-page";
      div.setAttribute("data-page-number", i);
      div.setAttribute("aria-label", `第${i}页`);
      div.hidden = true;
      this.commentContainer.append(div);
      this.#pages.set(i, {
        pageContainer: div,
        editors: [],
      });
    }
  }

  onAnnotationEditorManagerDataChange({ type, data }) {
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
      for (const params of data) {
        this.addEditor(params);
      }
    }
  }

  addEditor(params) {
    const pageIndex = params.editorParams.pageIndex + 1;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    targetPage.editors.push(
      new PDFAnnotationComment(targetPage.pageContainer, params, this)
    );
  }

  editEditor(params) {
    const pageIndex = params.editorParams.pageIndex + 1;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    const editors = targetPage.editors || [];
    const target = editors.find(
      editor => editor.editorId === params.editorParams.id
    );
    if (target) {
      target.updateTitle(params);
    }
  }

  deleteEditor(params) {
    const pageIndex = params.editorParams.pageIndex + 1;
    const targetPage = this.#pages.get(pageIndex);
    if (!targetPage) {
      return;
    }
    const targetIndex = targetPage.editors.findIndex(
      editor => editor.editorId === params.editorParams.id
    );
    if (targetIndex > -1) {
      targetPage.editors[targetIndex].destroy();
      targetPage.editors.splice(targetIndex, 1);
    }
    if (targetPage.editors.length === 0) {
      targetPage.pageContainer.hidden = true;
    }
  }

  onEditorFocusOut({ source, event }) {
    const { pageIndex, id } = source;
    const targetPage = this.#pages.get(pageIndex + 1);
    if (!targetPage) {
      return;
    }
    const editors = targetPage.editors || [];
    const target = editors.find(editor => editor.editorId === id);
    if (target) {
      target.onfocusOut(event);
    }
  }

  handleCommentFocusIn(commentEditor) {
    this.focusCommentEditor = commentEditor;
    const editorDiv = document.querySelector(`#${commentEditor.editorId}`);
    if (editorDiv) {
      editorDiv.focus();
    } else {
      const currentPageNumber = this.pdfViewer.currentPageNumber;
      if (currentPageNumber !== commentEditor.pageIndex + 1) {
        this._eventBus.dispatch("pagenumberchanged", {
          source: self,
          value: commentEditor.pageIndex + 1,
        });
      }
    }
  }

  onAnnotationeditormanagerrenderlayer() {
    if (this.focusCommentEditor) {
      const editorDiv = document.querySelector(
        `#${this.focusCommentEditor.editorId}`
      );
      if (editorDiv) {
        editorDiv.focus();
      }
      this.focusCommentEditor = null;
    }
  }

  onSidebarAnnotationToggle({ isOpen }) {
    if (isOpen) {
      const currentPageNumber = this.pdfViewer.currentPageNumber;
      const currentPage = this.#pages.get(currentPageNumber);
      const currentPageContainer = currentPage.pageContainer;
      const offsetTop = currentPageContainer.offsetTop;
      this.commentContainer.scrollTo({ top: offsetTop });
    }
  }

  onAnnotationViewerPositionById({ id, pageIndex }) {
    const target = this.commentContainer.querySelector(`#anno-view-${id}`);
    if (target) {
      const offsetTop = target.offsetTop;
      this.commentContainer.scrollTo({ top: offsetTop });
      pageIndex += 1;
      const targetPage = this.#pages.get(pageIndex);
      if (!targetPage) {
        return;
      }
      const targetEditor = targetPage.editors.find(
        editor => editor.editorId === id
      );
      targetEditor.container.focus();
    }
  }
}

class PDFAnnotationComment {
  #options = null;

  #boundFocusIn = this.onfocusIn.bind(this);

  #boundFocusOut = this.onfocusOut.bind(this);

  #noteInstance = null;

  #boundNoteInstanceBlur = this.onNoteInstanceBlur.bind(this);

  #boundNoteInstanceConfirm = this.onNoteInstanceConfirm.bind(this);

  #boundNoteInstanceCancel = this.onNoteInstanceCancel.bind(this);

  constructor(parentContainer, options, parent) {
    this.parent = parent;
    this.editorId = options.editorParams.id;
    this.pageIndex = options.editorParams.pageIndex;
    this.#options = options;

    parentContainer.append(this.renderCard(options));
    parentContainer.hidden = false;
  }

  renderCard(options) {
    const container = document.createElement("div");
    container.className = "comment-card";
    container.tabIndex = -1;
    container.id = `anno-view-${options.editorParams.id}`;
    const main = document.createElement("div");
    main.className = "comment-card-main";
    main.append(this.renderMainContent(options));
    main.append(this.renderMainHeader(options));
    container.append(main);
    this.container = container;
    this.bindEvent("container");
    return container;
  }

  renderMainContent(options) {
    const mainContent = document.createElement("div");
    mainContent.className = `comment-card-main-content type-${AnnotationEditorType[options.editorParams.mode]}`;
    mainContent.append(this.renderMainContentTitle(options));
    this.mainContent = mainContent;
    return mainContent;
  }

  renderMainContentTitle(options) {
    const editorParams = options.editorParams;
    const span = document.createElement("span");
    span.className = "comment-title-wrap";
    let innerSpan;
    switch (editorParams.name) {
      case "highlightEditor":
        span.className += ` is-text type-${AnnotationEditorType[editorParams.mode]}`;
        innerSpan = document.createElement("span");
        innerSpan.className = "comment-title";
        innerSpan.textContent = editorParams.text;
        if (editorParams.mode === AnnotationEditorType.HIGHLIGHT) {
          innerSpan.style.backgroundColor = editorParams.color;
        } else if (editorParams.mode === AnnotationEditorType.UNDERLINE) {
          span.style.color = editorParams.color;
          span.style.textDecorationColor = editorParams.color;
        } else if (editorParams.mode === AnnotationEditorType.STRIKETHROUGH) {
          span.style.color = editorParams.color;
          span.style.textDecorationColor = editorParams.color;
        }
        span.append(innerSpan);
        break;
      case "noteEditor":
        if (editorParams.content) {
          span.className += ` is-text type-${AnnotationEditorType[editorParams.mode]}`;
          innerSpan = document.createElement("span");
          innerSpan.className = "comment-title";
          innerSpan.textContent = editorParams.content;
          span.append(innerSpan);
        } else {
          this.createNoteInputInstance({ span });
        }
        break;
    }
    return span;
  }

  renderMainHeader(options) {
    const div = document.createElement("div");
    div.className = "comment-card-main-header";
    const { user, time } = this.renderMainHeaderTitle(options);
    if (user && time) {
      div.append(user);
      div.append(time);
    }
    this.mainHeader = div;
    return div;
  }

  renderMainHeaderTitle(options) {
    if (options.creator.name) {
      const user = document.createElement("span");
      user.className = "comment-user";
      user.textContent = options.creator.name;
      const time = document.createElement("span");
      time.className = "comment-time";
      time.textContent = timestampToYMDHMS(options.createTime);
      return { user, time };
    }
    return {};
  }

  bindEvent(type) {
    switch (type) {
      case "container":
        this.container.addEventListener("focusin", this.#boundFocusIn);
        this.container.addEventListener("focusout", this.#boundFocusOut);
        break;
    }
  }

  unbindEvent(type = "all") {
    switch (type) {
      case "all":
        this.container.removeEventListener("focusin", this.#boundFocusIn);
        this.container.removeEventListener("focusout", this.#boundFocusOut);
        break;
      case "container":
        this.container.removeEventListener("focusin", this.#boundFocusIn);
        this.container.removeEventListener("focusout", this.#boundFocusOut);
        break;
    }
  }

  destroy() {
    this.unbindEvent();
    this.container.remove();
    this.mainHeader = null;
    this.mainContent = null;
    this.container = null;
  }

  updateTitle(options) {
    this.#options = options;
    this.mainContent.replaceChildren(this.renderMainContentTitle(options));
    const { user, time } = this.renderMainHeaderTitle(options);
    if (user && time) {
      this.mainHeader.replaceChildren(user, time);
    }
  }

  onfocusIn() {
    this.container.classList.add("is-selected");
    // 存在注解输入框
    if (this.#noteInstance) {
      this.#noteInstance.input.focus();
      return;
    }
    this.parent.handleCommentFocusIn(this);
  }

  onfocusOut(e) {
    const relatedTarget = e.relatedTarget;
    if (
      relatedTarget &&
      relatedTarget.closest(`#${this.#options.editorParams.id}`)
    ) {
      return;
    }
    this.container.classList.remove("is-selected");
  }

  createNoteInputInstance({ span }) {
    this.#noteInstance = new TextareaPrompt({
      parentElement: span,
      onBlur: this.#boundNoteInstanceBlur,
      onConfirm: this.#boundNoteInstanceConfirm,
      onCancel: this.#boundNoteInstanceCancel,
    });
  }

  destroyNoteInputInstance() {
    if (this.#noteInstance) {
      this.#noteInstance.destroy();
    }
    this.#noteInstance = null;
  }

  onNoteInstanceBlur(e) {
    const relatedTarget = e.relatedTarget;
    const domId = relatedTarget?.id;
    if (domId === this.editorId) {
      return;
    }
    this.onNoteInstanceCancel("");
  }

  onNoteInstanceConfirm(value) {
    this.destroyNoteInputInstance();
    this.parent._eventBus.dispatch("pdfannotationcomment", {
      source: this,
      details: {
        editorName: "noteEditor",
        type: "noteInstance",
        inputType: "confirm",
        value,
      },
    });
  }

  onNoteInstanceCancel(value) {
    this.destroyNoteInputInstance();
    this.parent._eventBus.dispatch("pdfannotationcomment", {
      source: this,
      details: {
        editorName: "noteEditor",
        type: "noteInstance",
        inputType: "cancel",
        value,
      },
    });
  }
}

export { PDFAnnotationViewer };
