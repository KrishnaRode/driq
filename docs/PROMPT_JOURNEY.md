# DRIQ Prompt & Iteration Journey — Google AI Studio Build

This document records the prompt journey, engineering iterations, architectural problems encountered, and solutions developed during the creation of **DRIQ** in Google AI Studio for the **DevFest Pune 2026 Vibe Coding Contest**.

---

## 🧭 Project Inception & Vision Brief

### Initial Prompt
> *"Build DRIQ: a real-time, voice-first multimodal AI companion powered by Gemini Live and Spatial Vision Grounding. Point your device's camera at physical objects, ask questions in natural speech, and receive instant spoken explanations synchronized with illuminated on-screen visual overlays, callouts, and step-by-step guidance."*

### Core Challenge
Traditional multimodal models operate like static image chatbots: you submit an image, wait 3 seconds, and receive a wall of text. Physical troubleshooting requires continuous hands-free interaction, sub-second vocal feedback, precise coordinate alignment on moving cameras, and epistemic honesty when parts are occluded.

---

## 🔄 Detailed Iteration Journey

### Phase 1: Camera & Audio Input Foundations
- **Objective**: Establish rock-solid, production-grade hardware capture for video streams and Web Audio, with graceful fallbacks.
- **Problems Encountered**:
  - Web browsers decline camera or microphone permissions, leaving the application in a dead, unrecoverable state.
  - Cloud development and CI/headless environments lack physical webcams and microphones, blocking verification.
  - Standard browser `AudioContext` operates at native hardware rates (44.1kHz or 48kHz), whereas Gemini Live expects 16kHz single-channel linear PCM.
- **Architectural Solutions**:
  - Developed `CameraController.ts` with automatic device enumeration, resolution negotiation (prioritizing 1080p/720p 16:9), and rear/front camera toggling.
  - Built a simulated hardware mode (`isSimulated: true`) that generates a high-definition synthetic benchmark stream (router backplate, test patterns, moving indicators) when hardware access is denied.
  - Built `AudioController.ts` with custom linear downsampling to 16kHz PCM, real-time RMS metering, and 32-bin FFT frequency extraction for UI audio visualizers.

---

### Phase 2: Responsive Viewport & Video Geometry Mapping
- **Objective**: Map canonical vision bounding boxes to screen pixel coordinates without drift across any aspect ratio or orientation.
- **Problems Encountered**:
  - When the video feed is displayed with CSS `object-fit: cover` or `object-fit: contain`, bounding boxes drift significantly away from the physical hardware if container aspect ratio differs from camera aspect ratio.
  - Switching to front-facing (selfie) camera mirrors the image horizontally, causing annotations to render on the opposite side of the screen.
  - Mobile orientation changes and browser window resizing previously caused components to re-mount, dropping the active Gemini Live session.
- **Architectural Solutions**:
  - Created `VideoGeometryMapper.ts`: a pure mathematical transformation module calculating scale factors, letterbox/pillarbox offsets, and mirror inversion:
    $$X_{\text{mirrored}} = \text{Offset}_X + (1 - fX_{\max}) \cdot W_r$$
  - Decoupled viewport observation from session state using `ResizeObserver` on the viewport container and passive event listeners, dynamically updating SVG transforms without triggering WebSocket reconnects.

---

### Phase 3: Frame Sampling & Server-Side Gemini API Proxy
- **Objective**: Efficiently stream video context and bidirectional audio to Gemini Live while maintaining strict API key security.
- **Problems Encountered**:
  - Streaming continuous full-resolution uncompressed video quickly exhausts network bandwidth, spikes browser memory, and violates token limits.
  - Client-side API keys in browser single-page apps represent a severe security vulnerability.
- **Architectural Solutions**:
  - Built `FrameSampler.ts` with an offscreen HTML5 canvas to downsample and compress camera frames into JPEG format (`quality: 0.7`).
  - Implemented motion-adaptive sampling: 1.0 FPS idle background refresh, boosting to 2.5 FPS upon user interaction or camera movement.
  - Built an Express + Vite server (`server.ts`) acting as an authenticated server-side proxy; the client connects via internal WebSocket `/api/live`, keeping `GEMINI_API_KEY` protected on the server.

