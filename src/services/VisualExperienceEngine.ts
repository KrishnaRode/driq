/**
 * DRIQ — Visual Experience Engine (Phase 5)
 *
 * Minimalist graphical intelligence layer inspired by cinematic AI companions,
 * maintaining Google-level simplicity, crisp typography, and zero-pill discipline.
 *
 * Implements 6 canonical visual actions:
 * 1. highlightObject: Luminous bounding contour around identified primary objects
 * 2. highlightComponent: Fine-grained focus box/ring around specific buttons, ports, switches
 * 3. showCallout: Small contextual card with label, status, and concise explanation
 * 4. drawConnector: Elegant elbow/bezier connector lines linking target component to floating callout
 * 5. showSteps: Sequential step-by-step guidance overlays (Step 1 of N)
 * 6. clearAnnotations: Immediate animated dismissal or programmatic reset
 */

import {
  CalloutPlacement,
  ComponentHighlight,
  GroundingBox,
  IVisualExperienceEngine,
  ObjectHighlight,
  ScreenPoint,
  VisualCallout,
  VisualConnector,
  VisualEngineState,
  VisualHUDMode,
  VisualStep,
} from '../types';
import { groundingService } from './GroundingService';

type VisualEngineListener = (state: VisualEngineState) => void;

export class VisualExperienceEngine implements IVisualExperienceEngine {
  private _mode: VisualHUDMode = 'precision';
  private objectHighlights: Map<string, ObjectHighlight> = new Map();
  private componentHighlights: Map<string, ComponentHighlight> = new Map();
  private callouts: Map<string, VisualCallout> = new Map();
  private activeSteps: VisualStep[] = [];
  private currentStepIndex: number = 0;
  private connectors: Map<string, VisualConnector> = new Map();

  private _isDevOverlayMode: boolean = false;
  private _devScenarioName: string | null = null;
  private listeners: Set<VisualEngineListener> = new Set();

  private actionCounter = 0;

  constructor() {
    // If the scene changes significantly (delta > 0.22) or camera shifts,
    // clear annotations rather than letting them drift over the wrong physical objects.
    groundingService.subscribeSceneChange((isStale, reason) => {
      if (isStale && !this._isDevOverlayMode) {
        // Clear highlights and callouts on camera shift
        this.clearAnnotations('all');
      }
    });
  }

  get mode(): VisualHUDMode {
    return this._mode;
  }

  get isDevOverlayMode(): boolean {
    return this._isDevOverlayMode;
  }

  setMode(mode: VisualHUDMode) {
    if (this._mode === mode) return;
    this._mode = mode;
    this.notify();
  }

  cycleMode(): VisualHUDMode {
    const modes: VisualHUDMode[] = ['precision', 'minimal', 'inspector', 'grid'];
    const nextIdx = (modes.indexOf(this._mode) + 1) % modes.length;
    this._mode = modes[nextIdx];
    this.notify();
    return this._mode;
  }

  getState(): VisualEngineState {
    return {
      mode: this._mode,
      objectHighlights: Array.from(this.objectHighlights.values()),
      componentHighlights: Array.from(this.componentHighlights.values()),
      callouts: Array.from(this.callouts.values()),
      activeSteps: [...this.activeSteps],
      currentStepIndex: this.currentStepIndex,
      connectors: Array.from(this.connectors.values()),
      isDevOverlayMode: this._isDevOverlayMode,
      devScenarioName: this._devScenarioName,
    };
  }

  subscribe(listener: VisualEngineListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }

  private generateId(prefix: string): string {
    this.actionCounter += 1;
    return `${prefix}_${Date.now()}_${this.actionCounter}`;
  }

  /* ------------------------------------------------------------------
   * Action 1: highlightObject
   * Luminous bounding contour around identified primary objects
   * ----------------------------------------------------------------*/
  highlightObject(
    objectId: string,
    box: GroundingBox,
    label: string,
    color?: string
  ): string {
    const id = this.generateId('obj');
    const highlight: ObjectHighlight = {
      id,
      objectId,
      box,
      label,
      color: color || '#38bdf8', // luminous sky/cyan
      pulse: true,
    };
    this.objectHighlights.set(id, highlight);
    this.notify();
    return id;
  }

  /* ------------------------------------------------------------------
   * Action 2: highlightComponent
   * Fine-grained focus box/ring around specific buttons, ports, switches
   * ----------------------------------------------------------------*/
  highlightComponent(
    componentId: string,
    box: GroundingBox,
    label: string,
    color?: string
  ): string {
    const id = this.generateId('cmp');
    const highlight: ComponentHighlight = {
      id,
      componentId,
      box,
      label,
      color: color || '#06b6d4', // luminous cyan
      pulse: true,
    };
    this.componentHighlights.set(id, highlight);
    this.notify();
    return id;
  }

