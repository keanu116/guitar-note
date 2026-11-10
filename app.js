const STORAGE_KEY = "fretnote-notebook-v1";
const FRET_COUNT = 22;
const STRING_TUNINGS = [4, 9, 2, 7, 11, 4];
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PAGE_TYPE_LABELS = {
    cover: "表紙",
    fretboard: "フレット譜面",
    tab: "TAB譜",
    chord: "コード譜面",
    effects: "エフェクター配列",
    note: "ノート"
};
const UNAVAILABLE_PAGE_TYPES = new Set(["tab", "effects"]);
const SCALE_PATTERNS = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9]
};
const CHORD_SHAPES = {
    C: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["1-1", "2-2", "3-0", "4-1"], mutedStrings: [0, 5] },
    G: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["0-2", "1-1", "4-2", "5-2"], mutedStrings: [] },
    D: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["0-2", "1-2", "2-1"], mutedStrings: [3, 4, 5] },
    A: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["1-1", "2-1", "3-1"], mutedStrings: [0, 5] },
    E: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["0-0", "1-1", "2-1", "3-0", "4-0", "5-0"], mutedStrings: [] },
    Am: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["1-1", "2-1", "3-0"], mutedStrings: [0, 5] },
    Em: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["0-0", "1-1", "2-1", "3-0", "4-0", "5-0"], mutedStrings: [] },
    Dm: { fretNumbers: [0, 1, 2, 3, 4, 5], positions: ["0-1", "1-2", "2-1"], mutedStrings: [3, 4, 5] }
};

const elements = {
    noteList: document.querySelector("#note-list"),
    noteCount: document.querySelector("#note-count"),
    pageList: document.querySelector("#page-list"),
    pageHeading: document.querySelector("#page-heading"),
    searchInput: document.querySelector("#search-input"),
    title: document.querySelector("#note-title"),
    content: document.querySelector("#note-content"),
    date: document.querySelector("#note-date"),
    characterCount: document.querySelector("#character-count"),
    saveStatus: document.querySelector("#save-status"),
    previousPage: document.querySelector("#previous-page"),
    nextPage: document.querySelector("#next-page"),
    newNoteDialog: document.querySelector("#new-note-dialog"),
    newNoteForm: document.querySelector("#new-note-form"),
    newNoteTitle: document.querySelector("#new-note-title"),
    cancelNewNote: document.querySelector("#cancel-new-note"),
    closeNewNote: document.querySelector("#close-new-note"),
    notePaper: document.querySelector(".note-paper")
    ,fretboards: document.querySelector("#fretboards"),
    tablature: document.querySelector("#tablature"),
    pageTypePanel: document.querySelector("#page-type-panel"),
    tabTools: document.querySelector(".tab-tools"),
    pageTypeDialog: document.querySelector("#page-type-dialog"),
    pageTypeForm: document.querySelector("#page-type-form"),
    cancelPageType: document.querySelector("#cancel-page-type"),
    closePageType: document.querySelector("#close-page-type"),
    toggleDrawing: document.querySelector("#toggle-drawing"),
    clearDrawing: document.querySelector("#clear-drawing"),
    addText: document.querySelector("#add-text"),
    undoEdit: document.querySelector("#undo-edit"),
    redoEdit: document.querySelector("#redo-edit"),
    pageSpecificTools: document.querySelector("#page-specific-tools"),
    toolHint: document.querySelector("#tool-hint")
};

let notebooks = loadNotebooks();
let activeNotebookId = notebooks[0]?.id || null;
let activePageId = notebooks[0]?.pages[0]?.id || null;
const pageHistory = new Map();
let drawingActive = false;

function loadNotebooks() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(stored)) {
            return [];
        }
        if (stored[0]?.pages) {
            return stored.map(notebook => ({
                ...notebook,
                size: notebook.size || "a4",
                pages: notebook.pages.map(page => ({
                    ...normalizePage(page),
                    title: notebook.title || "新しいノート"
                }))
            }));
        }
        return stored.map(note => ({
            id: note.id,
            title: note.title || "新しいノート",
            size: note.size || "a4",
            updatedAt: note.updatedAt || new Date().toISOString(),
            pages: [{
                id: `${note.id}-page`,
                title: note.title || "",
                content: note.content || "",
                updatedAt: note.updatedAt || new Date().toISOString(),
                type: "fretboard",
                coverDetails: { creator: "", band: "", reference: "" },
                chords: createChords(),
                boards: createBoards()
            }]
        }));
    } catch {
        return [];
    }
}

