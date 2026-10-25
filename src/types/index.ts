/**
 * DRIQ — Universal Types and Interfaces
 * Phase 2: Production Camera & Aspect-Ratio-Independent Video Geometry
 */

export type SessionState =
  | 'idle'
  | 'initializing'
  | 'requesting_permissions'
  | 'ready'
  | 'active_listening'
  | 'analyzing'
  | 'speaking'
  | 'error'
  | 'disconnected';

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export interface DevicePermissions {
  camera: PermissionStatus;
  microphone: PermissionStatus;
}

export interface CameraDeviceInfo {
  deviceId: string;
  label: string;
  facingMode: 'user' | 'environment' | 'unknown';
}

export interface CameraState {
  isStreaming: boolean;
  activeDeviceId: string | null;
  facingMode: 'user' | 'environment';
  isMirrored: boolean;
  availableDevices: CameraDeviceInfo[];
  canSwitchCamera: boolean;
  hasTorch: boolean;
  isTorchOn: boolean;
  resolution: { width: number; height: number };
  aspectRatio: number;
  isSimulated: boolean;
  isSuspended: boolean;
  interruptionReason: string | null;
  error: string | null;
}

export interface AudioState {
  isMicActive: boolean;
  isMuted: boolean;
  inputVolume: number; // 0.0 - 1.0 (RMS)
  frequencyBins: Uint8Array; // FFT data for visualizer
  isSpeaking: boolean;
  outputVolume: number;
  error: string | null;
}

/**
 * 0-1000 Normalized Bounding Box following standard vision grounding conventions
 * [ymin, xmin, ymax, xmax]
 */
export type GroundingBox = [number, number, number, number];

export interface NormalizedPoint {
  normX: number; // 0 - 1000
  normY: number; // 0 - 1000
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface GroundedComponent {
  frameId: string;
  objectId: string;
  componentId: string;
  label: string;
  normalizedBoundingBox: GroundingBox; // [ymin, xmin, ymax, xmax] in 0-1000
  visible: boolean;
  uncertaintyReason: string | null;
  shortExplanation: string;
  category?: 'port' | 'button' | 'indicator' | 'key' | 'component' | 'sensor' | 'control';
  confidenceQuality?: 'high' | 'medium' | 'low';
}

export interface GroundingAnalysisResult {
  frameId: string;
  timestamp: number;
  components: GroundedComponent[];
  sceneSummary: string;
  sceneChangeDetected?: boolean;
  isStale?: boolean;
}

export interface GroundingValidationResult {
  isValid: boolean;
  errors: string[];
  validatedComponent?: GroundedComponent;
}

export interface Annotation {
  id: string;
  frameId?: string;
  label: string;
  category: 'object' | 'text' | 'measurement' | 'landmark' | 'diagram' | 'context' | 'port' | 'button' | 'key' | 'control';
  box: GroundingBox;
  confidence: number;
  description?: string;
  color?: string;
  isHighlighted?: boolean;
  timestamp: number;
  visible?: boolean;
  uncertaintyReason?: string | null;
  shortExplanation?: string;
  attributes?: Record<string, string | number>;
}

export interface DisplayedVideoRect {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  cropX: number;
  cropY: number;
}

export type FitMode = 'cover' | 'contain';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface VideoGeometry {
  containerWidth: number;
  containerHeight: number;
  videoWidth: number;
  videoHeight: number;
  fit: FitMode;
  isMirrored: boolean;
  orientation: 'portrait' | 'landscape';
  displayedRect: DisplayedVideoRect;
  safeArea: SafeAreaInsets;
}

export type LayoutMode =
  | 'mobile-portrait'
  | 'mobile-landscape'
  | 'tablet'
  | 'desktop-compact'
  | 'desktop-wide'
  | 'ultrawide';

export interface ViewportInfo {
  width: number;
  height: number;
  aspect: number;
  isTouch: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  layoutMode: LayoutMode;
  safeArea: SafeAreaInsets;
}

export type VisualHUDMode = 'minimal' | 'precision' | 'inspector' | 'grid';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: number;
  referencedAnnotationIds?: string[];
  audioVisualizerRms?: number;
}

export interface SampledFrame {
  id: string; // unique frameId
  dataUrl: string;
  blob?: Blob;
  width: number;
  height: number;
  timestamp: number;
  format: 'image/jpeg' | 'image/webp';
  fingerprint?: number[]; // cell luminance values for scene change detection
}

export interface FrameSamplingStats {
  isSamplingActive: boolean;
  sampleCount: number;
  lastSampleTime: number | null;
  averageIntervalMs: number;
  effectiveFps: number;
}

/* -------------------------------------------------------------
 * Visual Experience Engine (Phase 5) Types
 * -----------------------------------------------------------*/

export type CalloutPlacement = 'above' | 'below' | 'left' | 'right' | 'compact';

export type CalloutStatus = 'active' | 'warning' | 'info' | 'verified' | 'action_needed';

export interface VisualCallout {
  id: string;
  targetBox: GroundingBox; // [ymin, xmin, ymax, xmax] in 0-1000
  title: string;
  status?: CalloutStatus;
  explanation: string;
  category?: string;
  meta?: Record<string, string | number>;
  placement?: CalloutPlacement;
}

export interface VisualStep {
  stepNumber: number;
  totalSteps: number;
  targetBox: GroundingBox; // [ymin, xmin, ymax, xmax] in 0-1000
  title: string;
  instruction: string;
  status: 'pending' | 'current' | 'completed';
  actionPrompt?: string;
}

export interface ObjectHighlight {
  id: string;
  objectId: string;
  box: GroundingBox;
  label: string;
  confidence?: number;
  color?: string; // cyan, white, etc.
  pulse?: boolean;
}

