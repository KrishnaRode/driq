# DRIQ System Architecture & Technical Specifications

This document outlines the architectural design, multimodal streaming pipelines, geometric projection engines, and synchronization layers powering **DRIQ (Dynamic Real-Time Intelligence & Spatial Grounding)**.

---

## 🏗️ 1. High-Level System Overview

DRIQ couples real-time bidirectional audio streaming with live video spatial grounding and interactive canvas/SVG rendering.

```
                           +----------------------------------------+
                           |          PHYSICAL ENVIRONMENT          |
                           |   (Hardware, Components, Devices)     |
                           +-------------------+--------------------+
                                               |
                                     Camera Stream & Mic
                                               |
                                               v
+---------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                 |
|                                                                                       |
|  +------------------------+       +---------------------+     +--------------------+  |
|  |    CameraController    |       |   AudioController   |     | VisualExperience   |  |
|  | - MediaStream WebRTC   |       | - 16kHz PCM Stream  |     |   Engine           |  |
|  | - Resolution Negotiator|       | - RMS Vol Meter     |     | - HUD Annotations  |  |
|  | - Canvas Frame Sampler |       | - 32-bin FFT Visual |     | - Callout Clamping |  |
|  +-----------+------------+       +----------+----------+     | - Collision Solver |  |
|              |                               |                +---------^----------+  |
|              | JPEG frames (1-2 FPS)         | 16kHz PCM chunks         |             |
|              |                               |                          | Projections |
|              v                               v                          |             |
|  +------------------------------------------------------+     +---------+----------+  |
|  |             LiveSessionManager (WebSocket)           |     | VideoGeometry      |  |
|  |  - Full-duplex JSON/Binary stream                    |     |   Mapper           |  |
|  |  - Reconnection & Session Keepalive                  |     | - 0-1000 to Screen |  |
|  |  - Latency & FPS Telemetry                           |     | - Cover/Contain    |  |
|  +---------------------------+--------------------------+     | - Front Mirroring  |  |
|                              |                                +--------------------+  |
+------------------------------|--------------------------------------------------------+
                               | WebSocket Bridge (/api/live)
                               v
+---------------------------------------------------------------------------------------+
|                                SERVER-SIDE PROXY (Node.js)                            |
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                      GoogleGenAI SDK (ai.live.connect)                          |  |
|  |  - Model: gemini-2.0-flash-exp                                                  |  |
|  |  - Modalities: [AUDIO] (Aoede 24kHz output)                                     |  |
|  |  - System Instruction: DRIQ Permanent Persona & Safety Guidelines               |  |
|  |  - Canonical Graphical Tools:                                                   |  |
|  |      * highlightObject(label, boundingBox, style)                               |  |
|  |      * highlightComponent(componentId, label, boundingBox, category)            |  |
|  |      * showCallout(targetBox, title, explanation, status, placement)            |  |
|  |      * drawConnector(fromBox, toPoint, style)                                   |  |
|  |      * showSteps(steps, initialIndex)                                           |  |
|  |      * clearAnnotations(filter)                                                 |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 📹 2. Vision & Grounding Pipeline

### 2.1 Camera Stream Capture & Sampling
- **Resolution Negotiation**: Solicits `1280x720` (ideal 16:9), gracefully accepting any resolution provided by physical hardware or mobile webcams (`3840x2160`, `1920x1080`, `640x480`).
- **Simulated Camera Fallback**: Provides a high-fidelity synthetic benchmark canvas stream for environments lacking webcams or when permissions are declined.
- **Adaptive Frame Sampling (`FrameSampler.ts`)**:
  - Encodes video frames to compressed JPEG (`quality = 0.7`) using an offscreen canvas.
  - Dynamically regulates transmission frequency: throttles baseline to 1.0 FPS to conserve bandwidth, surging to 2.5 FPS on camera movement or user interaction.
  - Injects canonical timestamp and `frameId` tags into each frame header for telemetry and stale-data prevention.

### 2.2 Canonical Coordinate System
All vision annotations conform strictly to Google Vision's normalized `[ymin, xmin, ymax, xmax]` coordinate system bounded to `[0, 1000]`:
- `(0, 0)` represents the top-left corner of the source video stream.
- `(1000, 1000)` represents the bottom-right corner.
- **Server-Side Validation**: Every bounding box emitted by Gemini or the grounding model undergoes automated verification:
  - Coordinate finiteness and array length check.
  - Coordinate clamping into `[0, 1000]`.
  - Non-invertibility check (`ymax > ymin` and `xmax > xmin`).
  - Occlusion rejection: If an item is occluded or obscured by cables or shadows, it is flagged `visible: false` with an explicit `uncertaintyReason` and coordinates `[0, 0, 0, 0]`.

---

## 📐 3. Geometric Projection Engine (`VideoGeometryMapper`)

When rendering overlays across diverse screens and orientations, physical video aspect ratios rarely match container aspect ratios.

### 3.1 Mathematical Mapping Function

Let container dimensions be $W_c, H_c$ and source video dimensions be $W_v, H_v$.

$$\text{Aspect}_c = \frac{W_c}{H_c}, \quad \text{Aspect}_v = \frac{W_v}{H_v}$$

#### Cover Mode
$$\text{If } \text{Aspect}_c > \text{Aspect}_v: \quad W_r = W_c, \quad H_r = \frac{W_c}{\text{Aspect}_v}, \quad S = \frac{W_c}{W_v}$$
$$\text{Else}: \quad H_r = H_c, \quad W_r = H_c \cdot \text{Aspect}_v, \quad S = \frac{H_c}{H_v}$$

#### Contain Mode
$$\text{If } \text{Aspect}_c > \text{Aspect}_v: \quad H_r = H_c, \quad W_r = H_c \cdot \text{Aspect}_v, \quad S = \frac{H_c}{H_v}$$
$$\text{Else}: \quad W_r = W_c, \quad H_r = \frac{W_c}{\text{Aspect}_v}, \quad S = \frac{W_c}{W_v}$$

#### Offset & Centering
$$\text{Offset}_X = \frac{W_c - W_r}{2}, \quad \text{Offset}_Y = \frac{H_c - H_r}{2}$$

#### Screen Mapping with Front Camera Mirroring
For a normalized bounding box $[y_{\min}, x_{\min}, y_{\max}, x_{\max}]$:

$$\text{If Mirrored (User Front Camera)}: \quad X_{\text{screen}} = \text{Offset}_X + (1 - \frac{x_{\max}}{1000}) \cdot W_r$$
$$\text{If Non-Mirrored (Rear/Default)}: \quad X_{\text{screen}} = \text{Offset}_X + \frac{x_{\min}}{1000} \cdot W_r$$
$$Y_{\text{screen}} = \text{Offset}_Y + \frac{y_{\min}}{1000} \cdot H_r$$
$$\text{Width}_{\text{screen}} = \frac{x_{\max} - x_{\min}}{1000} \cdot W_r, \quad \text{Height}_{\text{screen}} = \frac{y_{\max} - y_{\min}}{1000} \cdot H_r$$

### 3.2 Invariance & Collision Avoidance
- **Drift Tolerance**: Round-trip projection tests guarantee drift $\le 1$ unit out of 1000 ($0.1\%$).
- **Collision Avoidance Placement**: `VisualExperienceEngine.computeOptimalPlacement` dynamically calculates four-direction candidate quadrants (Above, Below, Right, Left) and evaluates viewport boundary clamping to guarantee callout tooltips never clip off-screen or cover the component being explained.

---

## 🎙️ 4. Audio Pipeline & Gemini Live Synchronization

### 4.1 Audio Ingestion & Downsampling
1. **Microphone Capture**: `navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } })`.
2. **Web Audio DSP Pipeline**:
   - `MediaStreamAudioSourceNode` passes through an `AnalyserNode` computing root-mean-square (RMS) input amplitude ($0.0 - 1.0$) and a 32-bin FFT frequency spectrum for the animated visualizer.
   - `ScriptProcessorNode` / `AudioWorklet` buffers Float32 samples, converts them to 16-bit linear PCM (`Int16Array`), and emits base64-encoded audio frames across the WebSocket.

### 4.2 Playback & Barge-In Interruption
- Gemini Live streams back raw 24kHz linear PCM audio chunks.
- Chunks are scheduled seamlessly into a sequential `AudioBufferSourceNode` queue on the client's `AudioContext`.
- **Interruption (Barge-In)**: When the user speaks while Gemini is explaining, or when the user presses Mute/Space, the client triggers `audioController.stopPlayback()`, cancels pending audio buffers, and notifies `InteractionOrchestrator` to invalidate stale highlights.

---

## ⚡ 5. Function Calling & Orchestration Flow

```
User: "What's that blue port on the left?"
  |
  v (Audio Stream)