function renderPageContent(page) {
    const isFretboard = page?.type === "fretboard";
    const isTab = page?.type === "tab";
    const isCover = page?.type === "cover";
    elements.tabTools.hidden = !isTab;
    if (UNAVAILABLE_PAGE_TYPES.has(page?.type)) {
        elements.fretboards.hidden = true;
        elements.tablature.hidden = true;
        elements.pageTypePanel.hidden = false;
        elements.fretboards.replaceChildren();
        elements.tablature.replaceChildren();
        elements.pageTypePanel.innerHTML = `
            <div class="page-type-heading">${PAGE_TYPE_LABELS[page.type]}</div>
            <p>まもなくリリース</p>
        `;
        renderPageSpecificTools(page);
        return;
    }
    elements.fretboards.hidden = !isFretboard;
    elements.tablature.hidden = !isTab;
    elements.pageTypePanel.hidden = isFretboard || isTab;
    elements.notePaper.dataset.pageType = page?.type || "note";
    renderPageSpecificTools(page);
    if (isFretboard) {
        renderFretboards(page);
        elements.tablature.replaceChildren();
        elements.pageTypePanel.replaceChildren();
        return;
    }

    function renderPageSpecificTools(page) {
        if (!page || UNAVAILABLE_PAGE_TYPES.has(page.type)) {
            elements.pageSpecificTools.replaceChildren();
            return;
        }
        if (page.type === "fretboard") {
            elements.pageSpecificTools.innerHTML = `
                <div class="tool-group page-specific-group">
                    <p class="tool-label">フレット譜面ツール</p>
                    <label class="tool-select-label">キー
                        <select class="tool-select" id="scale-root">
                            ${NOTE_NAMES.map(note => `<option value="${note}">${note}</option>`).join("")}
                        </select>
                    </label>
                    <label class="tool-select-label">スケール
                        <select class="tool-select" id="scale-type">
                            <option value="major">メジャー</option>
                            <option value="minor">マイナー</option>
                            <option value="pentatonic">ペンタトニック</option>
                        </select>
                    </label>
                    <label class="tool-select-label">対象
                        <select class="tool-select" id="scale-board">
                            ${page.boards.map((board, index) => `<option value="${index}">${escapeHtml(board.title || `譜面 ${index + 1}`)}</option>`).join("")}
                        </select>
                    </label>
                    <button class="tool-button" id="apply-scale" type="button">スケールを自動入力</button>
                    <button class="tool-button" id="clear-scale" type="button">選択をクリア</button>
                </div>
            `;
            document.querySelector("#apply-scale").addEventListener("click", () => applyScale(page));
            document.querySelector("#clear-scale").addEventListener("click", () => clearScale(page));
            return;
        }
        if (page.type === "chord") {
            elements.pageSpecificTools.innerHTML = `
                <div class="tool-group page-specific-group">
                    <p class="tool-label">コード選択</p>
                    <div class="chord-tool-grid">
                        ${Object.keys(CHORD_SHAPES).map(chord => `<button class="tool-button" data-quick-chord="${chord}" type="button">${chord}</button>`).join("")}
                    </div>
                    <p class="tool-hint">コードを選ぶと、選択中のコード譜面に自動入力します。</p>
                </div>
            `;
            elements.pageSpecificTools.querySelectorAll("[data-quick-chord]").forEach(button => {
                button.addEventListener("click", () => applyChordShape(page, button.dataset.quickChord));
            });
            return;
        }
        elements.pageSpecificTools.replaceChildren();
    }

    function applyScale(page) {
        const root = NOTE_NAMES.indexOf(document.querySelector("#scale-root").value);
        const pattern = SCALE_PATTERNS[document.querySelector("#scale-type").value];
        const board = page.boards[Number(document.querySelector("#scale-board").value)];
        const scaleNotes = new Set(pattern.map(interval => (root + interval) % 12));
        board.frets = [];
        STRING_TUNINGS.forEach((openNote, stringIndex) => {
            for (let fret = 0; fret <= FRET_COUNT; fret += 1) {
                if (scaleNotes.has((openNote + fret) % 12)) {
                    board.frets.push(`${stringIndex}-${fret}`);
                }
            }
        });
        touchActivePage();
        renderFretboards(page);
    }

    function clearScale(page) {
        const board = page.boards[Number(document.querySelector("#scale-board").value)];
        board.frets = [];
        touchActivePage();
        renderFretboards(page);
    }

    function applyChordShape(page, chordName) {
        const shape = CHORD_SHAPES[chordName];
        const chord = page.chords[0];
        chord.name = chordName;
        chord.fretNumbers = shape.fretNumbers;
        chord.positions = shape.positions;
        chord.mutedStrings = shape.mutedStrings;
        touchActivePage();
        renderChords(page);
    }
    if (isTab) {
        renderTablature(page);
        elements.fretboards.replaceChildren();
        elements.pageTypePanel.replaceChildren();
        return;
    }
    elements.fretboards.replaceChildren();
    elements.tablature.replaceChildren();
    if (isCover) {
        elements.pageTypePanel.innerHTML = `
            <div class="cover-title">${escapeHtml(activeNotebook()?.title || "新しいノート")}</div>
            <div class="cover-details">
                ${renderCoverField(page, "creator", "譜面製作者")}
                ${renderCoverField(page, "band", "所属バンド")}
                ${renderCoverField(page, "reference", "参考資料")}
            </div>
        `;
        elements.pageTypePanel.querySelectorAll(".cover-detail-input").forEach(input => {
            input.addEventListener("input", () => {
                const currentPage = activePage();
                currentPage.coverDetails[input.dataset.field] = input.value;
                touchActivePage();
            });
        });
        return;
    }
    if (page?.type === "chord") {
        elements.pageTypePanel.hidden = false;
        renderChords(page);
        return;
    }
    if (page?.type === "note") {
        elements.pageTypePanel.replaceChildren();
        return;
    }
    elements.pageTypePanel.innerHTML = `
        <div class="page-type-heading">${PAGE_TYPE_LABELS[page?.type] || "ノート"}</div>
        <p>${getPageTypeDescription(page?.type)}</p>
    `;
}

