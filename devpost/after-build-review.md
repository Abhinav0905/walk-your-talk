# After the build: what the preview showed, and what changed

This follows the brief's "After the build" checklist. Each change below was made as a design note, then rebuilt and re-checked in Lens Studio's preview (SPECS 27, Interactive Preview, Colorful Home room).

## 1. Does it work?

- 10 portable logic tests pass (`npm test`), including a 400-run random action fuzz that checks the session never contradicts itself.
- 7 LEAF scenarios pass in the preview, one per done criterion plus an IK reachability check. See [validation/leaf-results.json](validation/leaf-results.json).
- Every done criterion has a test. Walking by moving the head is checked with preview camera moves (MovePreviewCamera) in the demo driver; LEAF covers the same step through the accessible pinch path.

## 2–4. Walking around it: design notes and the changes they caused

| What we saw in the preview | Design note | Result |
|---|---|---|
| The beat card sat above eye level when you looked down at an object. You had to look up to read it. | "Put the label just above the object in your view, not above it in the room." | The card follows your gaze and sits just above the object's top. **Logic proven.** |
| Placed beside the object, the card slid into walls and furniture by the window. | "Keep the card in open air between you and the object." | Card distance scales with how far away the object is (55–78 cm), so it never sinks into the egg chair or the island. **Logic proven.** |
| Generated objects were dark and muddy on the simulated additive display. | "Make the objects glow; dark disappears on Specs." | Lighting turned off on the generated materials so textures show at full brightness. **Logic proven in preview, feel unproven on glasses.** |
| Gold buttons with dark text read as grey on the additive look. | "White text, translucent glow buttons." | Pill buttons are a translucent gold glow with white labels. |
| Grading with two stacked card buttons was easy to mis-hit. | "Grading is about the object. Put two big round targets beside it." | Got it and Missed are 11 cm round targets either side of the revealed object. **Logic proven.** |
| Nearer spots blocked the ray to farther ones while building. | "Only the next spot should take a pinch." | Only the glowing spot is pinchable, which also enforces the route order. |
| Phase cards could end up off to the side after you turned. | "Cards should come with you if you turn away." | Phase cards tag along gently when more than 10° out of view. |
| The first beat triggered the moment the walk started, because the island was within reach. | "Make the first step a real step." | Arrival radius is 90 cm, so you take a step towards each object. |

## 5. What we know and what we don't

- **Logic proven:** build order, walk order, cue timing, hiding and revealing, honest grading, first-pass score, practice of missed beats, start over.
- **Feel unproven:** comfort and legibility on the real display, real walking with glasses on, whether the object sizes feel right, real hand tracking on the round targets.
- **Learning unproven:** the method of loci is well studied, but this Lens has not been tested with speakers. A next step is a small study: same talk, half rehearse with notes, half with Walk Your Talk, then recall a day later.
