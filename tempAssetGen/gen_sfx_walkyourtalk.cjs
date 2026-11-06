// Generates Walk Your Talk's six interface sounds with CLAD's build-sfx engine.
// Seeds are fixed so the committed WAVs can be reproduced exactly.
const path = require('path');
const fs = require('fs');
const ENGINE = '/Users/mac001/.codex/plugins/cache/ls-extensions/ls-clad/local/skills/build-sfx/tools';
const audio = require(ENGINE);
const p = audio.sfx_presets;
const PROJECT_ASSETS_SFX = '/Users/mac001/Downloads/walk-your-talk/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function mix(a, b, gb = 1) {
  const mono = x => (x.left ? x.left : x);
  const A = mono(a), B = mono(b);
  const out = new Float32Array(Math.max(A.length, B.length));
  for (let i = 0; i < out.length; i++) out[i] = (A[i] || 0) + (B[i] || 0) * gb;
  return out;
}
function save(buf, name) {
  audio.mix_bus.masterChain(buf, { normalize: 'peak' });
  audio.WavBuilder.write(buf, path.join(PROJECT_ASSETS_SFX, name + '.wav'));
  console.log('wrote', name);
}

// Dropping an image on its spot: a soft thock with a little sparkle.
save(mix(p.impact({ material: 'soft', size: 0.5, seed: 11 }), p.sparkle({ duration: 0.6, seed: 12 }), 0.45), 'Drop');
// The next spot calling from the room: a gentle two-bell ding.
save(p.uiNotify({ seed: 21 }), 'Beacon');
// A beat's image wakes up as you walk past it.
save(p.magicChime({ seed: 31 }), 'Reveal');
// Self-graded "got it".
save(p.uiSuccess({ seed: 41 }), 'GotIt');
// Self-graded "missed": a soft falling toggle, never a harsh buzzer.
save(p.uiToggle({ on: false, seed: 51 }), 'Missed');
// Start / button press.
save(p.uiBlip({ seed: 61 }), 'Tap');