function renderCoverField(page, field, label) {
    return `
        <label class="cover-detail-field">
            <span>${label}</span>
            <input class="cover-detail-input" type="text" maxlength="120"
                data-field="${field}" value="${escapeHtml(page.coverDetails?.[field] || "")}"
                placeholder="${label}を入力">
        </label>
    `;
}

function getPageTypeDescription(type) {
    return {
        cover: "ノートの表紙です。タイトルやメモを入力できます。",
        tab: "6本の線にフレット番号を入力して、ギターのTAB譜を作成できます。",
        chord: "コード進行や押さえ方をメモできます。",
        effects: "使用するエフェクターと接続順をメモできます。",
        note: "自由な内容をメモできます。"
    }[type] || "";
}

function saveNotebooks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notebooks));
}

function activeNotebook() {
    return notebooks.find(notebook => notebook.id === activeNotebookId);
}

function activePage() {
    return activeNotebook()?.pages.find(page => page.id === activePageId);
}

function createBoards() {
    return Array.from({ length: 4 }, (_, index) => ({
        id: `${Date.now()}-board-${index}`,
        title: `フレット譜面 ${index + 1}`,
        frets: []
    }));
}

function createChords() {
    return Array.from({ length: 8 }, (_, index) => ({
        id: `${Date.now()}-chord-${index}`,
        name: "",
        fret: 0,
        fretNumbers: [1, 2, 3, 4, 5, 6],
        mutedStrings: [],
        positions: []
    }));
}

function createTabNotes() {
    return Array.from({ length: 6 }, () => Array(32).fill(""));
}

function createTabSymbols() {
    return Array(32).fill("");
}

function getFretNumbers(chord) {
    if (Array.isArray(chord.fretNumbers) && chord.fretNumbers.length === 6) {
        return chord.fretNumbers;
    }
    const start = chord.fret ?? 0;
    return Array.from({ length: 6 }, (_, index) => Math.max(0, start - 1 + index));
}

function normalizePageType(type) {
    return {
        chords: "chord",
        "chord-sheet": "chord",
        "chord-sheet-page": "chord",
        "コード": "chord",
        "コード譜": "chord",
        "コード譜面": "chord"
    }[type] || type || "fretboard";
}

function normalizePage(page) {
    const tabNotes = Array.from({ length: 6 }, (_, stringIndex) =>
        Array.from({ length: 32 }, (_, columnIndex) =>
            String(page.tabNotes?.[stringIndex]?.[columnIndex] || "")
        )
    );
    return {
        ...page,
        type: normalizePageType(page.type),
        coverDetails: {
            creator: page.coverDetails?.creator || "",
            band: page.coverDetails?.band || "",
            reference: page.coverDetails?.reference || ""
        },
        chords: Array.from({ length: 8 }, (_, index) => ({
            id: page.chords?.[index]?.id || `${page.id}-chord-${index}`,
            name: page.chords?.[index]?.name || "",
            fret: page.chords?.[index]?.fret ?? 0,
            fretNumbers: getFretNumbers(page.chords?.[index] || {}),
            mutedStrings: page.chords?.[index]?.mutedStrings || [],
            positions: page.chords?.[index]?.positions || []
        })),
        boards: Array.from({ length: 4 }, (_, index) => ({
            id: page.boards?.[index]?.id || `${page.id}-board-${index}`,
            title: page.boards?.[index]?.title || `フレット譜面 ${index + 1}`,
            frets: page.boards?.[index]?.frets || []
        })),
        drawing: page.drawing || "",
        tabNotes,
        tabSymbols: Array.from({ length: 32 }, (_, columnIndex) =>
            String(page.tabSymbols?.[columnIndex] || "")
        ),
        tabDurations: Array.from({ length: 32 }, (_, columnIndex) =>
            String(page.tabDurations?.[columnIndex] || "")
        ),
        drawing: typeof page.drawing === "string" ? page.drawing : ""
    };
}

function openNewNotebookDialog() {
    elements.newNoteForm.reset();
    elements.newNoteDialog.showModal();
    elements.newNoteTitle.focus();
}

function createNotebook(event) {
    event.preventDefault();
    const now = new Date().toISOString();
    const title = elements.newNoteTitle.value.trim();
    const size = elements.newNoteForm.elements["note-size"].value;
    const notebook = {
        id: Date.now(),
        title,
        size,
        updatedAt: now,
        pages: [{
            id: `${Date.now()}-page`,
            title: "",
            content: "",
            updatedAt: now,
            type: "fretboard",
            coverDetails: { creator: "", band: "", reference: "" },
            chords: createChords(),
            boards: createBoards()
        }]
    };
    notebooks.unshift(notebook);
    activeNotebookId = notebook.id;
    activePageId = notebook.pages[0].id;
    saveNotebooks();
    render();
    elements.newNoteDialog.close();
    elements.title.focus();
}

