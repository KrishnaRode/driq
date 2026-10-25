import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Crosshair,
  Activity,
  CheckSquare,
  Trash2,
  ExternalLink,
  Target,
  Sparkles,
  Layers,
  Timer,
  FlipHorizontal,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  Scan,
  Cpu,
  Send,
} from 'lucide-react';

import {
  Annotation,
  AudioState,
  CameraState,
  ConversationTurn,
  FitMode,
  FrameSamplingStats,
  SessionState,
  ViewportInfo,
} from '../types';
import { conversationController } from '../services/ConversationController';
import { groundingService } from '../services/GroundingService';
import { frameSampler } from '../services/FrameSampler';
import { liveSessionManager } from '../services/LiveSessionManager';
import { visualExperienceEngine } from '../services/VisualExperienceEngine';
import { Phase1TestChecklist } from './Phase1TestChecklist';
import { DevOverlayTestSuite } from './DevOverlayTestSuite';
import { Phase6OrchestrationTestSuite } from './Phase6OrchestrationTestSuite';
import { Phase7PersonalityEvaluationSuite } from './Phase7PersonalityEvaluationSuite';
import { Phase8ResponsiveQaSuite } from './Phase8ResponsiveQaSuite';

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  viewport: ViewportInfo;
  cameraState: CameraState;
  audioState: AudioState;
  sessionState: SessionState;
  fitMode: FitMode;
  selectedAnnotation: Annotation | null;
  onSelectAnnotation: (ann: Annotation) => void;
}

type TabType = 'conversation' | 'grounding' | 'telemetry' | 'testsuite';