  /* ------------------------------------------------------------------
   * Action 3: showCallout
   * Small contextual card with label, status, and concise explanation
   * ----------------------------------------------------------------*/
  showCallout(callout: Omit<VisualCallout, 'id'>): string {
    const id = this.generateId('callout');
    const fullCallout: VisualCallout = {
      ...callout,
      id,
      placement: callout.placement || 'above',
    };
    this.callouts.set(id, fullCallout);
    this.notify();
    return id;
  }

  /* ------------------------------------------------------------------
   * Action 4: drawConnector
   * Elegant elbow/bezier connector lines linking target to callout
   * ----------------------------------------------------------------*/
  drawConnector(
    startPoint: ScreenPoint,
    endPoint: ScreenPoint,
    style: 'elbow' | 'curved' | 'direct' = 'elbow',
    color?: string
  ): string {
    const id = this.generateId('conn');
    const connector: VisualConnector = {
      id,
      startPoint,
      endPoint,
      style,
      color: color || '#38bdf8',
    };
    this.connectors.set(id, connector);
    this.notify();
    return id;
  }

  /* ------------------------------------------------------------------
   * Action 5: showSteps
   * Sequential step-by-step guidance overlays
   * ----------------------------------------------------------------*/
  showSteps(
    steps: Array<Omit<VisualStep, 'stepNumber' | 'totalSteps'>>,
    initialIndex = 0
  ): void {
    const total = steps.length;
    this.activeSteps = steps.map((s, idx) => ({
      ...s,
      stepNumber: idx + 1,
      totalSteps: total,
      status: idx < initialIndex ? 'completed' : idx === initialIndex ? 'current' : 'pending',
    }));
    this.currentStepIndex = Math.min(Math.max(0, initialIndex), total - 1);
    this.notify();
  }

  nextStep(): void {
    if (this.currentStepIndex < this.activeSteps.length - 1) {
      this.currentStepIndex += 1;
      this.activeSteps = this.activeSteps.map((s, idx) => ({
        ...s,
        status: idx < this.currentStepIndex ? 'completed' : idx === this.currentStepIndex ? 'current' : 'pending',
      }));
      this.notify();
    }
  }

  prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.activeSteps = this.activeSteps.map((s, idx) => ({
        ...s,
        status: idx < this.currentStepIndex ? 'completed' : idx === this.currentStepIndex ? 'current' : 'pending',
      }));
      this.notify();
    }
  }

  /* ------------------------------------------------------------------
   * Action 6: clearAnnotations
   * Immediate animated dismissal or programmatic reset
   * ----------------------------------------------------------------*/
  clearAnnotations(
    filter: 'all' | 'objects' | 'components' | 'callouts' | 'steps' | 'connectors' = 'all'
  ): void {
    if (filter === 'all' || filter === 'objects') {
      this.objectHighlights.clear();
    }
    if (filter === 'all' || filter === 'components') {
      this.componentHighlights.clear();
    }
    if (filter === 'all' || filter === 'callouts') {
      this.callouts.clear();
    }
    if (filter === 'all' || filter === 'connectors') {
      this.connectors.clear();
    }
    if (filter === 'all' || filter === 'steps') {
      this.activeSteps = [];
      this.currentStepIndex = 0;
    }
    this.notify();
  }

  /* ------------------------------------------------------------------
   * Adaptive Label & Callout Placement Math
   * Avoids notches, home indicators, mic bar, camera controls, edges
   * ----------------------------------------------------------------*/
  computeOptimalPlacement(
    screenBox: { x: number; y: number; width: number; height: number },
    container: { width: number; height: number },
    reservedZones: Array<{ x: number; y: number; width: number; height: number }> = [],
    isMobile = false
  ): {
    placement: CalloutPlacement;
    cardRect: { x: number; y: number; width: number; height: number };
    connectorStart: ScreenPoint;
    connectorEnd: ScreenPoint;
  } {
    const cardWidth = isMobile ? Math.min(220, container.width - 32) : 250;
    const cardHeight = 84;
    const gap = 16;

    // Safety bounds (top bar: 64px, bottom bar: 110px, lateral: 16px)
    const minTop = 64;
    const maxBottom = container.height - 110;
    const minLeft = 16;
    const maxRight = container.width - 16;

    const centerX = screenBox.x + screenBox.width / 2;
    const centerY = screenBox.y + screenBox.height / 2;

    // Evaluate candidate placements:
    // 1. Above
    const canFitAbove = screenBox.y - gap - cardHeight >= minTop;
    // 2. Below
    const canFitBelow = screenBox.y + screenBox.height + gap + cardHeight <= maxBottom;
    // 3. Right
    const canFitRight = screenBox.x + screenBox.width + gap + cardWidth <= maxRight;
    // 4. Left
    const canFitLeft = screenBox.x - gap - cardWidth >= minLeft;

    let chosenPlacement: CalloutPlacement = 'above';
    let cardX = 0;
    let cardY = 0;
    let connStart: ScreenPoint = { x: centerX, y: screenBox.y };
    let connEnd: ScreenPoint = { x: centerX, y: 0 };

    if (isMobile) {
      // On narrow mobile devices, prefer top or bottom, or compact label
      if (canFitAbove) {
        chosenPlacement = 'above';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, centerX - cardWidth / 2));
        cardY = screenBox.y - gap - cardHeight;
        connStart = { x: centerX, y: screenBox.y };
        connEnd = { x: cardX + cardWidth / 2, y: cardY + cardHeight };
      } else if (canFitBelow) {
        chosenPlacement = 'below';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, centerX - cardWidth / 2));
        cardY = screenBox.y + screenBox.height + gap;
        connStart = { x: centerX, y: screenBox.y + screenBox.height };
        connEnd = { x: cardX + cardWidth / 2, y: cardY };
      } else {
        chosenPlacement = 'compact';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, screenBox.x));
        cardY = Math.max(minTop, screenBox.y - 32);
        connStart = { x: centerX, y: screenBox.y };
        connEnd = { x: cardX, y: cardY };
      }
    } else {
      // Desktop / Tablet layout: evaluate all 4 directions
      if (canFitRight && screenBox.y + cardHeight <= maxBottom) {
        chosenPlacement = 'right';
        cardX = screenBox.x + screenBox.width + gap;
        cardY = Math.max(minTop, Math.min(maxBottom - cardHeight, centerY - cardHeight / 2));
        connStart = { x: screenBox.x + screenBox.width, y: centerY };
        connEnd = { x: cardX, y: cardY + cardHeight / 2 };
      } else if (canFitLeft && screenBox.y + cardHeight <= maxBottom) {
        chosenPlacement = 'left';
        cardX = screenBox.x - gap - cardWidth;
        cardY = Math.max(minTop, Math.min(maxBottom - cardHeight, centerY - cardHeight / 2));
        connStart = { x: screenBox.x, y: centerY };
        connEnd = { x: cardX + cardWidth, y: cardY + cardHeight / 2 };
      } else if (canFitAbove) {
        chosenPlacement = 'above';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, centerX - cardWidth / 2));
        cardY = screenBox.y - gap - cardHeight;
        connStart = { x: centerX, y: screenBox.y };
        connEnd = { x: cardX + cardWidth / 2, y: cardY + cardHeight };
      } else if (canFitBelow) {
        chosenPlacement = 'below';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, centerX - cardWidth / 2));
        cardY = screenBox.y + screenBox.height + gap;
        connStart = { x: centerX, y: screenBox.y + screenBox.height };
        connEnd = { x: cardX + cardWidth / 2, y: cardY };
      } else {
        chosenPlacement = 'compact';
        cardX = Math.max(minLeft, Math.min(maxRight - cardWidth, screenBox.x));
        cardY = Math.max(minTop, screenBox.y - 32);
        connStart = { x: centerX, y: screenBox.y };
        connEnd = { x: cardX, y: cardY };
      }
    }

    return {
      placement: chosenPlacement,
      cardRect: { x: cardX, y: cardY, width: cardWidth, height: cardHeight },
      connectorStart: connStart,
      connectorEnd: connEnd,
    };
  }

  /* ------------------------------------------------------------------
   * Developer-Only Overlay Test Mode
   * Displays verified benchmark coordinates without claiming live Gemini output
   * ----------------------------------------------------------------*/
  enableDevOverlayTest(
    scenario: 'router_setup' | 'mouse_sensor' | 'keyboard_matrix' | 'interactive_steps'
  ): void {
    this.clearAnnotations('all');
    this._isDevOverlayMode = true;
    this._devScenarioName = scenario;

    switch (scenario) {
      case 'router_setup': {
        // 1. Primary router chassis object highlight
        this.highlightObject('dev_obj_router', [280, 180, 720, 820], 'Wi-Fi 6 Router Chassis', '#38bdf8');

        // 2. Fine-grained component highlights
        this.highlightComponent('dev_cmp_wan', [460, 240, 560, 340], 'Internet (WAN) Port', '#06b6d4');
        this.highlightComponent('dev_cmp_lan1', [460, 360, 560, 460], 'Gigabit LAN 1', '#06b6d4');
        this.highlightComponent('dev_cmp_pwr', [470, 700, 550, 780], '12V DC Barrel Jack', '#f59e0b');

        // 3. Contextual callout on WAN port
        this.showCallout({
          targetBox: [460, 240, 560, 340],
          title: 'Internet (WAN) Port',
          status: 'action_needed',
          explanation: 'Connect the primary Ethernet cable from your modem or optical ONT here.',
          category: 'port',
          meta: { Speed: '2.5 Gbps', State: 'Link Down' },
          placement: 'above',
        });

        // 4. Sequential Step-by-step guidance
        this.showSteps([
          {
            targetBox: [460, 240, 560, 340],
            title: 'Connect WAN Uplink',
            instruction: 'Plug the yellow RJ-45 cable from your modem into the blue 2.5G Internet port until it clicks.',
            status: 'current',
            actionPrompt: 'Awaiting cable click',
          },
          {
            targetBox: [470, 700, 550, 780],
            title: 'Plug 12V Power Adapter',
            instruction: 'Insert the cylindrical DC power barrel into the rightmost power port.',
            status: 'pending',
            actionPrompt: 'Insert barrel plug',
          },
          {
            targetBox: [310, 480, 350, 520],
            title: 'Verify LED Status',
            instruction: 'Observe the front status LED light up solid white or green.',
            status: 'pending',
            actionPrompt: 'Check front panel',
          },
        ], 0);
        break;
      }

      case 'mouse_sensor': {
        // Computer mouse chassis
        this.highlightObject('dev_obj_mouse', [220, 320, 780, 680], 'Optical Gaming Mouse', '#38bdf8');
        this.highlightComponent('dev_cmp_sensor', [460, 460, 540, 540], 'Hero Optical Sensor', '#06b6d4');
        this.highlightComponent('dev_cmp_dpi', [320, 470, 380, 530], 'DPI Cycle Toggle', '#f59e0b');

        this.showCallout({
          targetBox: [460, 460, 540, 540],
          title: 'Hero Optical Sensor',
          status: 'verified',
          explanation: 'Sub-micron tracking aperture rated for 25,600 DPI with zero smoothing.',
          category: 'sensor',
          meta: { Resolution: '25,600 DPI', IPS: '400+' },
          placement: 'right',
        });
        break;
      }

      case 'keyboard_matrix': {
        this.highlightObject('dev_obj_kb', [300, 100, 700, 900], 'Mechanical Keyboard (Tenkeyless)', '#38bdf8');
        this.highlightComponent('dev_cmp_usbc', [305, 470, 350, 530], 'USB-C Data Port', '#06b6d4');
        this.highlightComponent('dev_cmp_esc', [360, 130, 420, 190], 'Escape Keycap', '#38bdf8');

        this.showCallout({
          targetBox: [305, 470, 350, 530],
          title: 'USB-C Data Port',
          status: 'verified',
          explanation: 'Direct USB 2.0 full-speed connection with 1000Hz polling rate active.',
          category: 'port',
          meta: { Polling: '1000 Hz', Latency: '1.0 ms' },
          placement: 'above',
        });
        break;
      }

      case 'interactive_steps': {
        this.highlightObject('dev_obj_device', [250, 200, 750, 800], 'Smart Assistant Hub', '#38bdf8');
        this.highlightComponent('dev_cmp_rst', [480, 480, 520, 520], 'Recessed Reset Pin', '#f59e0b');

        this.showSteps([
          {
            targetBox: [480, 480, 520, 520],
            title: 'Locate Recessed Reset Pin',
            instruction: 'Using a SIM ejector tool or bent paperclip, gently locate the micro switch hole on the base.',
            status: 'current',
            actionPrompt: 'Align pin tool',
          },
          {
            targetBox: [480, 480, 520, 520],
            title: 'Depress Pin for 10 Seconds',
            instruction: 'Press and hold down firmly until the perimeter LED transitions from amber to pulsing cyan.',
            status: 'pending',
            actionPrompt: 'Hold for 10s',
          },
          {
            targetBox: [270, 450, 310, 550],
            title: 'Confirm Reset Complete',
            instruction: 'Release the pin once the chime sounds and the top LED illuminates solid blue.',
            status: 'pending',
            actionPrompt: 'Release pin',
          },
        ], 0);

        this.showCallout({
          targetBox: [480, 480, 520, 520],
          title: 'Factory Reset Pin',
          status: 'warning',
          explanation: 'Restores default firmware settings and clears saved Wi-Fi credentials.',
          placement: 'below',
        });
        break;
      }
    }

    this.notify();
  }

  disableDevOverlayTest(): void {
    this._isDevOverlayMode = false;
    this._devScenarioName = null;
    this.clearAnnotations('all');
    this.notify();
  }
}

export const visualExperienceEngine = new VisualExperienceEngine();
