/**
 * Walk Your Talk — a compact UIKit card.
 *
 * BackPlate + FlexLayout column with an eyebrow, a title, an optional body and
 * up to two buttons. The controller pushes a CardView in; button presses come
 * back out as command strings. The card never decides anything itself.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate";
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import {GeometryBuilder, meshObject} from "./PalaceGeometry";
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout";
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem";
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes";

export interface CardButton { label: string; command: string; }
export interface CardView {
  eyebrow: string;
  title: string;
  body?: string;
  buttons: CardButton[];
}

type Role = "Eyebrow" | "Title" | "Body" | "Button";
const ROLES: {[role: string]: {size: number; weight: number}} = {
  Eyebrow: {size: 38, weight: 700},
  Title: {size: 54, weight: 700},
  Body: {size: 39, weight: 500},
  Button: {size: 39, weight: 600}
};

/** Gold accent used for eyebrows; light enough to read on an additive display. */
export const GOLD = new vec4(1.0, 0.82, 0.38, 1);

@component
export class PalaceCard extends BaseScriptComponent {
  @ui.label("Walk Your Talk | card")
  @ui.group_start("Layout")
  @input @hint("Card width in cm") @widget(new SliderWidget(20, 60, 1)) panelWidth: number = 40;
  @input @hint("Inner padding in cm") @widget(new SliderWidget(0.5, 4, 0.1)) padding: number = 2;
  @input @hint("Gap between rows in cm") @widget(new SliderWidget(0, 3, 0.1)) rowGap: number = 0.9;
  @input @hint("Height reserved for body text in cm") @widget(new SliderWidget(2, 20, 0.5)) bodyHeight: number = 6;
  @input @hint("Text scale multiplier") @widget(new SliderWidget(0.5, 2, 0.05)) textScale: number = 1;
  @ui.group_end
  @input @hint("Unlit alpha-blended material for the button pills") buttonMaterial!: Material;

  readonly command = new Event<string>();