function openPageTypeDialog() {
    const notebook = activeNotebook();
    if (!notebook) {
        openNewNotebookDialog();
        return;
    }
    elements.pageTypeForm.reset();
    elements.pageTypeDialog.showModal();
}

function createPage(event) {
    event.preventDefault();
    const notebook = activeNotebook();
    if (!notebook) {
        elements.pageTypeDialog.close();
        openNewNotebookDialog();
        return;
    }
    const now = new Date().toISOString();
    const type = elements.pageTypeForm.elements["page-type"].value;
    if (UNAVAILABLE_PAGE_TYPES.has(type)) {
        return;
    }
    const page = {
        id: `${Date.now()}-page`,
        title: "",
        content: "",
        updatedAt: now,
        type,
        coverDetails: { creator: "", band: "", reference: "" },
        chords: createChords(),
        boards: createBoards()
    };
    notebook.pages.unshift(page);
    notebook.updatedAt = now;
    activePageId = page.id;
    saveNotebooks();
    render();
    elements.pageTypeDialog.close();
    elements.title.focus();
}

function updateActivePage() {
    const page = activePage();
    const notebook = activeNotebook();
    if (!page || !notebook) {
        return;
    }
    notebook.title = elements.title.value.trim() || "新しいノート";
    notebook.pages.forEach(currentPage => {
        currentPage.title = notebook.title;
    });
    page.content = elements.content.value;
    page.updatedAt = new Date().toISOString();
    notebook.updatedAt = page.updatedAt;
    saveNotebooks();
    elements.saveStatus.textContent = "自動保存しました";
    renderLists();
}

function deleteNotebook() {
    if (!activeNotebookId || !window.confirm("このノートを削除しますか？")) {
        return;
    }
    notebooks = notebooks.filter(notebook => notebook.id !== activeNotebookId);
    activeNotebookId = notebooks[0]?.id || null;
    activePageId = activeNotebook()?.pages[0]?.id || null;
    saveNotebooks();
    render();
}

function openPrintPage(event) {
    event.stopPropagation();
    if (!activeNotebookId) {
        return;
    }
    window.location.href = `./印刷用.html?note=${encodeURIComponent(activeNotebookId)}`;
}

function deletePage() {
    const notebook = activeNotebook();
    if (!notebook || !activePageId || !window.confirm("このページを削除しますか？")) {
        return;
    }
    notebook.pages = notebook.pages.filter(page => page.id !== activePageId);
    if (notebook.pages.length === 0) {
        const now = new Date().toISOString();
        notebook.pages.push({
            id: `${Date.now()}-page`,
            title: "",
            content: "",
            updatedAt: now,
            type: "fretboard",
            coverDetails: { creator: "", band: "", reference: "" },
            chords: createChords(),
            boards: createBoards()
        });
    }
    activePageId = notebook.pages[0].id;
    notebook.updatedAt = new Date().toISOString();
    saveNotebooks();
    render();
}

function duplicatePage() {
    const notebook = activeNotebook();
    const page = activePage();
    if (!notebook || !page) {
        return;
    }
    const now = new Date().toISOString();
    const duplicateId = `${Date.now()}-page-copy`;
    const duplicate = normalizePage(JSON.parse(JSON.stringify(page)));
    duplicate.id = duplicateId;
    duplicate.updatedAt = now;
    duplicate.title = notebook.title || "新しいノート";
    duplicate.boards = duplicate.boards.map((board, index) => ({
        ...board,
        id: `${duplicateId}-board-${index}`
    }));
    duplicate.chords = duplicate.chords.map((chord, index) => ({
        ...chord,
        id: `${duplicateId}-chord-${index}`
    }));
    notebook.pages.unshift(duplicate);
    notebook.updatedAt = now;
    activePageId = duplicate.id;
    saveNotebooks();
    render();
}

function selectNotebook(id) {
    activeNotebookId = id;
    activePageId = activeNotebook()?.pages[0]?.id || null;
    render();
}

function selectPage(id) {
    const page = activeNotebook()?.pages.find(currentPage => currentPage.id === id);
    if (UNAVAILABLE_PAGE_TYPES.has(page?.type)) {
        return;
    }
    activePageId = id;
    render();
}

function movePage(direction) {
    const pages = activeNotebook()?.pages || [];
    const currentIndex = pages.findIndex(page => page.id === activePageId);
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= pages.length) {
        return;
    }
    activePageId = pages[nextIndex].id;
    render();
}

function movePageOrder(direction) {
    const notebook = activeNotebook();
    if (!notebook) {
        return;
    }
    const currentIndex = notebook.pages.findIndex(page => page.id === activePageId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= notebook.pages.length) {
        return;
    }
    [notebook.pages[currentIndex], notebook.pages[targetIndex]] =
        [notebook.pages[targetIndex], notebook.pages[currentIndex]];
    notebook.updatedAt = new Date().toISOString();
    saveNotebooks();
    render();
}

