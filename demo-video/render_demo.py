"""Edit the recorded Lens Studio Preview take into the narrated demo.

Inputs:  artifacts/media/raw/take.mov (+ take.log with timestamped marks,
         take.timing.json), artifacts/media/narration.wav, timeline.json,
         captions.json (from generate_narration.py).
Output:  artifacts/media/WalkYourTalk-demo.mp4 (2560x1440, 30 fps, H.264/AAC).

Every frame of footage is the real Preview panel; the editor only trims,
re-times and frames it. No outcome is drawn by the editor.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import textwrap

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "artifacts/media"
RAW = MEDIA / "raw"
OUT = MEDIA / "edit"
OUT.mkdir(parents=True, exist_ok=True)
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
TAKE = Path(os.environ.get("WYT_TAKE", RAW / "take3.mov"))

W, H, FPS = 2560, 1440, 30
BG, INK, MUTED = "#0e1217", "#f5f2ea", "#a9b3bd"
GOLD, LILAC = "#ffc24d", "#c3a6ff"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
# Footage box on the right; the take is the Preview render area without chrome.
BOX = (1180, 168, 1300, 935)
CHROME_TOP, CHROME_BOTTOM = 28, 48

timeline = json.loads((MEDIA / "timeline.json").read_text())
captions = json.loads((MEDIA / "captions.json").read_text())


def recorder_info() -> dict:
    """Window frame and first-frame time printed by WindowRecorder.swift."""
    info = {}
    for line in TAKE.with_suffix(".recorder.txt").read_text().splitlines():
        parts = line.split()
        if parts and parts[0] == "WINDOW_FRAME":
            info["window"] = [float(v) for v in parts[1:5]]
        elif parts and parts[0] == "FIRST_FRAME_EPOCH":
            info["t0"] = float(parts[1])
    return info


INFO = recorder_info()
# Preview panel rectangle in global points (from get-preview-rect.ts) and the
# panel's own chrome, so only the rendered Lens view is used.
PANEL = [float(v) for v in os.environ.get("WYT_PANEL", "486,-944,1340,847").split(",")]
# The preview renders the left eye; the SPECS display covers roughly its right
# four fifths, so the edit keeps that region and drops the empty left strip.
DISPLAY_LEFT = float(os.environ.get("WYT_DISPLAY_LEFT", "0.2"))
CROP_X = int(PANEL[0] - INFO["window"][0] + PANEL[2] * DISPLAY_LEFT)
CROP_Y = int(PANEL[1] - INFO["window"][1]) + CHROME_TOP
CROP_W = int(PANEL[2] * (1 - DISPLAY_LEFT)) // 2 * 2
CROP_H = (int(PANEL[3]) - CHROME_TOP - CHROME_BOTTOM) // 2 * 2
CROP = f"crop={CROP_W}:{CROP_H}:{CROP_X}:{CROP_Y}"


def marks() -> dict:
    t0 = INFO["t0"]
    out = {}
    for line in TAKE.with_suffix(".log").read_text().splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("event") == "mark":
            out[row["name"]] = row["e"] - t0
    return out


M = marks()

# Scene -> list of (from, to) source ranges, as (mark, offset seconds).
EDITS = {
    "problem": [(("intro", -1.0), ("build-1", 0.5))],
    "idea": [(("build-1", 0.5), ("build-3", 2.5))],
    "build": [(("build-3", 2.5), ("built", 3.0))],
    "walk": [(("walk-start", -0.4), ("walk-4", 2.6))],
    "recall": [(("hidden-1", -0.5), ("graded-1", 0.8)), (("reveal-4", 0.3), ("graded-4", 1.0))],
    "debrief": [(("debrief", -0.2), ("practice-start", 0.5)), (("practice-walk-4", -1.5), ("practice-walk-4", 1.5)),
                (("final-debrief", -0.3), ("final-debrief", 3.5))],
    "implementation": [(("hidden-2", -0.5), ("graded-3", 1.0))],
    "close": [(("walk-5", -2.0), ("walked", 2.0)), (("hidden-5", -0.3), ("graded-5", 1.2))],
}


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else REG, size)


def wrap(draw, text, xy, size, width, fill, bold=False, gap=12):
    face = font(size, bold)
    x, y = xy
    line = ""
    for word in text.split():
        trial = (line + " " + word).strip()
        if line and draw.textlength(trial, font=face) > width:
            draw.text((x, y), line, font=face, fill=fill)
            y += size + gap
            line = word
        else:
            line = trial
    draw.text((x, y), line, font=face, fill=fill)
    return y + size + gap


def card(scene, index) -> Path:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 14, H), fill=GOLD)
    d.text((80, 44), "WALK YOUR TALK", font=font(38, True), fill=INK)
    d.text((470, 52), "SPECS  ·  A MEMORY PALACE FOR YOUR NEXT TALK", font=font(25), fill=MUTED)
    d.line((80, 112, 2480, 112), fill="#26303a", width=2)
    d.text((80, 200), f"0{index + 1}  /  {scene['kicker']}", font=font(30, True), fill=GOLD)
    for row, line in enumerate(scene["title"].split("\n")):
        d.text((74, 268 + row * 112), line, font=font(90, True), fill=INK)
    y = 560
    for n, point in enumerate(scene["points"], 1):
        d.ellipse((82, y + 6, 124, y + 48), fill="#3a3220")
        d.text((95, y + 11), str(n), font=font(23, True), fill=GOLD)
        end = wrap(d, point, (150, y), 42, 900, INK)
        y = max(end + 34, y + 100)
    if scene["id"] == "implementation":
        for x, value, label in [(80, "10 / 10", "LOGIC TESTS"), (520, "7 / 7", "LEAF SCENARIOS")]:
            d.rounded_rectangle((x, 960, x + 400, 1120), radius=18, fill="#1a1f26", outline="#3a3220", width=2)
            d.text((x + 24, 978), value, font=font(64, True), fill=GOLD)
            d.text((x + 26, 1068), label, font=font(24, True), fill=MUTED)
    else:
        wrap(d, "A Lens for SPECS, shown in Lens Studio's preview. Simulated room, no glasses needed.", (80, 1060), 30, 980, MUTED, gap=8)
    x0, y0, bw, bh = BOX
    d.rounded_rectangle((x0 - 14, y0 - 14, x0 + bw + 14, y0 + bh + 14), radius=20, fill="#05080b", outline="#26303a", width=2)
    d.text((x0, y0 - 62), "LENS STUDIO PREVIEW  ·  SPECS 27", font=font(26, True), fill=LILAC)
    d.text((x0, y0 + bh + 26), "Real recordings of the running Lens  ·  simulated preview input", font=font(24), fill=MUTED)
    d.rectangle((0, 1300, W, H), fill="#090c10")
    for k in range(len(timeline["scenes"])):
        x = 80 + k * 302
        d.rounded_rectangle((x, 1418, x + 280, 1425), radius=3, fill=GOLD if k == index else "#26303a")
    path = OUT / f"{scene['id']}.png"
    img.save(path)
    return path


def run(args):
    done = subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", *args], capture_output=True, text=True)
    if done.returncode:
        raise RuntimeError(done.stderr[-4000:])


def at(ref):
    name, offset = ref
    return max(0.0, M[name] + offset)


def render_scene(item):
    index, scene = item
    ranges = [(at(a), at(b)) for a, b in EDITS[scene["id"]]]
    source_total = sum(b - a for a, b in ranges)
    factor = scene["duration"] / source_total  # >1 slows down, <1 speeds up
    pieces = []
    _, _, bw, bh = BOX
    for n, (a, b) in enumerate(ranges):
        target = OUT / f"{scene['id']}-{n}.mp4"
        length = (b - a) * factor
        crop = CROP
        run(["-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(TAKE), "-an", "-vf",
             f"{crop},setpts=PTS*{factor:.5f},fps={FPS},scale={bw}:{bh}:force_original_aspect_ratio=decrease,"
             f"pad={bw}:{bh}:(ow-iw)/2:(oh-ih)/2:color=0x05080b,setsar=1,tpad=stop_mode=clone:stop_duration=0.2",
             "-t", f"{length:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-y", str(target)])
        pieces.append(target)
    listing = OUT / f"{scene['id']}-concat.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in pieces))
    background = card(scene, index)
    target = OUT / f"scene-{index:02}.mp4"
    x0, y0, _, _ = BOX
    run(["-loop", "1", "-framerate", str(FPS), "-i", str(background), "-f", "concat", "-safe", "0", "-i", str(listing),
         "-filter_complex", f"[0:v][1:v]overlay={x0}:{y0}:shortest=1,format=yuv420p[v]", "-map", "[v]", "-an",
         "-t", f"{scene['duration']:.3f}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-y", str(target)])
    print("scene", scene["id"], f"factor={factor:.2f}", flush=True)
    return target


def ass_time(ms):
    cs = round(ms / 10)
    return f"{cs // 360000}:{cs // 6000 % 60:02}:{cs // 100 % 60:02}.{cs % 100:02}"


def captions_file() -> Path:
    ass = ("[Script Info]\nScriptType: v4.00+\nPlayResX: 2560\nPlayResY: 1440\nWrapStyle: 2\n\n[V4+ Styles]\n"
           "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
           "Style: Default,Arial,46,&H00EAF2F5,&H00FFFFFF,&H00100C09,&H00100C09,0,0,0,0,100,100,0,0,1,0,0,2,160,160,52,1\n\n"
           "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    for cue in captions:
        text = r"\N".join(textwrap.wrap(cue["text"], 90))
        ass += f"Dialogue: 0,{ass_time(cue['startMs'])},{ass_time(cue['endMs'])},Default,,0,0,0,,{text}\n"
    path = OUT / "captions.ass"
    path.write_text(ass)
    return path


def cover():
    frame = OUT / "cover-frame.png"
    t = M["walk-2"] + 2.0
    run(["-ss", f"{t:.2f}", "-i", str(TAKE), "-frames:v", "1", "-vf", CROP, "-y", str(frame)])
    img = Image.new("RGB", (1600, 900), BG)
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 12, 900), fill=GOLD)
    d.text((60, 70), "WALK YOUR TALK", font=font(34, True), fill=GOLD)
    for y, line in [(170, "Memorize a talk"), (268, "by walking")] + [(366, "your room.")]:
        d.text((56, y), line, font=font(80, True), fill=INK)
    wrap(d, "A memory-palace Lens for SPECS.", (60, 500), 36, 640, MUTED)
    d.rounded_rectangle((60, 640, 680, 716), radius=12, fill="#3a3220")
    d.text((86, 660), "Build. Walk. Recall.", font=font(34, True), fill=GOLD)
    d.text((60, 820), "LENS STUDIO PREVIEW", font=font(22, True), fill=MUTED)
    shot = Image.open(frame).convert("RGB")
    shot.thumbnail((860, 760), Image.Resampling.LANCZOS)
    img.paste(shot, (720 + (860 - shot.width) // 2, (900 - shot.height) // 2))
    img.save(MEDIA / "WalkYourTalk-cover.jpg", quality=94)


if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        scenes = list(pool.map(render_scene, enumerate(timeline["scenes"])))
    listing = OUT / "all-scenes.txt"
    listing.write_text("".join(f"file '{p.name}'\n" for p in scenes))
    subs = captions_file()
    escaped = str(subs).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
    final = MEDIA / "WalkYourTalk-demo.mp4"
    run(["-f", "concat", "-safe", "0", "-i", str(listing), "-i", str(MEDIA / "narration.wav"),
         "-vf", f"subtitles=filename='{escaped}'", "-af", "loudnorm=I=-16:TP=-1.5:LRA=9",
         "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         "-t", f"{timeline['scenes'][-1]['end']:.3f}", "-y", str(final)])
    cover()
    (MEDIA / "edit-plan.json").write_text(json.dumps({"take": TAKE.name, "marks": M, "edits": EDITS}, indent=2) + "\n")
    print(final, flush=True)