  private plate: BackPlate;
  private layout: FlexLayout;
  private content: SceneObject;
  private eyebrowText: Text;
  private titleText: Text;
  private bodyText: Text;
  private bodyItem: FlexItem;
  private buttonObjects: SceneObject[] = [];
  private buttonItems: FlexItem[] = [];
  private buttonLabels: Text[] = [];
  private model: CardView | null = null;
  private frames = 0;
  private dirty = true;

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas");
    this.plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate;
    this.plate.style = "dark";
    // No near-field interaction plane: the card often floats in front of the
    // spot you are pinching, and the plane would swallow that ray.
    (this.plate as unknown as {_enableInteractionPlane: boolean})._enableInteractionPlane = false;
    this.content = this.child(this.sceneObject, this.sceneObject.name + "_Content", new vec3(0, 0, 0.6));
    this.layout = this.content.createComponent(FlexLayout.getTypeName()) as FlexLayout;
    this.layout.autoDiscoverItemsOnStart = false;
    this.layout.onInitialized.add(() => {
      this.layout.width = this.panelWidth;
      this.layout.height = -1;
      this.layout.direction = FlexDirection.Column;
      this.layout.justifyContent = FlexJustify.Start;
      this.layout.alignItems = FlexAlign.Stretch;
      this.layout.rowGap = this.rowGap;
      this.layout.paddingTop = this.padding;
      this.layout.paddingBottom = this.padding;
      this.layout.paddingLeft = this.padding;
      this.layout.paddingRight = this.padding;
      this.dirty = true;
    });
    this.layout.onLayoutComplete.add(result => {
      this.plate.size = new vec2(result.containerWidth, result.containerHeight);
    });
    this.eyebrowText = this.row("Eyebrow", 2.2, "Eyebrow", GOLD).text;
    this.titleText = this.row("Title", 5.2, "Title", new vec4(1, 1, 1, 1)).text;
    const body = this.row("Body", this.bodyHeight, "Body", new vec4(0.93, 0.95, 1, 1));
    this.bodyText = body.text;
    this.bodyItem = body.item;
    this.buildButtons();
    this.createEvent("UpdateEvent").bind(() => {
      this.frames++;
      if (this.frames > 1 && this.dirty) this.apply();
      this.silencePlane();
    });
  }

  /** Show a view, or hide the card (including its colliders) with null. */
  setView(view: CardView | null): void {
    this.model = view;
    this.dirty = true;
    if (this.frames > 1) this.apply();
  }

  get visible(): boolean { return this.model !== null; }

  get currentTitle(): string { return this.model ? this.model.title : ""; }
  get currentBody(): string { return this.model?.body ?? ""; }

  /** Approximate height of the shown card in local centimetres. */
  get visibleHeight(): number {
    if (!this.model) return 0;
    let h = this.padding * 2 + 2.2 + 5.2 + this.rowGap * 2;
    if (this.model.body) h += this.bodyHeight + this.rowGap;
    h += this.model.buttons.length * (6.4 + this.rowGap);
    return h;
  }

  private apply(): void {
    this.dirty = false;
    this.sceneObject.enabled = this.model !== null;
    this.silencePlane();
    if (!this.model) return;
    this.eyebrowText.text = this.model.eyebrow;
    this.titleText.text = this.model.title;
    const hasBody = !!this.model.body;
    this.bodyText.text = this.model.body || "";
    this.layout.removeItems([this.bodyItem, ...this.buttonItems]);
    this.bodyItem.getSceneObject().enabled = hasBody;
    if (hasBody) this.layout.addItems([this.bodyItem]);
    const count = this.model.buttons.length;
    for (let i = 0; i < 2; i++) {
      const data = this.model.buttons[i];
      this.buttonObjects[i].enabled = !!data;
      if (data) this.buttonLabels[i].text = data.label;
    }
    for (let i = 0; i < count; i++) this.layout.addItems([this.buttonItems[i]]);
    this.layout.markDirty();
  }

  /**
   * The BackPlate re-creates its near-field interaction plane whenever it
   * resizes. That plane would swallow pinches aimed at the spot behind the
   * card, so keep it switched off.
   */
  private silencePlane(): void {
    for (let i = 0; i < this.sceneObject.getChildrenCount(); i++) {
      const c = this.sceneObject.getChild(i);
      if (c.name === "InteractionPlaneColliderRoot" && c.enabled) c.enabled = false;
    }
  }

  private row(name: string, height: number, role: Role, color: vec4): {text: Text; item: FlexItem} {
    const object = this.child(this.content, this.sceneObject.name + "_" + name);
    const item = object.createComponent(FlexItem.getTypeName()) as FlexItem;
    item.overrideHeight = height;
    item.flexGrow = 0;
    item.flexShrink = 0;
    item.alignSelf = FlexAlignSelf.Stretch;
    const text = object.createComponent("Component.Text") as Text;
    text.layoutRect = Rect.create(-0.5, 0.5, -0.5, 0.5);
    text.horizontalAlignment = HorizontalAlignment.Left;
    text.verticalAlignment = VerticalAlignment.Center;
    text.horizontalOverflow = HorizontalOverflow.Wrap;
    text.verticalOverflow = VerticalOverflow.Overflow;
    text.depthTest = true;
    text.textFill.color = color;
    this.style(text, role);
    this.layout.addItems([item]);
    return {text, item};
  }

  /**
   * Two big pill buttons built from SIK primitives: a mesh, a box collider
   * and an Interactable. They brighten on hover and fire on release.
   */
  private buildButtons(): void {
    const width = this.panelWidth - this.padding * 2;
    const height = 6.4;
    // Additive display: dark text vanishes, so labels stay white and the
    // primary pill is a translucent gold glow rather than a solid fill.
    const colors = [new vec4(1.0, 0.72, 0.22, 0.62), new vec4(1, 1, 1, 0.2)];
    const textColors = [new vec4(1, 1, 1, 1), new vec4(1, 1, 1, 1)];
    for (let i = 0; i < 2; i++) {
      const suffix = i === 0 ? "Primary" : "Secondary";
      const object = this.child(this.content, this.sceneObject.name + "_" + suffix);
      const pill = meshObject(object, object.name + "_Pill", new GeometryBuilder().pill(width, height, 14, 0.05).build(), this.buttonMaterial, colors[i]);
      const collider = object.createComponent("Physics.ColliderComponent") as ColliderComponent;
      const shape = Shape.createBoxShape();
      shape.size = new vec3(width, height, 2);
      collider.shape = shape;
      collider.fitVisual = false;
      const interactable = object.createComponent(Interactable.getTypeName()) as Interactable;
      const base = colors[i];
      this.createEvent("OnStartEvent").bind(() => {
        interactable.onHoverEnter.add(() => { pill.material.mainPass.baseColor = new vec4(Math.min(1, base.x + 0.15), Math.min(1, base.y + 0.15), Math.min(1, base.z + 0.15), Math.min(1, base.w + 0.2)); });
        interactable.onHoverExit.add(() => { pill.material.mainPass.baseColor = base; });
        interactable.onTriggerEnd.add(() => {
          pill.material.mainPass.baseColor = base;
          const command = this.model?.buttons[i]?.command;
          if (command) this.command.invoke(command);
        });
      });
      const label = this.child(object, this.sceneObject.name + "_" + suffix + "_Label", new vec3(0, 0, 0.3));
      const text = label.createComponent("Component.Text") as Text;
      text.layoutRect = Rect.create(-(width - 1) / 2, (width - 1) / 2, -2, 2);
      text.horizontalAlignment = HorizontalAlignment.Center;
      text.verticalAlignment = VerticalAlignment.Center;
      text.horizontalOverflow = HorizontalOverflow.Shrink;
      text.depthTest = true;
      text.textFill.color = textColors[i];
      this.style(text, "Button");
      const item = object.createComponent(FlexItem.getTypeName()) as FlexItem;
      item.overrideWidth = width;
      item.overrideHeight = height;
      item.flexGrow = 0;
      item.flexShrink = 0;
      this.buttonObjects.push(object);
      this.buttonItems.push(item);
      this.buttonLabels.push(text);
      this.layout.addItems([item]);
    }
  }

  private style(text: Text, role: Role): void {
    text.size = ROLES[role].size * this.textScale;
    (text as Text & {weight?: number}).weight = ROLES[role].weight;
  }

  private child(parent: SceneObject, name: string, position?: vec3): SceneObject {
    const object = global.scene.createSceneObject(name);
    object.setParent(parent);
    if (position) object.getTransform().setLocalPosition(position);
    return object;
  }
}
