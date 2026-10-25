import { audioController } from './AudioController';
import { cameraController } from './CameraController';
import { conversationController } from './ConversationController';
import { frameSampler } from './FrameSampler';
import { groundingService } from './GroundingService';
import { liveSessionManager } from './LiveSessionManager';
import { responsiveLayoutManager } from './ResponsiveLayoutManager';
import { videoGeometryMapper } from './VideoGeometryMapper';
import { visualExperienceEngine } from './VisualExperienceEngine';
import { FitMode, SampledFrame } from '../types';

type OrchestratorListener = (lastAction: string) => void;

export class InteractionOrchestrator {
  private isPushToTalking = false;
  private isContinuousMode = false;
  private keydownHandled = false;
  private listeners: Set<OrchestratorListener> = new Set();
  private lastCapturedSnapshot: SampledFrame | null = null;
  private currentFitMode: FitMode = 'cover';

  // Phase 6 Orchestration Tracking
  private pendingActionIds: Set<string> = new Set();
  private actionHistory: Array<{
    callId: string;
    name: string;
    timestamp: number;
    success: boolean;
    reason?: string;
    componentId?: string;
    confirmedBox?: any;
  }> = [];

  constructor() {
    this.initKeyboardListeners();

    // Hook up official Gemini Live tool calling & interruption
    liveSessionManager.setToolHandler(
      this.handleToolCall.bind(this),
      this.handleToolCancellation.bind(this)
    );
    liveSessionManager.setInterruptionHandler(
      this.handleInterruption.bind(this)
    );

    // Subscribe to material scene changes (camera shift / rotation)
    groundingService.subscribeSceneChange((isStale, reason) => {
      if (isStale) {
        this.handleSceneChangeInvalidation(reason);
      }
    });
  }

  getActionHistory() {
    return [...this.actionHistory];
  }

  get fitMode(): FitMode {
    return this.currentFitMode;
  }

  get isContinuous(): boolean {
    return this.isContinuousMode;
  }

  setFitMode(mode: FitMode) {
    if (this.currentFitMode === mode) return;
    this.currentFitMode = mode;
    this.notify(`Fit Mode: ${mode.toUpperCase()}`);
  }

  toggleFitMode(): FitMode {
    const next = this.currentFitMode === 'cover' ? 'contain' : 'cover';
    this.setFitMode(next);
    return next;
  }

  toggleContinuousMode(): boolean {
    this.isContinuousMode = !this.isContinuousMode;
    if (this.isContinuousMode) {
      this.startContinuousVoice();
      this.notify('Continuous Voice Mode Active (Aoede VAD)');
    } else {
      this.stopContinuousVoice();
      this.notify('Push-to-Talk Mode Active (Hold Space / Mic)');
    }
    return this.isContinuousMode;
  }