---

### Phase 4: Spatial Grounding & Dynamic Visual Verification
- **Objective**: Localize physical components and enforce strict coordinate validation.
- **Problems Encountered**:
  - Vision models frequently hallucinate bounding box coordinates for components that are hidden by cables, shadowed, or not visible in the frame.
  - Out-of-bounds coordinates ($< 0$ or $> 1000$) or non-numeric values resulted in NaN rendering bugs and broken SVG viewboxes.
- **Architectural Solutions**:
  - Standardized all grounding on the canonical normalized $[0, 1000]$ coordinate space $[y_{\min}, x_{\min}, y_{\max}, x_{\max}]$.
  - Built `validateAndSanitizeBox()` on the server: clamped coordinates to $[0, 1000]$ and verified coordinate ordering ($y_{\max} > y_{\min}$).
  - Introduced the **Occlusion Guard**: If a component is occluded or deeply shadowed (e.g., recessed reset pinholes), it is flagged `visible: false` with an explicit `uncertaintyReason`, preventing misleading highlights.

---

### Phase 5: Visual Experience Engine & Collision Avoidance
- **Objective**: Render high-fidelity HUD graphics, animated focal rings, callout cards, and interactive steps.
- **Problems Encountered**:
  - Callout cards anchored directly to bounding boxes frequently overlapped the component being examined, obstructing the user's view.
  - On narrow smartphone screens, callouts anchored to the right or bottom were clipped by the edge of the viewport.
- **Architectural Solutions**:
  - Built `VisualExperienceEngine.ts` with a dynamic 4-quadrant collision avoidance solver (`computeOptimalPlacement`), which evaluates candidate anchor positions (Above, Below, Right, Left) and clamps card positions safely inside container bounds.
  - Introduced 3 user-selectable HUD modes:
    1. *Minimal*: Unobtrusive central reticle with subtle targeting brackets.
    2. *Tactical*: Corner brackets, focal reticles, and high-contrast diagnostic indicators.
    3. *Annotated*: Full visual callouts, leader lines, component badges, and metadata chips.

---

### Phase 6: Voice and Visual Orchestration
- **Objective**: Wire Gemini Live reasoning directly to DRIQ's graphical actions via official function calling.
- **Problems Encountered**:
  - Gemini Live spoke about components before graphical highlights were verified on screen.
  - If a user interrupted the AI mid-sentence (barge-in), old highlights lingered on screen, causing visual confusion.
  - Schema mismatches when using generic function declaration objects.
- **Architectural Solutions**:
  - Registered 6 official function declarations via `@google/genai` `Type` schema: `highlightObject`, `highlightComponent`, `showCallout`, `drawConnector`, `showSteps`, and `clearAnnotations`.
  - Built `InteractionOrchestrator.ts`: validates component existence in current grounding data before rendering; returns execution confirmation back to Gemini Live via `sendToolResponse` before speech continues.
  - Implemented interrupt handlers: user speech triggers immediate audio playback cancellation and clears stale transient highlights.

---

### Phase 7: Personality and Explanation Quality
- **Objective**: Establish DRIQ's permanent runtime identity, tone, and pedagogical excellence.
- **Problems Encountered**:
  - Unconstrained models defaulted to verbose, robotic paragraphs or excessive flattery.
  - Dangerous instructions when asked about high-voltage AC terminals or internal capacitors.
  - Guessing when the user used ambiguous deictic references like *"What is this thing?"*.
- **Architectural Solutions**:
  - Authored `src/config/personality.ts`: configured Aoede voice, calm and confident persona, subtle wit, and mental models.
  - Enforced safety protocols: mandatory audible and visual warnings prior to destructive actions (e.g. factory resets, electrical probes).
  - Enforced deictic clarification: when a user's reference is ambiguous, DRIQ politely asks for clarification or highlights the most probable candidate with a soft question.

---

