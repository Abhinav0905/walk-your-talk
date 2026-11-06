/**
 * Walk Your Talk — session logic.
 *
 * Pure TypeScript with no Lens Studio APIs, so the same file runs inside the
 * Lens and under `node --test`. It owns every decision (what is placed, which
 * spot comes next, what was recalled); the scene scripts only render it.
 */

export type Phase = "intro" | "build" | "walk" | "recall" | "debrief";
export type Grade = "got" | "missed";

export interface Beat {
  /** Stable id used by scene objects and tests. */
  id: string;
  /** The words the speaker must remember, kept to a glanceable length. */
  cue: string;
  /** The memorable image that stands for the beat. */
  image: string;
  /** Where the image sits on the route, in plain words. */
  spot: string;
}

/** Sample talk for the demo: a two-minute wedding toast in five beats. */
export const SAMPLE_TOAST: Beat[] = [
  {id: "thanks", cue: "Thank everyone for coming", image: "a sunflower bouquet", spot: "kitchen island"},
  {id: "camping", cue: "How I met Sam: the camping trip", image: "an orange tent", spot: "end of the island"},
  {id: "bowling", cue: "Sam met Alex at the bowling alley", image: "a giant bowling pin", spot: "chair by the window"},
  {id: "patience", cue: "Alex taught Sam patience", image: "a golden snail", spot: "dining chair"},
  {id: "toast", cue: "Raise your glasses to Sam and Alex", image: "a champagne flute", spot: "dining table"}
];

export interface PalaceEvent {
  kind: "started" | "placed" | "built" | "arrived" | "walked" | "recallStarted" | "revealed" | "graded" | "finished" | "practice" | "restarted" | "ignored";
  index: number;
  detail?: string;
}

export class PalaceModel {
  readonly beats: Beat[];
  phase: Phase = "intro";
  /** Index of the beat the user is working on, or -1 when nothing is in focus. */
  focus = -1;
  /** 1 for the full palace; each "practice missed" pass increments it. */
  round = 1;
  placed: boolean[] = [];
  visited: boolean[] = [];
  revealed: boolean[] = [];
  grades: (Grade | null)[] = [];
  /** Beats included in the current walk and recall pass, in route order. */
  queue: number[] = [];
  /** First-pass result for each beat; later practice never overwrites it. */
  firstPass: (Grade | null)[] = [];
  readonly log: PalaceEvent[] = [];

  constructor(beats: Beat[] = SAMPLE_TOAST) {
    if (beats.length < 1) throw new Error("A palace needs at least one beat");
    this.beats = beats;
    this.clear();
  }

  get count(): number { return this.beats.length; }

  /** Start building from the intro card. */
  start(): PalaceEvent {
    if (this.phase !== "intro") return this.ignore(-1, "start outside intro");
    this.phase = "build";
    this.focus = 0;
    return this.emit("started", 0);
  }

  /** Drop the image for beat `i` on its spot. Beats are placed in route order. */
  place(i: number): PalaceEvent {
    if (this.phase !== "build" || i !== this.focus || this.placed[i]) return this.ignore(i, "place out of order");
    this.placed[i] = true;
    const next = this.placed.indexOf(false);
    if (next >= 0) {
      this.focus = next;
      return this.emit("placed", i);
    }
    this.phase = "walk";
    this.queue = this.beats.map((_, k) => k);
    this.focus = this.queue[0];
    this.emit("placed", i);
    return this.emit("built", i);
  }

  /**
   * The user reached spot `i` on the walk, either by walking up to it or by
   * pinching it (for anyone who cannot walk the room). Only the next spot in
   * route order counts, which keeps the sequence intact.
   */
  arrive(i: number): PalaceEvent {
    if (this.phase !== "walk" || i !== this.focus || this.visited[i]) return this.ignore(i, "arrive out of order");
    this.visited[i] = true;
    const next = this.queue.find(k => !this.visited[k]);
    this.focus = next === undefined ? -1 : next;
    this.emit("arrived", i);
    return next === undefined ? this.emit("walked", i) : this.log[this.log.length - 1];
  }

  get walkComplete(): boolean {
    return this.phase === "walk" && this.queue.length > 0 && this.queue.every(k => this.visited[k]);
  }

  /** Begin the memory check once the whole route has been walked. */
  beginRecall(): PalaceEvent {
    if (!this.walkComplete) return this.ignore(-1, "recall before walk finished");
    this.phase = "recall";
    for (const k of this.queue) { this.revealed[k] = false; this.grades[k] = null; }
    this.focus = this.queue[0];
    return this.emit("recallStarted", this.focus);
  }

  /** Check the hidden beat after saying it out loud. */
  reveal(i: number): PalaceEvent {
    if (this.phase !== "recall" || i !== this.focus || this.revealed[i]) return this.ignore(i, "reveal out of order");
    this.revealed[i] = true;
    return this.emit("revealed", i);
  }

  /** Honest self-grade after the reveal. */
  grade(i: number, result: Grade): PalaceEvent {
    if (this.phase !== "recall" || i !== this.focus || !this.revealed[i] || this.grades[i] !== null) {
      return this.ignore(i, "grade before reveal or out of order");
    }
    this.grades[i] = result;
    if (this.round === 1) this.firstPass[i] = result;
    const next = this.queue.find(k => this.grades[k] === null);
    this.emit("graded", i, result);
    if (next !== undefined) {
      this.focus = next;
      return this.log[this.log.length - 1];
    }
    this.phase = "debrief";
    this.focus = -1;
    return this.emit("finished", i);
  }

  /** Beats the user marked as missed in the most recent recall pass. */
  get missed(): number[] {
    return this.queue.filter(k => this.grades[k] === "missed");
  }

  /** Walk and recall only the beats that were missed. */
  practiceMissed(): PalaceEvent {
    const missed = this.missed;
    if (this.phase !== "debrief" || missed.length === 0) return this.ignore(-1, "nothing to practice");
    this.round += 1;
    this.queue = missed;
    for (const k of missed) { this.visited[k] = false; this.revealed[k] = false; this.grades[k] = null; }
    this.phase = "walk";
    this.focus = missed[0];
    return this.emit("practice", this.focus, String(missed.length));
  }

  /** Clear everything and return to the intro card. */
  restart(): PalaceEvent {
    this.clear();
    return this.emit("restarted", -1);
  }

  /** Score of the first full recall, which is what the debrief reports. */
  firstPassScore(): {got: number; total: number} {
    return {got: this.firstPass.filter(g => g === "got").length, total: this.count};
  }

  /** Score of the latest recall pass over its own queue. */
  passScore(): {got: number; total: number} {
    return {got: this.queue.filter(k => this.grades[k] === "got").length, total: this.queue.length};
  }

  private clear(): void {
    this.phase = "intro";
    this.focus = -1;
    this.round = 1;
    const n = this.beats.length;
    this.placed = new Array(n).fill(false);
    this.visited = new Array(n).fill(false);
    this.revealed = new Array(n).fill(false);
    this.grades = new Array(n).fill(null);
    this.firstPass = new Array(n).fill(null);
    this.queue = [];
  }

  private emit(kind: PalaceEvent["kind"], index: number, detail?: string): PalaceEvent {
    const event: PalaceEvent = {kind, index, detail};
    this.log.push(event);
    return event;
  }

  private ignore(index: number, detail: string): PalaceEvent {
    return {kind: "ignored", index, detail};
  }
}
