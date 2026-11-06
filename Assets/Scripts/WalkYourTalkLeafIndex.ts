/** LEAF discovery index for Walk Your Talk: one scenario per done criterion. */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import {WalkYourTalkLeafScenario} from "./WalkYourTalkLeafScenario";

@component
export class WalkYourTalkLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "wyt_build_in_order", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "build"}},
    {id: "wyt_out_of_order_ignored", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "order"}},
    {id: "wyt_walk_shows_each_beat", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "walk"}},
    {id: "wyt_recall_and_grade", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "recall"}},
    {id: "wyt_practice_missed", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "practice"}},
    {id: "wyt_start_over", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "restart"}},
    {id: "wyt_ik_reach_start", typename: WalkYourTalkLeafScenario.getTypeName(), parameters: {kind: "ik"}}
  ];
}
