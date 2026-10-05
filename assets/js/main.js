/* Gomes's Construction Inc. — interactions */
(() => {
  "use strict";
  const doc = document.documentElement;
  doc.classList.add("js");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // deterministic PRNG so the shingle pattern is identical on every load
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------
     Isometric roof cutaway
     model: x across the eave (0..W), y from ridge (0) to eave (D), z up
  ------------------------------------------------------------------ */
  const C = 0.866, S = 0.5, W = 360, D = 300;

  const LAYERS = [
    { key: "deck",    y0: 0,   y1: 300, t: 14,  top: "#dbb486", front: "#c3966a", right: "#a77c51" },
    { key: "shield",  y0: 0,   y1: 272, t: 3,   top: "#2b2e32", front: "#1f2124", right: "#17191b" },
    { key: "under",   y0: 0,   y1: 244, t: 2.5, top: "#b3bac0", front: "#959ca2", right: "#80878d" },
    { key: "starter", y0: 150, y1: 220, t: 3,   top: "#55595e", front: "#3d4044", right: "#33363a" },
    { key: "shingle", y0: 0,   y1: 194, t: 6,   top: "#3b3e42", front: "#2b2d30", right: "#222427" },
    { key: "ridge",   y0: 0,   y1: 28,  t: 9,   top: "#45484d", front: "#303236", right: "#26282b" }
  ];
  // resting heights (shingles sit on the underlayment, over the starter)
  const Z0 = [0, 14, 17, 19.5, 19.5, 25.5];

  const LAYER_NAMES = ["Solid deck", "Ice & water shield", "Synthetic underlayment", "Starter strip", "Architectural shingles", "Ridge cap"];

  function buildCutaway(svg, { ox, oy, gap, labelX }) {
    const uid = svg.dataset.cutaway;
    const defs = el("defs", {}, svg);
    const blur = el("filter", { id: `${uid}-blur`, x: "-20%", y: "-20%", width: "140%", height: "140%" }, defs);
    el("feGaussianBlur", { stdDeviation: 14 }, blur);

    const P = (x, y, z) => [ox + (x - y) * C, oy + (x + y) * S - z];
    const pts = (arr) => arr.map((p) => p.map((n) => n.toFixed(2)).join(",")).join(" ");
    const topMatrix = (z) => `matrix(${C} ${S} ${-C} ${S} ${ox} ${oy - z})`;

    el("polygon", {
      class: "cw-shadow",
      points: pts([P(-10, 20, -26), P(W + 26, 20, -26), P(W + 26, D + 30, -26), P(-10, D + 30, -26)]),
      fill: "#5a4a40", opacity: ".2", filter: `url(#${uid}-blur)`
    }, svg);

    const groups = [];
    const anchors = [];
    LAYERS.forEach((L, i) => {
      const z0 = Z0[i], z1 = z0 + L.t;
      const g = el("g", { class: "cw-layer", "data-layer": i }, svg);
      const inner = el("g", { class: "cw-inner" }, g);
      const faces = [
        [P(W, L.y0, z1), P(W, L.y1, z1), P(W, L.y1, z0), P(W, L.y0, z0)],
        [P(0, L.y1, z1), P(W, L.y1, z1), P(W, L.y1, z0), P(0, L.y1, z0)]
      ];
      el("polygon", { points: pts(faces[0]), fill: L.right }, inner);
      el("polygon", { points: pts(faces[1]), fill: L.front }, inner);

      const clipId = `${uid}-clip-${i}`;
      const cp = el("clipPath", { id: clipId }, defs);
      el("rect", { x: 0, y: L.y0, width: W, height: L.y1 - L.y0 }, cp);
      const top = el("g", { transform: topMatrix(z1) }, inner);
      el("rect", { x: 0, y: L.y0, width: W, height: L.y1 - L.y0, fill: L.top }, top);
      paintTexture(L.key, el("g", { "clip-path": `url(#${clipId})` }, top), L, i);

      const topFace = [P(0, L.y0, z1), P(W, L.y0, z1), P(W, L.y1, z1), P(0, L.y1, z1)];
      el("polyline", { points: pts([P(0, L.y1, z1), P(W, L.y1, z1), P(W, L.y0, z1)]), fill: "none", stroke: "rgba(255,255,255,.3)", "stroke-width": 1 }, inner);
      // veil: lightens inactive layers without making them see-through
      const veil = el("g", { class: "cw-veil" }, inner);
      [topFace, ...faces].forEach((f) => el("polygon", { points: pts(f), fill: "#fbfaf8" }, veil));
      // active outline
      el("polygon", { class: "cw-outline", points: pts(topFace), fill: "none", stroke: "#e3241b", "stroke-width": 2, "stroke-linejoin": "round" }, inner);

      const ym = (L.y0 + L.y1) / 2;
      const [ax, ay] = P(W, ym, z1 - L.t / 2);
      anchors.push({ ax, ay: ay - i * gap, i });
      groups.push(g);
    });

    // callouts: a parts list on the right, drawn for the fully exploded state
    const callouts = el("g", { class: "cw-callouts" }, svg);
    const sorted = [...anchors].sort((p, q) => p.ay - q.ay);
    let lastY = -Infinity;
    sorted.forEach((p) => { p.ly = Math.max(p.ay, lastY + 34); lastY = p.ly; });
    const calloutEls = [];
    anchors.forEach((p) => {
      const c = el("g", { class: "cw-callout", "data-i": p.i }, callouts);
      el("circle", { cx: p.ax, cy: p.ay, r: 3.2, class: "cw-callout__dot" }, c);
      el("polyline", { points: pts([[p.ax, p.ay], [p.ax + 14, p.ly], [labelX - 8, p.ly]]), class: "cw-callout__line" }, c);
      const t = el("text", { x: labelX, y: p.ly + 4.5, class: "cw-callout__text" }, c);
      const n = el("tspan", { class: "cw-callout__num" }, t); n.textContent = `0${p.i + 1}  `;
      const nm = el("tspan", {}, t); nm.textContent = LAYER_NAMES[p.i];
      calloutEls[p.i] = c;
    });

    return {
      explode(e) {
        groups.forEach((g, i) => { g.style.transform = `translateY(${(-i * gap * e).toFixed(2)}px)`; });
        callouts.style.opacity = clamp((e - .75) / .25).toFixed(3);
        svg.classList.toggle("is-exploded", e > .6);
      },
      focus(idx) {
        groups.forEach((g, i) => {
          g.classList.toggle("is-dim", idx >= 0 && i !== idx);
          g.classList.toggle("is-active", i === idx);
        });
        calloutEls.forEach((c, i) => c.classList.toggle("is-active", i === idx));
      }
    };
  }

  function paintTexture(key, g, L, i) {
    const r = rng(17 + i * 31);
    const line = (x1, y1, x2, y2, stroke, w = 1, op = 1) =>
      el("line", { x1, y1, x2, y2, stroke, "stroke-width": w, opacity: op }, g);

    if (key === "deck") {
      // 4x8 plywood sheets, staggered, with grain and nail lines
      for (let row = 0; row < 3; row++) {
        const y = row * 100;
        line(0, y, W, y, "#9c7349", 1.4, .8);
        const off = row % 2 ? 60 : 0;
        for (let x = off; x < W; x += 120) line(x, y, x, y + 100, "#9c7349", 1.4, .8);
      }
      for (let k = 0; k < 46; k++) {
        const y = r() * D, x = r() * W, len = 30 + r() * 80;
        el("path", { d: `M${x.toFixed(1)} ${y.toFixed(1)} q ${len / 2} ${((r() - .5) * 4).toFixed(1)} ${len} 0`, fill: "none", stroke: "#b08458", "stroke-width": .8, opacity: .45 }, g);
      }
      for (let x = 6; x < W; x += 60) for (let y = 8; y < D; y += 16) el("circle", { cx: x, cy: y, r: .9, fill: "#7c5a39", opacity: .55 }, g);
    }
    if (key === "shield") {
      for (let y = 0; y < L.y1; y += 92) line(0, y, W, y, "#4a4e53", 1.2);
      for (let k = 0; k < 260; k++) el("circle", { cx: (r() * W).toFixed(1), cy: (r() * L.y1).toFixed(1), r: .7, fill: "#5d6166", opacity: .55 }, g);
    }
    if (key === "under") {
      for (let y = 6; y < L.y1; y += 38) {
        line(0, y, W, y, "#8a9197", 1.1);
        line(0, y + 5, W, y + 5, "#c8ced3", .8);
        for (let x = 14; x < W; x += 52) el("rect", { x, y: y + 13, width: 18, height: 3, fill: "#c81e16", opacity: .55 }, g);
      }
    }
    if (key === "starter") {
      line(0, L.y1 - 10, W, L.y1 - 10, "#d8d2c8", 2, .55);
      for (let x = 0; x < W; x += 40) line(x, L.y0, x, L.y1, "#2e3134", 1, .6);
    }
    if (key === "shingle") {
      const tones = ["#3b3e42", "#45494d", "#33363a", "#4f5357", "#2c2f32", "#565a5e", "#3f4246"];
      const EXP = 14;
      for (let y = 0, row = 0; y < L.y1; y += EXP, row++) {
        let x = -((row * 13) % 30);
        while (x < W) {
          const w = 16 + Math.round(r() * 20);
          el("rect", { x: x + .6, y, width: w - 1.2, height: EXP, fill: tones[Math.floor(r() * tones.length)] }, g);
          if (r() > .62) el("rect", { x: x + 2, y: y + EXP - 5, width: w - 4, height: 5, fill: "#000", opacity: .18 }, g);
          x += w;
        }
        line(0, y + EXP, W, y + EXP, "#1c1e21", 1.6, .9);
      }
    }
    if (key === "ridge") {
      for (let x = 0; x < W; x += 24) {
        el("rect", { x: x + .5, y: 0, width: 23, height: L.y1, fill: x % 48 ? "#4a4d52" : "#404347" }, g);
        line(x + 23.5, 0, x + 23.5, L.y1, "#2a2c2f", 1.2);
      }
    }
  }

  /* hero film: honour reduced motion, pause off-screen, user toggle */
  const heroVideo = $("[data-hero-video]"), heroToggle = $("[data-hero-toggle]");
  if (heroVideo && heroToggle) {
    let userPaused = reduced;
    const icon = () => {
      heroToggle.querySelector("use").setAttribute("href", heroVideo.paused ? "#i-play" : "#i-pause");
      heroToggle.setAttribute("aria-label", heroVideo.paused ? "Play background video" : "Pause background video");
    };
    if (reduced) { heroVideo.removeAttribute("autoplay"); heroVideo.pause(); }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !userPaused) heroVideo.play().catch(() => {}); else heroVideo.pause();
    }, { threshold: .1 }).observe(heroVideo);
    heroVideo.addEventListener("play", icon); heroVideo.addEventListener("pause", icon);
    heroToggle.addEventListener("click", () => {
      if (heroVideo.paused) { userPaused = false; heroVideo.play().catch(() => {}); } else { userPaused = true; heroVideo.pause(); }
    });
    icon();
  }

  /* system: pinned scroll explodes the layers */
  const sysSection = $("[data-system]");
  const sysSvg = $('[data-cutaway="system"]');
  if (sysSection && sysSvg) {
    const cut = buildCutaway(sysSvg, { ox: 280, oy: 262, gap: 46, labelX: 622 });
    const sysMq = matchMedia("(max-width: 960px), (max-height: 540px)");
    const sysBox = () => sysSvg.setAttribute("viewBox", sysMq.matches ? "0 -24 620 664" : "10 -170 860 770");
    sysBox(); sysMq.addEventListener("change", sysBox);
    const stick = $(".system__stick");
    const items = $$("[data-layer]", $("[data-layers]"));
    const plates = $$("[data-plate]", sysSection);
    const pinned = () => getComputedStyle(stick).position === "sticky";
    let target = 0, current = -1, active = -1, ticking = false, running = false;

    const setActive = (idx) => {
      if (idx === active) return;
      active = idx;
      items.forEach((li, i) => li.classList.toggle("is-active", i === idx));
      cut.focus(idx);
      const count = $("[data-layer-count]"), name = $("[data-layer-name]"), seal = $("[data-seal]");
      if (count && idx >= 0) count.textContent = String(idx + 1).padStart(2, "0");
      if (name && idx >= 0) name.textContent = LAYER_NAMES[idx];
      if (seal) seal.classList.toggle("is-on", idx === 5);
      const desc = $("[data-layer-desc]");
      if (desc && idx >= 0) {
        const text = items[idx].querySelector("p")?.textContent || "";
        desc.classList.add("is-swap");
        clearTimeout(desc._t);
        desc._t = setTimeout(() => { desc.textContent = text; desc.classList.remove("is-swap"); }, 180);
      }
      const plateIdx = idx >= 4 ? 4 : idx >= 2 ? 2 : 0;
      plates.forEach((p) => p.classList.toggle("is-active", +p.dataset.plate === plateIdx));
    };
    const loop = () => {
      current += (target - current) * .18;
      if (Math.abs(target - current) < .001) current = target;
      cut.explode(current);
      if (current !== target) requestAnimationFrame(loop); else running = false;
    };
    const read = () => {
      ticking = false;
      if (!pinned()) { cut.explode(1); cut.focus(-1); active = -1; items.forEach((li) => li.classList.add("is-active")); return; }
      const rect = sysSection.getBoundingClientRect();
      const span = rect.height - stick.offsetHeight;
      const p = clamp(-rect.top / span);
      target = clamp(p / .2);
      setActive(Math.min(5, Math.floor(clamp((p - .14) / .8) * 6)));
      const lp = clamp((p - .14) / .8);
      $("[data-layers]").style.setProperty("--lp", lp.toFixed(3));
      items.forEach((li, i) => li.style.setProperty("--cp", clamp(lp * 6 - i).toFixed(3)));
      if (reduced) { cut.explode(target); return; }
      if (current < 0) current = target;
      if (!running) { running = true; requestAnimationFrame(loop); }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(read); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", () => { active = -1; onScroll(); });
    items.forEach((li, i) => li.addEventListener("click", () => {
      if (!pinned()) return;
      const span = sysSection.offsetHeight - stick.offsetHeight;
      const p = .14 + (i + .5) / 6 * .8;
      const headerH = parseFloat(getComputedStyle(doc).getPropertyValue("--header-h")) || 0;
      scrollTo({ top: sysSection.getBoundingClientRect().top + scrollY - headerH + span * p, behavior: reduced ? "auto" : "smooth" });
    }));
    read();
  }

  /* header state, current section, call bar */
  const header = $("[data-header]");
  const callbar = $("[data-callbar]");
  const hero = $(".hero");
  const onScrollUi = () => {
    const y = scrollY;
    const menuOpen = header.querySelector("[data-menu-btn]")?.getAttribute("aria-expanded") === "true";
    header.classList.toggle("is-over", !!hero && !menuOpen && y < 40);
    header.classList.toggle("is-scrolled", y > 8);
    if (callbar && hero) callbar.classList.toggle("is-on", y > hero.offsetHeight * .6);
  };
  addEventListener("scroll", onScrollUi, { passive: true });
  onScrollUi();

  const navLinks = $$('.nav a[href^="#"]');
  const sectionIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  navLinks.forEach((a) => { const s = $(a.getAttribute("href")); if (s) sectionIO.observe(s); });

  /* mobile menu */
  const menuBtn = $("[data-menu-btn]"), mobileNav = $("[data-mobile-nav]");
  if (menuBtn && mobileNav) {
    const setMenu = (open) => { menuBtn.setAttribute("aria-expanded", String(open)); mobileNav.hidden = !open; onScrollUi(); };
    menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
    mobileNav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }

  /* reveal on scroll */
  if (!reduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
    $$("[data-reveal]").forEach((n) => {
      const group = n.closest("[data-stagger]");
      const idx = group ? [...group.querySelectorAll("[data-reveal]")].indexOf(n) : 0;
      n.style.transitionDelay = `${Math.min(idx, 8) * 90}ms`;
      io.observe(n);
    });
  } else {
    $$("[data-reveal]").forEach((n) => n.classList.add("is-in"));
  }

  /* gallery: endless, slow auto-drift; drag (mouse or touch) with inertia; arrow keys */
  const car = $("[data-carousel]");
  if (car) {
    const track = $("[data-carousel-track]", car);
    const set = track.firstElementChild;
    const AUTO = reduced ? 0 : 26;              // px per second
    let setW = 0, x = 0, v = 0, dragging = false, lastX = 0, lastT = 0, prev = 0, running = false, visible = false;

    const build = () => {
      track.querySelectorAll(".is-clone").forEach((n) => n.remove());
      setW = set.getBoundingClientRect().width;
      if (!setW) return;
      let total = setW;
      while (total < car.clientWidth + setW) {
        const cl = set.cloneNode(true);
        cl.classList.add("is-clone");
        cl.setAttribute("aria-hidden", "true");
        cl.querySelectorAll("img").forEach((im) => { im.alt = ""; });
        track.appendChild(cl);
        total += setW;
      }
    };
    const wrap = () => {
      if (!setW) return;
      while (x <= -setW) x += setW;
      while (x > 0) x -= setW;
    };
    const frame = (t) => {
      const dt = prev ? Math.min((t - prev) / 1000, .05) : 0;
      prev = t;
      if (!dragging) {
        if (Math.abs(v) > 4) { x += v * dt; v *= Math.pow(.05, dt); }
        else { v = 0; x -= AUTO * dt; }
      }
      wrap();
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
      if (visible || dragging || v) requestAnimationFrame(frame); else { running = false; prev = 0; }
    };
    const start = () => { if (!running) { running = true; prev = 0; requestAnimationFrame(frame); } };

    car.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true; v = 0; lastX = e.clientX; lastT = e.timeStamp;
      car.setPointerCapture(e.pointerId); car.classList.add("is-dragging"); start();
    });
    car.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dtm = Math.max(e.timeStamp - lastT, 8) / 1000;
      x += dx; v = dx / dtm; lastX = e.clientX; lastT = e.timeStamp;
    });
    const release = () => {
      if (!dragging) return;
      dragging = false; car.classList.remove("is-dragging");
      v = Math.max(-2400, Math.min(2400, v)); start();
    };
    car.addEventListener("pointerup", release);
    car.addEventListener("pointercancel", release);
    car.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { v = -900; start(); e.preventDefault(); }
      if (e.key === "ArrowLeft") { v = 900; start(); e.preventDefault(); }
    });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(car);
    set.querySelectorAll("img").forEach((im) => im.addEventListener("load", build, { once: true }));
    addEventListener("resize", build);
    build();
  }

  /* process: the red line follows the scroll */
  const steps = $(".steps"), stepEls = $$(".step");
  if (steps) {
    const upd = () => {
      const r = steps.getBoundingClientRect();
      const p = reduced ? 1 : clamp((innerHeight * .8 - r.top) / (r.height + innerHeight * .2));
      steps.style.setProperty("--p", p.toFixed(3));
      stepEls.forEach((s, i) => s.classList.toggle("is-on", p >= i / 2 - .02));
    };
    addEventListener("scroll", () => requestAnimationFrame(upd), { passive: true });
    upd();
  }

  /* service-area map, plotted from real coordinates */
  const TOWNS = [
    ["Abington", 42.105, -70.945], ["Agawam", 42.070, -72.615], ["Amherst", 42.373, -72.520], ["Ashburnham", 42.636, -71.908],
    ["Ashby", 42.678, -71.820], ["Ashland", 42.261, -71.463], ["Auburn", 42.195, -71.835], ["Ayer", 42.561, -71.590],
    ["Bellingham", 42.087, -71.475], ["Blackstone", 42.018, -71.541], ["Boston", 42.360, -71.058, 1], ["Canton", 42.158, -71.145],
    ["Dedham", 42.242, -71.166], ["Douglas", 42.054, -71.739], ["Easton", 42.025, -71.129], ["Framingham", 42.279, -71.416, 1],
    ["Franklin", 42.083, -71.397, 1], ["Grafton", 42.207, -71.686], ["Groton", 42.611, -71.575], ["Hanover", 42.113, -70.812],
    ["Hardwick", 42.348, -72.200], ["Holliston", 42.200, -71.425], ["Holyoke", 42.204, -72.616], ["Hopedale", 42.131, -71.541],
    ["Hopkinton", 42.229, -71.522], ["Hudson", 42.392, -71.566], ["Leicester", 42.246, -71.909], ["Lexington", 42.447, -71.225],
    ["Longmeadow", 42.050, -72.583], ["Lynn", 42.467, -70.949, 1], ["Malden", 42.425, -71.066], ["Medfield", 42.188, -71.306],
    ["Medway", 42.142, -71.396], ["Mendon", 42.106, -71.552], ["Milford", 42.140, -71.516, 1], ["Millbury", 42.194, -71.760],
    ["Millville", 42.028, -71.581], ["Natick", 42.283, -71.348], ["Norfolk", 42.119, -71.325], ["Northbridge", 42.151, -71.649],
    ["Oxford", 42.117, -71.865], ["Pembroke", 42.065, -70.809], ["Randolph", 42.162, -71.041], ["Raynham", 41.949, -71.073, 1],
    ["Rockland", 42.131, -70.916], ["Sherborn", 42.239, -71.370], ["Spencer", 42.244, -71.993], ["Springfield", 42.102, -72.590, 1],
    ["Sudbury", 42.383, -71.416], ["Sutton", 42.150, -71.763], ["Upton", 42.174, -71.602], ["Uxbridge", 42.077, -71.630],
    ["Walpole", 42.142, -71.249], ["Ware", 42.260, -72.240, 1], ["Webster", 42.050, -71.880, 1], ["Westborough", 42.269, -71.616],
    ["Woburn", 42.479, -71.152, 1], ["Wrentham", 42.067, -71.328]
  ];
  const townList = $("[data-town-list]");
  if (townList) ["Brockton", ...TOWNS.map((t) => t[0])].sort().forEach((name) => {
    const li = document.createElement("li");
    li.textContent = name;
    if (name === "Brockton") li.className = "is-home";
    townList.appendChild(li);
  });
  const mapSvg = $("[data-map]");
  if (mapSvg) {
    const LAT0 = 42.0834, LON0 = -71.0184, MLON = 51.35, MLAT = 69.0, K = 4.2, CX = 320, CY = 200;
    const proj = (lat, lon) => [CX + (lon - LON0) * MLON * K, CY - (lat - LAT0) * MLAT * K];
    const path = (ll, close = true) => "M" + ll.map(([a, b]) => proj(a, b).map((n) => n.toFixed(1)).join(" ")).join("L") + (close ? "Z" : "");
    const g = el("g", {}, mapSvg);
    // land is the paper; the sea is cut out of it in white (coastline approximated, for orientation)
    const SEA = [
      [42.80, -69.40], [42.80, -70.81], [42.70, -70.77], [42.66, -70.63], [42.66, -70.59], [42.60, -70.65], [42.56, -70.78],
      [42.52, -70.87], [42.47, -70.90], [42.43, -70.92], [42.40, -70.99], [42.36, -71.04], [42.33, -71.01], [42.28, -70.97],
      [42.30, -70.90], [42.27, -70.85], [42.24, -70.79], [42.18, -70.72], [42.10, -70.66], [42.04, -70.66], [41.98, -70.64],
      [41.92, -70.55], [41.83, -70.53], [41.77, -70.52], [41.76, -70.42], [41.72, -70.29], [41.75, -70.14], [41.78, -70.01],
      [41.84, -69.98], [41.93, -70.03], [42.00, -70.06], [42.05, -70.17], [42.08, -70.24], [42.06, -70.10], [42.00, -69.99],
      [41.90, -69.95], [41.80, -69.93], [41.68, -69.94], [41.56, -69.98], [41.66, -70.05], [41.65, -70.20], [41.63, -70.29],
      [41.58, -70.45], [41.55, -70.60], [41.52, -70.67], [41.60, -70.65], [41.68, -70.62], [41.74, -70.62], [41.75, -70.72],
      [41.69, -70.76], [41.64, -70.82], [41.60, -70.91], [41.53, -70.98], [41.51, -71.07], [41.49, -71.12], [41.47, -71.19],
      [41.45, -71.24], [41.47, -71.31], [41.40, -71.45], [41.36, -71.50], [41.33, -71.70], [41.30, -71.86], [41.25, -71.90], [41.25, -69.40]
    ];
    el("path", { d: path(SEA), fill: "#ffffff" }, g);
    el("path", { d: path([[41.48, -70.60], [41.46, -70.50], [41.42, -70.46], [41.35, -70.45], [41.34, -70.65], [41.35, -70.80], [41.42, -70.75], [41.46, -70.68]]), fill: "#f3f1ee" }, g);
    el("path", { d: path(SEA), fill: "none", stroke: "#cfc7c0", "stroke-width": 1 }, g);
    // state lines
    const border = { fill: "none", stroke: "#a99f98", "stroke-width": 1.2, "stroke-dasharray": "5 4" };
    el("path", { d: path([[41.49, -71.12], [41.70, -71.13], [41.78, -71.30], [41.90, -71.38], [42.02, -71.38], [42.02, -71.80], [42.03, -72.80]], false), ...border }, g);
    el("path", { d: path([[42.73, -72.60], [42.70, -71.90], [42.70, -71.30], [42.80, -71.10]], false), ...border }, g);
    const lbl = (txt, lat, lon, cls = "map-state") => { const [x, y] = proj(lat, lon); el("text", { x: x.toFixed(1), y: y.toFixed(1), class: cls, "text-anchor": "middle" }, g).textContent = txt; };
    lbl("RHODE ISLAND", 41.70, -71.58); lbl("CONNECTICUT", 41.88, -72.20); lbl("NEW HAMPSHIRE", 42.75, -71.95);
    lbl("ATLANTIC OCEAN", 42.42, -70.40, "map-sea"); lbl("CAPE COD BAY", 41.88, -70.33, "map-sea");
    [15, 30, 45, 60].forEach((mi) => {
      el("circle", { cx: CX, cy: CY, r: mi * K, class: `map-ring${mi === 60 ? " map-ring--60" : ""}` }, g);
      el("text", { x: CX - mi * K * .866 + 6, y: CY + mi * K * .5 + 4, class: `map-ring-lbl${mi === 60 ? " map-ring-lbl--60" : ""}` }, g).textContent = `${mi} MI`;
    });
    const LABEL = { Boston: [7, 4, "start"], Lynn: [7, 4, "start"], Woburn: [-7, 4, "end"], Framingham: [-7, -5, "end"],
      Franklin: [2, 16, "middle"], Milford: [-7, -5, "end"], Raynham: [7, 4, "start"], Webster: [-7, 12, "end"], Ware: [7, 4, "start"] };
    TOWNS.forEach(([name, lat, lon]) => {
      const [x, y] = proj(lat, lon);
      if (x < 4 || x > 636 || y < 4 || y > 416) return;
      const dist = Math.hypot((lon - LON0) * MLON, (lat - LAT0) * MLAT);
      const lab = LABEL[name];
      const t = el("g", { class: `map-town${lab ? " is-major" : ""}${dist > 60 ? " is-out" : ""}` }, g);
      el("title", {}, t).textContent = `${name}, MA · ${Math.round(dist)} mi from Brockton`;
      el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: lab ? 3.2 : 2.4 }, t);
      if (lab) el("text", { x: (x + lab[0]).toFixed(1), y: (y + lab[1]).toFixed(1), "text-anchor": lab[2] }, t).textContent = name;
    });
    // HQ marker: the diamond from the logo
    const hq = el("g", { transform: `translate(${CX} ${CY})` }, g);
    el("circle", { r: 15, fill: "rgba(227,36,27,.14)" }, hq);
    el("circle", { r: 12, fill: "none", stroke: "#e3241b", "stroke-width": 1.5, class: "map-hq-pulse" }, hq);
    el("rect", { x: -7, y: -7, width: 14, height: 14, fill: "#e3241b", stroke: "#fff", "stroke-width": 2.5, transform: "rotate(45)" }, hq);
    el("text", { x: 14, y: -12, "font-family": "Jost, sans-serif", "font-weight": 800, "font-size": 15, fill: "#17120f", "paint-order": "stroke", stroke: "#f3f1ee", "stroke-width": 4, "stroke-linejoin": "round" }, hq).textContent = "Brockton";
    // north arrow + scale bar
    const na = el("g", { transform: "translate(612 30)" }, g);
    el("path", { d: "M0 -14 L6 6 L0 2 L-6 6 Z", fill: "#17120f" }, na);
    el("text", { x: 0, y: 22, "text-anchor": "middle", "font-family": "Jost, sans-serif", "font-weight": 700, "font-size": 11, fill: "#17120f" }, na).textContent = "N";
    const sb = el("g", { transform: "translate(18 398)" }, g);
    el("rect", { x: 0, y: 0, width: 42, height: 5, fill: "#17120f" }, sb);
    el("rect", { x: 42, y: 0, width: 42, height: 5, fill: "#fff", stroke: "#17120f" }, sb);
    el("text", { x: 90, y: 6, "font-family": "Jost, sans-serif", "font-weight": 600, "font-size": 11, fill: "#463d38" }, sb).textContent = "20 mi";
    const list = $("[data-town-list]");
    if (list) list.textContent = ["Brockton", ...TOWNS.map((t) => t[0])].sort().join(" · ");
  }

  /* estimate form: three steps, validated per step, sent to Web3Forms */
  const form = $("[data-form]");
  if (form) {
    const steps = $$("[data-step]", form), dots = $$("[data-step-dot]", form);
    const next = $("[data-next]", form), back = $("[data-back]", form), submit = $("[data-submit]", form);
    const label = $("[data-submit-label]", form), status = $("[data-status]", form);
    let cur = 0;
    const valid = (f) => {
      const inputs = $$("input, textarea", f);
      if (inputs[0].type === "radio") return inputs.some((i) => i.checked);
      const v = inputs[0].value.trim();
      if (inputs[0].type === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      if (inputs[0].type === "tel") return v.replace(/\D/g, "").length >= 10;
      return v.length > 1;
    };
    const required = (st) => $$(".field", st).filter((f) => f.querySelector("[required]"));
    const check = (st) => {
      const list = required(st), bad = list.filter((f) => !valid(f));
      list.forEach((f) => f.classList.toggle("is-invalid", bad.includes(f)));
      if (bad.length) { bad[0].querySelector("input, textarea").focus(); return false; }
      return true;
    };
    const show = (i, focus = true) => {
      cur = i;
      steps.forEach((s, k) => { s.hidden = k !== i; s.classList.toggle("is-active", k === i); });
      dots.forEach((d, k) => { d.classList.toggle("is-current", k === i); d.classList.toggle("is-done", k < i); });
      back.hidden = i === 0;
      next.hidden = i === steps.length - 1;
      submit.hidden = i !== steps.length - 1;
      const first = steps[i].querySelector("input:not([type=radio]), textarea");
      if (focus && first && i > 0) first.focus({ preventScroll: true });
    };
    next.addEventListener("click", () => { if (check(steps[cur])) show(cur + 1); });
    back.addEventListener("click", () => show(cur - 1));
    $$('input[name="service"]', form).forEach((r) => r.addEventListener("change", () => {
      r.closest(".field").classList.remove("is-invalid");
      if (cur === 0) setTimeout(() => show(1), 240);
    }));
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && cur < steps.length - 1) { e.preventDefault(); next.click(); }
    });
    $$(".field", form).forEach((f) => {
      const h = () => { if (f.classList.contains("is-invalid") && valid(f)) f.classList.remove("is-invalid"); };
      f.addEventListener("input", h); f.addEventListener("change", h);
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      for (let k = 0; k < steps.length; k++) {
        if (!required(steps[k]).every(valid)) { show(k, false); check(steps[k]); return; }
      }
      if (form.botcheck.checked) return;
      submit.disabled = true; submit.classList.add("is-loading"); label.textContent = "Sending your request…";
      status.className = "form__status"; status.textContent = "";
      try {
        const data = Object.fromEntries(new FormData(form));
        const res = await fetch(form.action, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(data) });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || out.success === false) throw new Error(out.message || "Request failed");
        form.classList.add("is-sent");
        status.classList.add("is-ok");
        status.textContent = `Thank you, ${String(data.name).split(" ")[0]}. José will call you at ${data.phone}, usually the same day.`;
      } catch (err) {
        status.classList.add("is-err");
        status.innerHTML = 'We couldn\u2019t send your request. Please try again, or call <a href="tel:+17743814481">(774) 381-4481</a>.';
      } finally {
        submit.disabled = false; submit.classList.remove("is-loading"); label.textContent = "Request My Free Estimate";
      }
    });
    show(0, false);
  }

  /* live open / closed status, computed in Massachusetts time (Mon–Sat 7 AM–6 PM) */
  const statusEl = $("[data-status-hours]");
  if (statusEl) {
    const render = () => {
      const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", hourCycle: "h23", minute: "numeric" })
        .formatToParts(new Date()).map((p) => [p.type, p.value]));
      const mins = (+parts.hour) * 60 + (+parts.minute);
      const day = parts.weekday;
      const open = day !== "Sun" && mins >= 420 && mins < 1080;
      const next = day === "Sun" || (day === "Sat" && mins >= 1080) ? "Monday" : mins < 420 ? "today" : "tomorrow";
      statusEl.classList.toggle("is-closed", !open);
      statusEl.querySelector("span").textContent = open ? "Open now · until 6 PM" : `Closed · opens 7 AM ${next}`;
      statusEl.hidden = false;
    };
    render(); setInterval(render, 60000);
  }

  /* image skeletons: shimmer until the photo has loaded */
  $$(".plate").forEach((box) => {
    const media = box.querySelector("img, video");
    const done = () => box.classList.add("is-loaded");
    if (!media) return done();
    if (media.tagName === "VIDEO") {
      if (!media.poster) return done();
      const im = new Image(); im.onload = done; im.onerror = done; im.src = media.poster; return;
    }
    if (media.complete && media.naturalWidth) return done();
    media.addEventListener("load", done, { once: true });
    media.addEventListener("error", done, { once: true });
  });

  /* magnetic CTAs: fine pointers only, never under reduced motion */
  if (!reduced && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    $$("[data-magnetic]").forEach((b) => {
      b.classList.add("is-magnet");
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * .16).toFixed(1) + "px");
        b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * .28).toFixed(1) + "px");
      });
      b.addEventListener("pointerleave", () => { b.style.setProperty("--mx", "0px"); b.style.setProperty("--my", "0px"); });
    });
  }

  const yr = $("[data-year]");
  if (yr) yr.textContent = new Date().getFullYear();
})();
