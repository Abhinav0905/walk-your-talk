"""Check the synthetic narration against the script with an independent local
speech recognizer (faster-whisper base.en). A transcript match, not a listening test."""
from pathlib import Path
import difflib
import json
import re
import subprocess

import imageio_ffmpeg
import numpy as np
from faster_whisper import WhisperModel

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "artifacts/media"
plan = json.loads((ROOT / "demo-video/narration.json").read_text())
expected = " ".join(s for scene in plan["scenes"] for s in scene["sentences"])
pcm = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-i", str(MEDIA / "narration.wav"),
                      "-f", "f32le", "-ar", "16000", "-ac", "1", "pipe:1"], capture_output=True, check=True).stdout
speech = np.frombuffer(pcm, dtype=np.float32)
model = WhisperModel("base.en", device="cpu", compute_type="int8", download_root="/tmp/two-minutes-asr-models")
segments, _ = model.transcribe(speech, language="en", beam_size=5)
heard = " ".join(s.text.strip() for s in segments)


def words(text: str) -> list[str]:
    text = text.lower().replace("2017", "twenty seventeen").replace("specs", "specs").replace("loci", "loci")
    return re.findall(r"[a-z0-9']+", text)


ratio = difflib.SequenceMatcher(None, words(expected), words(heard)).ratio()
result = {"recognizer": "faster-whisper/base.en", "scriptMatch": round(ratio, 4), "seconds": round(len(speech) / 16000, 2),
          "status": "passed" if ratio > 0.85 else "review_required", "transcript": heard}
(MEDIA / "audio-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({k: v for k, v in result.items() if k != "transcript"}))