export interface ComponentHighlight {
  id: string;
  componentId: string;
  box: GroundingBox;
  label: string;
  color?: string; // cyan, amber, emerald, white
  pulse?: boolean;
}

export interface VisualConnector {
  id: string;
  startPoint: ScreenPoint; // target anchor
  endPoint: ScreenPoint; // callout card anchor
  style?: 'elbow' | 'curved' | 'direct';
  color?: string;
}

export interface VisualEngineState {
  mode: VisualHUDMode;
  objectHighlights: ObjectHighlight[];
  componentHighlights: ComponentHighlight[];
  callouts: VisualCallout[];
  activeSteps: VisualStep[];
  currentStepIndex: number;
  connectors: VisualConnector[];
  isDevOverlayMode: boolean;
  devScenarioName: string | null;
}

export interface GeometryTestResult {
  aspectName: string;
  videoDimensions: { width: number; height: number };
  containerDimensions: { width: number; height: number };
  fitMode: FitMode;
  isMirrored: boolean;
  passed: boolean;
  maxCoordinateDrift: number; // in 0-1000 units
  details: string;
}

/* -------------------------------------------------------------
 * Service Contracts
 * -----------------------------------------------------------*/

export interface IPermissionManager {
  checkPermissions(): Promise<DevicePermissions>;
  requestCamera(): Promise<boolean>;
  requestMicrophone(): Promise<boolean>;
  requestAll(): Promise<DevicePermissions>;
}

export interface ICameraController {
  startStream(preferredFacing?: 'user' | 'environment'): Promise<MediaStream | null>;
  stopStream(): void;
  switchCamera(): Promise<void>;
  toggleTorch(): Promise<boolean>;
  setSimulatedMode(enabled: boolean): void;
  getVideoElement(): HTMLVideoElement | null;
  getStream(): MediaStream | null;
  isMirrored(): boolean;
}

export interface IAudioController {
  startAudio(): Promise<boolean>;
  stopAudio(): void;
  toggleMute(): boolean;
  getVolume(): number;
  getFrequencyData(): Uint8Array;
  synthesizeTestChime(): void;
}

export interface IVideoGeometryMapper {
  computeGeometry(
    container: { width: number; height: number },
    video: { width: number; height: number },
    fit?: FitMode,
    isMirrored?: boolean,
    safeArea?: SafeAreaInsets
  ): VideoGeometry;
  mapBoxToScreen(
    box: GroundingBox,
    geometry: VideoGeometry
  ): { x: number; y: number; width: number; height: number };
  mapScreenToBox(
    screenX: number,
    screenY: number,
    geometry: VideoGeometry
  ): { normX: number; normY: number };
  mapNormalizedPointToScreen(
    point: NormalizedPoint,
    geometry: VideoGeometry
  ): ScreenPoint;
  mapScreenPointToNormalized(
    point: ScreenPoint,
    geometry: VideoGeometry
  ): NormalizedPoint;
  runComprehensiveGeometryTests(): GeometryTestResult[];
}

export interface IFrameSampler {
  captureFrame(video: HTMLVideoElement, quality?: number, maxDimension?: number): SampledFrame | null;
  startAiSampling(
    video: HTMLVideoElement,
    onSample: (frame: SampledFrame) => void,
    intervalMs?: number
  ): void;
  stopAiSampling(): void;
  isAiSampling(): boolean;
  getStats(): FrameSamplingStats;
}

export interface IGroundingService {
  getAnnotations(): Annotation[];
  addAnnotation(annotation: Omit<Annotation, 'id' | 'timestamp'>): Annotation;
  removeAnnotation(id: string): void;
  clearAnnotations(): void;
  hitTest(normX: number, normY: number): Annotation | null;
  loadDemoAnnotations(): void;
}

export interface IVisualExperienceEngine {
  mode: VisualHUDMode;
  setMode(mode: VisualHUDMode): void;
  cycleMode(): VisualHUDMode;

  // Phase 5 Visual Actions
  highlightObject(objectId: string, box: GroundingBox, label: string, color?: string): string;
  highlightComponent(componentId: string, box: GroundingBox, label: string, color?: string): string;
  showCallout(callout: Omit<VisualCallout, 'id'>): string;
  drawConnector(startPoint: ScreenPoint, endPoint: ScreenPoint, style?: 'elbow' | 'curved' | 'direct', color?: string): string;
  showSteps(steps: Array<Omit<VisualStep, 'stepNumber' | 'totalSteps'>>, initialIndex?: number): void;
  nextStep(): void;
  prevStep(): void;
  clearAnnotations(filter?: 'all' | 'objects' | 'components' | 'callouts' | 'steps' | 'connectors'): void;

  // Dev overlay test mode
  isDevOverlayMode: boolean;
  enableDevOverlayTest(scenario: 'router_setup' | 'mouse_sensor' | 'keyboard_matrix' | 'interactive_steps'): void;
  disableDevOverlayTest(): void;

  // State management & subscription
  getState(): VisualEngineState;
  subscribe(listener: (state: VisualEngineState) => void): () => void;
}

export interface IConversationController {
  turns: ConversationTurn[];
  addTurn(role: 'user' | 'assistant' | 'system', text: string, annotationIds?: string[]): ConversationTurn;
  clear(): void;
}

export interface ILiveSessionManager {
  state: SessionState;
  connect(): Promise<void>;
  disconnect(): void;
  sendUserQuery(text: string): Promise<void>;
}

export type SupportedLanguage = 'auto' | 'en' | 'mr' | 'hi';

export interface IResponsiveLayoutManager {
  viewport: ViewportInfo;
  isContextPanelOpen: boolean;
  toggleContextPanel(): void;
  setContextPanelOpen(open: boolean): void;
}

