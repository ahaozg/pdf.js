/** @typedef {import("./event_utils.js").EventBus} EventBus */
/** @typedef {import("./interfaces.js").IL10n} IL10n */

import { PDFAnnotationComment } from "./pdf_annotation_comment.js";

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
      target.updateComment(params);
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

export { PDFAnnotationViewer };
