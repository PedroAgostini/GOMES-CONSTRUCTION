/* Gomes's Construction Inc. — form antispam, shared by the home page and the roofing LP.
   Client-side layer only: Web3Forms runs its own spam filter on the server.
   Every form marked [data-antispam] is armed on load; the submit handlers ask
   GomesAntispam.verdict(form) before sending:
     ""      clean, send it
     "bot"   honeypot filled, sent too fast or never touched: drop it quietly
     "links" links in the name or message: ask the person to remove them
     "rate"  too many sends from this browser: point the person to the phone */
(() => {
  "use strict";
  const MIN_MS = 4000;             // a person needs longer than this to get through a three-step form
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX_SENDS = 3;             // per browser, per window
  const STORE = "gomes:sends";
  const TRAPS = ["botcheck", "website"];
  const LINK = /https?:\/\/|www\.|\[url|<a\s/gi;

  const state = new WeakMap();

  const field = (form, name) => form.elements.namedItem(name);
  const value = (form, name) => { const f = field(form, name); return f && typeof f.value === "string" ? f.value.trim() : ""; };

  function arm(form) {
    if (state.has(form)) return;
    const s = { t0: Date.now(), human: false };
    state.set(form, s);
    const mark = () => { s.human = true; };
    ["pointerdown", "keydown", "touchstart"].forEach((ev) => form.addEventListener(ev, mark, { once: true, passive: true }));
  }

  function recent() {
    try {
      const now = Date.now();
      return (JSON.parse(localStorage.getItem(STORE)) || []).filter((t) => now - t < WINDOW_MS);
    } catch (e) { return []; }
  }

  function verdict(form) {
    arm(form);
    const s = state.get(form);
    const trapped = TRAPS.some((n) => {
      const f = field(form, n);
      return f && (f.type === "checkbox" ? f.checked : f.value.trim() !== "");
    });
    if (trapped || !s.human || Date.now() - s.t0 < MIN_MS) return "bot";

    const name = [value(form, "name"), value(form, "first_name"), value(form, "last_name")].join(" ");
    if (name.match(LINK) || (value(form, "message").match(LINK) || []).length > 1) return "links";

    if (recent().length >= MAX_SENDS) return "rate";
    return "";
  }

  // call after a successful send
  function sent() {
    try { localStorage.setItem(STORE, JSON.stringify([...recent(), Date.now()])); } catch (e) { /* storage blocked: skip the rate limit */ }
  }

  // drop the trap fields from the payload sent to Web3Forms
  function clean(data) {
    TRAPS.forEach((n) => delete data[n]);
    return data;
  }

  window.GomesAntispam = { arm, verdict, sent, clean };
  document.querySelectorAll("form[data-antispam]").forEach(arm);
})();