### Phase 8: Universal Responsive QA & Release Gate
- **Objective**: Execute a 24-viewport audit across mobile, tablet, desktop, and ultrawide layouts.
- **Problems Encountered**:
  - Secondary buttons crowded the voice control bar on ultra-compact 320px screens (iPhone SE).
  - TypeScript linter detected missing `scaleX` property on `VideoGeometry` in the test suite runner.
- **Architectural Solutions**:
  - Corrected `geoCover.displayedRect.scale` access in `Phase8ResponsiveQaSuite.tsx`.
  - Tuned header and voice bar flex gaps (`px-2 sm:px-4`, `gap-1.5 xs:gap-2.5 sm:gap-5`), ensuring touch targets maintain WCAG AAA compliance ($\ge 44 \times 44$px) without horizontal scrollbar overflow.
### Phase 9: Real-World Testing & Adaptive Vision Engine
- **Objective**: Ensure seamless real-time operation in production when cloud API credits are constrained, providing offline-resilient local computer vision and responsive voice interaction.
- **Problems Encountered**:
  - Cloud Gemini API key ran into prepaid quota limit (HTTP 402), which previously caused live sessions to silently stall.
  - Tapping the viewport accumulated multiple bounding boxes (`Focused Area [X, Y]`) without clearing old ones, cluttering the screen with 5+ overlapping reticles.
  - Camera motion detection caused the "Scene changed — annotations cleared to prevent drift" amber banner to stick persistently without a clear dismiss path.
- **Architectural Solutions**:
  - Implemented the browser-native **Adaptive Voice & Vision Engine** as an authoritative fallback: seamlessly handles questions with local speech recognition, visual grounding, and speech synthesis.
  - Added `clearTappedAnnotations()` in `GroundingService.ts` and `InteractionOrchestrator.ts`: tapping clears previous tap boxes, ensuring exactly one active focus reticle at a time.
  - Enhanced the scene stale warning banner with an immediate dismiss button and auto-cleanup on re-scan.

---

### Phase 10: Multilingual Intelligence (मराठी Marathi / हिंदी Hindi / English) & Open-Domain Reasoning
- **Objective**: Support natural conversational reasoning across languages (Marathi, Hindi, English) and eliminate canned hardware-only responses.
- **Problems Encountered**:
  - Speech queries in Marathi (मराठी) or Devanagari script were not recognized because speech recognition was hardcoded to `en-US`.
  - Speech synthesis only searched for English voices, mispronouncing or failing on Indian regional languages.
  - Query answering was previously restricted to router/switch hardware keywords, repeatedly claiming "I can only help with switches", failing when users asked about themselves, their faces, or room surroundings (e.g. clock on wall).
- **Architectural Solutions**:
  - Implemented dynamic **Script & Keyword Language Detection** (`/[\u0900-\u097F]/` and transliterated Marathi/Hindi keywords).
  - Added an intuitive **1-Tap Language Switcher** in `VoiceControlBar.tsx` and `Header.tsx` supporting `Auto`, `मराठी MR`, `हिंदी HI`, and `EN (Aoede)`.
  - Configured SpeechRecognition dynamically (`mr-IN`, `hi-IN`, `en-US`).
  - Upgraded `speakVoice()` with native Indian TTS synthesis prioritizing `mr-IN` and `hi-IN` voices (`Google मराठी`, `Lekha`, `Neerja`, `Google हिन्दी`).
  - Re-architected `handleAdaptiveSpeechQuery()` into an **Open-Domain Physical Reasoner**: directly answers questions about human presence (face, eyes, gaze, expression), room environment (clock on wall, background lighting), objects, and general questions in natural, polite Marathi and English.

---

## 🏆 Key Takeaways & Contest Relevance

Building DRIQ with Google AI Studio demonstrated how multimodal AI transcends traditional text prompts when combined with **rigorous spatial mathematics, real-time audio streaming, open-domain visual perception, and authentic multilingual synthesis**. DRIQ transforms Gemini Live into an authentic physical companion capable of seeing, speaking, and pointing with pinpoint precision in English, Marathi, and Hindi.
