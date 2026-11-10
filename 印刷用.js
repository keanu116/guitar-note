const STORAGE_KEY = "fretnote-notebook-v1";
const FRET_COUNT = 22;
const STRING_TUNINGS = [4, 9, 2, 7, 11, 4];
const PAGE_TYPE_LABELS = {
    cover: "表紙",
    fretboard: "フレット譜面",
    tab: "TAB譜",
    chord: "コード譜面",
    effects: "エフェクター配列",
    note: "ノート"
};

const printPages = document.querySelector("#print-pages");
const printError = document.querySelector("#print-error");
const noteId = new URLSearchParams(window.location.search).get("note");

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

function loadNotebook() {
    try {
        const notebooks = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        const notebook = notebooks.find(notebook => String(notebook.id) === noteId);
        if (!notebook) {
            return null;
        }
        return {
            ...notebook,
            pages: notebook.pages.map(page => ({
                ...page,
                type: normalizePageType(page.type)
            }))
        };
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function renderBoard(board) {
    return `
        <section class="board">
            <h3>${escapeHtml(board.title || "フレット譜面")}</h3>
            <div class="fretboard-grid" style="--fret-count: ${FRET_COUNT + 1}">
                <span class="fretboard-corner"></span>
                ${Array.from({ length: FRET_COUNT + 1 }, (_, fret) =>
                    `<span class="fret-number">${fret}</span>`).join("")}
                ${STRING_TUNINGS.map((_, stringIndex) => `
                    <span class="string-label">${stringIndex + 1}</span>
                    ${Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                        const selected = (board.frets || []).includes(`${stringIndex}-${fret}`);
                        return `<span class="fret-cell ${selected ? "selected" : ""}">${selected ? '<span class="selection-dot" aria-hidden="true">●</span>' : ""}</span>`;
                    }).join("")}
                `).join("")}
            </div>
        </section>
    `;
}

function renderChord(chord) {
    return `
        <section class="chord-card">
            <h3>${escapeHtml(chord.name || "コード")}</h3>
            <div class="chord-diagram" style="--chord-frets: 6">
                <span class="chord-number-corner"></span>
                ${getFretNumbers(chord).map((number, fretIndex) =>
                    `<span class="chord-fret-number ${chord.mutedFrets?.includes(fretIndex) ? "muted" : ""}">${number}</span>`).join("")}
                ${Array.from({ length: 6 }, (_, stringIndex) =>
                    `<span class="chord-string-label ${chord.mutedStrings?.includes(stringIndex) ? "muted" : ""}">
                        ${chord.mutedStrings?.includes(stringIndex) ? "×" : stringIndex + 1}
                    </span>
                     ${Array.from({ length: 6 }, (_, fretIndex) => {
                         const selected = (chord.positions || []).includes(`${stringIndex}-${fretIndex}`);
                         const muted = (chord.mutedFrets || []).includes(fretIndex);
                         return `<span class="chord-position ${selected ? "selected" : ""} ${muted ? "muted" : ""}">${selected ? '<span class="selection-dot" aria-hidden="true">●</span>' : ""}</span>`;
                     }).join("")}`
                ).join("")}
            </div>
        </section>
    `;
}

function renderTablature(page) {
    const notes = page.tabNotes || Array.from({ length: 6 }, () => Array(32).fill(""));
    const symbols = page.tabSymbols || Array(32).fill("");
    const durations = page.tabDurations || Array(32).fill("");
    return `
        <section class="tablature-print">
            <div class="tablature-staff">
                <div class="tab-clef" aria-label="Guitar TAB">Guitar<br><strong>T<br>A<br>B</strong></div>
                <div class="tablature-lines">
                    <div class="tab-duration-line">
                        ${durations.map(duration => `<span class="tab-duration">${escapeHtml(duration)}</span>`).join("")}
                    </div>
                    <div class="tab-symbol-line">
                        ${symbols.map(symbol => `<span class="tab-symbol">${escapeHtml(symbol)}</span>`).join("")}
                    </div>
                    ${notes.map(stringNotes => `
                        <div class="tab-line">
                            ${stringNotes.map(note => `<span class="tab-note">${escapeHtml(note)}</span>`).join("")}
                        </div>
                    `).join("")}
                </div>
            </div>
        </section>
    `;
}

function renderPage(page, pageIndex, notebook) {
    const typeLabel = PAGE_TYPE_LABELS[page.type] || "ノート";
    const pageContent = page.type === "note"
        ? `<div class="page-content note-content">${escapeHtml(page.content || "")}</div>`
        : page.content ? `<p class="page-content">${escapeHtml(page.content)}</p>` : "";
    const boardMarkup = page.type === "fretboard"
        ? `<div class="boards">${(page.boards || []).slice(0, 4).map(renderBoard).join("")}</div>`
        : page.type === "chord"
            ? `<div class="chord-grid">${(page.chords || []).slice(0, 8).map(renderChord).join("")}</div>`
        : page.type === "tab"
            ? renderTablature(page)
        : page.type === "cover"
            ? `<div class="cover-content">
                <div class="cover-title">${escapeHtml(notebook.title || "新しいノート")}</div>
            </div>`
        : page.type === "note"
            ? ""
        : `<div class="page-placeholder">
            <h2>${typeLabel}</h2>
            <p>${escapeHtml(page.content || "")}</p>
        </div>`;
    return `
        <article class="paper page-${escapeHtml(page.type || "note")}">
            <div class="paper-topline">
                <span>${pageIndex + 1}ページ目</span>
                <span>${escapeHtml(typeLabel)}</span>
            </div>
            ${page.type === "note" || page.type === "cover" ? "" : `<h1>${escapeHtml(notebook.title || "新しいノート")}</h1>`}
            ${pageContent}
            ${boardMarkup}
            <div class="paper-footer">
                <span><span class="footer-mark">♬</span> © K&amp;S Keanu development</span>
                <span>音録/On-Rock</span>
            </div>
        </article>
    `;
}

function render() {
    const notebook = loadNotebook();
    if (!notebook) {
        printError.hidden = false;
        return;
    }
    document.title = `${notebook.title || "ノート"} | 音録/On-Rock 印刷用`;
    printPages.innerHTML = notebook.pages.map((page, index) =>
        renderPage(page, index, notebook)).join("");
}

document.querySelector("#print-button").addEventListener("click", () => window.print());
render();
