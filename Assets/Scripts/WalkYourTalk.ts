/**
 * Walk Your Talk — main controller.
 *
 * Turns the five beats of a talk into five memorable objects placed along a
 * route through the room (method of loci). The user builds the palace by
 * pinching each glowing spot, rehearses by walking past the objects, then
 * checks recall from memory. PalaceModel owns every decision; this script
 * renders state, reads the camera position and routes input.
 */
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {PalaceModel, PalaceEvent, SAMPLE_TOAST, Grade} from "./PalaceModel";
import {GeometryBuilder, meshObject} from "./PalaceGeometry";
import {PalaceCard, CardView} from "./PalaceCard";

const SOUNDS: {[key: string]: AudioTrackAsset} = {
  drop: requireAsset("../GeneratedSFX/Drop.wav") as AudioTrackAsset,
  beacon: requireAsset("../GeneratedSFX/Beacon.wav") as AudioTrackAsset,
  reveal: requireAsset("../GeneratedSFX/Reveal.wav") as AudioTrackAsset,
  got: requireAsset("../GeneratedSFX/GotIt.wav") as AudioTrackAsset,
  missed: requireAsset("../GeneratedSFX/Missed.wav") as AudioTrackAsset,
  tap: requireAsset("../GeneratedSFX/Tap.wav") as AudioTrackAsset
};

const C = {
  gold: new vec4(1.0, 0.78, 0.32, 1),
  mint: new vec4(0.45, 0.96, 0.76, 1),
  lilac: new vec4(0.76, 0.64, 1.0, 1),
  amber: new vec4(1.0, 0.56, 0.32, 1),
  white: new vec4(1, 1, 1, 1)
};

/**
 * Lens Studio previews the left eye, whose display sits slightly right of the
 * camera centre; nudging head-relative cards a few centimetres right centres
 * them in the display without mattering on device.
 */
const VIEW_BIAS = 6;

/** What a placed image looks like, per beat. Heights are real centimetres. */
const IMAGE_NAMES = ["sunflower bouquet", "orange tent", "giant bowling pin", "golden snail", "champagne flute"];

interface Spot {
  index: number;
  root: SceneObject;
  image: SceneObject;
  imageScale: vec3;
  imageCenter: vec3;
  imageRotation: quat;
  ring: SceneObject;
  ringMat: Material;
  halo: SceneObject;
  haloMat: Material;
  orb: SceneObject;
  orbMat: Material;
  badge: SceneObject;
  badgeText: Text;
  target: SceneObject;
  audio: AudioComponent;
  popT: number;
  wakeT: number;
}

@component
export class WalkYourTalk extends BaseScriptComponent {
  @ui.label("Walk Your Talk | controller")
  @ui.group_start("References")
  @input @hint("World-tracked camera (Camera Object)") camera!: SceneObject;
  @input @hint("Unlit, alpha-blended material used for rings, dots, orbs and arrow") glow!: Material;
  @input @hint("Intro, phase and debrief card") mainCard!: PalaceCard;
  @input @hint("Card that sits next to the spot in focus") spotCard!: PalaceCard;
  @ui.group_end
  @ui.group_start("Tuning")
  @input @hint("Walking within this horizontal distance (cm) of the next spot counts as arriving") @widget(new SliderWidget(60, 250, 5)) arriveRadius: number = 90;
  @input @hint("Seconds a beat's cue stays up after you arrive") @widget(new SliderWidget(2, 12, 0.5)) cueSeconds: number = 6;
  @input @hint("Seconds between beacon chimes from the next spot") @widget(new SliderWidget(2, 10, 0.5)) beaconSeconds: number = 4.5;
  @input @hint("Floor height relative to the starting head position (cm)") floorY: number = -135;
  @ui.group_end

  readonly model = new PalaceModel(SAMPLE_TOAST);
  private spots: Spot[] = [];
  private uiAudio: {[key: string]: AudioComponent} = {};
  private pathRoot: SceneObject;
  private pathVisual: RenderMeshVisual | null = null;
  private pathMat: Material;
  private arrow: SceneObject;
  private gradeGot: SceneObject;
  private gradeMissed: SceneObject;
  private arrowMat: Material;
  private startFloor = new vec3(0, -135, 0);
  /** True while a phase card is up; arrivals and spot pinches wait for it. */
  private gated = true;
  private cueIndex = -1;
  private cueTimer = 0;
  private beaconTimer = 0;
  private pendingCard: {view: CardView; delay: number} | null = null;
  private time = 0;

