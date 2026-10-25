<div align="center">

# DRIQ

### See. Ask. Understand.

Point your phone camera at something, **ask out loud**, and DRIQ answers out loud, in **Marathi or English**,
while drawing on the live camera view to show exactly which part it means. Tap any spot to make that the topic.
Interrupt it mid-sentence. Or skip the object entirely and just chat: DRIQ is happy to be witty, sarcastic or
patiently informative.

**No app to install. No typing.** A browser, a camera and your voice.

[![Gemini Live](https://img.shields.io/badge/AI-Gemini%20Live%20%C2%B7%20Gemini%20Flash-1a73e8?style=flat-square)](#how-it-works)
[![Languages](https://img.shields.io/badge/voice-%E0%A4%AE%E0%A4%B0%E0%A4%BE%E0%A4%A0%E0%A5%80%20%C2%B7%20English%20%C2%B7%20%E0%A4%B9%E0%A4%BF%E0%A4%82%E0%A4%A6%E0%A5%80-f29900?style=flat-square)](#marathi-first)
[![Runs on](https://img.shields.io/badge/runs%20on-Cloud%20Run-34a853?style=flat-square)](#deploy)
[![Stack](https://img.shields.io/badge/React%2019%20%C2%B7%20Express%20%C2%B7%20TypeScript-1d1d1f?style=flat-square)](#project-layout)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](LICENSE)

*The Sunday Builds #16: Solving Real Problems with AI, every Sunday.*
*This one swaps the usual local open models for **Google Gemini**, because real-time two-way voice + vision
on a phone needs a live multimodal model.*

**Try it:** https://driq-real-time-visual-intelligence.ai.studio/ (allow camera + microphone; best on a phone)

</div>

---

<!-- Add a phone screenshot or GIF from the demo here, e.g. docs/screenshots/driq-demo.gif -->

## Why

Most "explain this" moments happen with your hands full: the router's lights are blinking, the remote has
40 buttons, the appliance manual is in a drawer somewhere. Typing a question into a chatbot, or taking a
photo and waiting, breaks the flow. And for many people at home, the most comfortable language to ask in
is not English.

DRIQ is built for that moment: keep the camera on the thing, keep talking, and get the answer in the
language you asked in.

## What you can do

| Do this | DRIQ does this |
| --- | --- |
| Point the camera and ask *"what am I looking at?"* | Answers by voice, and labels the parts it is talking about on screen |
| Tap **Inspect Scene** | Analyses the current frame and lays out labelled boxes for the components it found |
| **Tap any spot** on the screen | Makes that spot the single focus area, sends Gemini the current frame + the box, and talks only about what's inside it |
| Tap somewhere else | The focus **moves** (there is only ever one focus area) |
| Tap **Reset Focus** | Clears the focus box and everything DRIQ drew, and tells Gemini to go back to the whole scene / free conversation |
| Talk while it is speaking | It stops (barge-in) and listens |
| Ask in Marathi | It answers in Marathi (and follows you if you mix Marathi, Hindi and English) |
| Ask anything else | Free conversation: questions, jokes, explanations. It doesn't insist on inspecting things |

### Marathi first

The language chip defaults to **Auto (MR/EN)**: DRIQ answers in the language you spoke. The persona
([src/config/personality.ts](src/config/personality.ts)) asks for natural, idiomatic Marathi rather than a
literal translation. The voice is Gemini Live's native audio (voice *Aoede*), not the browser's
text-to-speech. That difference is very audible in Marathi.

## How it works

```
 Phone browser (React 19)                       DRIQ server (Express + ws, Cloud Run)          Google Gemini
 ─────────────────────────                      ─────────────────────────────────────          ─────────────
 mic → 16 kHz PCM chunks      ──── WebSocket ──►  /api/live bridge  ───────────────────────►  Gemini Live
 camera frames (on demand)    ──── /api/live ──►  (holds the API key; browser never sees it)   (gemini-3.8-live,
 speaker ◄── 24 kHz PCM       ◄────────────────   ◄── audio + transcripts + tool calls ◄────    native audio, Aoede)
 overlay ◄── tool calls: highlightComponent, showCallout, drawConnector, showSteps, clearAnnotations
 Inspect Scene ── frame ──►   /api/grounding/analyze ─────────────────────────────────────►  gemini-3.8-flash
                                                   ◄── validated [ymin,xmin,ymax,xmax] boxes ◄── (structured JSON)
```

- **Voice:** `LiveSessionManager` streams microphone audio over a WebSocket to the server, which bridges it to a
  Gemini Live session (`ai.live.connect`). Replies come back as audio chunks plus transcripts, and Gemini can
  call DRIQ's on-screen drawing tools while it talks.
- **Vision:** frames are sent when they matter (Inspect Scene, a focus tap, a snapshot), not as a constant
  video stream. Grounding uses Gemini Flash with boxes in a fixed `[0, 1000]` coordinate space, and the server
  checks the boxes before they reach the screen.
- **Overlay geometry:** `VideoGeometryMapper` maps those boxes onto the real video element (cover/contain,
  front/rear camera, mirroring), so labels stay on the right part when the phone rotates or the window resizes.
- **Key safety:** `GEMINI_API_KEY` stays on the server. The browser only talks to DRIQ's own `/api/*`
  endpoints.

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start (local)

Requirements: Node.js 20+ and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/KrishnaRode/driq.git
cd driq
npm install
cp .env.example .env        # then set GEMINI_API_KEY in .env
npm run dev                 # http://localhost:3000
```

Open **http://localhost:3000** in Chrome, allow camera and microphone, and wait for **Live Ready (Aoede)**
in the header before speaking.

> **Phone testing needs HTTPS.** Browsers only allow camera/mic on `https://` or `localhost`, so opening
> your laptop's LAN IP on a phone won't get the camera. Deploy it (below) to test on a phone.

`npm run build` builds the client into `dist/`; `NODE_ENV=production npm start` serves that build.
`npm run lint` runs the TypeScript check.

## Deploy

The live instance runs on **Google Cloud Run** (region `asia-east1`), first deployed from
[Google AI Studio](https://aistudio.google.com/)'s Build mode, where DRIQ was originally created.

Two ways to deploy your own:

1. **From Google AI Studio:** import the code into an AI Studio Build app and use *Deploy*. AI Studio
   injects `GEMINI_API_KEY` and `APP_URL` for you.
2. **With `gcloud`:** `gcloud run deploy driq --source . --region <your-region>` with
   `GEMINI_API_KEY` set as an environment variable or secret. *This path uses Cloud Build buildpacks and
   hasn't been tested against this repo yet.*

Whichever you use, Cloud Run needs WebSocket support (on by default) and enough memory for the Node server;
the live instance uses 1 vCPU / 3 GiB with session affinity on.

## Validation

What was actually checked for this release:

| Check | Result |
| --- | --- |
| `npm install` → `npm run lint` (tsc) → `npm run build` | clean |
| `npm run dev` | server starts, page and `/api/health` respond |
| Gemini Live round trip (scripted WebSocket client against the deployed service) | session opens, spoken reply + transcript stream back, turn completes |
| Single focus area: five taps in different spots | exactly one focus box on screen, Gemini asked about it |
| Reset Focus | screen fully cleared, including boxes Gemini drew in reply to the old focus |
| Pressing toolbar buttons | no longer drops a focus box underneath the button |
| Real phone, camera + mic, Marathi | used by the author on the deployed app |

[docs/TEST_REPORT.md](docs/TEST_REPORT.md) is the earlier, more detailed report produced during the
AI Studio build (responsive viewport matrix, grounding scenarios). Treat it as that build's self-report;
the table above is what was re-verified.

## Known limitations

- **Needs a network and a Gemini API key.** Unlike most Sunday Builds, nothing here runs offline or on a local
  model. Usage is billed to your Gemini project (AI Studio prepaid credits run out; when they do, Gemini calls fail
  with HTTP 402).
- **Model names move fast.** DRIQ uses `gemini-3.8-live` and `gemini-3.8-flash`. Older names
  (`gemini-2.5-*`) are already refused for new users. If a call starts 404-ing, check the current model list.
- **Not a safety tool.** It can be wrong about what it sees, and it doesn't replace a manual or an electrician.
- **Background noise and speakers** can trigger barge-in. Earphones or holding the mic button help.
- The focus box is a fixed-size square around the tap point, not a detected object outline.

## Project layout

```
server.ts                    Express server: /api/health, /api/config, /api/chat, /api/grounding/analyze,
                             /api/live WebSocket ⇄ Gemini Live bridge, drawing-tool declarations
src/App.tsx                  app shell, bootstraps camera, audio and the live session
src/config/personality.ts    DRIQ's voice, model and persona (system instruction)
src/services/                LiveSessionManager (WebSocket + fallback), AudioController (PCM in/out),
                             CameraController, FrameSampler, GroundingService (boxes, hit-testing, focus),
                             InteractionOrchestrator (taps, focus, reset), VideoGeometryMapper,
                             VisualExperienceEngine (callouts, connectors, steps), ResponsiveLayoutManager
src/components/              CameraViewport, VoiceControlBar, Header, ContextPanel, test-suite panels
docs/                        ARCHITECTURE, TEST_REPORT, PROMPT_JOURNEY (how it was built in AI Studio),
                             DEMO_SCRIPT_DEVFEST
```

## How it was built

DRIQ was built in **Google AI Studio's Build mode** over ten prompt-driven phases (camera and audio
foundations → geometry → grounding → live voice → personality → Marathi). The prompts and decisions are in
[docs/PROMPT_JOURNEY.md](docs/PROMPT_JOURNEY.md). After that, the single-focus behaviour, Reset Focus and
the build/deploy setup in this repo were added outside AI Studio.

MIT licensed.
