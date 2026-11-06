// Drives the running Walk Your Talk Lens through Lens Studio's own MCP tools
// (the official MCP SDK client, never raw HTTP). Used for repeatable preview
// checks and to choreograph the demo takes; every outcome on screen comes from
// the Lens itself reacting to these camera moves and pinches.
import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers['lens-studio'];
const endpoint = new URL(config.url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)) throw new Error('Expected the local Lens Studio MCP endpoint');
const client = new Client({name: 'walk-your-talk-demo', version: '1.0.0'});
await client.connect(new StreamableHTTPClientTransport(endpoint, {requestInit: {headers: config.headers ?? {}}}));

const started = Date.now();
const wait = ms => new Promise(r => setTimeout(r, ms));
const log = (event, extra = {}) => console.log(JSON.stringify({t: +((Date.now() - started) / 1000).toFixed(2), e: Date.now() / 1000, event, ...extra}));

async function tool(name, args) {
  const result = await client.callTool({name, arguments: args}, undefined, {timeout: 120000});
  if (result.isError) throw new Error(name + ': ' + JSON.stringify(result.content).slice(0, 600));
  if (result.structuredContent) return result.structuredContent;
  const text = (result.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n');
  try { return JSON.parse(text); } catch { return {text}; }
}

async function pinch(name, hold = 160) {
  try {
    const r = await tool('PreviewInteractTool', {action: 'Pinch', name, durationMs: hold});
    if (!r.success) throw new Error('pinch failed ' + name + ' ' + JSON.stringify(r));
    log('pinch', {name});
  } catch (e) {
    // The press landed but its target changed before release; the Lens log is the judge.
    if (String(e).includes('waiting for onTriggerEnd')) { log('pinch-late-release', {name}); return; }
    throw e;
  }
}

/** Press a UIKit button by pinching at its current world position. */
async function press(name, hold = 160) {
  // Aim a little away from the neighbouring button, along the card's own axis,
  // because the simulated fingertip lands slightly off the aimed point.
  const card = name.split('_')[0];
  const q = await tool('QueryRuntimeSceneTool', {query: `{ sceneObjects(filter:{nameContains:"${card}_", enabledOnly: true}, limit: 12) { matches { summary transform { worldPosition } } } }`});
  const rows = q.data?.sceneObjects?.matches || [];
  const m = rows.find(x => x.summary.name === name);
  if (!m) throw new Error('button not visible: ' + name);
  const other = rows.find(x => x.summary.name === card + (name.endsWith('Primary') ? '_Secondary' : '_Primary'));
  const p = m.transform.worldPosition;
  let at = p;
  if (other) {
    const o = other.transform.worldPosition;
    const k = name.endsWith('Primary') ? 0.18 : 0.3;
    at = {x: p.x + (p.x - o.x) * k, y: p.y + (p.y - o.y) * k, z: p.z + (p.z - o.z) * k};
  }
  const r = await tool('PreviewInteractTool', {action: 'Pinch', worldPosition: at, durationMs: hold});
  if (!r.success) throw new Error('press failed ' + name + ' ' + JSON.stringify(r));
  log('press', {name});
}

let pose = {p: [0, 0, 0], l: [0, 0, -100]};
async function cam(p, l) {
  pose = {p, l};
  await tool('MovePreviewCamera', {action: 'setPosition', commands: [
    {action: 'setPosition', x: p[0], y: p[1], z: p[2]},
    {action: 'lookAt', x: l[0], y: l[1], z: l[2]}
  ]});
}
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
/** Smoothly move and turn the preview head over `seconds`. */
async function glide(p, l, seconds, hz = 30) {
  const from = pose;
  const steps = Math.max(1, Math.round(seconds * hz));
  const t0 = Date.now();
  for (let k = 1; k <= steps; k++) {
    const t = ease(k / steps);
    await cam(lerp(from.p, p, t), lerp(from.l, l, t));
    const due = t0 + (k / steps) * seconds * 1000;
    const slack = due - Date.now();
    if (slack > 0) await wait(slack);
  }
}

const SPOT = {
  1: [95, -30, -45], 2: [255, -25, -135], 3: [140, -45, -385], 4: [0, -85, -280], 5: [-70, -45, -315]
};
// Where a person would stand to reach each spot without walking through furniture.
const STAND = {
  1: [15, 0, -25], 2: [195, 0, -195], 3: [108, 0, -305], 4: [40, 0, -212], 5: [-42, 0, -238]
};
const VIA = {2: [[18, 0, -150], [120, 0, -200]], 3: [], 4: [], 5: []};
// Recall happens from a step back: you check yourself from where you can see the spot.
const CHECK = {
  1: [-25, 0, -70], 2: [165, 0, -240], 3: [60, 0, -275], 4: [62, 0, -165], 5: [20, 0, -195]
};
const CHECK_VIA = {2: [[0, 0, -170], [100, 0, -250]], 3: [], 4: [], 5: []};

async function reset() {
  await tool('MovePreviewCamera', {action: 'reset'});
  pose = {p: [0, 0, 0], l: [0, 0, -100]};
  await tool('RecompileTypeScriptTool', {});
  await tool('RunAndCollectLogsTool', {mode: 'refresh', settleMinMs: 900, settleMaxMs: 2500});
  log('reset');
}

async function build(pace = 1) {
  await faceCard();
  await shot('intro');
  await pinch('MainCard_Primary');
  await wait(900 * pace);
  for (let i = 1; i <= 5; i++) {
    await glide([0, 0, 0], SPOT[i], 1.1 * pace);
    await wait(500 * pace);
    if (i === 1) await shot('b1-before');
    await pinch('Spot_' + i + '_Target');
    await wait(1100 * pace);
    if (i === 1 || i === 3) await shot('b' + i + '-after');
  }
  await glide([0, 0, 0], [0, -12, -100], 1.0 * pace);
  await wait(1600 * pace);
  await shot('built');
}

async function walkTo(i, pace = 1, lookAhead = true) {
  for (const v of (VIA[i] || [])) await glide(v, SPOT[i], 1.2 * pace);
  await glide(STAND[i], SPOT[i], 1.6 * pace);
}

async function walk(pace = 1, order = [1, 2, 3, 4, 5]) {
  await faceCard();
  await pinch('MainCard_Primary');
  await wait(500 * pace);
  for (const i of order) {
    await walkTo(i, pace);
    await wait(2200 * pace);
    await shot('w' + i);
  }
}

async function recall(pace = 1, missed = [4], order = [1, 2, 3, 4, 5]) {
  await faceCard();
  await pinch('MainCard_Primary');
  await wait(600 * pace);
  for (const i of order) {
    for (const v of (CHECK_VIA[i] || [])) await glide(v, SPOT[i], 1.2 * pace);
    await glide(CHECK[i], SPOT[i], 1.6 * pace);
    await wait(900 * pace);
    await shot('r' + i + '-hidden');
    await pinch('Spot_' + i + '_Target');
    await wait(1300 * pace);
    await shot('r' + i + '-check');
    await pinch(missed.includes(i) ? 'GradeMissed' : 'GradeGot');
    await wait(900 * pace);
  }
}

/** Wait for the Lens to show a phase card, then turn towards it. */
async function faceCard() {
  // The card root is what the Lens shows and hides; its children keep their own flags.
  for (let k = 0; k < 60; k++) {
    const q = await tool('QueryRuntimeSceneTool', {query: '{ sceneObjects(filter:{nameContains:"MainCard"}, limit: 20) { matches { summary } } }'});
    const root = (q.data?.sceneObjects?.matches || []).find(x => x.summary.name === 'MainCard');
    if (root?.summary?.enabled) break;
    await wait(250);
  }
  const r = await tool('QueryRuntimeSceneTool', {query: '{ sceneObjects(filter:{nameContains:"MainCard"}, limit: 1) { matches { summary transform { worldPosition } } } }'});
  const m = r.data?.sceneObjects?.matches?.[0];
  if (m) await glide(pose.p, [m.transform.worldPosition.x, m.transform.worldPosition.y, m.transform.worldPosition.z], 0.8);
}

const SHOT_DIR = process.env.SHOTS || '';
async function shot(name) {
  if (!SHOT_DIR) return;
  fs.mkdirSync(SHOT_DIR, {recursive: true});
  await tool('PreviewPanelTool', {action: 'screenshot', outputPath: path.join(SHOT_DIR, name + '.png')});
  log('shot', {name});
}

async function state() {
  const r = await tool('RunAndCollectLogsTool', {mode: 'tail', tailBytes: 20000});
  return (r.prints || []).filter(p => p.includes('WalkYourTalk:')).map(p => p.replace(/^.*WalkYourTalk: /, ''));
}

try {
  const flow = process.argv[2] ?? 'full';
  const pace = Number(process.argv[3] ?? 1);
  if (flow === 'reset') await reset();
  else if (flow === 'build') await build(pace);
  else if (flow === 'walk') await walk(pace);
  else if (flow === 'recall') await recall(pace);
  else if (flow === 'practice') {
    await faceCard(); await pinch('MainCard_Primary'); await wait(800);
    await walk(pace, [4]);
    await recall(pace, [], [4]);
  } else if (flow === 'full') {
    await reset(); await build(pace); await walk(pace); await recall(pace);
    await faceCard(); await wait(2500 * pace); await shot('debrief1');
    await pinch('MainCard_Primary'); await wait(1300);   // practice the missed beat
    await walk(pace, [4]);
    await recall(pace, [], [4]);
    await faceCard(); await wait(1500); await shot('debrief2');
  } else if (flow === 'record') {
    // Paced take for the demo video. Every mark is logged so the edit can cut
    // to real moments; nothing on screen is staged outside the Lens.
    const mark = name => log('mark', {name});
    await reset();
    await wait(2500); mark('intro');
    await wait(3500);
    await pinch('MainCard_Primary'); mark('build-start');
    await wait(900);
    for (let i = 1; i <= 5; i++) {
      await glide([0, 0, 0], SPOT[i], 1.5);
      await wait(900); mark('build-' + i);
      await pinch('Spot_' + i + '_Target');
      await wait(1700);
    }
    await glide([0, 0, 0], [0, -12, -100], 1.4);
    await faceCard(); mark('built'); await wait(3200);
    await pinch('MainCard_Primary'); mark('walk-start');
    await wait(700);
    for (const i of [1, 2, 3, 4, 5]) {
      for (const v of (VIA[i] || [])) await glide(v, SPOT[i], 1.6);
      await glide(STAND[i], SPOT[i], 2.4); mark('walk-' + i);
      await wait(2600);
    }
    await faceCard(); mark('walked'); await wait(3000);
    await pinch('MainCard_Primary'); mark('recall-start');
    await wait(700);
    for (const i of [1, 2, 3, 4, 5]) {
      for (const v of (CHECK_VIA[i] || [])) await glide(v, SPOT[i], 1.5);
      await glide(CHECK[i], SPOT[i], 2.0); mark('hidden-' + i);
      await wait(1500);
      await pinch('Spot_' + i + '_Target'); mark('reveal-' + i);
      await wait(2200);
      await pinch(i === 4 ? 'GradeMissed' : 'GradeGot'); mark('graded-' + i);
      await wait(1300);
    }
    await faceCard(); mark('debrief'); await wait(4800);
    await pinch('MainCard_Primary'); mark('practice-start'); await wait(1300);
    await faceCard(); await wait(1800);
    await pinch('MainCard_Primary'); mark('practice-walk');
    await wait(600);
    await glide(STAND[4], SPOT[4], 2.4); mark('practice-walk-4');
    await wait(2600);
    await faceCard(); await wait(1800);
    await pinch('MainCard_Primary'); mark('practice-recall');
    await wait(700);
    await glide(CHECK[4], SPOT[4], 2.0); mark('practice-hidden-4'); await wait(1400);
    await pinch('Spot_4_Target'); mark('practice-reveal-4'); await wait(2000);
    await pinch('GradeGot'); mark('practice-graded-4'); await wait(1200);
    await faceCard(); mark('final-debrief'); await wait(5000);
    mark('end');
  } else if (flow === 'tow4') {
    await reset(); await build(0.3); await walk(0.4, [1, 2, 3, 4]);
    const q = await tool('QueryRuntimeSceneTool', {query: '{ sceneObjects(filter:{nameContains:"SpotCard"}, limit: 3) { matches { summary transform { worldPosition worldScale } } } }'});
    for (const m of q.data.sceneObjects.matches) log('obj', {n: m.summary.name, e: m.summary.enabled, p: m.transform.worldPosition, s: m.transform.worldScale});
    await shot('w4-debug');
  } else if (flow === 'tomiss') {
    await reset(); await build(0.3); await walk(0.3);
    await faceCard(); await pinch('MainCard_Primary'); await wait(400);
    await glide(CHECK[1], SPOT[1], 0.6); await wait(500); await pinch('Spot_1_Target'); await wait(900);
    const q = await tool('QueryRuntimeSceneTool', {query: '{ sceneObjects(filter:{nameContains:"SpotCard_", enabledOnly: true}, limit: 12) { matches { summary transform { worldPosition } } } }'});
    for (const m of q.data.sceneObjects.matches) log('obj', {n: m.summary.name, p: m.transform.worldPosition});
  } else if (flow === 'state') {
    console.log((await state()).join('\n'));
  } else throw new Error('unknown flow ' + flow);
  log('done', {flow});
} finally { await client.close(); }
