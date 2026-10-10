// ---------------------------------------------------------------------------
// MangoDash Minesweeper – dependency-free DOM game, mounted by the
// minesweeper widget (display.js) inside a fullscreen modal overlay.
// window.MangoMinesweeper.mount(container, { cols, rows, mines })
// ---------------------------------------------------------------------------
window.MangoMinesweeper = (function () {
  function mount(root, opts) {
    opts = opts || {};
    const COLS = opts.cols || 9, ROWS = opts.rows || 9, MINES = opts.mines || 10;
    root.innerHTML = `
      <div class="ms-hud">
        <span class="ms-counter" id="ms-mines">&#128163; ${MINES}</span>
        <button class="ms-restart" id="ms-face">&#128578;</button>
        <span class="ms-timer" id="ms-time">&#9201; 0s</span>
      </div>
      <div class="ms-board" id="ms-board" style="grid-template-columns:repeat(${COLS},34px)"></div>
      <div class="ms-status" id="ms-status"></div>`;
    const board = root.querySelector("#ms-board");
    const face = root.querySelector("#ms-face");
    const status = root.querySelector("#ms-status");
    const cells = [];
    let started = false, over = false, flags = 0, revealed = 0, timer = null, secs = 0;

    // Build blank grid (safe first click: mines placed after the first reveal).
    for (let i = 0; i < COLS * ROWS; i++) {
      const c = document.createElement("div");
      c.className = "ms-cell";
      c.dataset.i = i;
      board.appendChild(c);
      cells.push({ el: c, mine: false, open: false, flag: false, n: 0 });
      c.addEventListener("click", () => reveal(i));
      c.addEventListener("contextmenu", e => { e.preventDefault(); toggleFlag(i); });
    }

    function neighbors(i) {
      const x = i % COLS, y = Math.floor(i / COLS), out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) out.push(ny * COLS + nx);
      }
      return out;
    }

    function placeMines(safe) {
      const forbidden = new Set([safe, ...neighbors(safe)]);
      let placed = 0;
      while (placed < MINES) {
        const i = Math.floor(Math.random() * cells.length);
        if (forbidden.has(i) || cells[i].mine) continue;
        cells[i].mine = true; placed++;
      }
      cells.forEach((c, i) => { c.n = neighbors(i).filter(j => cells[j].mine).length; });
      startTimer();
    }

    function startTimer() {
      if (timer) return;
      timer = setInterval(() => {
        secs++;
        root.querySelector("#ms-time").innerHTML = "&#9201; " + secs + "s";
      }, 1000);
    }

    function toggleFlag(i) {
      const c = cells[i];
      if (over || c.open) return;
      c.flag = !c.flag;
      flags += c.flag ? 1 : -1;
      c.el.classList.toggle("ms-flag", c.flag);
      c.el.innerHTML = c.flag ? "&#128681;" : "";
      root.querySelector("#ms-mines").innerHTML = "&#128163; " + Math.max(0, MINES - flags);
    }

    function reveal(i) {
      const c = cells[i];
      if (over || c.open || c.flag) return;
      if (!started) { started = true; placeMines(i); }
      c.open = true; revealed++;
      c.el.classList.add("ms-open");
      if (c.mine) { return lose(c); }
      if (c.n) { c.el.textContent = c.n; c.el.dataset.n = c.n; return checkWin(); }
      neighbors(i).forEach(reveal);
      checkWin();
    }

    function lose(hit) {
      over = true; clearInterval(timer);
      cells.forEach(c => { if (c.mine) { c.el.classList.add("ms-open", "ms-mine"); c.el.innerHTML = "&#128163;"; } });
      hit.el.classList.add("ms-boom");
      face.innerHTML = "&#128565;";
      status.innerHTML = "&#128165; Boom! " + secs + "s &#8211; click the face to play again";
      status.className = "ms-status ms-lose";
    }

    function checkWin() {
      if (over || revealed !== COLS * ROWS - MINES) return;
      over = true; clearInterval(timer);
      cells.forEach(c => { if (c.mine && !c.flag) { c.el.classList.add("ms-flag"); c.el.innerHTML = "&#128681;"; } });
      face.innerHTML = "&#127881;";
      status.innerHTML = "&#127881; Cleared in " + secs + "s! Click the face for a new board";
      status.className = "ms-status ms-win";
    }

    face.addEventListener("click", () => mount(root, opts)); // fresh board
  }
  return { mount };
})();