# Toolchain and provenance

| Step | Tool | Where it shows up |
|---|---|---|
| Planning | Devpost Learn `plan-lens` skill (`npx skills add challengepost/learn-specs`) | [design-brief.md](design-brief.md), skill copy in [planning-skill/](planning-skill) |
| Building | Claude Code with CLAD (`ls-clad` plugin: lens-studio-router, specs-project-init, specs-interaction-recipes, specs-build-ui, build-sfx, specs-world-query, specs-leaf-*) | all of `Assets/Scripts/` |
| Editor control | Lens Studio MCP: VirtualScene, scene-graphql, asset-graphql, ExecuteEditorCode, RecompileTypeScriptTool, RunAndCollectLogsTool, QueryRuntimeSceneTool, PreviewPanelTool, MovePreviewCamera, PreviewInteractTool, GenerateFast3DAssets, InstallLensStudioPackage, LEAF tools | scene assembly, verification, demo driver |
| Room survey | World Query hit tests in the preview (temporary probe, removed) | spot positions on the Colorful Home furniture |
| 3D objects | Lens Studio GenerateFast3DAssets | `Assets/Models/*.glb` |
| Sounds | CLAD `build-sfx` engine, fixed seeds | `Assets/GeneratedSFX/*.wav`, `tempAssetGen/gen_sfx_walkyourtalk.cjs` |
| Logic tests | Node test runner + TypeScript | `tests/PalaceModel.test.ts` |
| Native tests | LEAF in Lens Studio preview | `Assets/Scripts/WalkYourTalkLeaf*.ts`, [validation/leaf-results.json](validation/leaf-results.json) |
| Demo footage | `demo-video/drive.mjs` (Lens Studio MCP via the official MCP SDK) + `demo-video/WindowRecorder.swift` (ScreenCaptureKit, Lens Studio window only) | `demo-video/` |
| Narration | Kokoro TTS 0.6.1, voice `af_heart` (synthetic, no cloning); captions from synthesis timing; checked with faster-whisper | `demo-video/narration.json`, `demo-video/WalkYourTalk-English.srt` |

## Starting point and packages

- Snap's official **Specs Base Template** from [specs-devs/samples](https://github.com/specs-devs/samples) (MIT, see [SPECS-SAMPLE-LICENSE.md](../SPECS-SAMPLE-LICENSE.md)).
- Lens Studio Asset Library packages: Spectacles Interaction Kit 0.18, Spectacles UIKit, LEAF, AI Preview Agent Inspect/Interact (and their dependencies Icons, Motion, Bitmoji 3D).
- All project code in `Assets/Scripts/`, `tests/` and `demo-video/` was written during the hackathon for this Lens.
