export class TextareaPrompt {
  #boundOnFocus = this.bindOnFocus.bind(this);

  #boundOnBlur = this.bindOnBlur.bind(this);

  #boundOnChange = this.bindOnChange.bind(this);

  #boundOnKeyDown = this.bindOnKeyDown.bind(this);

  #boundOnConfirm = this.bindOnConfirm.bind(this);

  #boundOnCancel = this.bindOnCancel.bind(this);

  constructor({
    parentElement,
    value = "",
    maxlength = 1000,
    placeholder = "Alt+Enter换行(限1000字)",
    confirmButtonText = "评论",
    cancelButtonText = "取消",
    onFocus = () => {},
    onBlur = () => {},
    onChange = () => {},
    onCancel = () => {},
    onConfirm = () => {},
    autoFocus = true,
    id = "",
  }) {
    this.parentElement = parentElement;
    this.defaultValue = value;
    this.preValue = value;
    this.maxlength = maxlength;
    this.placeholder = placeholder;
    this.confirmButtonText = confirmButtonText;
    this.cancelButtonText = cancelButtonText;
    this.onFocus = onFocus;
    this.onBlur = onBlur;
    this.onChange = onChange;
    this.onCancel = onCancel;
    this.onConfirm = onConfirm;
    this.init({ autoFocus, id });
  }

  init({ autoFocus = true, id = "" }) {
    // 创建 textarea 元素
    const input = document.createElement("textarea");
    input.className = "commit-input";
    input.placeholder = this.placeholder;
    input.maxlength = this.maxlength;
    input.value = this.defaultValue;
    input.tabIndex = 0;
    input.addEventListener("focus", this.#boundOnFocus);
    input.addEventListener("blur", this.#boundOnBlur);
    input.addEventListener("change", this.#boundOnChange);
    input.addEventListener("keydown", this.#boundOnKeyDown);

    const calcDiv = document.createElement("div");
    calcDiv.className = "calc-height";
    calcDiv.textContent = this.defaultValue;

    // 创建确认按钮
    const confirmButton = document.createElement("button");
    confirmButton.className = "button primaryButton";
    confirmButton.textContent = this.confirmButtonText;
    confirmButton.tabIndex = 0;
    confirmButton.addEventListener("click", this.#boundOnConfirm);

    // 创建取消按钮
    const cancelButton = document.createElement("button");
    cancelButton.className = "button secondaryButton";
    cancelButton.textContent = this.cancelButtonText;
    confirmButton.tabIndex = 0;
    cancelButton.addEventListener("click", this.#boundOnCancel);

    const buttons = document.createElement("div");
    buttons.className = "buttons";
    buttons.append(cancelButton);
    buttons.append(confirmButton);

    // 创建一个容器来包装所有元素
    const container = document.createElement("div");
    container.className = "commit-wrap";
    if (id) {
      container.id = id;
    }
    container.append(input);
    container.append(calcDiv);
    container.append(buttons);

    // 将容器添加到父元素中
    this.parentElement.append(container);

    // 保存引用以便后续操作
    this.input = input;
    this.calcDiv = calcDiv;
    this.container = container;
    this.confirmButton = confirmButton;
    this.cancelButton = cancelButton;

    if (autoFocus) {
      input.focus();
    }
  }

  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this.input.removeEventListener("focus", this.#boundOnFocus);
    this.input.removeEventListener("blur", this.#boundOnBlur);
    this.input.removeEventListener("change", this.#boundOnChange);
    this.input.removeEventListener("keydown", this.#boundOnKeyDown);
    this.confirmButton.removeEventListener("click", this.#boundOnConfirm);
    this.cancelButton.removeEventListener("click", this.#boundOnCancel);

    // 移除容器
    if (this.container.parentNode === this.parentElement) {
      this.container.remove();
    }

    // 清空引用，帮助垃圾回收
    this.input = null;
    this.calcDiv = null;
    this.container = null;
    this.confirmButton = null;
    this.cancelButton = null;
  }

  bindOnFocus(e) {
    // eslint-disable-next-line no-unused-expressions
    this.onFocus && this.onFocus(e);
  }

  bindOnBlur(e) {
    const relatedTarget = e.relatedTarget;
    if (
      relatedTarget === this.cancelButton ||
      relatedTarget === this.confirmButton
    ) {
      this.input.focus();
      return;
    }
    // eslint-disable-next-line no-unused-expressions
    this.onBlur && this.onBlur(e);
  }

  bindOnChange() {
    // eslint-disable-next-line no-unused-expressions
    this.onChange && this.onChange(this.input.value);
  }

  bindOnKeyDown(e) {
    e.stopPropagation();
    const text = e.value;
    const enterKey = 13;
    const enter = enterKey === e.keyCode;
    if (enter && e.altKey) {
      const start = this.input.selectionStart;
      const end = this.input.selectionEnd;
      const newText =
        text.substring(0, start) + "\n" + text.substring(end, text.length);
      const endIndex = start + 1;
      this.input.value = newText;
      this.input.selectionStart = endIndex;
      this.input.selectionEnd = endIndex;
    } else if (enter && !e.shiftKey) {
      e.preventDefault();
      if (text === this.preValue) {
        this.bindOnCancel();
        return;
      }
      this.bindOnConfirm();
    }
    this.setCalcDiv();
  }

  bindOnConfirm(e) {
    if (e) {
      e.stopPropagation();
    }
    const value = this.input.value;
    this.preValue = value;
    if (!this.input.value) {
      this.input.focus();
      return;
    }
    // 清空输入框
    this.input.value = "";
    // eslint-disable-next-line no-unused-expressions
    this.onConfirm && this.onConfirm(value);
  }

  bindOnCancel(e) {
    if (e) {
      e.stopPropagation();
    }
    const value = this.input.value;
    this.preValue = value;
    // 清空输入框
    this.input.value = "";
    // eslint-disable-next-line no-unused-expressions
    this.onCancel && this.onCancel(value);
  }

  setCalcDiv() {
    const minHeight = 52;
    requestAnimationFrame(() => {
      this.calcDiv.textContent = this.input?.value || "";
      let height = this.calcDiv?.getBoundingClientRect().height || 0;
      height = Math.max(minHeight, height);
      if (this.input) {
        this.input.style.height = `${height}px`;
      }
    });
  }
}

export default { TextareaPrompt };