function render() {
    const page = activePage();
    const notebook = activeNotebook();
    elements.title.value = notebook?.title || "";
    elements.content.value = page?.content || "";
    elements.content.placeholder = page?.type === "note" ? "" : "ここにアイデアを書こう…";
    elements.date.textContent = page ? formatDate(page.updatedAt) : "新しいノート";
    elements.saveStatus.textContent = page ? "保存されています" : "ノートを作成してください";
    elements.pageHeading.textContent = `ページ（${notebook?.pages.length || 0}）`;
    elements.notePaper.dataset.size = notebook?.size || "a4";
    ensurePageHistory(page);
    updateCharacterCount();
    renderPageContent(page);
    renderDrawing(page);
    updatePageNavigation();
    renderLists();
}

function getPageSnapshot(page) {
    return JSON.stringify(page);
}

function ensurePageHistory(page) {
    if (!page) {
        return null;
    }
    let history = pageHistory.get(page.id);
    if (!history) {
        history = { past: [getPageSnapshot(page)], future: [] };
        pageHistory.set(page.id, history);
    }
    return history;
}

function recordPageHistory(page) {
    const history = ensurePageHistory(page);
    if (!history) {
        return;
    }
    const snapshot = getPageSnapshot(page);
    if (history.past[history.past.length - 1] !== snapshot) {
        history.past.push(snapshot);
        history.future = [];
    }
}

function restorePageSnapshot(snapshot) {
    const notebook = activeNotebook();
    const pageIndex = notebook?.pages.findIndex(page => page.id === activePageId);
    if (!notebook || pageIndex < 0) {
        return;
    }
    notebook.pages[pageIndex] = JSON.parse(snapshot);
    saveNotebooks();
    render();
}

function undoEdit() {
    const page = activePage();
    const history = ensurePageHistory(page);
    if (!history || history.past.length < 2) {
        return;
    }
    history.future.push(history.past.pop());
    restorePageSnapshot(history.past[history.past.length - 1]);
}

function redoEdit() {
    const page = activePage();
    const history = ensurePageHistory(page);
    if (!history || history.future.length === 0) {
        return;
    }
    const snapshot = history.future.pop();
    history.past.push(snapshot);
    restorePageSnapshot(snapshot);
}

function renderDrawing(page) {
    document.querySelector(".drawing-layer")?.remove();
    drawingActive = false;
    elements.toggleDrawing.classList.remove("active");
    if (!page) {
        return;
    }
    const canvas = document.createElement("canvas");
    canvas.className = "drawing-layer";
    canvas.setAttribute("aria-label", "ページ描画レイヤー");
    elements.notePaper.append(canvas);
    const context = canvas.getContext("2d");
    const resize = () => {
        const ratio = window.devicePixelRatio || 1;
        const bounds = elements.notePaper.getBoundingClientRect();
        canvas.width = bounds.width * ratio;
        canvas.height = bounds.height * ratio;
        context.scale(ratio, ratio);
        if (page.drawing) {
            const image = new Image();
            image.onload = () => context.drawImage(image, 0, 0, bounds.width, bounds.height);
            image.src = page.drawing;
        }
    };
    requestAnimationFrame(resize);
    let drawing = false;
    canvas.addEventListener("pointerdown", event => {
        drawing = true;
        canvas.setPointerCapture(event.pointerId);
        context.beginPath();
        context.moveTo(event.offsetX, event.offsetY);
    });
    canvas.addEventListener("pointermove", event => {
        if (!drawing) {
            return;
        }
        context.lineTo(event.offsetX, event.offsetY);
        context.strokeStyle = "#27264d";
        context.lineWidth = 2;
        context.lineCap = "round";
        context.stroke();
    });
    canvas.addEventListener("pointerup", () => {
        drawing = false;
        page.drawing = canvas.toDataURL();
        touchActivePage();
    });
}

function toggleDrawing() {
    drawingActive = !drawingActive;
    const canvas = document.querySelector(".drawing-layer");
    if (!canvas) {
        return;
    }
    canvas.classList.toggle("active", drawingActive);
    elements.toggleDrawing.classList.toggle("active", drawingActive);
    elements.toolHint.textContent = drawingActive
        ? "ページ上をドラッグして描画できます。"
        : "TAB譜の入力欄を選択してから記号を押してください。";
}

function clearDrawing() {
    const page = activePage();
    const canvas = document.querySelector(".drawing-layer");
    if (!page || !canvas || !window.confirm("このページの描画を消去しますか？")) {
        return;
    }
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    page.drawing = "";
    touchActivePage();
}

function addText() {
    const text = window.prompt("追加するテキストを入力してください。");
    if (!text) {
        return;
    }
    elements.content.value += `${elements.content.value ? "\n" : ""}${text}`;
    updateActivePage();
}

function insertTabSymbol(symbol) {
    const cell = elements.tablature.querySelector(".tab-note.selected");
    if (!cell) {
        elements.toolHint.textContent = "先にTAB譜の位置をクリックしてください。";
        return;
    }
    setTabSymbol(cell, symbol);
}

function setTabNote(cell, value) {
    const stringIndex = Number(cell.dataset.tabString);
    const columnIndex = Number(cell.dataset.tabColumn);
    activePage().tabNotes[stringIndex][columnIndex] = value;
    cell.textContent = value;
    cell.classList.toggle("has-note", Boolean(value));
    touchActivePage();
}

