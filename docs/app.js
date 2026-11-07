// Browser companion for Walk Your Talk. PalaceModel is compiled from the
// Lens's own Assets/Scripts/PalaceModel.ts, so every rule here (route order,
// reveal before grading, honest first pass, practice of missed beats) is the
// same code the SPECS Lens runs. Buttons stand in for walking and pinching.
import {PalaceModel} from "./palace-model.js";

const EMOJI = ["💐", "⛺", "🎳", "🐌", "🥂"];
const SPOT = [[255, 425], [415, 335], [300, 85], [160, 190], [90, 155]];
const STAND = [[178, 440], [355, 275], [268, 165], [200, 258], [118, 232]];
const VIA = {1: [[178, 320], [280, 270]]};
const START = [160, 470];
const $ = id => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";

let model = new PalaceModel();
let gate = "intro";       // "intro" | "walkCard" | "recallCard" | null: a phase card is waiting
let cue = -1;             // beat whose cue is showing after arriving
let busy = false;
let you = [...START];

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(svgNS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function drawSpots() {
  const g = $("spots");
  g.textContent = "";
  model.beats.forEach((beat, i) => {
    const [x, y] = SPOT[i];
    const spot = el("g", {class: "spot", transform: `translate(${x} ${y})`, tabindex: "0", role: "button", "aria-label": `Spot ${i + 1}: ${beat.spot}`}, g);
    el("circle", {r: 22, class: "ring"}, spot);
    spot.addEventListener("click", () => pinchSpot(i));
    spot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pinchSpot(i); } });
  });
}

function refreshMap() {
  const m = model;
  const spots = $("spots").children;
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const inQueue = m.queue.includes(i);
    s.setAttribute("class", "spot");
    s.querySelectorAll("text").forEach(t => t.remove());
    if (m.phase === "intro") { s.style.display = "none"; continue; }
    s.style.display = "";
    const hidden = m.phase === "recall" && inQueue && !m.revealed[i];
    if (m.focus === i && !gate) s.classList.add("focus");
    if (m.phase === "walk" && m.visited[i] && inQueue) s.classList.add("visited");
    if ((m.phase === "recall" || m.phase === "debrief") && m.grades[i]) s.classList.add(m.grades[i]);
    if (hidden) {
      s.classList.add("hidden");
      el("text", {class: "q"}, s).textContent = "?";
    } else if (m.placed[i]) {
      el("text", {class: "obj"}, s).textContent = EMOJI[i];
    } else {
      el("text", {class: "num", y: 5}, s).textContent = String(i + 1);
    }
  }
  const route = $("route");
  route.textContent = "";
  const pts = [START, ...SPOT.filter((_, i) => m.placed[i])];
  for (let k = 0; k < pts.length - 1; k++) {
    const [a, b] = [pts[k], pts[k + 1]];
    const n = Math.max(2, Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 14));
    for (let j = 1; j < n; j++) el("circle", {cx: a[0] + (b[0] - a[0]) * j / n, cy: a[1] + (b[1] - a[1]) * j / n, r: 2.4, class: "route-dot"}, route);
  }
  $("you").setAttribute("transform", `translate(${you[0]} ${you[1]})`);
  $("phase-label").textContent = {intro: "THE ROOM", build: "BUILD", walk: m.round > 1 ? "PRACTICE WALK" : "WALK", recall: "RECALL", debrief: "DEBRIEF"}[m.phase];
}

function frame(name) {
  const img = $("frame");
  const src = `./frames/${name}.jpg`;
  if (img.getAttribute("src") !== src) img.setAttribute("src", src);
}

function view({eyebrow, title, body, actions = []}) {
  $("eyebrow").textContent = eyebrow;
  $("title").textContent = title;
  $("body").textContent = body || "";
  const box = $("actions");
  box.textContent = "";
  for (const a of actions) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = a.label;
    if (a.kind) b.className = a.kind;
    b.disabled = busy;
    b.addEventListener("click", a.run);
    box.appendChild(b);
  }
}

