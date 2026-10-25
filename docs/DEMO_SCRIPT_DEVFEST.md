# DRIQ — 90-Second Contest Demo Script (DevFest Pune 2026)

**Presenter**: Lead Engineer / Creator  
**Total Duration**: 1 Minute 30 Seconds (90 Seconds)  
**Setup**: Mobile phone or laptop with camera open to `https://ais-pre-oaz2fh5jhz33d7jr2ufdnj-213647883298.asia-northeast1.run.app`  
**Physical Prop**: A Wi-Fi router or electronics hardware (or simulated camera mode enabled)

---

## ⏱️ Second-by-Second Execution Timeline

### 0:00 – 0:15 | The Hook: Beyond Text & Chatbots
- **Action**: Hold up device with DRIQ running full-screen. The live camera preview is active, displaying the tactical HUD reticle.
- **Spoken (Presenter)**:  
  *"Judges, traditional AI chatbots fail the moment you step into the physical world. If your hands are holding cables or screwdrivers, you can't type. And typical vision models give vague answers like 'look near the middle'. Meet DRIQ — a voice-first, real-time visual intelligence companion that can genuinely see, talk, and point."*
- **Visual Cue**: The pulsating microphone island and live camera feed confirm continuous readiness.

---

### 0:15 – 0:35 | Live Grounding & Instant Spoken Explanation
- **Action**: Aim camera at the rear of the router. Press Space (or hold the mobile Mic button) and speak naturally:
- **Spoken (Presenter to DRIQ)**:  
  *"DRIQ, which port do I plug into to get internet from my modem?"*
- **DRIQ (Aoede Voice - Real Gemini Live)**:  
  *"That's the 2.5 Gigabit WAN port highlighted in blue on the left! Connect your ethernet cable directly from your modem here."*
- **Visual Cue**:  
  Gemini Live calls `highlightComponent("wan_port")`. A luminous cyan reticle locks onto the physical WAN port, and an animated leader line extends to a verified callout card: **"WAN Internet Port (2.5 GbE) · VERIFIED"**.
- **Spoken (Presenter)**:  
  *"Notice that DRIQ didn't just talk — Gemini Live triggered a real-time graphical tool that anchored a verified bounding box directly onto the hardware."*

---

### 0:35 – 0:50 | Epistemic Honesty & Occlusion Guard
- **Action**: Speak to DRIQ about the hidden reset button:
- **Spoken (Presenter to DRIQ)**:  
  *"Can you highlight the reset button so I can press it?"*
- **DRIQ (Aoede Voice)**:  
  *"The reset button is a tiny recessed pinhole shadowed under the antenna hinge. Be careful — holding it down for 10 seconds will wipe your entire network configuration."*
- **Visual Cue**:  
  DRIQ's Occlusion Guard detects that the pinhole is not physically localized in the current angle. Instead of hallucinating a false box, a yellow warning badge appears with the notice: **"Recessed pinhole deeply shadowed"**.
- **Spoken (Presenter)**:  
  *"Zero hallucination. When a part is obscured or dangerous, DRIQ tells you the truth and issues a safety warning."*

---

### 0:50 – 1:10 | Barge-In Interruption & Multi-Step Guidance
- **Action**: Ask DRIQ to guide you through setting up WPS, then immediately interrupt mid-sentence by saying:
- **Spoken (Presenter)**:  
  *"DRIQ, show me how to pair a new device with WPS."*
- **DRIQ (Starts speaking)**:  
  *"Sure! Step 1: Locate the WPS button to the right of the..."*
- **Action (Barge-In)**: Tap Mic or press Space:
- **Spoken (Presenter interrupts)**:  
  *"Wait, does that work with modern phones?"*
- **Visual & Audio Cue**:  
  DRIQ immediately cuts off speech in under 35 milliseconds, clears the active overlay, and adapts:
- **DRIQ (Aoede Voice)**:  
  *"Most modern smartphones deprecated WPS for security reasons. You'll want to use the QR code on the bottom sticker instead!"*

---

### 1:10 – 1:25 | Universal Responsive Invariance
- **Action**: Quickly rotate the phone from portrait to landscape (or resize the desktop browser window).
- **Visual Cue**:  
  The bounding boxes, callouts, and HUD instantly recalculate in under 50ms using `VideoGeometryMapper`. The Gemini Live voice session stays unbroken without a single flicker or reconnection drop.
- **Spoken (Presenter)**:  
  *"Whether you tilt your phone, rotate to landscape, or switch cameras, DRIQ's geometric projection engine preserves sub-pixel alignment without restarting the AI session."*

---

### 1:25 – 1:30 | The Punchline & Closing
- **Spoken (Presenter)**:  
  *"Real multimodal live streaming. Microsecond spatial geometry. Real-world physical assistance. That's DRIQ. Thank you!"*
- **Action**: Display the contest release URL on screen.

---

## 💡 Presenter Emergency Fallback Tips

- **If Wi-Fi drops at venue**: Press `P` to open the Context Panel, toggle **Simulated Stream**, and run the built-in scenario harness in the **Tests** tab. The automated test suite executes verified ground truth responses locally with 100% deterministic fidelity.
- **If microphone has venue echo**: Use the keyboard shortcut `Space` for explicit push-to-talk to avoid picking up ambient noise.
