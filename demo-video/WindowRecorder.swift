// Records ONLY the Lens Studio main window with ScreenCaptureKit
// (desktop-independent window capture), so other apps on screen never end up
// in the footage. Usage: swift WindowRecorder.swift <seconds> <out.mov>
// Prints the window frame (points) so the Preview panel can be cropped later.
import AppKit
import AVFoundation
import CoreMedia
import Foundation
import ScreenCaptureKit

final class Recorder: NSObject, SCStreamOutput {
  let writer: AVAssetWriter
  let input: AVAssetWriterInput
  var started = false
  var frames = 0

  init(url: URL, width: Int, height: Int) throws {
    writer = try AVAssetWriter(outputURL: url, fileType: .mov)
    input = AVAssetWriterInput(mediaType: .video, outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 16_000_000]
    ])
    input.expectsMediaDataInRealTime = true
    writer.add(input)
  }

  func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen, buffer.isValid,
          let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false) as? [[SCStreamFrameInfo: Any]],
          let raw = attachments.first?[.status] as? Int, let status = SCFrameStatus(rawValue: raw), status == .complete
    else { return }
    if !started {
      writer.startWriting()
      writer.startSession(atSourceTime: CMSampleBufferGetPresentationTimeStamp(buffer))
      started = true
      print("FIRST_FRAME_EPOCH \(Date().timeIntervalSince1970)")
      fflush(stdout)
    }
    if input.isReadyForMoreMediaData { input.append(buffer); frames += 1 }
  }
}

// A window-server connection is required before any capture APIs run.
_ = NSApplication.shared
let args = CommandLine.arguments
let seconds = Double(args.count > 1 ? args[1] : "10") ?? 10
let out = URL(fileURLWithPath: args.count > 2 ? args[2] : "window.mov")
try? FileManager.default.removeItem(at: out)

let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
let candidates = content.windows.filter { $0.owningApplication?.applicationName == "Lens Studio" && $0.frame.width > 800 && $0.frame.height > 500 }
guard let window = candidates.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
  print("NO_LENS_STUDIO_WINDOW"); exit(2)
}
print("WINDOW_FRAME \(window.frame.origin.x) \(window.frame.origin.y) \(window.frame.width) \(window.frame.height)")

let config = SCStreamConfiguration()
let scale = 1
config.width = Int(window.frame.width) * scale
config.height = Int(window.frame.height) * scale
config.minimumFrameInterval = CMTime(value: 1, timescale: 30)
config.pixelFormat = kCVPixelFormatType_32BGRA
config.showsCursor = false
config.queueDepth = 6

let recorder = try Recorder(url: out, width: config.width, height: config.height)
let stream = SCStream(filter: SCContentFilter(desktopIndependentWindow: window), configuration: config, delegate: nil)
try stream.addStreamOutput(recorder, type: .screen, sampleHandlerQueue: DispatchQueue(label: "frames"))
try await stream.startCapture()
print("RECORDING \(seconds)s")
fflush(stdout)
try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
try await stream.stopCapture()
recorder.input.markAsFinished()
await recorder.writer.finishWriting()
print("SAVED \(out.path) frames=\(recorder.frames)")
