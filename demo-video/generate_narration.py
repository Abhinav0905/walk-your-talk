"""Walk Your Talk narration: Kokoro TTS (af_heart, a synthetic voice, no cloning)
plus English captions timed from the synthesis itself.

Expects the official kokoro-onnx model files in $WYT_VOICE_MODELS
(default /tmp/two-minutes-media-models):
  kokoro-v1.0.onnx, voices-v1.0.bin
"""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import textwrap

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts/media"
SCRIPT = ROOT / "demo-video/narration.json"
MODELS = Path(os.environ.get("WYT_VOICE_MODELS", "/tmp/two-minutes-media-models"))
RATE = 24_000
LEAD, GAP, TAIL = 0.30, 0.16, 0.6


def srt_time(seconds: float) -> str:
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def silence(seconds: float) -> np.ndarray:
    return np.zeros(round(RATE * seconds), dtype=np.float32)


def main() -> None:
    (OUT / "voice").mkdir(parents=True, exist_ok=True)
    plan = json.loads(SCRIPT.read_text())
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(MODELS / "kokoro-v1.0.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
    tts = Kokoro.from_session(session, str(MODELS / "voices-v1.0.bin"))
    if plan["voice"] not in tts.voices:
        raise SystemExit("af_heart voice not found in voices file")

    track: list[np.ndarray] = []
    position = 0
    captions = []

    def add(chunk: np.ndarray) -> None:
        nonlocal position
        track.append(chunk)
        position += len(chunk)

    for scene in plan["scenes"]:
        scene["start"] = position / RATE
        add(silence(LEAD))
        for sentence in scene["sentences"]:
            samples, rate = tts.create(sentence, voice=plan["voice"], speed=plan["speed"], lang=plan["language"])
            assert rate == RATE and np.isfinite(samples).all() and len(samples) > RATE * 0.3
            start = position / RATE
            add(samples.astype(np.float32))
            captions.append({"text": sentence, "startMs": round(start * 1000), "endMs": round(position / RATE * 1000)})
            add(silence(GAP))
        add(silence(TAIL))
        scene["end"] = position / RATE
        scene["duration"] = scene["end"] - scene["start"]
        print(json.dumps({"scene": scene["id"], "seconds": round(scene["duration"], 2)}), flush=True)

    audio = np.concatenate(track)
    peak = float(np.max(np.abs(audio)))
    if peak > 0.95:
        audio *= 0.95 / peak
    sf.write(OUT / "narration.wav", audio, RATE, subtype="PCM_16")
    (OUT / "timeline.json").write_text(json.dumps(plan, indent=2) + "\n")
    (OUT / "captions.json").write_text(json.dumps(captions, indent=2) + "\n")
    srt = [f"{i}\n{srt_time(c['startMs'] / 1000)} --> {srt_time(c['endMs'] / 1000)}\n" + "\n".join(textwrap.wrap(c["text"], 70)) + "\n"
           for i, c in enumerate(captions, 1)]
    (ROOT / "demo-video/WalkYourTalk-English.srt").write_text("\n".join(srt))
    receipt = {
        "engine": "kokoro-onnx", "version": importlib.metadata.version("kokoro-onnx"), "voice": plan["voice"],
        "syntheticVoice": True, "voiceCloning": False, "captionsAddedSeparately": True,
        "durationSeconds": round(len(audio) / RATE, 3), "captionCues": len(captions),
        "scriptSha256": hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),
    }
    (OUT / "voice-provenance.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt), flush=True)


if __name__ == "__main__":
    main()
