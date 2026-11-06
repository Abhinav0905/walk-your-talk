# Demo production

The demo is a narrated edit of a real recording of the running Lens in Lens Studio's preview (SPECS 27, Interactive Preview, Colorful Home).

1. `drive.mjs record` performs a paced take through Lens Studio's own MCP tools (camera moves and pinches), logging a timestamped mark at each moment.
2. `WindowRecorder.swift` records **only the Lens Studio window** with ScreenCaptureKit, so other apps on screen can never appear in the footage. `record.sh` runs both together.
3. `generate_narration.py` synthesizes the narration with Kokoro TTS, voice `af_heart` (a synthetic voice, not a clone of anyone's voice), and times the English captions from the synthesis. `verify_audio.py` checks it against the script with faster-whisper (98.7% match).
4. `render_demo.py` crops the recording to the area the SPECS display covers, cuts it at the logged marks and lays it beside the narration cards. The editor only trims and re-times footage; every outcome on screen comes from the Lens.

Output: 2560×1440, 30 fps, H.264/AAC, 2:07. Captions: [WalkYourTalk-English.srt](WalkYourTalk-English.srt). Script: [narration.json](narration.json).