function setTabSymbol(cell, value) {
    const columnIndex = Number(cell.dataset.tabColumn);
    const page = activePage();
    page.tabSymbols[columnIndex] = value;
    const symbol = elements.tablature.querySelector(
        `.tab-symbol[data-tab-column="${columnIndex}"]`
    );
    if (symbol) {
        symbol.textContent = value;
        symbol.classList.toggle("has-symbol", Boolean(value));
    }
    touchActivePage();
}

function setTabDuration(cell, value) {
    const columnIndex = Number(cell.dataset.tabColumn);
    const page = activePage();
    page.tabDurations[columnIndex] = value;
    const duration = elements.tablature.querySelector(
        `.tab-duration[data-tab-column="${columnIndex}"]`
    );
    if (duration) {
        duration.textContent = value;
        duration.classList.toggle("has-duration", Boolean(value));
    }
    touchActivePage();
}

function renderFretboards(page) {
    elements.fretboards.innerHTML = page
        ? page.boards.map((board, boardIndex) => `
            <article class="fretboard-card">
                <input class="fretboard-title" type="text" value="${escapeHtml(board.title)}"
                    data-board-title="${boardIndex}" aria-label="フレット譜面の名前">
                <div class="fretboard-grid" style="--fret-count: ${FRET_COUNT + 1}">
                    <span class="fretboard-corner"></span>
                    ${Array.from({ length: FRET_COUNT + 1 }, (_, fret) => `<span class="fret-number">${fret}</span>`).join("")}
                    ${STRING_TUNINGS.map((tuning, stringIndex) => `
                        <span class="string-label">${stringIndex + 1}</span>
                        ${Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                            const key = `${stringIndex}-${fret}`;
                            const selected = board.frets.includes(key);
                            return `<button class="fret-cell ${selected ? "selected" : ""}" type="button"
                                data-board="${boardIndex}" data-fret="${key}" aria-label="${stringIndex + 1}弦 ${fret}フレット"></button>`;
                        }).join("")}
                    `).join("")}
                </div>
            </article>
        `).join("")
        : "";
    elements.fretboards.querySelectorAll(".fret-cell").forEach(cell => {
        cell.addEventListener("click", () => toggleFret(cell));
    });
    elements.fretboards.querySelectorAll("[data-board-title]").forEach(input => {
        input.addEventListener("input", () => {
            const currentPage = activePage();
            currentPage.boards[Number(input.dataset.boardTitle)].title = input.value;
            touchActivePage();
        });
    });
}

function renderTablature(page) {
    if (!Array.isArray(page.tabNotes)) {
        page.tabNotes = createTabNotes();
    }
    if (!Array.isArray(page.tabSymbols)) {
        page.tabSymbols = createTabSymbols();
    }
    if (!Array.isArray(page.tabDurations)) {
        page.tabDurations = Array(32).fill("");
    }
    elements.tablature.innerHTML = `
        <div class="tablature-staff">
            <div class="tab-clef" aria-label="Guitar TAB">Guitar<br><strong>T<br>A<br>B</strong></div>
            <div class="tablature-lines">
                <div class="tab-duration-line">
                    ${page.tabDurations.map((duration, columnIndex) => `
                        <span class="tab-duration ${duration ? "has-duration" : ""}"
                            data-tab-column="${columnIndex}">${escapeHtml(duration)}</span>
                    `).join("")}
                </div>
                <div class="tab-symbol-line">
                    ${page.tabSymbols.map((symbol, columnIndex) => `
                        <span class="tab-symbol ${symbol ? "has-symbol" : ""}"
                            data-tab-column="${columnIndex}">${escapeHtml(symbol)}</span>
                    `).join("")}
                </div>
                ${page.tabNotes.map((stringNotes, stringIndex) => `
                    <div class="tab-line">
                        ${stringNotes.map((note, columnIndex) => `
                            <button class="tab-note ${note ? "has-note" : ""}" type="button"
                                data-tab-string="${stringIndex}" data-tab-column="${columnIndex}"
                                aria-label="${6 - stringIndex}弦 ${columnIndex + 1}列目">${escapeHtml(note)}</button>
                        `).join("")}
                    </div>
                `).join("")}
            </div>
        </div>
    `;
    elements.tablature.querySelectorAll(".tab-note").forEach(button => {
        button.addEventListener("click", () => {
            elements.tablature.querySelectorAll(".tab-note.selected").forEach(cell => cell.classList.remove("selected"));
            button.classList.add("selected");
            elements.toolHint.textContent = "右側の数字または記号を選択してください。";
        });
    });
}