Gemini Live Model
  |
  +---> Recognizes component as "WAN Internet Port" from video context
  |
  +---> Calls Tool: highlightComponent(componentId: "wan_port", label: "WAN Internet Port")
  |
  v (Tool Call message over WebSocket)
DRIQ InteractionOrchestrator
  |
  +---> Resolves against GroundingService catalog:
  |       - Found componentId: "wan_port"
  |       - Verified visible: true, BoundingBox: [460, 180, 710, 310]
  |
  +---> VisualExperienceEngine renders:
  |       - Reticle contour around port
  |       - Luminous callout: "WAN Internet Port (2.5 GbE) · VERIFIED"
  |       - Animated leader line
  |
  +---> Emits tool_response: { status: "confirmed", screenRect: { x, y, w, h } }
  |
  v (Tool Response over WebSocket)
Gemini Live Model
  |
  +---> Speaks naturally in Aoede's voice:
        "That's the 2.5 Gigabit WAN port! Connect your ethernet cable from the modem here..."
```

---

## 🛡️ 6. Security & Resource Lifecycle

1. **Zero Secret Exposure**:
   - `GEMINI_API_KEY` is loaded exclusively in Node.js server memory via environment variables.
   - The client never touches, receives, or transmits API keys.
2. **Resource Teardown**:
   - Toggling cameras or navigating away releases all `MediaStreamTrack` hardware locks immediately (`track.stop()`).
   - `ResizeObserver` and window listeners cleanly detach via React `useEffect` cleanups.
   - WebSocket disconnects trigger immediate server-side session cleanup (`liveSession.close()`).