  onAwake(): void {
    this.pathRoot = this.child(this.sceneObject, "RoutePath");
    this.pathMat = this.glow.clone();
    this.pathMat.mainPass.baseColor = new vec4(C.gold.x, C.gold.y, C.gold.z, 0.75);
    this.buildSpots();
    this.buildArrow();
    this.gradeGot = this.buildGradeButton("GradeGot", "Got it", C.mint, "got");
    this.gradeMissed = this.buildGradeButton("GradeMissed", "Missed", C.amber, "missed");
    this.buildAudio();
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  // ───────────────────────── setup ─────────────────────────

  private buildSpots(): void {
    for (let i = 0; i < this.model.count; i++) {
      const root = this.findChild(this.sceneObject, "Spot_" + (i + 1));
      if (!root) { print("WalkYourTalk: missing Spot_" + (i + 1)); continue; }
      const image = this.findChild(root, "Image");
      const imageScale = image.getTransform().getLocalScale();
      const imageCenter = image.getTransform().getLocalPosition();
      const imageRotation = image.getTransform().getLocalRotation();

      const halo = meshObject(root, root.name + "_Halo", new GeometryBuilder().disc(17, 48, 0.4).build(), this.glow, new vec4(C.gold.x, C.gold.y, C.gold.z, 0.16));
      const ring = meshObject(root, root.name + "_Ring", new GeometryBuilder().ring(15.5, 18, 72, 0.6).build(), this.glow, C.gold);
      const orb = meshObject(root, root.name + "_Orb", new GeometryBuilder().sphere(9).build(), this.glow, new vec4(C.lilac.x, C.lilac.y, C.lilac.z, 0.55));
      orb.object.getTransform().setLocalPosition(new vec3(0, Math.max(14, imageCenter.y), 0));
      const orbMark = this.label(orb.object, root.name + "_OrbMark", "?", 420, C.white);
      orbMark.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 9.5));

      const badge = this.child(root, root.name + "_Badge", new vec3(0, 16, 0));
      const badgeText = this.label(badge, root.name + "_BadgeText", String(i + 1), 380, C.gold);

      // A generous invisible pinch target around where the image sits.
      const target = this.child(root, root.name + "_Target", new vec3(0, Math.max(14, imageCenter.y), 0));
      const collider = target.createComponent("Physics.ColliderComponent") as ColliderComponent;
      const shape = Shape.createSphereShape();
      shape.radius = 20;
      collider.shape = shape;
      collider.fitVisual = false;
      const interactable = target.createComponent(Interactable.getTypeName()) as Interactable;

      const audio = root.createComponent("Component.AudioComponent") as AudioComponent;
      audio.audioTrack = SOUNDS.beacon;
      audio.volume = 0.6;
      audio.playbackMode = Audio.PlaybackMode.LowLatency;
      audio.spatialAudio.enabled = true;
      audio.spatialAudio.positionEffect.enabled = true;

      this.spots.push({
        index: i, root, image, imageScale, imageCenter, imageRotation,
        ring: ring.object, ringMat: ring.material, halo: halo.object, haloMat: halo.material,
        orb: orb.object, orbMat: orb.material, badge, badgeText, target, audio, popT: -1, wakeT: -1
      });
      this.createEvent("OnStartEvent").bind(() => {
        interactable.onTriggerEnd.add(() => this.onSpotPinched(i));
      });
    }
  }

  /** Two big round targets flank the revealed object: honest self-grading. */
  private buildGradeButton(name: string, label: string, color: vec4, command: string): SceneObject {
    const root = this.child(this.sceneObject, name);
    const disc = meshObject(root, name + "_Disc", new GeometryBuilder().sphere(5.5, 14, 22).build(), this.glow, new vec4(color.x, color.y, color.z, 0.85));
    disc.object.getTransform().setLocalScale(new vec3(1, 1, 0.35));
    const text = this.label(root, name + "_Label", label, 135, C.white);
    text.getSceneObject().getTransform().setLocalPosition(new vec3(0, -9, 0));
    const collider = root.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape = Shape.createSphereShape();
    shape.radius = 8;
    collider.shape = shape;
    collider.fitVisual = false;
    const interactable = root.createComponent(Interactable.getTypeName()) as Interactable;
    this.createEvent("OnStartEvent").bind(() => {
      interactable.onTriggerEnd.add(() => {
        if (this.model.phase === "recall" && this.model.focus >= 0 && this.model.revealed[this.model.focus]) this.queueCommand(command);
      });
    });
    root.enabled = false;
    return root;
  }

  private buildArrow(): void {
    const arrow = meshObject(this.sceneObject, "OffViewArrow", new GeometryBuilder().chevron(2.6, 0.9).build(), this.glow, C.gold);
    this.arrow = arrow.object;
    this.arrowMat = arrow.material;
    this.arrow.enabled = false;
  }

  private buildAudio(): void {
    for (const key of ["drop", "reveal", "got", "missed", "tap"]) {
      const object = this.child(this.camera, "WalkYourTalkSound_" + key);
      const audio = object.createComponent("Component.AudioComponent") as AudioComponent;
      audio.audioTrack = SOUNDS[key];
      audio.volume = key === "reveal" ? 0.55 : 0.7;
      audio.playbackMode = Audio.PlaybackMode.LowLatency;
      this.uiAudio[key] = audio;
    }
  }

  private onStart(): void {
    // Let the pressed button finish its own trigger cycle before the card that
    // owns it changes; switching views mid-press leaves the press unfinished.
    this.mainCard.command.add(cmd => this.queueCommand(cmd));
    this.spotCard.command.add(cmd => this.queueCommand(cmd));
    this.reset();
  }

  // ───────────────────────── input ─────────────────────────

  private queued: {command: string; delay: number} | null = null;

  private queueCommand(command: string): void {
    this.play("tap");
    this.queued = {command, delay: 0.18};
  }

  private onCommand(command: string): void {
    const m = this.model;
    switch (command) {
      case "start": {
        const cam = this.camera.getTransform().getWorldPosition();
        this.startFloor = new vec3(cam.x, cam.y + this.floorY, cam.z);
        this.apply(m.start());
        break;
      }
      case "walk":
        this.gated = false;
        this.mainCard.setView(null);
        this.beaconTimer = this.beaconSeconds - 1;
        break;
      case "recall":
        this.apply(m.beginRecall());
        break;
      case "practice":
        this.apply(m.practiceMissed());
        break;
      case "restart":
        this.apply(m.restart());
        break;
      case "got":
      case "missed":
        this.apply(m.grade(m.focus, command as Grade));
        break;
    }
  }

  private onSpotPinched(i: number): void {
    const m = this.model;
    if (this.gated) return;
    if (m.phase === "build") this.apply(m.place(i));
    else if (m.phase === "walk") this.apply(m.arrive(i));
    else if (m.phase === "recall") this.apply(m.reveal(i));
  }

  // ───────────────────────── state → visuals ─────────────────────────

  private apply(event: PalaceEvent): void {
    const m = this.model;
    if (event.kind === "ignored") return;
    print("WalkYourTalk: " + event.kind + " " + event.index + (event.detail ? " " + event.detail : "") + " phase=" + m.phase + " focus=" + m.focus);
    switch (event.kind) {
      case "started":
        this.gated = false;
        this.mainCard.setView(null);
        break;
      case "placed":
        this.spots[event.index].popT = 0;
        this.play("drop");
        this.rebuildPath();
        break;
      case "built":
        this.gated = true;
        this.later({eyebrow: "PALACE BUILT  ·  5 OF 5", title: "Now walk the route",
          body: "Walk to each object in order and say its beat out loud. Can't walk the room? Pinch the next glowing spot instead.",
          buttons: [{label: "Start walking", command: "walk"}]}, 1.2);
        break;
      case "arrived":
        this.spots[event.index].wakeT = 0;
        this.cueIndex = event.index;
        this.cueTimer = 0;
        this.play("reveal");
        this.beaconTimer = 0;
        break;
      case "walked":
        this.gated = true;
        this.later({eyebrow: m.round > 1 ? "PRACTICE ROUTE WALKED" : "ROUTE WALKED", title: "Now from memory",
          body: "The objects hide. Walk the route again and say each beat before you pinch the ? to check yourself.",
          buttons: [{label: "Start recall", command: "recall"}]}, this.cueSeconds * 0.6);
        break;
      case "recallStarted":
        this.gated = false;
        this.cueIndex = -1;
        this.mainCard.setView(null);
        this.beaconTimer = this.beaconSeconds - 1;
        break;
      case "revealed":
        this.spots[event.index].popT = 0;
        this.play("reveal");
        break;
      case "graded":
        this.play(event.detail === "got" ? "got" : "missed");
        this.beaconTimer = 0;
        break;
      case "finished":
        this.gated = true;
        this.later(this.debriefView(), 1.0);
        break;
      case "practice":
        this.gated = true;
        this.mainCard.setView({eyebrow: "PRACTICE  ·  ROUND " + m.round, title: m.queue.length === 1 ? "Walk the missed beat" : "Walk the missed beats",
          body: "Only the beats you missed are on this route. Walk to each, say it, and look at the object a little longer.",
          buttons: [{label: "Start walking", command: "walk"}]});
        this.placeCardInFront(this.mainCard.getSceneObject());
        break;
      case "restarted":
        this.reset();
        break;
    }
    this.refreshSpots();
    this.refreshSpotCard();
  }

  private debriefView(): CardView {
    const m = this.model;
    const first = m.firstPassScore();
    const pass = m.passScore();
    const missed = m.missed;
    const lines: string[] = [];
    if (m.round === 1) {
      const recalled = m.queue.filter(k => m.grades[k] === "got").map(k => String(k + 1));
      lines.push("Recalled: " + (recalled.length ? recalled.join(", ") : "none yet"));
    } else {
      lines.push("Practice round " + m.round + ": " + pass.got + " of " + pass.total + " recalled.");
      lines.push("First full pass: " + first.got + " of " + first.total + ".");
    }
    for (const k of missed) lines.push("Practice " + (k + 1) + ": " + m.beats[k].cue);
    const title = m.round === 1 ? first.got + " of " + first.total + " from memory" : (missed.length === 0 ? "Every beat is back" : pass.got + " of " + pass.total + " this round");
    const buttons = missed.length > 0
      ? [{label: missed.length === 1 ? "Practice the missed beat" : "Practice missed beats", command: "practice"}, {label: "Start over", command: "restart"}]
      : [{label: "Start over", command: "restart"}];
    return {eyebrow: m.round === 1 ? "DEBRIEF  ·  FIRST WALK" : "DEBRIEF  ·  ROUND " + m.round, title, body: lines.join("\n"), buttons};
  }

  private refreshSpots(): void {
    const m = this.model;
    for (const s of this.spots) {
      const i = s.index;
      const inQueue = m.queue.indexOf(i) >= 0;
      const show = m.phase !== "intro";
      s.ring.enabled = show;
      s.halo.enabled = show;
      let imageVisible = m.placed[i];
      let orbVisible = false;
      if (m.phase === "recall" && inQueue && !m.revealed[i]) { imageVisible = false; orbVisible = true; }
      s.image.enabled = imageVisible;
      s.orb.enabled = orbVisible;
      s.badge.enabled = m.phase === "build" && !m.placed[i];
      let color = C.gold;
      let alpha = m.focus === i ? 1 : 0.45;
      if (m.phase === "walk" && m.visited[i] && inQueue) color = C.mint;
      if ((m.phase === "recall" || m.phase === "debrief") && m.grades[i] === "got") color = C.mint;
      if ((m.phase === "recall" || m.phase === "debrief") && m.grades[i] === "missed") color = C.amber;
      if (m.phase === "recall" && inQueue && m.grades[i] === null) color = C.lilac;
      if (m.phase === "debrief") alpha = 0.8;
      if (m.phase === "walk" && !inQueue) alpha = 0.25;
      s.ringMat.mainPass.baseColor = new vec4(color.x, color.y, color.z, alpha);
      s.haloMat.mainPass.baseColor = new vec4(color.x, color.y, color.z, alpha * 0.22);
    }
  }

  private refreshSpotCard(): void {
    const m = this.model;
    const f = m.focus;
    let view: CardView | null = null;
    let at = -1;
    if (this.gated) {
      view = null;
    } else if (m.phase === "build" && f >= 0) {
      const b = m.beats[f];
      view = {eyebrow: "BEAT " + (f + 1) + " OF " + m.count + "  ·  BUILD", title: b.cue,
        body: "Pinch the glowing spot to drop " + b.image + " on the " + b.spot + ".", buttons: []};
      at = f;
    } else if (m.phase === "walk" && this.cueIndex >= 0) {
      const b = m.beats[this.cueIndex];
      view = {eyebrow: "BEAT " + (this.cueIndex + 1) + " OF " + m.count, title: b.cue, body: "Say it out loud.", buttons: []};
      at = this.cueIndex;
    } else if (m.phase === "recall" && f >= 0) {
      if (!m.revealed[f]) {
        view = {eyebrow: "BEAT " + (f + 1) + " OF " + m.count + "  ·  FROM MEMORY", title: "What goes here?",
          body: "Say the beat out loud, then pinch the ? to check.", buttons: []};
      } else {
        view = {eyebrow: "BEAT " + (f + 1) + " OF " + m.count + "  ·  CHECK", title: m.beats[f].cue,
          body: "Said it before you looked? Pinch Got it or Missed beside the object.", buttons: []};
      }
      at = f;
    }
    this.spotCard.setView(view);
    this.spotCardAt = at;
  }
  private spotCardAt = -1;

  private rebuildPath(): void {
    const points: vec3[] = [this.startFloor];
    for (const s of this.spots) {
      if (!this.model.placed[s.index]) break;
      const p = s.root.getTransform().getWorldPosition();
      points.push(new vec3(p.x, this.startFloor.y, p.z));
    }
    if (this.pathVisual) { this.pathVisual.getSceneObject().destroy(); this.pathVisual = null; }
    if (points.length < 2) return;
    const geometry = new GeometryBuilder().dots(points, 14, 3.2, 0.5);
    if (geometry.isEmpty) return;
    const object = this.child(this.pathRoot, "RouteDots");
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    visual.mesh = geometry.build();
    visual.mainMaterial = this.pathMat;
    this.pathVisual = visual;
  }

  private reset(): void {
    this.gated = true;
    this.cueIndex = -1;
    this.pendingCard = null;
    if (this.pathVisual) { this.pathVisual.getSceneObject().destroy(); this.pathVisual = null; }
    for (const s of this.spots) { s.popT = -1; s.wakeT = -1; s.image.getTransform().setLocalScale(s.imageScale); }
    this.mainCard.setView({eyebrow: "WALK YOUR TALK", title: "Memorize a talk by walking your room",
      body: "The five beats of a two-minute wedding toast become five odd objects placed around you. Walk past them to rehearse, then check what stuck.",
      buttons: [{label: "Build my palace", command: "start"}]});
    this.placeCardInFront(this.mainCard.getSceneObject());
    this.refreshSpots();
    this.refreshSpotCard();
  }

  // ───────────────────────── per frame ─────────────────────────

  private onUpdate(): void {
    const dt = getDeltaTime();
    this.time += dt;
    const m = this.model;
    const cam = this.camera.getTransform();
    const camPos = cam.getWorldPosition();

    if (this.queued) {
      this.queued.delay -= dt;
      if (this.queued.delay <= 0) {
        const command = this.queued.command;
        this.queued = null;
        this.onCommand(command);
      }
    }

    if (this.pendingCard) {
      this.pendingCard.delay -= dt;
      if (this.pendingCard.delay <= 0) {
        this.mainCard.setView(this.pendingCard.view);
        this.placeCardInFront(this.mainCard.getSceneObject());
        this.pendingCard = null;
        this.refreshSpotCard();
      }
    }

    // Walking up to the next spot counts as arriving.
    if (!this.gated && m.phase === "walk" && m.focus >= 0) {
      const p = this.spots[m.focus].root.getTransform().getWorldPosition();
      if (this.flatDistance(camPos, p) < this.arriveRadius) this.apply(m.arrive(m.focus));
    }

    // A beat's cue fades once you have moved on.
    if (m.phase === "walk" && this.cueIndex >= 0) {
      this.cueTimer += dt;
      if (this.cueTimer > this.cueSeconds) { this.cueIndex = -1; this.refreshSpotCard(); }
    }

    // The next spot calls softly while it waits.
    const guiding = !this.gated && (m.phase === "walk" || m.phase === "recall") && m.focus >= 0;
    if (guiding) {
      this.beaconTimer += dt;
      if (this.beaconTimer >= this.beaconSeconds) {
        this.beaconTimer = 0;
        const s = this.spots[m.focus];
        if (this.flatDistance(camPos, s.root.getTransform().getWorldPosition()) > this.arriveRadius) s.audio.play(1);
      }
    }

    // Only the spot in focus takes a pinch, so nearer spots never block the ray.
    const live = !this.gated && (m.phase === "build" || m.phase === "walk" || m.phase === "recall");
    for (const s of this.spots) {
      const want = live && m.focus === s.index && !(m.phase === "recall" && m.revealed[s.index]);
      if (s.target.enabled !== want) s.target.enabled = want;
    }

    this.placeGradeButtons(camPos);
    this.followMainCard(dt);
    this.animateSpots(dt, camPos);
    this.placeSpotCard(camPos, dt);
    this.updateArrow(cam, camPos, (!this.gated && m.focus >= 0 && m.phase !== "debrief") ? m.focus : -1);
  }

  private animateSpots(dt: number, camPos: vec3): void {
    const m = this.model;
    for (const s of this.spots) {
      const focus = m.focus === s.index && !this.gated;
      // Focus ring breathes; others stay still.
      const pulse = focus ? 1 + 0.09 * Math.sin(this.time * 4.2) : 1;
      s.ring.getTransform().setLocalScale(new vec3(pulse, 1, pulse));
      s.halo.getTransform().setLocalScale(new vec3(pulse * 1.05, 1, pulse * 1.05));

      // Pop when placed or revealed.
      let scale = 1;
      if (s.popT >= 0) {
        s.popT += dt;
        const t = Math.min(1, s.popT / 0.55);
        scale = t < 0.6 ? this.easeOut(t / 0.6) * 1.18 : 1.18 - 0.18 * this.easeOut((t - 0.6) / 0.4);
        if (s.popT >= 0.55) { s.popT = -1; scale = 1; }
      }
      // Wake on arrival: a little hop and a full turn.
      let hop = 0;
      let spin = 0;
      if (s.wakeT >= 0) {
        s.wakeT += dt;
        const t = Math.min(1, s.wakeT / 1.1);
        hop = Math.sin(t * Math.PI) * 9;
        spin = this.easeOut(t) * Math.PI * 2;
        if (s.wakeT >= 1.1) s.wakeT = -1;
      }
      const bob = s.image.enabled ? Math.sin(this.time * 1.6 + s.index) * 0.8 : 0;
      const it = s.image.getTransform();
      it.setLocalScale(s.imageScale.uniformScale(scale));
      it.setLocalPosition(new vec3(s.imageCenter.x, s.imageCenter.y + hop + bob, s.imageCenter.z));
      it.setLocalRotation(quat.angleAxis(spin, vec3.up()).multiply(s.imageRotation));

      if (s.orb.enabled) {
        const o = 1 + (focus ? 0.07 * Math.sin(this.time * 5) : 0);
        s.orb.getTransform().setLocalScale(new vec3(o, o, o));
        this.billboard(s.orb, camPos);
      }
      if (s.badge.enabled) this.billboard(s.badge, camPos);
    }
  }

  private placeSpotCard(camPos: vec3, dt: number): void {
    if (this.spotCardAt < 0 || !this.spotCard.visible) { this.cardPlaced = false; return; }
    const s = this.spots[this.spotCardAt];
    const root = s.root.getTransform().getWorldPosition();
    const cam = this.camera.getTransform();
    const fwd = cam.forward.uniformScale(-1);
    // Aim at the top of the object (or the spot, before anything is placed),
    // then sit just above it in view: objects rest on furniture below eye
    // level, so the label stays in open air and never covers its object.
    const height = this.model.placed[s.index] ? Math.max(14, s.imageCenter.y * 2) : 14;
    const top = new vec3(root.x, root.y + height, root.z);
    const toTop = top.sub(camPos);
    const topDist = toTop.length;
    const dir = fwd.add(toTop.normalize()).normalize();
    const cardDist = Math.max(52, Math.min(78, topDist * 0.7));
    const scale = cardDist / 100;
    const lift = (this.spotCard.visibleHeight * 0.5 + 3) * scale;
    const target = camPos.add(dir.uniformScale(cardDist)).add(cam.up.uniformScale(lift)).add(cam.right.uniformScale(VIEW_BIAS * scale));
    const t = this.spotCard.getSceneObject().getTransform();
    const k = this.cardPlaced ? 1 - Math.exp(-dt * 11) : 1;
    const current = this.cardPlaced ? t.getWorldPosition() : target;
    const pos = vec3.lerp(current, target, k);
    this.cardPlaced = true;
    t.setWorldPosition(pos);
    t.setWorldScale(new vec3(scale, scale, scale));
    const look = camPos.sub(pos);
    t.setWorldRotation(quat.lookAt(new vec3(look.x, look.y * 0.6, look.z).normalize(), vec3.up()));
  }
  private cardPlaced = false;

  private placeGradeButtons(camPos: vec3): void {
    const m = this.model;
    const f = m.focus;
    const show = !this.gated && !this.queued && m.phase === "recall" && f >= 0 && m.revealed[f] && m.grades[f] === null;
    if (this.gradeGot.enabled !== show) this.gradeGot.enabled = show;
    if (this.gradeMissed.enabled !== show) this.gradeMissed.enabled = show;
    if (!show) return;
    const s = this.spots[f];
    const root = s.root.getTransform().getWorldPosition();
    const center = new vec3(root.x, root.y + Math.max(12, s.imageCenter.y), root.z);
    const back = this.flatten(camPos.sub(center), new vec3(0, 0, 1));
    const right = vec3.up().cross(back).normalize();
    const reach = Math.max(22, s.imageScale.x * 0.5);
    const placeAt = (o: SceneObject, sign: number) => {
      const p = center.add(back.uniformScale(22)).add(right.uniformScale(sign * reach));
      const t = o.getTransform();
      t.setWorldPosition(p);
      t.setWorldRotation(quat.lookAt(camPos.sub(p).normalize(), vec3.up()));
    };
    placeAt(this.gradeGot, -1);
    placeAt(this.gradeMissed, 1);
  }

  private flatten(v: vec3, fallback: vec3): vec3 {
    const f = new vec3(v.x, 0, v.z);
    return f.length > 0.001 ? f.normalize() : fallback;
  }

  private updateArrow(cam: Transform, camPos: vec3, target: number): void {
    if (target < 0) { this.arrow.enabled = false; return; }
    const s = this.spots[target];
    const goal = s.root.getTransform().getWorldPosition().add(new vec3(0, s.imageCenter.y, 0));
    const fwd = cam.forward.uniformScale(-1);
    const right = cam.right;
    const up = cam.up;
    const d = goal.sub(camPos).normalize();
    const x = d.dot(right), y = d.dot(up), z = d.dot(fwd);
    const horiz = Math.atan2(x, z) * 180 / Math.PI;
    const vert = Math.atan2(y, z) * 180 / Math.PI;
    const inView = z > 0 && Math.abs(horiz) < 13 && Math.abs(vert) < 15;
    this.arrow.enabled = !inView;
    if (inView) return;
    let vx = x, vy = y;
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    vx /= len; vy /= len;
    if (z < 0 && Math.abs(vx) < 0.3) { vx = vx >= 0 ? 1 : -1; vy = 0; }
    const pos = camPos.add(fwd.uniformScale(60)).add(right.uniformScale(vx * 9)).add(up.uniformScale(vy * 9 - 3));
    const t = this.arrow.getTransform();
    t.setWorldPosition(pos);
    const face = quat.lookAt(fwd.uniformScale(-1), up);
    t.setWorldRotation(face.multiply(quat.angleAxis(Math.atan2(-vx, vy), vec3.forward())));
    const a = 0.55 + 0.35 * Math.sin(this.time * 5);
    this.arrowMat.mainPass.baseColor = new vec4(C.gold.x, C.gold.y, C.gold.z, a);
  }

  // ───────────────────────── helpers ─────────────────────────

  private later(view: CardView, delay: number): void {
    this.pendingCard = {view, delay};
    this.mainCard.setView(null);
  }

  /** Keep a visible phase card in front of you if you turn away (tag-along). */
  private followMainCard(dt: number): void {
    if (!this.mainCard.visible) return;
    const card = this.mainCard.getSceneObject().getTransform();
    const cam = this.camera.getTransform();
    const camPos = cam.getWorldPosition();
    const gaze = this.flatten(cam.forward.uniformScale(-1), new vec3(0, 0, -1));
    const toCard = this.flatten(card.getWorldPosition().sub(camPos), gaze);
    const off = Math.acos(Math.max(-1, Math.min(1, gaze.dot(toCard)))) * 180 / Math.PI;
    if (off > 10) this.followTarget = true;
    if (!this.followTarget) return;
    const desired = this.cardPose(camPos, cam);
    const k = 1 - Math.exp(-dt * 5);
    card.setWorldPosition(vec3.lerp(card.getWorldPosition(), desired.pos, k));
    card.setWorldRotation(quat.slerp(card.getWorldRotation(), desired.rot, k));
    if (card.getWorldPosition().distance(desired.pos) < 1) this.followTarget = false;
  }
  private followTarget = false;

  private cardPose(camPos: vec3, cam: Transform): {pos: vec3; rot: quat} {
    const fwd = cam.forward.uniformScale(-1);
    const flat = this.flatten(fwd, new vec3(0, 0, -1));
    // In the direction you face, close to eye height: furniture sits below eye
    // level, so this keeps the card (and your hand on it) in open air.
    const pitch = Math.max(-0.12, Math.min(0.06, Math.asin(Math.max(-1, Math.min(1, fwd.y)))));
    const dir = flat.uniformScale(Math.cos(pitch)).add(vec3.up().uniformScale(Math.sin(pitch)));
    const distance = this.model.phase === "intro" ? 100 : 80;
    const right = flat.cross(vec3.up()).normalize();
    const pos = camPos.add(dir.uniformScale(distance)).add(new vec3(0, -6, 0)).add(right.uniformScale(VIEW_BIAS * distance / 100));
    return {pos, rot: quat.lookAt(camPos.sub(pos).normalize(), vec3.up())};
  }

  private placeCardInFront(card: SceneObject): void {
    const cam = this.camera.getTransform();
    const pose = this.cardPose(cam.getWorldPosition(), cam);
    const t = card.getTransform();
    t.setWorldPosition(pose.pos);
    t.setWorldRotation(pose.rot);
    t.setWorldScale(vec3.one().uniformScale(this.model.phase === "intro" ? 1 : 0.8));
    this.followTarget = false;
  }

  private billboard(object: SceneObject, camPos: vec3): void {
    const t = object.getTransform();
    const p = t.getWorldPosition();
    const look = new vec3(camPos.x - p.x, 0, camPos.z - p.z);
    if (look.length > 0.01) t.setWorldRotation(quat.lookAt(look.normalize(), vec3.up()));
  }

  private flatDistance(a: vec3, b: vec3): number {
    const dx = a.x - b.x, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private easeOut(t: number): number { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); }

  private play(key: string): void { this.uiAudio[key]?.play(1); }

  private label(parent: SceneObject, name: string, value: string, size: number, color: vec4): Text {
    const object = this.child(parent, name);
    const text = object.createComponent("Component.Text") as Text;
    text.text = value;
    text.size = size;
    (text as Text & {weight?: number}).weight = 700;
    text.horizontalAlignment = HorizontalAlignment.Center;
    text.verticalAlignment = VerticalAlignment.Center;
    text.textFill.color = color;
    text.depthTest = true;
    return text;
  }

  private child(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const object = global.scene.createSceneObject(name);
    object.setParent(parent);
    if (position) object.getTransform().setLocalPosition(position);
    return object;
  }

  private findChild(parent: SceneObject, name: string): SceneObject | null {
    for (let i = 0; i < parent.getChildrenCount(); i++) {
      const c = parent.getChild(i);
      if (c.name === name) return c;
    }
    return null;
  }

  /** LEAF fixture setup only: return to the intro card before a scenario. */
  resetForTest(): void {
    this.queued = null;
    this.apply(this.model.restart());
  }

  /** LEAF assertion helper: whether a beat's image is currently shown. */
  imageVisible(index: number): boolean {
    return this.spots[index]?.image.enabled === true;
  }

  /** LEAF assertion helper: whether the recall orb for a beat is shown. */
  orbVisible(index: number): boolean {
    return this.spots[index]?.orb.enabled === true;
  }

  /** LEAF assertion helper: the text currently on the card beside the spot. */
  spotCardTitle(): string {
    return this.spotCard.visible ? this.spotCard.currentTitle : "";
  }

  /** LEAF assertion helper: the title on the phase card, or "" when hidden. */
  mainCardTitle(): string {
    return this.mainCard.visible ? this.mainCard.currentTitle : "";
  }

  /** Test hook for LEAF and preview checks: the current phase and focus. */
  describe(): string {
    const m = this.model;
    return m.phase + ":" + m.focus + ":r" + m.round;
  }
}

export {IMAGE_NAMES};
