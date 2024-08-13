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

const AnnotationCommentCardIdPrefix = "anno-view-";
const AnnotationCommentInputIdPrefix = "anno-commit-";

class PDFAnnotationComment {
  #options = null;

  #boundFocusIn = this.onfocusIn.bind(this);

  #boundFocusOut = this.onfocusOut.bind(this);

  #noteInstance = null;

  #boundNoteInstanceBlur = this.onNoteInstanceBlur.bind(this);

  #boundNoteInstanceConfirm = this.onNoteInstanceConfirm.bind(this);

  #boundNoteInstanceCancel = this.onNoteInstanceCancel.bind(this);

  #commentInstance = null;

  #boundCommentInstanceBlur = this.onCommentInstanceBlur.bind(this);

  #boundCommentInstanceConfirm = this.onCommentInstanceConfirm.bind(this);

  #boundCommentInstanceCancel = this.onCommentInstanceCancel.bind(this);

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
    container.id = `${AnnotationCommentCardIdPrefix}${options.editorParams.id}`;
    const main = document.createElement("div");
    main.className = "comment-card-main";
    main.append(this.renderMainContent(options));
    main.append(this.renderMainHeader(options));
    container.append(main);
    const commentListWrap = document.createElement("div");
    commentListWrap.className = "comment-card-list";
    commentListWrap.append(...this.renderCommentList(options));
    container.append(commentListWrap);
    const commentInputWrap = document.createElement("div");
    commentInputWrap.className = "comment-input-wrap";
    container.append(commentInputWrap);
    this.container = container;
    this.commentInputWrap = commentInputWrap;
    this.commentListWrap = commentListWrap;
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

  renderCommentList(options) {
    const result = [];
    const { comments } = options;
    comments.forEach(comment => {
      const div = document.createElement("div");
      div.className = "comment-card-list-item";
      const contentDiv = document.createElement("div");
      contentDiv.className = "comment-card-list-item-content";
      contentDiv.textContent = comment.value;
      div.append(contentDiv);
      const authorDiv = document.createElement("div");
      authorDiv.className =
        "comment-card-main-header comment-card-list-item-author";
      const { user, time } = this.renderMainHeaderTitle(comment);
      authorDiv.append(user);
      authorDiv.append(time);
      div.append(authorDiv);
      result.push(div);
    });
    return result;
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
    this.commentInputWrap = null;
    this.commentListWrap = null;
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

  updateComment(options) {
    this.#options = options;
    this.commentListWrap.replaceChildren(...this.renderCommentList(options));
  }

  onfocusIn(e) {
    const target = e.target;
    this.container.classList.add("is-selected");
    // 存在注解输入框
    if (this.#noteInstance) {
      this.#noteInstance.input.focus();
      return;
    }
    this.createCommentInputInstance();
    if (!this.isFocusInCommitInput(target)) {
      this.parent.handleCommentFocusIn(this);
    }
  }

  isFocusInCommitInput(target) {
    return (
      target &&
      target.closest(
        `#${AnnotationCommentInputIdPrefix}${this.#options.editorParams.id}`
      )
    );
  }

  isFocusInCard(target) {
    return (
      target &&
      target.closest(
        `#${AnnotationCommentCardIdPrefix}${this.#options.editorParams.id}`
      )
    );
  }

  isFocusInEditor(target) {
    return target && target.closest(`#${this.#options.editorParams.id}`);
  }

  onfocusOut(e) {
    const relatedTarget = e.relatedTarget;
    const target = e.target;
    if (
      this.isFocusInEditor(relatedTarget) ||
      this.isFocusInCard(relatedTarget) ||
      (!relatedTarget && this.isFocusInCard(target))
    ) {
      return;
    }
    this.destroyCommentInputInstance();
    this.container.classList.remove("is-selected");
  }

  createNoteInputInstance({ span }) {
    if (this.#noteInstance) {
      return;
    }
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

  createCommentInputInstance() {
    if (this.#commentInstance) {
      return;
    }
    this.#commentInstance = new TextareaPrompt({
      id: `${AnnotationCommentInputIdPrefix}${this.#options.editorParams.id}`,
      autoFocus: false,
      parentElement: this.commentInputWrap,
      onBlur: this.#boundCommentInstanceBlur,
      onConfirm: this.#boundCommentInstanceConfirm,
      onCancel: this.#boundCommentInstanceCancel,
      value: this.commentInputValue,
    });
  }

  destroyCommentInputInstance() {
    if (this.#commentInstance) {
      this.#commentInstance.destroy();
    }
    this.#commentInstance = null;
  }

  onCommentInstanceBlur(e) {
    this.commentInputValue = this.#commentInstance?.input.value;
  }

  onCommentInstanceConfirm(value) {
    this.commentInputValue = "";
    this.destroyCommentInputInstance();
    this.parent._eventBus.dispatch("annotationcommentinput", {
      source: this,
      details: {
        editorId: this.editorId,
        inputType: "confirm",
        value,
      },
    });
  }

  onCommentInstanceCancel(value) {
    this.commentInputValue = "";
    this.destroyCommentInputInstance();
  }
}

export { PDFAnnotationComment };
