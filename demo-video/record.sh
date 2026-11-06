#!/bin/bash
# Records only the Lens Studio window (ScreenCaptureKit window capture, so no
# other app can appear in the footage) while drive.mjs performs a paced take.
# Usage: record.sh <seconds> <out.mov> [flow]
set -euo pipefail
SECONDS_TOTAL="$1"; OUT="$2"; FLOW="${3:-record}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="${TMPDIR:-/tmp}/wyt-window-recorder"
if [ ! -x "$BIN/WindowRecorder" ]; then
  mkdir -p "$BIN" && cp "$ROOT/demo-video/WindowRecorder.swift" "$BIN/main.swift"
  swiftc -O -o "$BIN/WindowRecorder" "$BIN/main.swift"
fi
"$BIN/WindowRecorder" "$SECONDS_TOTAL" "$OUT" > "${OUT%.mov}.recorder.txt" 2>&1 &
REC=$!
sleep 3
node "$ROOT/demo-video/drive.mjs" "$FLOW" > "${OUT%.mov}.log" 2>&1 || true
wait $REC
cat "${OUT%.mov}.recorder.txt"
