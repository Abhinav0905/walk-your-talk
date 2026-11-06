---
status: approved
name: "Walk Your Talk"
planning_method: "Devpost Learn plan-lens skill (challengepost/learn-specs): its AR design rules, preview limits and design-brief template, applied to the concept the learner chose in conversation on Nov 6, 2026"
scope_approval: "Learner approved the Walk Your Talk concept and asked for it to be built, recorded and submitted the same way as their first entry."
---

# Design brief: Walk Your Talk

## The one spatial moment
You are rehearsing a two-minute wedding toast in your living room. As you walk your usual route, each beat of the toast is waiting for you as an odd, vivid object on real furniture: a sunflower bouquet on the kitchen island, a tent at its far end, a bowling pin in the armchair. Reaching one wakes it up and shows the beat, so you say it out loud with your eyes up and your hands free. Then the objects hide and you walk it again from memory.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free, and uses your own space as the memory aid.
- The method of loci works because memories attach to places. On glasses the places are your real room and the route is your real walk; on a phone the objects live on a screen you hold up, and you cannot rehearse a toast with a phone in one hand and a glass in the other.
- A speaker's real constraint is hands (glass, microphone) and eyes (on the couple, not on notes). The Lens keeps both free during rehearsal.

## Product or overlay
- Type: product. The palace of objects and the walk are the experience.
- What the real version would sense: the user's position (to know when they reach a spot) and surfaces in their room (World Query) to suggest and anchor spots.
- Stand-in for the preview: five spots are authored on furniture in Lens Studio's Colorful Home room (kitchen island, its far end, the armchair by the window, a dining chair, the dining table). The user still pinches each glowing spot to place a beat. Walking is the preview camera moving with WASD; on glasses it is the user walking.

## Where things live
- Where the user is looking during the main task: at the object on the furniture in front of them, usually 0.8 to 1.5 m away and below eye level.
- Spot ring: a glowing ring 36 cm across lying on the furniture surface where the object will sit (default).
- Object: real-scale but exaggerated, 25 to 45 cm tall, resting on the spot (sunflower bouquet 40 cm, tent 30 cm, bowling pin 45 cm, snail 25 cm, champagne flute 38 cm) (default).
- Beat label: a compact card about 25 cm wide floating just above the object in your view, 55 to 78 cm from you, so it reads as that object's label and sits in open air above the furniture (default).
- Phase cards (intro, "Now walk the route", "Now from memory", debrief): about 80 cm in front at near eye height; they follow gently if you turn away (default).
- Route: small gold dots on the floor joining the spots in order (default).
- Grade buttons: two 11 cm round targets either side of the revealed object, Got it on the left and Missed on the right (default).

## Hands and input
- Start, phase changes and debrief choices: pinch large pill buttons on the card.
- Build: pinch the glowing spot to drop that beat's object. Only the next spot in route order takes a pinch.
- Walk: walk up to the next object (within 90 cm). Pinching the next spot does the same job, for anyone who cannot walk the room.
- Recall: pinch the "?" orb to reveal the beat after saying it, then pinch Got it or Missed.
- Targets are big and highlight when aimed at.
- Voice: none required. Saying the beat out loud is part of the practice, but nothing depends on speech recognition.

## When things show
- Spot rings: appear when building starts; the next one pulses, the others stay dim.
- Beat label in build: shows the beat and what to pinch; moves on as soon as it is placed.
- Beat label in walk: appears when you reach the object and fades after about six seconds or when you reach the next one.
- Objects in recall: hidden behind a lilac "?" orb until you pinch it.
- Grade buttons: only while a revealed beat is waiting for a grade.
- If the next spot is out of view: a small gold chevron at the edge of view points to it, and the spot chimes softly every few seconds (spatial sound).

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching "Build my palace", then each glowing spot in order, drops five objects onto the furniture and draws the route; the walk card appears.
2. A spot that is not the glowing one does not take a pinch.
3. Walking up to (or pinching) each next object wakes it and shows its beat; after the fifth, the "Now from memory" card appears.
4. In recall every object is hidden behind a "?"; pinching it reveals the beat, and Got it or Missed records the grade.
5. The debrief reports the first-pass score and names missed beats; "Practice the missed beat" runs a route with only those beats and reports them back without changing the first-pass score.
6. "Start over" returns to the intro with the palace cleared.

## Out of scope
- Typing or dictating your own talk, AI-generated images on the fly, persistent palaces across sessions, real surface detection in the preview, speech recognition grading, sharing a palace with someone else.

## Risks and open questions
- Feel unproven: whether objects at these sizes are comfortable and memorable on real Specs, and how the narrow display frames a 45 cm object at arm's length.
- Feel unproven: walking a real room while wearing glasses; the preview walks with the keyboard.
- Learning unproven: no participant study yet. The method of loci has strong evidence in general; this Lens has not been tested with real speakers.
- Preview stand-in: spot positions are authored for one simulated room.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
