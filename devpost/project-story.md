## Inspiration

Your best friend's wedding is on Saturday and you are giving a two-minute toast. You will be holding a glass and a microphone, and you want your eyes on the couple, not on note cards. The talk has to live in your head.

Memory champions don't memorize by repeating lists. They use the **method of loci**: walk through a place you know and leave a vivid image at each spot. In a 2017 study in *Neuron* (Dresler et al.), six weeks of this training more than doubled ordinary people's recall. The method is old, but it has always lived in your imagination. Glasses can put the images on your actual furniture.

**Who it's for:** anyone who has to speak without notes: wedding toasts, best-man speeches, class presentations, pitches, interviews.

## What it does

Walk Your Talk turns the five beats of a talk into five odd objects on a route through your room.

1. **Build.** Pinch the glowing spot and a beat drops onto the furniture as a vivid object. "Thank everyone for coming" becomes a sunflower bouquet on the kitchen island, the camping trip a tent, the bowling alley a giant pin, patience a golden snail, the toast a champagne flute. A gold route joins them in speaking order.
2. **Walk.** Walk up to each object. It wakes up and shows its beat just long enough to say it out loud, with hands free and eyes up. If the next spot is out of view, a small chevron and a spatial chime point the way. Can't walk the room? Pinch the next spot instead.
3. **Recall.** The objects hide behind "?" orbs. Walk the route again, say each beat from memory, pinch to check, then grade yourself with two big targets beside the object: Got it or Missed.
4. **Debrief.** See your first-pass score (it is never rewritten) and practice a route with only the beats that slipped, until every beat is back.

**Why SPECS:** the memory aid *is* your space. Objects sit at real scale on real furniture along your real walk, and rehearsal happens with your hands free and eyes up, exactly how you will deliver the talk. On a phone, the objects would live on a screen you hold up.

## How I built it

- **Planned** with the Devpost Learn `plan-lens` skill: its AR design rules and preview limits shaped the brief (`devpost/design-brief.md`), from label placement to "only the next spot takes a pinch".
- **Built** with **CLAD** through the **Lens Studio MCP**, starting from Snap's Specs Base Template. Spectacles Interaction Kit drives every interaction; UIKit BackPlate and Flex layout build the cards; MeshBuilder makes the rings, route dots, orbs, pill buttons and arrow.
- **One pure state model** (`PalaceModel.ts`) owns every decision: build order, walk order, recall, honest grading, practice rounds. It has no Lens Studio dependencies, so it runs under Node too.
- **Objects** come from Lens Studio's 3D generator. Their lighting is turned off so they stay bright on an additive display, where dark disappears.
- **Sounds** (drop, beacon chime, reveal, got it, missed, tap) are synthesized with CLAD's `build-sfx` engine. The beacon is spatial, so the next spot calls from where it is.
- **Tests:** 10 Node tests (including a 400-run random-action fuzz) and **7 LEAF scenarios that pass in the preview**, one per done criterion plus an IK reachability check.

## Challenges

- **Labels in a narrow display.** A card above the object in the room sat above your gaze when you looked down; beside the object it sank into walls. The fix was to place the label above the object *in your view*, in the open air between you and the furniture.
- **Pinch targets fighting each other.** Nearer spots blocked rays to farther ones, and two stacked grade buttons were easy to mis-hit. Only the next spot is pinchable now, and grading moved to two big round targets beside the object.
- **Additive display.** Generated models looked muddy and dark text vanished. Unlit materials, white labels and translucent glow buttons fixed both.

## What I learned

The hard part is not building a Lens; CLAD builds quickly. The hard part is deciding where every glance goes. Each design note ("label just above the object in your view", "grade beside the object", "only the next spot glows") made the experience calmer and the tests simpler.

## What's next

- Type or dictate your own talk, with objects generated on the fly.
- Spots from your own surfaces via World Query, and palaces that persist between rehearsals.
- A small study: same talk, notes versus Walk Your Talk, recall a day later.

## Honest limits

The demo runs in Lens Studio's preview in a simulated room, with spots authored for its furniture. Comfort, legibility on the real display, real walking and real hand tracking are unproven without glasses. No study has tested this Lens's learning effect yet.

Narration in the demo video uses Kokoro TTS with the `af_heart` voice: a synthetic voice, not a clone of anyone's voice. English captions were added separately.