export const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  viewport,
  cameraState,
  audioState,
  sessionState,
  fitMode,
  selectedAnnotation,
  onSelectAnnotation,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('conversation');
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isSceneStale, setIsSceneStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>('router');
  const [samplerStats, setSamplerStats] = useState<FrameSamplingStats>(frameSampler.getStats());
  const [testSubTab, setTestSubTab] = useState<'qa_matrix' | 'personality' | 'orchestration' | 'visual' | 'geometry'>('qa_matrix');
  const [chatInput, setChatInput] = useState<string>('');

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    liveSessionManager.sendUserQuery(text);
  };

  const handleQuickPrompt = (promptText: string) => {
    liveSessionManager.sendUserQuery(promptText);
  };

  useEffect(() => {
    const unsubTurns = conversationController.subscribe(setTurns);
    const unsubGrounding = groundingService.subscribe(setAnnotations);
    const unsubScene = groundingService.subscribeSceneChange((stale, reason) => {
      setIsSceneStale(stale);
      setStaleReason(reason || null);
    });
    const interval = setInterval(() => {
      setSamplerStats(frameSampler.getStats());
    }, 500);

    return () => {
      unsubTurns();
      unsubGrounding();
      unsubScene();
      clearInterval(interval);
    };
  }, []);


  if (!isOpen) return null;

  const isDrawerOnMobile = viewport.isMobile || viewport.isTablet;

  return (
    <aside
      className={`fixed z-40 bg-neutral-950/95 border-neutral-800 backdrop-blur-xl shadow-2xl flex flex-col transition-all duration-300 ${
        isDrawerOnMobile
          ? 'inset-x-0 bottom-0 max-h-[82dvh] rounded-t-2xl border-t'
          : 'top-0 right-0 h-full w-96 border-l'
      }`}
    >
      {/* Drawer Grab Handle for Mobile */}
      {isDrawerOnMobile && (
        <div className="w-10 h-1 bg-neutral-700 rounded-full mx-auto my-2 shrink-0" />
      )}

      {/* Panel Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Context & Intelligence</span>
          <span className="text-[11px] font-mono text-neutral-400">
            {turns.length} turns · {annotations.length} targets
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="grid grid-cols-4 p-1.5 bg-neutral-900/80 border-b border-neutral-800/60 text-xs font-medium">
        <button
          onClick={() => setActiveTab('conversation')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
            activeTab === 'conversation'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="truncate">Talk</span>
        </button>

        <button
          onClick={() => setActiveTab('grounding')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
            activeTab === 'grounding'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="truncate">Vision</span>
        </button>

        <button
          onClick={() => setActiveTab('telemetry')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
            activeTab === 'telemetry'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span className="truncate">Stats</span>
        </button>

        <button
          onClick={() => setActiveTab('testsuite')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all ${
            activeTab === 'testsuite'
              ? 'bg-neutral-800 text-white shadow-xs'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span className="truncate">Tests</span>
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: CONVERSATION */}
        {activeTab === 'conversation' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span>Transcript & Interaction Turns</span>
              <button
                onClick={() => conversationController.clear()}
                className="flex items-center gap-1 text-neutral-500 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {turns.map((turn: ConversationTurn) => (
                <div
                  key={turn.id}
                  className={`p-3 rounded-lg border text-xs ${
                    turn.role === 'user'
                      ? 'bg-sky-950/20 border-sky-900/40 text-sky-100 ml-4'
                      : turn.role === 'assistant'
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-100 mr-2'
                      : 'bg-neutral-900/40 border-neutral-800/40 text-neutral-400 italic'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
                    <span
                      className={`font-semibold uppercase tracking-wider ${
                        turn.role === 'user'
                          ? 'text-sky-400'
                          : turn.role === 'assistant'
                          ? 'text-amber-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {turn.role === 'assistant' ? 'DRIQ (Voice: Aoede)' : turn.role}
                    </span>
                    <span className="text-neutral-400">
                      {new Date(turn.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="leading-relaxed text-sm">{turn.text}</p>

                  {/* Referenced Visual Grounding Badges */}
                  {turn.referencedAnnotationIds && turn.referencedAnnotationIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pt-1.5 border-t border-neutral-800/60">
                      {turn.referencedAnnotationIds.map((annId: string) => {
                        const ann = annotations.find((a: Annotation) => a.id === annId);
                        return (
                          <button
                            key={annId}
                            onClick={() => {
                              if (ann) onSelectAnnotation(ann);
                            }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[10px] font-mono border border-neutral-700 transition-colors"
                          >

                            <Target className="w-2.5 h-2.5 text-sky-400" />
                            <span>{ann?.label || annId}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick Inquiries */}
            <div className="pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-1.5 uppercase tracking-wider">
                <span>Quick Inquiries (EN / मराठी)</span>
                <button
                  onClick={() => {
                    groundingService.clearAnnotations();
                    visualExperienceEngine.clearAnnotations('all');
                  }}
                  className="text-amber-400 hover:text-amber-300 underline"
                >
                  Clear Annotations
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'तुला काय दिसतय?',
                  'माझा चेहरा कसा आहे?',
                  'भिंतीवर काय आहे?',
                  'What do you see?',
                  'Describe my surroundings',
                  'Find ports & controls',
                  'Safety check',
                  'नमस्कार / Hello',
                ].map((qp) => (
                  <button
                    key={qp}
                    onClick={() => handleQuickPrompt(qp)}
                    className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-[11px] text-sky-300 font-sans transition-colors active:scale-95"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Message Input */}
            <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-2 border-t border-neutral-800/80">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask in English or मराठी (e.g. 'तुला काय दिसतय?')..."
                className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                title="Send inquiry"
                className="p-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg transition-colors active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: GROUNDING & SPATIAL INTELLIGENCE */}
        {activeTab === 'grounding' && (
          <div className="space-y-4">
            {/* Benchmark Test Scene Switcher */}
            <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span className="flex items-center gap-1 text-sky-400 font-semibold">
                  <Cpu className="w-3.5 h-3.5" />
                  BENCHMARK TEST CASES
                </span>
                <span>5 SCENARIOS</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono">
                {[
                  { key: 'router', label: 'Wi-Fi Router' },
                  { key: 'mouse', label: 'Optical Mouse' },
                  { key: 'keyboard', label: 'Keyboard' },
                  { key: 'unfamiliar', label: 'Cryo Device' },
                  { key: 'obscured', label: 'Obscured Audio' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActivePreset(item.key);
                      groundingService.loadBenchmarkScene(item.key as any);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                      activePreset === item.key
                        ? 'bg-sky-950/80 border-sky-500 text-sky-200 font-bold shadow-xs'
                        : 'bg-neutral-950/80 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scene Status & Metadata Banner */}
            <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Scene Analysis Status</span>
                {isSceneStale ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/50">
                    <AlertTriangle className="w-3 h-3" />
                    STALE (Moved)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-600/50">
                    <CheckCircle2 className="w-3 h-3" />
                    CALIBRATED
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300">
                {groundingService.getLastResult()?.sceneSummary ||
                  'Active frame analyzed with Gemini 3.8 Flash multimodal grounding.'}
              </p>
              {isSceneStale && staleReason && (
                <p className="text-[11px] font-mono text-amber-300/90 bg-amber-950/40 p-1.5 rounded border border-amber-800/40">
                  ⚠️ {staleReason}
                </p>
              )}
            </div>

            {/* Section A: Clearly Visible Localized Components (Active SVG boxes on camera) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-400 px-0.5">
                <span className="flex items-center gap-1.5 font-medium text-neutral-200">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  Confirmed Visible Components (Highlighted)
                </span>
                <span className="font-mono text-[10px]">
                  {annotations.filter((a: Annotation) => a.visible !== false && !a.uncertaintyReason).length}
                </span>
              </div>

              {annotations
                .filter((ann: Annotation) => ann.visible !== false && !ann.uncertaintyReason)
                .map((ann: Annotation) => {
                  const isSelected = selectedAnnotation?.id === ann.id;
                  return (
                    <div
                      key={ann.id}
                      onClick={() => onSelectAnnotation(ann)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500/80 ring-1 ring-amber-500/50'
                          : 'bg-neutral-900/70 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: ann.color || '#38bdf8' }}
                          />
                          <span className="text-xs font-semibold text-neutral-100">
                            {ann.label}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-neutral-800 text-sky-300">
                          {ann.category}
                        </span>
                      </div>

                      {ann.description && (
                        <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                          {ann.description}
                        </p>
                      )}

                      {/* Normalized 0-1000 Box values */}
                      <div className="mt-2.5 p-2 rounded-lg bg-neutral-950 font-mono text-[10px] text-neutral-400 grid grid-cols-4 gap-1 text-center border border-neutral-900">
                        <div><span className="text-neutral-500">ymin:</span> {ann.box[0]}</div>
                        <div><span className="text-neutral-500">xmin:</span> {ann.box[1]}</div>
                        <div><span className="text-neutral-500">ymax:</span> {ann.box[2]}</div>
                        <div><span className="text-neutral-500">xmax:</span> {ann.box[3]}</div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Section B: Uncertain or Obscured Components (Verbal explanation instead of false box) */}
            {annotations.some((a: Annotation) => a.visible === false || a.uncertaintyReason) && (
              <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                <div className="flex items-center justify-between text-xs text-neutral-400 px-0.5">
                  <span className="flex items-center gap-1.5 font-medium text-amber-300">
                    <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                    Uncertain / Occluded (Box Suppressed)
                  </span>
                  <span className="font-mono text-[10px] text-amber-400">
                    {annotations.filter((a: Annotation) => a.visible === false || a.uncertaintyReason).length}
                  </span>
                </div>

                {annotations
                  .filter((ann: Annotation) => ann.visible === false || ann.uncertaintyReason)
                  .map((ann: Annotation) => (
                    <div
                      key={ann.id}
                      className="p-3 rounded-xl border border-amber-900/40 bg-amber-950/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-neutral-200">
                          {ann.label}
                        </span>

                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/50">
                          OCCLUDED / UNCERTAIN
                        </span>
                      </div>

                      {ann.uncertaintyReason && (
                        <div className="text-[11px] font-mono text-amber-300/90 bg-neutral-950/80 p-2 rounded-lg border border-amber-900/30">
                          <span className="text-amber-400 font-semibold">Uncertainty Reason: </span>
                          {ann.uncertaintyReason}
                        </div>
                      )}

                      <p className="text-xs text-neutral-300 leading-relaxed">
                        {ann.shortExplanation || ann.description}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}


        {/* TAB 3: TELEMETRY & PIPELINE STATS */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4 text-xs font-mono">
            {/* Viewport Info */}
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
              <div className="text-neutral-400 font-semibold mb-1">VIEWPORT & DISPLAY</div>
              <div className="flex justify-between text-neutral-300">
                <span>Window Resolution:</span>
                <span>{viewport.width} × {viewport.height}px</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Layout Mode:</span>
                <span className="uppercase text-sky-400">{viewport.layoutMode}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Orientation:</span>
                <span className="capitalize">{viewport.orientation}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Touch Device:</span>
                <span>{viewport.isTouch ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Video Geometry Telemetry */}
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
              <div className="text-neutral-400 font-semibold mb-1">VIDEO GEOMETRY MAPPER</div>
              <div className="flex justify-between text-neutral-300">
                <span>Fitting Mode:</span>
                <span className="uppercase text-sky-400">{fitMode}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Hardware Mirror:</span>
                <span className={cameraState.isMirrored ? 'text-amber-400' : 'text-neutral-300'}>
                  {cameraState.isMirrored ? 'Active (scaleX -1)' : 'Standard'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Aspect Normalization:</span>
                <span className="text-emerald-400">0 - 1000 Canonical Grid</span>
              </div>
            </div>

            {/* AI Frame Sampler Rate Limiter Stats */}
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
              <div className="text-neutral-400 font-semibold mb-1">AI FRAME SAMPLER (MAX 1 FPS)</div>
              <div className="flex justify-between text-neutral-300">
                <span>Sampling Status:</span>
                <span className={samplerStats.isSamplingActive ? 'text-amber-400 animate-pulse' : 'text-neutral-400'}>
                  {samplerStats.isSamplingActive ? 'Active (1 FPS Capped)' : 'Idle (Session Standby)'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Total Samples:</span>
                <span>{samplerStats.sampleCount} frames</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Average Interval:</span>
                <span>{samplerStats.averageIntervalMs ? `${samplerStats.averageIntervalMs}ms` : '—'}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Effective Rate:</span>
                <span>{samplerStats.effectiveFps ? `${samplerStats.effectiveFps} FPS` : '0 FPS'}</span>
              </div>
            </div>

            {/* Audio Pipeline */}
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="text-neutral-400 font-semibold">WEB AUDIO PIPELINE</div>
              <div className="flex justify-between text-neutral-300">
                <span>Microphone Status:</span>
                <span className={audioState.isMicActive ? 'text-emerald-400' : 'text-amber-400'}>
                  {audioState.isMicActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Live RMS Meter Gauge */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Input RMS:</span>
                  <span>{Math.round(audioState.inputVolume * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 transition-all duration-75"
                    style={{ width: `${Math.min(100, audioState.inputVolume * 100)}%` }}
                  />
                </div>
              </div>

              {/* FFT Bins Visualizer */}
              <div className="flex items-end gap-0.5 h-8 pt-1">
                {Array.from(audioState.frequencyBins.slice(0, 24)).map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-sky-500/80 rounded-t"
                    style={{ height: `${Math.max(4, (val / 255) * 100)}%` }}
                  />
                ))}
              </div>
            </div>

            {/* Camera Pipeline */}
            <div className="p-3 rounded-lg bg-neutral-900 border border-neutral-800 space-y-1.5">
              <div className="text-neutral-400 font-semibold mb-1">VISION HARDWARE</div>
              <div className="flex justify-between text-neutral-300">
                <span>Stream Mode:</span>
                <span className={cameraState.isSimulated ? 'text-amber-400' : 'text-emerald-400'}>
                  {cameraState.isSimulated ? 'DRIQ Test Pattern (60FPS)' : 'Hardware Webcam'}
                </span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Facing Mode:</span>
                <span className="capitalize">{cameraState.facingMode}</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Camera Devices:</span>
                <span>{cameraState.availableDevices.length} enumerated</span>
              </div>
              <div className="flex justify-between text-neutral-300">
                <span>Suspension State:</span>
                <span className={cameraState.isSuspended ? 'text-amber-400' : 'text-neutral-400'}>
                  {cameraState.isSuspended ? 'Suspended in Background' : 'Foreground Active'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: TEST SUITES (Phase 8 QA Matrix, Phase 7 Personality, Phase 6 Orchestration, Phase 5 Visual Engine, Phase 2 Geometry) */}
        {activeTab === 'testsuite' && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 p-1 bg-neutral-900 rounded-lg border border-neutral-800 text-[11px]">
              <button
                onClick={() => setTestSubTab('qa_matrix')}
                className={`py-1.5 px-0.5 rounded-md font-medium text-center truncate transition-all ${
                  testSubTab === 'qa_matrix'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Phase 8 Universal Responsive QA Matrix (24 Viewports)"
              >
                QA (P8)
              </button>
              <button
                onClick={() => setTestSubTab('personality')}
                className={`py-1.5 px-0.5 rounded-md font-medium text-center truncate transition-all ${
                  testSubTab === 'personality'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Phase 7 Personality & Explanation Quality"
              >
                Pers (P7)
              </button>
              <button
                onClick={() => setTestSubTab('orchestration')}
                className={`py-1.5 px-0.5 rounded-md font-medium text-center truncate transition-all ${
                  testSubTab === 'orchestration'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Phase 6 Voice & Visual Orchestration"
              >
                Orch (P6)
              </button>
              <button
                onClick={() => setTestSubTab('visual')}
                className={`py-1.5 px-0.5 rounded-md font-medium text-center truncate transition-all ${
                  testSubTab === 'visual'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Phase 5 Visual HUD & Graphics"
              >
                HUD (P5)
              </button>
              <button
                onClick={() => setTestSubTab('geometry')}
                className={`py-1.5 px-0.5 rounded-md font-medium text-center truncate transition-all ${
                  testSubTab === 'geometry'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title="Phase 2 Geometry & Camera Feed"
              >
                Cam (P2)
              </button>
            </div>

            {testSubTab === 'qa_matrix' ? (
              <Phase8ResponsiveQaSuite />
            ) : testSubTab === 'personality' ? (
              <Phase7PersonalityEvaluationSuite />
            ) : testSubTab === 'orchestration' ? (
              <Phase6OrchestrationTestSuite />
            ) : testSubTab === 'visual' ? (
              <DevOverlayTestSuite />
            ) : (
              <Phase1TestChecklist
                viewport={viewport}
                cameraState={cameraState}
                audioState={audioState}
                sessionState={sessionState}
              />
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