function renderChords(page) {
    elements.fretboards.replaceChildren();
    elements.pageTypePanel.innerHTML = `
        <div class="chord-grid" aria-label="コード譜面">
            ${page.chords.map((chord, chordIndex) => `
                <article class="chord-card">
                    <input class="chord-name-input" type="text" maxlength="20"
                        value="${escapeHtml(chord.name)}" placeholder="コード名"
                        data-chord-name="${chordIndex}" aria-label="コード名">
                    <div class="chord-diagram" style="--chord-frets: 6">
                        <span class="chord-number-corner"></span>
                        ${getFretNumbers(chord).map((number, fretIndex) =>
                            `<label class="chord-fret-number">
                                <input type="number" min="0" max="22" value="${number}"
                                    data-chord-number="${chordIndex}" data-number-index="${fretIndex}"
                                    aria-label="${fretIndex + 1}列目のフレット番号">
                            </label>`
                        ).join("")}
                        ${Array.from({ length: 6 }, (_, stringIndex) =>
                            `<button class="chord-string-label ${chord.mutedStrings.includes(stringIndex) ? "muted" : ""}"
                                type="button" data-chord-string="${chordIndex}" data-string-index="${stringIndex}"
                                aria-label="${stringIndex + 1}弦のミュートを切り替え">
                                ${chord.mutedStrings.includes(stringIndex) ? "×" : stringIndex + 1}
                            </button>
                             ${Array.from({ length: 6 }, (_, fretIndex) => {
                                 const key = `${stringIndex}-${fretIndex}`;
                                 const selected = chord.positions.includes(key);
                                 return `<button class="chord-position ${selected ? "selected" : ""}"
                                     type="button" data-chord="${chordIndex}" data-position="${key}"
                                     aria-label="${stringIndex + 1}弦 ${getFretNumbers(chord)[fretIndex]}フレット"></button>`;
                             }).join("")}`
                        ).join("")}
                    </div>
                </article>
            `).join("")}
        </div>
    `;
    elements.pageTypePanel.querySelectorAll(".chord-position").forEach(button => {
        button.addEventListener("click", () => toggleChordPosition(button));
    });
    elements.pageTypePanel.querySelectorAll("[data-chord-name]").forEach(input => {
        input.addEventListener("input", () => {
            const currentPage = activePage();
            currentPage.chords[Number(input.dataset.chordName)].name = input.value;
            touchActivePage();
        });
    });
    elements.pageTypePanel.querySelectorAll("[data-chord-number]").forEach(input => {
        input.addEventListener("change", () => {
            const currentPage = activePage();
            const chord = currentPage.chords[Number(input.dataset.chordNumber)];
            const numberIndex = Number(input.dataset.numberIndex);
            const value = Math.max(0, Math.min(22, Number(input.value) || 0));
            const start = Math.max(0, Math.min(17, value - numberIndex));
            chord.fretNumbers = Array.from({ length: 6 }, (_, index) => start + index);
            elements.pageTypePanel.querySelectorAll(
                `[data-chord-number="${input.dataset.chordNumber}"]`
            ).forEach(numberInput => {
                numberInput.value = chord.fretNumbers[Number(numberInput.dataset.numberIndex)];
            });
            touchActivePage();
        });
    });
    elements.pageTypePanel.querySelectorAll("[data-chord-string]").forEach(button => {
        button.addEventListener("click", () => {
            const currentPage = activePage();
            const chord = currentPage.chords[Number(button.dataset.chordString)];
            const stringIndex = Number(button.dataset.stringIndex);
            chord.mutedStrings = chord.mutedStrings.includes(stringIndex)
                ? chord.mutedStrings.filter(item => item !== stringIndex)
                : [...chord.mutedStrings, stringIndex];
            renderChords(currentPage);
            touchActivePage();
        });
    });
}

function toggleChordPosition(button) {
    const page = activePage();
    const chord = page?.chords[Number(button.dataset.chord)];
    if (!chord) {
        return;
    }
    const position = button.dataset.position;
    chord.positions = chord.positions.includes(position)
        ? chord.positions.filter(item => item !== position)
        : [...chord.positions, position];
    button.classList.toggle("selected");
    touchActivePage();
}

function toggleFret(cell) {
    const page = activePage();
    const board = page?.boards[Number(cell.dataset.board)];
    if (!board) {
        return;
    }
    const key = cell.dataset.fret;
    board.frets = board.frets.includes(key)
        ? board.frets.filter(fret => fret !== key)
        : [...board.frets, key];
    cell.classList.toggle("selected");
    touchActivePage();
}

function touchActivePage() {
    const page = activePage();
    const notebook = activeNotebook();
    if (!page || !notebook) {
        return;
    }
    recordPageHistory(page);
    page.updatedAt = new Date().toISOString();
    notebook.updatedAt = page.updatedAt;
    saveNotebooks();
    elements.saveStatus.textContent = "自動保存しました";
    renderLists();
}

function updatePageNavigation() {
    const pages = activeNotebook()?.pages || [];
    const currentIndex = pages.findIndex(page => page.id === activePageId);
    elements.previousPage.disabled = currentIndex <= 0;
    elements.nextPage.disabled = currentIndex < 0 || currentIndex >= pages.length - 1;
}

