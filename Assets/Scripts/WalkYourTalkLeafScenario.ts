/**
 * Walk Your Talk — LEAF integration scenarios.
 *
 * Every user action goes through SIK (LEAF's interactor pinching the same
 * Interactables a person pinches in the preview). The only direct call is the
 * fixture reset at the start. Assertions read the controller's own model.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario";
import {ScenarioConfig} from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils";
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils";
import {expect} from "Leaf.lspkg/Utils/common/Expect";
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar";
import {WalkYourTalk} from "./WalkYourTalk";

@component
export class WalkYourTalkLeafScenario extends Scenario {
  private interactor!: DefaultLeafInteractor;
  private app!: WalkYourTalk;

  async run(config?: ScenarioConfig): Promise<void> {
    this.interactor = new DefaultLeafInteractor();
    this.app = findSceneObjectByName("WalkYourTalk").getComponent(WalkYourTalk.getTypeName()) as WalkYourTalk;
    expect(!!this.app).toBe(true);
    this.app.resetForTest();
    await sleep(400);
    const kind = config?.get("kind") || "build";
    if (kind === "build") await this.buildInOrder();
    else if (kind === "order") await this.outOfOrderIgnored();
    else if (kind === "walk") await this.walkByPinch();
    else if (kind === "recall") await this.recallAndGrade();
    else if (kind === "practice") await this.practiceMissed();
    else if (kind === "restart") await this.restartClears();
    else if (kind === "ik") await this.ikStart();
    else throw new Error("Unknown Walk Your Talk case: " + kind);
  }

  /** Pinch a visible, enabled SIK target the way a person would. */
  private async tap(name: string, settle = 450): Promise<void> {
    const target = findInteractableByName(name);
    if (!target) throw new Error("Missing SIK target: " + name);
    for (let object: SceneObject | null = target.getSceneObject(); object; object = object.getParent()) {
      if (!object.enabled) throw new Error("Hidden SIK target: " + name + " under " + object.name);
    }
    await this.interactor.trigger(target);
    await sleep(settle);
  }

  private async build(): Promise<void> {
    await this.tap("MainCard_Primary");
    expect(this.app.model.phase).toBe("build");
    for (let i = 1; i <= 5; i++) await this.tap("Spot_" + i + "_Target", 350);
    await sleep(1500); // the "Now walk the route" card arrives after a short beat
  }

  private async walk(spots: number[]): Promise<void> {
    await this.tap("MainCard_Primary"); // Start walking
    // Pinching the next spot is the accessible equivalent of walking up to it.
    for (const i of spots) await this.tap("Spot_" + i + "_Target", 400);
    await sleep(4200); // the "Now from memory" card follows the last cue
  }

  private async recall(spots: number[], missed: number[]): Promise<void> {
    await this.tap("MainCard_Primary"); // Start recall
    expect(this.app.model.phase).toBe("recall");
    for (const i of spots) {
      expect(this.app.orbVisible(i - 1)).toBe(true);
      expect(this.app.imageVisible(i - 1)).toBe(false);
      await this.tap("Spot_" + i + "_Target", 500); // reveal
      expect(this.app.imageVisible(i - 1)).toBe(true);
      await this.tap(missed.indexOf(i) >= 0 ? "GradeMissed" : "GradeGot", 500);
    }
    await sleep(1400);
  }

  /** Done 1: build places five images in route order and moves on to the walk. */
  private async buildInOrder(): Promise<void> {
    await this.build();
    expect(this.app.model.phase).toBe("walk");
    for (let i = 0; i < 5; i++) expect(this.app.imageVisible(i)).toBe(true);
    expect(this.app.mainCardTitle()).toBe("Now walk the route");
  }

  /** Done 2: a spot other than the glowing one does not take a pinch. */
  private async outOfOrderIgnored(): Promise<void> {
    await this.tap("MainCard_Primary");
    const third = findInteractableByName("Spot_3_Target");
    expect(!!third && third.getSceneObject().enabled).toBe(false);
    await this.tap("Spot_1_Target");
    expect(this.app.model.placed[0]).toBe(true);
    expect(this.app.model.placed[2]).toBe(false);
    expect(this.app.model.focus).toBe(1);
  }

  /** Done 3: reaching each spot in order shows its beat; the walk then hands over to recall. */
  private async walkByPinch(): Promise<void> {
    await this.build();
    await this.tap("MainCard_Primary");
    await this.tap("Spot_1_Target", 400);
    expect(this.app.spotCardTitle()).toBe("Thank everyone for coming");
    for (const i of [2, 3, 4, 5]) await this.tap("Spot_" + i + "_Target", 400);
    await sleep(4200);
    expect(this.app.model.walkComplete).toBe(true);
    expect(this.app.mainCardTitle()).toBe("Now from memory");
  }

  /** Done 4: recall hides every image, reveals on pinch and records an honest grade. */
  private async recallAndGrade(): Promise<void> {
    await this.build();
    await this.walk([1, 2, 3, 4, 5]);
    await this.recall([1, 2, 3, 4, 5], [4]);
    expect(this.app.model.phase).toBe("debrief");
    expect(this.app.model.firstPass).toEqual(["got", "got", "got", "missed", "got"]);
    expect(this.app.mainCardTitle()).toBe("4 of 5 from memory");
  }

  /** Done 5: practice runs a route of only the missed beat, then reports it back. */
  private async practiceMissed(): Promise<void> {
    await this.build();
    await this.walk([1, 2, 3, 4, 5]);
    await this.recall([1, 2, 3, 4, 5], [4]);
    await this.tap("MainCard_Primary"); // Practice the missed beat
    expect(this.app.model.queue).toEqual([3]);
    await this.walk([4]);
    await this.recall([4], []);
    expect(this.app.model.round).toBe(2);
    expect(this.app.mainCardTitle()).toBe("Every beat is back");
    expect(this.app.model.firstPassScore().got).toBe(4); // first pass is never rewritten
  }

  /** Done 6: "Start over" clears the palace back to the intro card. */
  private async restartClears(): Promise<void> {
    await this.build();
    await this.walk([1, 2, 3, 4, 5]);
    await this.recall([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]);
    await this.tap("MainCard_Secondary"); // Start over
    expect(this.app.model.phase).toBe("intro");
    for (let i = 0; i < 5; i++) expect(this.app.imageVisible(i)).toBe(false);
    expect(this.app.mainCardTitle()).toBe("Memorize a talk by walking your room");
  }

  /** Reachability: an IK arm can reach and press the intro button. */
  private async ikStart(): Promise<void> {
    const ik = createIKInteractor();
    const start = findInteractableByName("MainCard_Primary");
    if (!start) throw new Error("Missing MainCard_Primary");
    await ik.trigger(start);
    await sleep(500);
    expect(this.app.model.phase).toBe("build");
  }
}