  subscribe(listener: OrchestratorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(action: string) {
    this.listeners.forEach((fn) => fn(action));
  }

  private initKeyboardListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener(
      'keydown',
      async (e) => {
        // Ignore if user is typing into an input field or textarea
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }

        if (e.code === 'Space' && !this.keydownHandled) {
          e.preventDefault();
          this.keydownHandled = true;
          await this.startVoiceInteraction();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          this.toggleCamera();
        } else if (e.key === 'm' || e.key === 'M') {
          e.preventDefault();
          this.toggleAudioMute();
        } else if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          responsiveLayoutManager.toggleContextPanel();
          this.notify('Toggled Context Panel');
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          const next = visualExperienceEngine.cycleMode();
          this.notify(`HUD Mode: ${next}`);
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          cameraController.toggleTorch();
          this.notify('Toggled Torch');
        } else if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          this.toggleFitMode();
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          if (visualExperienceEngine.isDevOverlayMode) {
            visualExperienceEngine.disableDevOverlayTest();
            this.notify('Exited Dev Overlay Benchmark');
          } else {
            visualExperienceEngine.enableDevOverlayTest('router_setup');
            this.notify('Enabled Phase 5 Dev Overlay Benchmark');
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          visualExperienceEngine.clearAnnotations('all');
          visualExperienceEngine.disableDevOverlayTest();
          this.notify('Annotations Cleared');
        }
      },
      { passive: false }
    );

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.keydownHandled = false;
        if (!this.isContinuousMode) {
          this.stopVoiceInteraction();
        }
      }
    });
  }

  async startVoiceInteraction() {
    if (this.isPushToTalking) return;
    this.isPushToTalking = true;

    // Barge-in: if model is currently speaking, stop immediately
    audioController.stopPlayback();
    audioController.synthesizeTestChime();

    // Ensure audio contexts unlocked on user gesture
    await audioController.ensureAudioContextUnlocked();

    // Ensure live WebSocket session is active
    if (!liveSessionManager.isConnected()) {
      await liveSessionManager.connect();
    }

    liveSessionManager.startListening();
    this.notify('Listening (Aoede Persona · Ready)');

    // Start 1 FPS AI frame streaming for visual context
    const video = cameraController.getVideoElement();
    if (video) {
      frameSampler.startAiSampling(video, (frame) => {
        this.lastCapturedSnapshot = frame;
        liveSessionManager.sendVideo(frame.dataUrl);
      }, 1000);
    }
  }

  stopVoiceInteraction() {
    if (!this.isPushToTalking) return;
    this.isPushToTalking = false;

    // In push-to-talk, stop frame sampler when releasing
    if (!this.isContinuousMode) {
      frameSampler.stopAiSampling();
    }

    liveSessionManager.stopListening();

    // Capture visual snapshot at query completion
    const video = cameraController.getVideoElement();
    if (video) {
      const frame = frameSampler.captureFrame(video);
      if (frame) {
        this.lastCapturedSnapshot = frame;
        liveSessionManager.sendVideo(frame.dataUrl);
      }
    }

    this.notify('Processing visual & audio query...');
  }

  async startContinuousVoice() {
    await audioController.ensureAudioContextUnlocked();
    if (!liveSessionManager.isConnected()) {
      await liveSessionManager.connect();
    }

    const video = cameraController.getVideoElement();
    if (video) {
      frameSampler.startAiSampling(video, (frame) => {
        this.lastCapturedSnapshot = frame;
        liveSessionManager.sendVideo(frame.dataUrl);
      }, 1000);
    }

    liveSessionManager.startListening();
  }

  stopContinuousVoice() {
    frameSampler.stopAiSampling();
    audioController.stopPlayback();
    liveSessionManager.stopListening();
  }

  async toggleVoice() {
    if (this.isContinuousMode) {
      this.toggleContinuousMode();
    } else {
      if (this.isPushToTalking) {
        this.stopVoiceInteraction();
      } else {
        await this.startVoiceInteraction();
      }
    }
  }

  toggleCamera() {
    cameraController.switchCamera();
    this.notify('Switched camera');
  }

  toggleAudioMute(): boolean {
    const isMuted = audioController.toggleMute();
    this.notify(isMuted ? 'Muted microphone' : 'Unmuted microphone');
    return isMuted;
  }

  handleViewportTap(
    screenX: number,
    screenY: number,
    containerWidth: number,
    containerHeight: number,
    fitMode: FitMode = this.currentFitMode
  ) {
    const video = cameraController.getVideoElement();
    const vw = video?.videoWidth || 1280;
    const vh = video?.videoHeight || 720;
    const isMirrored = cameraController.isMirrored();

    const geometry = videoGeometryMapper.computeGeometry(
      { width: containerWidth, height: containerHeight },
      { width: vw, height: vh },
      fitMode,
      isMirrored
    );

    const { normX, normY } = videoGeometryMapper.mapScreenToBox(screenX, screenY, geometry);
    const found = groundingService.hitTest(normX, normY);
    // Tapping inside the current focus box moves the focus rather than "selecting" it.
    const hit = found && !found.id.startsWith('tap_') ? found : null;

    if (hit) {
      // A detected component becomes the single focus: drop any tap focus box.
      groundingService.clearTappedAnnotations();
      groundingService.setHighlight(hit.id);
      audioController.synthesizeTestChime();
      this.notify(`Focused: ${hit.label}`);

      // Display floating callout card linked to target component
      visualExperienceEngine.clearAnnotations('callouts');
      visualExperienceEngine.showCallout({
        targetBox: hit.box,
        title: hit.label,
        status: hit.visible ? 'verified' : 'warning',
        explanation: hit.description || hit.shortExplanation || 'Focused item',
        category: hit.category,
        meta: hit.attributes,
        placement: 'above',
      });

      const isMarathi = liveSessionManager.getEffectiveLanguage() === 'mr';
      // If Live session is connected, prompt Gemini about the focused item
      if (liveSessionManager.isConnected()) {
        liveSessionManager.sendUserQuery(
          isMarathi
            ? `या घटकाबद्दल माहिती द्या: ${hit.label}`
            : `Look at the ${hit.label} around normalized coordinates [${Math.round(normX)}, ${Math.round(normY)}]. What can you tell me about it?`
        );
      } else {
        liveSessionManager.handleAdaptiveSpeechQuery(
          isMarathi ? `${hit.label} बद्दल माहिती सांगा` : `Tell me about ${hit.label}`
        );
      }
    } else {
      visualExperienceEngine.clearAnnotations('callouts');

      audioController.synthesizeTestChime();
      const tapBox: [number, number, number, number] = [
        Math.max(0, normY - 60),
        Math.max(0, normX - 60),
        Math.min(1000, normY + 60),
        Math.min(1000, normX + 60),
      ];

      const isMarathi = liveSessionManager.getEffectiveLanguage() === 'mr';
      const label = isMarathi
        ? `लक्ष्य [${Math.round(normX)}, ${Math.round(normY)}]`
        : `Focus [${Math.round(normX)}, ${Math.round(normY)}]`;

      // Replaces the previous focus, so only one focus area is ever shown.
      const newAnn = groundingService.setTapFocus({
        label,
        category: 'object',
        box: tapBox,
        confidence: 0.95,
        visible: true,
        shortExplanation: isMarathi ? 'स्क्रीनवर निवडलेला लक्ष्य बिंदू.' : 'Focal target anchored to user screen tap.',
      });

      visualExperienceEngine.showCallout({
        targetBox: tapBox,
        title: newAnn.label,
        status: 'verified',
        explanation: isMarathi ? 'स्पर्श केलेला लक्ष्य बिंदू.' : 'Focal target anchored directly to your screen tap.',
        category: 'object',
      });

      this.notify(isMarathi ? `लक्ष्य केंद्रित केले` : `Focused on tap point`);

      if (liveSessionManager.isConnected()) {
        // Give Gemini the current frame and pin the conversation to the focus area.
        const video = cameraController.getVideoElement();
        const frame = video ? frameSampler.captureFrame(video) : null;
        if (frame) liveSessionManager.sendVideo(frame.dataUrl);
        const box = tapBox.map((v) => Math.round(v)).join(', ');
        liveSessionManager.sendUserQuery(
          isMarathi
            ? `मी स्क्रीनवर एक लक्ष्य क्षेत्र निवडले आहे: बॉक्स [${box}] (ymin, xmin, ymax, xmax; 0-1000 स्केल). आता फक्त या क्षेत्रातील गोष्टीबद्दल बोला. ते काय आहे ते थोडक्यात सांगा.`
            : `I selected a focus area on screen: box [${box}] (ymin, xmin, ymax, xmax on a 0-1000 scale). From now on, talk only about what is inside this area. Briefly tell me what it is.`
        );
      } else {
        // Concise, non-repetitive feedback
        liveSessionManager.speakVoice(isMarathi ? 'लक्ष्य केंद्रित केले.' : 'Focused here.');
      }
    }

    return { normX, normY, hit };
  }

  /** Remove the focus area entirely and release Gemini from it. */
  clearFocus() {
    groundingService.clearTappedAnnotations();
    groundingService.setHighlight(null);
    // Also remove anything Gemini drew for the old focus, and drop drawings still in flight.
    visualExperienceEngine.clearAnnotations('all');
    liveSessionManager.suppressVisualTools(3000);
    const isMarathi = liveSessionManager.getEffectiveLanguage() === 'mr';
    this.notify(isMarathi ? 'लक्ष्य काढले' : 'Focus cleared');
    if (liveSessionManager.isConnected()) {
      liveSessionManager.sendUserQuery(
        isMarathi
          ? 'लक्ष्य क्षेत्र काढले आहे. आधीचे लक्ष्य विसरा; आता संपूर्ण दृश्याबद्दल किंवा मी विचारेन त्याबद्दल बोला. फक्त एका वाक्यात पुष्टी करा.'
          : 'Focus area cleared. Forget the previous focus area; talk about the whole scene or whatever I ask. Confirm in one short sentence.'
      );
    }
  }

  takeSnapshot(): SampledFrame | null {
    const video = cameraController.getVideoElement();
    if (!video) return null;
    const frame = frameSampler.captureFrame(video);
    if (frame) {
      this.lastCapturedSnapshot = frame;
      audioController.synthesizeTestChime();
      this.notify(`Snapshot captured (${frame.width}×${frame.height})`);

      if (liveSessionManager.isConnected()) {
        liveSessionManager.sendVideo(frame.dataUrl);
      }
    }
    return frame;
  }

  getLastSnapshot(): SampledFrame | null {
    return this.lastCapturedSnapshot;
  }

  /* ------------------------------------------------------------------
   * Phase 6: Voice and Visual Tool Call Resolution
   * Resolves actions requested by Gemini against verified grounding data
   * ----------------------------------------------------------------*/
  async handleToolCall(callId: string, name: string, args: Record<string, any>): Promise<any> {
    this.pendingActionIds.add(callId);

    // 1. Stale / Scene Shift Invalidation Guard
    if (groundingService.isStale()) {
      const result = {
        success: false,
        executed: false,
        rendered: false,
        reason: 'Current frame is invalidated due to camera motion. Action rejected.',
      };
      this.recordAction(callId, name, result);
      return result;
    }

    // 2. Clear annotations action
    if (name === 'clearAnnotations') {
      const filter = args.filter || 'all';
      visualExperienceEngine.clearAnnotations(filter);
      const result = { success: true, executed: true, cleared: filter };
      this.recordAction(callId, name, result);
      this.notify(`Cleared visual annotations: ${filter}`);
      return result;
    }

    // 3. Resolve target component from verified grounding annotations
    const currentAnnotations = groundingService.getAnnotations();
    const queryId = (args.componentId || args.objectId || '').toLowerCase().trim();
    const queryLabel = (args.label || args.title || '').toLowerCase().trim();

    let matched = currentAnnotations.find((a) => {
      const aId = a.id.toLowerCase();
      const aLabel = a.label.toLowerCase();
      const aObj = String(a.attributes?.['Object'] || '').toLowerCase();
      const aComp = String(a.attributes?.['Component'] || '').toLowerCase();

      return (
        (queryId && (aId.includes(queryId) || aComp === queryId || aObj === queryId || queryId.includes(aComp))) ||
        (queryLabel && (aLabel.includes(queryLabel) || queryLabel.includes(aLabel)))
      );
    });

    // 4. If highlightObject was requested but specific sub-component not identified,
    // match primary visible object or bounding envelope of all visible components
    if (!matched && name === 'highlightObject') {
      const visibleItems = currentAnnotations.filter((a) => a.visible !== false && !a.uncertaintyReason);
      if (visibleItems.length > 0) {
        const ymin = Math.min(...visibleItems.map((a) => a.box[0]));
        const xmin = Math.min(...visibleItems.map((a) => a.box[1]));
        const ymax = Math.max(...visibleItems.map((a) => a.box[2]));
        const xmax = Math.max(...visibleItems.map((a) => a.box[3]));

        const objId = args.objectId || 'primary_object';
        const label = args.label || 'Identified Object';
        const actionId = visualExperienceEngine.highlightObject(objId, [ymin, xmin, ymax, xmax], label, args.color);

        const result = {
          success: true,
          executed: true,
          rendered: true,
          actionId,
          confirmedBox: [ymin, xmin, ymax, xmax],
          label,
        };
        this.recordAction(callId, name, result);
        this.notify(`Highlighted object: ${label}`);
        return result;
      }
    }

    // 5. Component not recognized in camera frame
    if (!matched) {
      const result = {
        success: false,
        executed: false,
        rendered: false,
        reason: `Component "${args.componentId || args.label || queryId}" was not recognized in the active camera frame.`,
      };
      this.recordAction(callId, name, result);
      return result;
    }

    // 6. Component Occlusion & Uncertainty Guard (Crucial contract requirement)
    // "If a component is not clearly visible, do not highlight it. If Gemini is uncertain, provide a verbal explanation instead."
    if (matched.visible === false || matched.uncertaintyReason) {
      const reason = matched.uncertaintyReason || 'Component is obscured or partially off-screen';
      console.warn(`[InteractionOrchestrator] Refusing false graphical highlight for obscured component: ${matched.label} (${reason})`);

      const result = {
        success: false,
        executed: false,
        rendered: false,
        visible: false,
        uncertaintyReason: reason,
        guidance: 'Component is obscured or not clearly visible in camera frame. Provide verbal location guidance instead of an on-screen box.',
      };
      this.recordAction(callId, name, result);
      this.notify(`Obscured: ${matched.label} (verbal only)`);
      return result;
    }

    // 7. Confirmed visible execution in VisualExperienceEngine
    let actionId = '';
    const targetBox = matched.box;

    switch (name) {
      case 'highlightComponent': {
        actionId = visualExperienceEngine.highlightComponent(
          matched.id,
          targetBox,
          args.label || matched.label,
          args.color || matched.color
        );
        break;
      }
      case 'highlightObject': {
        actionId = visualExperienceEngine.highlightObject(
          args.objectId || matched.id,
          targetBox,
          args.label || matched.label,
          args.color || matched.color
        );
        break;
      }
      case 'showCallout': {
        actionId = visualExperienceEngine.showCallout({
          targetBox,
          title: args.title || matched.label,
          explanation: args.explanation || matched.description || matched.shortExplanation || 'Target component',
          status: args.status || 'verified',
          category: args.category || matched.category,
          meta: args.meta || matched.attributes,
          placement: args.placement,
        });
        break;
      }
      case 'drawConnector': {
        const startPt = { x: targetBox[1] + (targetBox[3] - targetBox[1]) / 2, y: targetBox[0] };
        const endPt = { x: startPt.x + 80, y: Math.max(10, startPt.y - 60) };
        actionId = visualExperienceEngine.drawConnector(startPt, endPt, args.style || 'elbow');
        break;
      }
      case 'showSteps': {
        const steps = Array.isArray(args.steps) ? args.steps : [];
        visualExperienceEngine.showSteps(
          steps.map((s: any, idx: number) => ({
            targetBox,
            title: s.title || 'Step',
            instruction: s.instruction || '',
            actionPrompt: s.actionPrompt,
            status: idx === 0 ? 'current' : 'pending',
          })),
          args.initialIndex || 0
        );
        actionId = 'steps_active';
        break;
      }
    }

    const result = {
      success: true,
      executed: true,
      rendered: true,
      actionId,
      componentId: matched.id,
      label: matched.label,
      confirmedBox: targetBox,
      timestamp: Date.now(),
    };

    this.recordAction(callId, name, result);
    this.notify(`Visual Action: ${matched.label}`);
    return result;
  }

  private recordAction(callId: string, name: string, res: any) {
    this.pendingActionIds.delete(callId);
    this.actionHistory.unshift({
      callId,
      name,
      timestamp: Date.now(),
      success: res.success,
      reason: res.reason || res.uncertaintyReason,
      componentId: res.componentId,
      confirmedBox: res.confirmedBox,
    });
    if (this.actionHistory.length > 30) {
      this.actionHistory.pop();
    }
  }

  handleToolCancellation(ids: string[]) {
    ids.forEach((id) => {
      this.pendingActionIds.delete(id);
    });
    console.log('[InteractionOrchestrator] Cancelled tool calls:', ids);
    this.notify('Cancelled pending visual actions');
  }

  handleInterruption() {
    this.pendingActionIds.clear();
    // Stop audio
    audioController.stopPlayback();
    // Dismiss transient callouts on barge-in
    visualExperienceEngine.clearAnnotations('callouts');
    this.notify('Interrupted (Barge-in active)');
  }

  handleSceneChangeInvalidation(reason?: string) {
    this.pendingActionIds.clear();
    // Clear highlights to avoid drifting over wrong objects
    visualExperienceEngine.clearAnnotations('all');
    this.notify(reason || 'Camera moved — cleared highlights');
  }

  /* ------------------------------------------------------------------
   * Phase 6 Automated Verification Test Suite
   * Validates all required voice & visual test criteria
   * ----------------------------------------------------------------*/
  async runPhase6Test(testId: 'wan' | 'reset' | 'interrupt' | 'rotate' | 'shift'): Promise<{
    id: string;
    name: string;
    passed: boolean;
    message: string;
    details: any;
  }> {
    switch (testId) {
      case 'wan': {
        // Test 1: Identify and highlight WAN port
        await groundingService.loadBenchmarkScene('router');
        const res = await this.handleToolCall(`test_wan_${Date.now()}`, 'highlightComponent', {
          componentId: 'wan_port',
          label: 'WAN Internet Port',
        });
        const passed = res.success === true && res.rendered === true && Array.isArray(res.confirmedBox);
        return {
          id: 'wan',
          name: 'Identify & Highlight WAN Port',
          passed,
          message: passed
            ? `Successfully resolved WAN port and rendered precision contour at [${res.confirmedBox.join(', ')}].`
            : `Failed to resolve WAN port: ${res.reason}`,
          details: res,
        };
      }

      case 'reset': {
        // Test 2: Ask follow-up about reset button (recessed/obscured component)
        await groundingService.loadBenchmarkScene('router');
        const res = await this.handleToolCall(`test_reset_${Date.now()}`, 'highlightComponent', {
          componentId: 'recessed_reset_pinhole',
          label: 'Factory Reset Pinhole',
        });
        // Success criteria: must REFUSE false box, returning rendered: false and uncertaintyReason
        const passed = res.rendered === false && res.visible === false && Boolean(res.uncertaintyReason);
        return {
          id: 'reset',
          name: 'Obscured Reset Button (Verbal Explanation Only)',
          passed,
          message: passed
            ? `Correctly refused false visual box: "${res.uncertaintyReason}". Provided verbal guidance only.`
            : `Failed: improperly rendered false box for obscured component!`,
          details: res,
        };
      }

      case 'interrupt': {
        // Test 3: Interrupt the explanation (barge-in)
        visualExperienceEngine.showCallout({
          targetBox: [460, 180, 710, 310],
          title: 'WAN Port',
          explanation: 'Long audio explanation streaming...',
        });
        this.handleInterruption();
        const calloutsAfter = visualExperienceEngine.getState().callouts;
        const passed = calloutsAfter.length === 0;
        return {
          id: 'interrupt',
          name: 'Interruption & Barge-In Audio Stop',
          passed,
          message: passed
            ? 'Interruption immediately dismissed transient callouts, cleared pending actions, and silenced audio.'
            : 'Failed to dismiss callouts on interruption.',
          details: { calloutsRemaining: calloutsAfter.length },
        };
      }

      case 'rotate': {
        // Test 4: Rotate device / Resize viewport
        const portraitGeo = videoGeometryMapper.computeGeometry(
          { width: 400, height: 800 },
          { width: 1280, height: 720 },
          'cover',
          false
        );
        const landscapeGeo = videoGeometryMapper.computeGeometry(
          { width: 800, height: 400 },
          { width: 1280, height: 720 },
          'cover',
          false
        );
        const ptPortrait = videoGeometryMapper.mapBoxToScreen([460, 180, 710, 310], portraitGeo);
        const ptLandscape = videoGeometryMapper.mapBoxToScreen([460, 180, 710, 310], landscapeGeo);
        const passed = ptPortrait.width > 0 && ptLandscape.width > 0 && ptPortrait.x !== ptLandscape.x;
        return {
          id: 'rotate',
          name: 'Device Rotation & Viewport Resize Geometry',
          passed,
          message: passed
            ? `VideoGeometryMapper dynamically remapped box: Portrait (${Math.round(ptPortrait.width)}×${Math.round(ptPortrait.height)}) vs Landscape (${Math.round(ptLandscape.width)}×${Math.round(ptLandscape.height)}).`
            : 'Geometry mapping failed on rotation test.',
          details: { portrait: ptPortrait, landscape: ptLandscape },
        };
      }

      case 'shift': {
        // Test 5: Move camera to another object (Scene shift invalidation)
        visualExperienceEngine.highlightComponent('temp', [200, 200, 400, 400], 'Temporary');
        this.handleSceneChangeInvalidation('Camera moved to table surface');
        const highlightsAfter = visualExperienceEngine.getState().componentHighlights;
        const passed = highlightsAfter.length === 0;
        return {
          id: 'shift',
          name: 'Scene Change / Camera Motion Invalidation',
          passed,
          message: passed
            ? 'Camera shift successfully invalidated and dismissed outdated annotations to prevent drift.'
            : 'Failed: outdated annotations remained on screen after camera shift!',
          details: { highlightsRemaining: highlightsAfter.length },
        };
      }
    }
  }

  async runAllPhase6Tests() {
    const tests: Array<'wan' | 'reset' | 'interrupt' | 'rotate' | 'shift'> = [
      'wan',
      'reset',
      'interrupt',
      'rotate',
      'shift',
    ];
    const results = [];
    for (const t of tests) {
      results.push(await this.runPhase6Test(t));
    }
    return results;
  }
}

export const interactionOrchestrator = new InteractionOrchestrator();