function renderLists() {
    const keyword = elements.searchInput.value.trim().toLowerCase();
    const filtered = notebooks.filter(notebook =>
        `${notebook.title} ${notebook.pages.map(page => `${page.title} ${page.content}`).join(" ")}`
            .toLowerCase().includes(keyword)
    );
    elements.noteCount.textContent = notebooks.length;
    elements.noteList.innerHTML = filtered.length
        ? filtered.map(notebook => `
            <div class="note-item ${notebook.id === activeNotebookId ? "active" : ""}" role="button" tabindex="0" data-id="${notebook.id}">
                <div class="note-item-info">
                    <div class="note-item-title">${escapeHtml(notebook.title)}</div>
                    <div class="note-item-date">${notebook.pages.length}ページ ・ ${formatDate(notebook.updatedAt)}</div>
                </div>
                ${notebook.id === activeNotebookId
                    ? '<button class="note-print-button" type="button" aria-label="ノートを印刷">印刷</button>'
                    : ""}
            </div>
        `).join("")
        : '<p class="empty-list">ノートがありません。<br>「新規ノート」から作成しましょう。</p>';
    elements.pageList.innerHTML = activeNotebook()?.pages.map((page, pageIndex, pages) => `
        <div class="page-item ${page.id === activePageId ? "active" : ""}" role="button" tabindex="0" data-id="${page.id}">
            <span class="page-item-label">${pageIndex + 1}ページ目（${PAGE_TYPE_LABELS[page.type] || "フレット譜面"}）</span>
            ${page.id === activePageId ? `
                <span class="page-order-controls">
                    <button class="page-order-button" type="button" data-direction="-1"
                        aria-label="上へ移動" ${pageIndex === 0 ? "disabled" : ""}>↑</button>
                    <button class="page-order-button" type="button" data-direction="1"
                        aria-label="下へ移動" ${pageIndex === pages.length - 1 ? "disabled" : ""}>↓</button>
                </span>
            ` : ""}
        </div>
    `).join("") || '<p class="empty-list">ノートを選択してください。</p>';
    elements.noteList.querySelectorAll(".note-item").forEach(item => {
        item.addEventListener("click", event => {
            if (!event.target.closest(".note-print-button")) {
                selectNotebook(Number(item.dataset.id));
            }
        });
        elements.noteList.querySelectorAll(".note-print-button").forEach(button => {
            button.addEventListener("click", openPrintPage);
        });
        item.addEventListener("keydown", event => {
            if ((event.key === "Enter" || event.key === " ") &&
                !event.target.closest(".note-print-button")) {
                event.preventDefault();
                selectNotebook(Number(item.dataset.id));
            }
        });
    });
    elements.pageList.querySelectorAll(".page-item").forEach(item => {
        item.addEventListener("click", event => {
            if (!event.target.closest(".page-order-button")) {
                selectPage(item.dataset.id);
            }
        });
        item.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectPage(item.dataset.id);
            }
        });
    });
    elements.pageList.querySelectorAll(".page-order-button").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            movePageOrder(Number(button.dataset.direction));
        });
    });
}

function updateCharacterCount() {
    elements.characterCount.textContent = `${elements.content.value.length}文字`;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[character]);
}

document.querySelector("#new-note").addEventListener("click", openNewNotebookDialog);
elements.newNoteForm.addEventListener("submit", createNotebook);
elements.cancelNewNote.addEventListener("click", () => elements.newNoteDialog.close());
elements.closeNewNote.addEventListener("click", () => elements.newNoteDialog.close());
document.querySelector("#new-page").addEventListener("click", openPageTypeDialog);
elements.pageTypeForm.addEventListener("submit", createPage);
elements.cancelPageType.addEventListener("click", () => elements.pageTypeDialog.close());
elements.closePageType.addEventListener("click", () => elements.pageTypeDialog.close());
document.querySelector("#save-note").addEventListener("click", updateActivePage);
document.querySelector("#delete-note").addEventListener("click", deleteNotebook);
document.querySelector("#delete-page").addEventListener("click", deletePage);
document.querySelector("#duplicate-page").addEventListener("click", duplicatePage);
elements.previousPage.addEventListener("click", () => movePage(-1));
elements.nextPage.addEventListener("click", () => movePage(1));
elements.searchInput.addEventListener("input", renderLists);
elements.title.addEventListener("input", updateActivePage);
elements.content.addEventListener("input", () => {
    updateCharacterCount();
    updateActivePage();
});
elements.toggleDrawing.addEventListener("click", toggleDrawing);
elements.clearDrawing.addEventListener("click", clearDrawing);
elements.addText.addEventListener("click", addText);
elements.undoEdit.addEventListener("click", undoEdit);
elements.redoEdit.addEventListener("click", redoEdit);
document.querySelectorAll("[data-tab-symbol]").forEach(button => {
    button.addEventListener("click", () => insertTabSymbol(button.dataset.tabSymbol));
});
document.querySelectorAll("[data-tab-note]").forEach(button => {
    button.addEventListener("click", () => {
        const cell = elements.tablature.querySelector(".tab-note.selected");
        if (!cell) {
            elements.toolHint.textContent = "先にTAB譜の位置をクリックしてください。";
            return;
        }
        setTabNote(cell, button.dataset.tabNote);
    });
});
document.querySelectorAll("[data-tab-duration]").forEach(button => {
    button.addEventListener("click", () => {
        const cell = elements.tablature.querySelector(".tab-note.selected");
        if (!cell) {
            elements.toolHint.textContent = "先にTAB譜の位置をクリックしてください。";
            return;
        }
        setTabDuration(cell, button.dataset.tabDuration);
    });
});

render();