function render() {
  const m = model;
  const f = m.focus;
  refreshMap();
  if (m.phase === "intro") {
    frame("intro");
    return view({eyebrow: "WALK YOUR TALK", title: "Memorize a talk by walking your room",
      body: "The five beats of a two-minute wedding toast become five odd objects placed around you. Walk past them to rehearse, then check what stuck.",
      actions: [{label: "Build my palace", run: () => { model.start(); gate = null; render(); }}]});
  }
  if (m.phase === "build") {
    const b = m.beats[f];
    frame(`build-${f + 1}`);
    return view({eyebrow: `BEAT ${f + 1} OF ${m.count} · BUILD`, title: b.cue,
      body: `Pinch the glowing spot to drop ${b.image} on the ${b.spot}.`,
      actions: [{label: `Drop ${b.image}`, run: () => pinchSpot(f)}]});
  }
  if (m.phase === "walk") {
    if (gate === "walkCard") {
      frame("built");
      return view({eyebrow: m.round > 1 ? `PRACTICE · ROUND ${m.round}` : "PALACE BUILT · 5 OF 5", title: m.round > 1 ? (m.queue.length === 1 ? "Walk the missed beat" : "Walk the missed beats") : "Now walk the route",
        body: m.round > 1 ? "Only the beats you missed are on this route. Walk to each, say it, and look at the object a little longer." : "Walk to each object in order and say its beat out loud. Can't walk the room? Pinch the next glowing spot instead.",
        actions: [{label: "Start walking", run: () => { gate = null; render(); }}]});
    }
    if (gate === "recallCard") {
      frame("walk-5");
      return view({eyebrow: m.round > 1 ? "PRACTICE ROUTE WALKED" : "ROUTE WALKED", title: "Now from memory",
        body: "The objects hide. Walk the route again and say each beat before you pinch the ? to check yourself.",
        actions: [{label: "Start recall", run: () => { model.beginRecall(); gate = null; cue = -1; render(); }}]});
    }
    const next = f >= 0 ? m.beats[f] : null;
    if (cue >= 0) frame(`walk-${cue + 1}`); else frame("built");
    const shown = cue >= 0 ? m.beats[cue] : null;
    return view({eyebrow: shown ? `BEAT ${cue + 1} OF ${m.count}` : "WALK",
      title: shown ? shown.cue : "Walk to the glowing spot",
      body: shown ? "Say it out loud." + (next ? ` Next: the ${next.spot}.` : "") : `Head for the ${next.spot}. The gold arrow and a soft chime point the way on glasses.`,
      actions: next ? [{label: `Walk to the ${next.spot}`, run: () => walkTo(f)}] : []});
  }
  if (m.phase === "recall") {
    const b = m.beats[f];
    if (!m.revealed[f]) {
      frame(`hidden-${f + 1}`);
      return view({eyebrow: `BEAT ${f + 1} OF ${m.count} · FROM MEMORY`, title: "What goes here?",
        body: `You're at the ${b.spot}. Say the beat out loud, then pinch the ? to check.`,
        actions: [{label: "Pinch the ? to check", run: () => pinchSpot(f)}]});
    }
    frame(m.round > 1 && f === 3 ? "practice-check" : `check-${f + 1}`);
    return view({eyebrow: `BEAT ${f + 1} OF ${m.count} · CHECK`, title: b.cue,
      body: "Did you say it before you looked?",
      actions: [{label: "Got it", kind: "got", run: () => grade("got")}, {label: "Missed", kind: "missed", run: () => grade("missed")}]});
  }
  // Debrief
  const first = m.firstPassScore();
  const pass = m.passScore();
  const missed = m.missed;
  frame(m.round > 1 ? "final" : "debrief");
  const lines = m.round === 1
    ? [`Recalled: ${m.queue.filter(k => m.grades[k] === "got").map(k => k + 1).join(", ") || "none yet"}`]
    : [`Practice round ${m.round}: ${pass.got} of ${pass.total} recalled.`, `First full pass: ${first.got} of ${first.total}.`];
  missed.forEach(k => lines.push(`Practice ${k + 1}: ${m.beats[k].cue}`));
  view({eyebrow: m.round === 1 ? "DEBRIEF · FIRST WALK" : `DEBRIEF · ROUND ${m.round}`,
    title: m.round === 1 ? `${first.got} of ${first.total} from memory` : (missed.length ? `${pass.got} of ${pass.total} this round` : "Every beat is back"),
    body: lines.join("  ·  ") + "  (picture: the Lens's debrief from the recorded run)",
    actions: [
      ...(missed.length ? [{label: missed.length === 1 ? "Practice the missed beat" : "Practice missed beats", run: () => { model.practiceMissed(); gate = "walkCard"; cue = -1; render(); }}] : []),
      {label: "Start over", kind: "secondary", run: restart}
    ]});
}

function pinchSpot(i) {
  if (busy || gate) return;
  const m = model;
  if (m.phase === "build") { if (m.place(i).kind === "built") gate = "walkCard"; render(); }
  else if (m.phase === "walk") walkTo(i);
  else if (m.phase === "recall") { m.reveal(i); render(); }
}

function grade(result) {
  model.grade(model.focus, result);
  render();
}

function animate(path, done) {
  busy = true;
  render();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const legs = [you, ...path];
  let k = 0;
  const step = () => {
    if (k >= legs.length - 1) { busy = false; done(); return; }
    const [a, b] = [legs[k], legs[k + 1]];
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ms = reduce ? 0 : Math.max(250, dist * 4);
    const t0 = performance.now();
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI + 90;
    const tick = now => {
      const t = ms ? Math.min(1, (now - t0) / ms) : 1;
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      you = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
      $("you").setAttribute("transform", `translate(${you[0]} ${you[1]}) rotate(${angle})`);
      if (t < 1) requestAnimationFrame(tick); else { k++; step(); }
    };
    requestAnimationFrame(tick);
  };
  step();
}

function walkTo(i) {
  if (busy || model.phase !== "walk" || i !== model.focus) return;
  animate([...(VIA[i] || []), STAND[i]], () => {
    const ev = model.arrive(i);
    cue = i;
    if (ev.kind === "walked") gate = "recallCard";
    render();
  });
}

function restart() {
  model = new PalaceModel();
  gate = "intro";
  cue = -1;
  busy = false;
  you = [...START];
  render();
}

$("restart").addEventListener("click", restart);
// Preload the real Lens frames so each step swaps instantly.
["intro", "built", "debrief", "final", "practice-check", ...[1, 2, 3, 4, 5].flatMap(k => [`build-${k}`, `walk-${k}`, `hidden-${k}`, `check-${k}`])]
  .forEach(n => { const img = new Image(); img.src = `./frames/${n}.jpg`; });
drawSpots();
render();
