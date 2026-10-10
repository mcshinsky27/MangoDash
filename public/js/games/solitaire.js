// ---------------------------------------------------------------------------
// MangoDash Solitaire – dependency-free Klondike, mounted by the solitaire
// widget (display.js) inside a fullscreen modal overlay.
// Click-to-move: click a card (or stack), then click where it should go.
// window.MangoSolitaire.mount(container)
// ---------------------------------------------------------------------------
window.MangoSolitaire = (function () {
  const SUITS = ["&#9824;", "&#9827;", "&#9829;", "&#9830;"]; // spades clubs hearts diamonds
  const RED = s => s >= 2; // hearts & diamonds
  const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

  function mount(root) {
    let sel = null; // {pile, idx}
    let moves = 0, secs = 0, timer = null;
    root.innerHTML = `
      <div class="sol-hud">
        <span id="sol-score">&#127939; 0 moves &#183; &#9201; 0s</span>
        <button class="sol-new" id="sol-new">New game</button>
      </div>
      <div class="sol-top">
        <div class="sol-pile" id="sol-stock" title="Draw"></div>
        <div class="sol-pile" id="sol-waste"></div>
        <div class="sol-spacer"></div>
        ${[0, 1, 2, 3].map(i => `<div class="sol-pile sol-foundation" id="sol-f${i}" data-pile="f${i}"></div>`).join("")}
      </div>
      <div class="sol-tableau">
        ${[0, 1, 2, 3, 4, 5, 6].map(i => `<div class="sol-pile sol-t" id="sol-t${i}" data-pile="t${i}"></div>`).join("")}
      </div>`;

    let stock = [], waste = [], foundations = [[], [], [], []], tableau = [[], [], [], [], [], [], []];

    function deal() {
      const deck = [];
      for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r, up: false });
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      stock = []; waste = []; foundations = [[], [], [], []];
      tableau = [[], [], [], [], [], [], []];
      for (let t = 0; t < 7; t++) for (let k = 0; k <= t; k++) {
        const c = deck.pop(); c.up = (k === t); tableau[t].push(c);
      }
      stock = deck;
      moves = 0; secs = 0;
      clearInterval(timer);
      timer = setInterval(tick, 1000);
      updateHud(); render();
    }
    function tick() {
      secs++;
      root.querySelector("#sol-score").innerHTML = "&#127939; " + moves + " moves &#183; &#9201; " + secs + "s";
    }
    function updateHud() {
      root.querySelector("#sol-score").innerHTML = "&#127939; " + moves + " moves &#183; &#9201; " + secs + "s";
    }

    function cardHtml(c, extra) {
      return `<div class="sol-card ${c.up ? (RED(c.s) ? "sol-red" : "sol-black") : "sol-back"} ${extra || ""}"
        data-s="${c.s}" data-r="${c.r}">${c.up ? `<b>${RANKS[c.r - 1]}</b><span>${SUITS[c.s]}</span>` : "&#127183;"}</div>`;
    }

    function render() {
      const stockEl = root.querySelector("#sol-stock");
      stockEl.innerHTML = stock.length ? `<div class="sol-stockback">&#127183;</div>` : "&#8635;";
      const wasteEl = root.querySelector("#sol-waste");
      wasteEl.innerHTML = waste.slice(-1).map(c => cardHtml(c)).join("");
      foundations.forEach((f, i) => {
        root.querySelector("#sol-f" + i).innerHTML = f.length
          ? cardHtml(f[f.length - 1])
          : `<div class="sol-empty">${SUITS[i]}</div>`;
      });
      tableau.forEach((t, i) => {
        root.querySelector("#sol-t" + i).innerHTML = t.length
          ? t.map(c => cardHtml(c, c.up ? "sol-stack" : "")).join("")
          : `<div class="sol-empty">&#13913;</div>`;
      });
      if (sel) highlight();
    }

    function highlight() {
      const el = pileCardEl(sel);
      if (el) el.classList.add("sol-sel");
    }
    function pileCardEl(sel) {
      if (sel.pile === "waste") return root.querySelector("#sol-waste .sol-card");
      if (sel.pile.startsWith("f")) return root.querySelector("#sol-" + sel.pile + " .sol-card");
      const t = root.querySelector("#sol-" + sel.pile);
      if (!t) return null;
      const cards = t.querySelectorAll(".sol-card");
      return cards[sel.idx] || null;
    }

    function getCards(s) {
      // Returns the movable sequence starting at the selection, or null.
      if (s.pile === "waste") return waste.length ? [waste[waste.length - 1]] : null;
      if (s.pile.startsWith("f")) {
        const f = foundations[+s.pile.slice(1)];
        return f.length ? [f[f.length - 1]] : null;
      }
      const t = tableau[+s.pile.slice(1)];
      if (!t.length || s.idx >= t.length) return null;
      const c = t[s.idx];
      if (!c.up) return null;
      return t.slice(s.idx);
    }

    function removeCards(s, n) {
      if (s.pile === "waste") waste.splice(waste.length - n, n);
      else if (s.pile.startsWith("f")) {
        const f = foundations[+s.pile.slice(1)];
        f.splice(f.length - n, n);
      } else {
        const t = tableau[+s.pile.slice(1)];
        t.splice(t.length - n, n);
        // flip the newly exposed tableau card
        if (t.length && !t[t.length - 1].up) t[t.length - 1].up = true;
      }
    }

    function canDrop(cards, dest) {
      const c = cards[0];
      if (dest.startsWith("f")) {
        if (cards.length !== 1) return false;
        const f = foundations[+dest.slice(1)];
        if (!f.length) return c.r === 1; // aces start foundations
        const top = f[f.length - 1];
        return top.s === c.s && c.r === top.r + 1;
      }
      if (!/^[ft]\d$/.test(dest)) return false; // only tableau/foundation targets
      const t = tableau[+dest.slice(1)];
      if (!t.length) return c.r === 13; // kings on empty columns
      const top = t[t.length - 1];
      return top.up && RED(top.s) !== RED(c.s) && c.r === top.r - 1;
    }

    function attempt(dest) {
      const s = sel;
      if (!s) return;
      const cards = getCards(s);
      sel = null;
      if (!cards) { render(); return; }
      if (canDrop(cards, dest)) {
        removeCards(s, cards.length);
        moves++; updateHud();
      }
      render();
      if (foundations.every(f => f.length === 13)) win();
    }

    function win() {
      clearInterval(timer);
      root.querySelector("#sol-score").innerHTML =
        "&#127881; Won in " + moves + " moves &#183; " + secs + "s!";
      [0, 1, 2, 3].forEach(i => root.querySelector("#sol-f" + i).classList.add("sol-celebrate"));
    }

    root.querySelector("#sol-new").addEventListener("click", deal);
    root.querySelector("#sol-stock").addEventListener("click", () => {
      if (stock.length) {
        const c = stock.pop(); c.up = true; waste.push(c);
      } else {
        // recycle the waste back into the stock, face down
        stock = waste.reverse().map(c => { c.up = false; return c; });
        waste = [];
      }
      sel = null; render();
    });

    // One delegated click handler resolves both selection and destinations.
    root.addEventListener("click", e => {
      if (e.target.closest("#sol-new")) return;
      const pileEl = e.target.closest("[data-pile], #sol-waste, #sol-stock");
      if (!pileEl) return;
      const id = pileEl.id;
      if (id === "sol-stock") return; // handled by its own listener
      if (id === "sol-waste") {
        // Waste is never a valid drop target — a click with any selection just
        // cancels it (or re-selects the waste card below).
        if (sel) { sel = null; render(); return; }
        if (waste.length) sel = { pile: "waste", idx: waste.length - 1 };
        render();
        return;
      }
      const dest = pileEl.dataset.pile;
      if (sel) return attempt(dest);
      if (dest.startsWith("f")) {
        const f = foundations[+dest.slice(1)];
        if (f.length) { sel = { pile: dest, idx: f.length - 1 }; render(); }
        return;
      }
      const t = tableau[+dest.slice(1)];
      const cardEl = e.target.closest(".sol-card");
      if (!cardEl) { sel = null; render(); return; }
      const idx = Array.from(t.querySelectorAll(".sol-card")).indexOf(cardEl);
      if (idx < 0 || !t[idx].up) { sel = null; render(); return; }
      sel = { pile: dest, idx };
      render();
    });

    deal();
  }
  return { mount };
})();