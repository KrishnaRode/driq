import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Annotation,
  CameraState,
  FitMode,
  VideoGeometry,
  VisualEngineState,
  VisualHUDMode,
} from '../types';
import { cameraController } from '../services/CameraController';
import { groundingService } from '../services/GroundingService';
import { videoGeometryMapper } from '../services/VideoGeometryMapper';
import { interactionOrchestrator } from '../services/InteractionOrchestrator';
import { frameSampler } from '../services/FrameSampler';
import { visualExperienceEngine } from '../services/VisualExperienceEngine';
import {
  AlertCircle,
  Camera,
  Maximize2,
  RefreshCw,
  Sparkles,
  Target,
  Layers,
  FlipHorizontal,
  Scan,
  Loader2,
  CheckCircle2,
  X,
  ChevronRight,
  ChevronLeft,
  Info,
  Box,
  CornerDownRight,
  Compass,
  RotateCcw,
} from 'lucide-react';

interface CameraViewportProps {
  cameraState: CameraState;
  hudMode: VisualHUDMode;
  fitMode: FitMode;
  onToggleFitMode: () => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
}

export const CameraViewport: React.FC<CameraViewportProps> = ({
  cameraState,
  hudMode,
  fitMode,
  onToggleFitMode,
  onSelectAnnotation,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const hasFocus = annotations.some((a) => a.id.startsWith('tap_') || a.isHighlighted);
  const [isSceneStale, setIsSceneStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisFlash, setAnalysisFlash] = useState<boolean>(false);
  const [geometry, setGeometry] = useState<VideoGeometry>(() =>
    videoGeometryMapper.computeGeometry(
      { width: 1280, height: 720 },
      { width: 1280, height: 720 },
      fitMode,
      cameraState.isMirrored
    )
  );
  const [tapPing, setTapPing] = useState<{ x: number; y: number; id: number } | null>(null);

  // Phase 5: Visual Experience Engine State
  const [visualState, setVisualState] = useState<VisualEngineState>(() =>
    visualExperienceEngine.getState()
  );

  // Subscribe to annotations and scene change state
  useEffect(() => {
    const unsubAnnotations = groundingService.subscribe((list) => {
      setAnnotations(list);
    });
    const unsubScene = groundingService.subscribeSceneChange((stale, reason) => {
      setIsSceneStale(stale);
      setStaleReason(reason || null);
    });
    const unsubVisual = visualExperienceEngine.subscribe((vState) => {
      setVisualState(vState);
    });

    return () => {
      unsubAnnotations();
      unsubScene();
      unsubVisual();
    };
  }, []);

  // Attach video element to camera controller
  useEffect(() => {
    if (videoRef.current) {
      cameraController.attachVideoElement(videoRef.current);
    }
  }, []);

  // Recalculate geometry based on container and video source dimensions
  const updateGeometry = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth: cw, clientHeight: ch } = containerRef.current;
    const vw = videoRef.current?.videoWidth || cameraState.resolution.width || 1280;
    const vh = videoRef.current?.videoHeight || cameraState.resolution.height || 720;

    const computed = videoGeometryMapper.computeGeometry(
      { width: cw, height: ch },
      { width: vw, height: vh },
      fitMode,
      cameraState.isMirrored
    );
    setGeometry(computed);
  }, [cameraState.resolution, cameraState.isMirrored, fitMode]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. ResizeObserver on the container element
    const observer = new ResizeObserver(() => {
      updateGeometry();
    });
    observer.observe(containerRef.current);

    // 2. Window and orientation listeners
    window.addEventListener('resize', updateGeometry, { passive: true });
    window.addEventListener('orientationchange', updateGeometry, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateGeometry);
      window.removeEventListener('orientationchange', updateGeometry);
    };
  }, [updateGeometry]);

  const handleLoadedMetadata = () => {
    updateGeometry();
  };

  const handleVideoResize = () => {
    updateGeometry();
  };

  // Handle pointer down on camera viewport
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Visual tap ripple (brief; the focus box is what stays on screen)
    const pingId = Date.now();
    setTapPing({ x: screenX, y: screenY, id: pingId });
    setTimeout(() => setTapPing((p) => (p && p.id === pingId ? null : p)), 1000);

    const result = interactionOrchestrator.handleViewportTap(
      screenX,
      screenY,
      rect.width,
      rect.height,
      fitMode
    );

    if (result.hit && onSelectAnnotation) {
      onSelectAnnotation(result.hit);
    }
  };

  const handleTriggerAnalysis = async () => {
    if (isAnalyzing) return;
    const video = videoRef.current;
    if (!video) return;

    // Immediately clear stale state on re-scan
    groundingService.clearSceneStale();
    setIsSceneStale(false);
    setStaleReason(null);

    const frame = frameSampler.captureFrame(video);
    if (!frame) return;

    setIsAnalyzing(true);
    setAnalysisFlash(true);
    setTimeout(() => setAnalysisFlash(false), 200);

    try {
      await groundingService.analyzeFrame(frame);
    } catch (err) {
      console.warn('[DRIQ] Grounding analysis error handled:', err);
    } finally {
      setIsAnalyzing(false);
      setIsSceneStale(false);
    }
  };

  const isMobile = geometry.containerWidth < 640;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className="relative flex-1 w-full h-full min-h-0 overflow-hidden bg-neutral-950 select-none cursor-crosshair"
      style={{ touchAction: 'none' }}
    >
      {/* Visual Shutter Flash on Frame Capture */}
      {analysisFlash && (
        <div className="absolute inset-0 bg-white/20 pointer-events-none z-30 transition-opacity duration-150" />
      )}

      {/* 1. Underlying Video Feed with Object-Fit and Hardware Mirroring */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleLoadedMetadata}
        onResize={handleVideoResize}
        onPlay={handleLoadedMetadata}
        style={{
          objectFit: fitMode,
          transform: cameraState.isMirrored ? 'scaleX(-1)' : 'none',
        }}
        className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-200"
      />

      {/* 2. Contain Mode Letterbox / Pillarbox Boundary Guides */}
      {fitMode === 'contain' && (
        <div
          className="absolute pointer-events-none border border-sky-500/30 rounded-xs transition-all duration-150 z-10"
          style={{
            left: `${geometry.displayedRect.left}px`,
            top: `${geometry.displayedRect.top}px`,
            width: `${geometry.displayedRect.width}px`,
            height: `${geometry.displayedRect.height}px`,
          }}
        >
          <div className="absolute top-1 left-2 text-[10px] font-mono text-sky-400/80 bg-neutral-950/80 px-1 rounded">
            FIT: CONTAIN ({Math.round(geometry.displayedRect.width)}×{Math.round(geometry.displayedRect.height)})
          </div>
        </div>
      )}

      {/* 3. Grid Mode Lines */}
      {hudMode === 'grid' && (
        <svg
          className="absolute pointer-events-none z-10 opacity-30"
          style={{
            left: `${geometry.displayedRect.left}px`,
            top: `${geometry.displayedRect.top}px`,
            width: `${geometry.displayedRect.width}px`,
            height: `${geometry.displayedRect.height}px`,
          }}
        >
          <line x1="33.3%" y1="0" x2="33.3%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="66.6%" y1="0" x2="66.6%" y2="100%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" />
        </svg>
      )}

      {/* 4. Reticle Corner Framing Brackets */}
      {hudMode !== 'minimal' && (
        <div
          className="absolute pointer-events-none z-10"
          style={{
            left: `${Math.max(16, geometry.displayedRect.left + 16)}px`,
            top: `${Math.max(16, geometry.displayedRect.top + 16)}px`,
            width: `${Math.min(geometry.containerWidth - 32, geometry.displayedRect.width - 32)}px`,
            height: `${Math.min(geometry.containerHeight - 32, geometry.displayedRect.height - 32)}px`,
          }}
        >
          {/* Top-Left */}
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/40" />
          {/* Top-Right */}
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/40" />
          {/* Bottom-Left */}
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/40" />
          {/* Bottom-Right */}
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/40" />

          {/* Center Crosshair Tick */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-40">
            <div className="w-4 h-0.5 bg-white/60 mx-auto" />
            <div className="w-0.5 h-4 bg-white/60 mx-auto -mt-2.25" />
          </div>
        </div>
      )}

      {/* 5. Tap Target Ping Ripple */}
      {tapPing && (
        <div
          key={tapPing.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20"
          style={{ left: tapPing.x, top: tapPing.y }}
        >
          <div className="w-12 h-12 rounded-full border border-sky-400 animate-ping opacity-75" />
          <div className="w-3 h-3 rounded-full bg-sky-400/80 -mt-7.5 ml-4.5" />
        </div>
      )}

      {/* -------------------------------------------------------------
       * 6. SVG Graphical Intelligence Layer (Phase 5)
       * Renders:
       * - Luminous Object Contour Highlights
       * - Precision Component Focus Boxes
       * - Animated Connectors (Elbow & Bezier)
       * - Standard Grounding Annotations
       * ----------------------------------------------------------- */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
        viewBox={`0 0 ${geometry.containerWidth} ${geometry.containerHeight}`}
      >
        <defs>
          {/* Cyan linear gradient for scanning beam */}
          <linearGradient id="scan-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>

          {/* Drop shadow filter for luminous highlights */}
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 6A. Object Highlights (Action 1: highlightObject) */}
        {visualState.objectHighlights.map((obj) => {
          const screen = videoGeometryMapper.mapBoxToScreen(obj.box, geometry);
          const color = obj.color || '#38bdf8';
          const cornerLen = Math.min(20, Math.min(screen.width, screen.height) / 4);

          return (
            <g key={obj.id} className="transition-all duration-200">
              {/* Soft ambient background wash */}
              <rect
                x={screen.x}
                y={screen.y}
                width={screen.width}
                height={screen.height}
                fill={color}
                fillOpacity="0.04"
                rx="6"
              />

              {/* Luminous bounding contour */}
              <rect
                x={screen.x}
                y={screen.y}
                width={screen.width}
                height={screen.height}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeOpacity="0.7"
                rx="6"
                className="filter-luminous-cyan"
              />

              {/* Precision Corner Brackets */}
              <path
                d={`M ${screen.x} ${screen.y + cornerLen} L ${screen.x} ${screen.y} L ${screen.x + cornerLen} ${screen.y}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />
              <path
                d={`M ${screen.x + screen.width - cornerLen} ${screen.y} L ${screen.x + screen.width} ${screen.y} L ${screen.x + screen.width} ${screen.y + cornerLen}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />
              <path
                d={`M ${screen.x} ${screen.y + screen.height - cornerLen} L ${screen.x} ${screen.y + screen.height} L ${screen.x + cornerLen} ${screen.y + screen.height}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />
              <path
                d={`M ${screen.x + screen.width - cornerLen} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height - cornerLen}`}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
              />

              {/* Subtle Scanning Beam inside box */}
              <line
                x1={screen.x + 4}
                y1={screen.y + screen.height * 0.45}
                x2={screen.x + screen.width - 4}
                y2={screen.y + screen.height * 0.45}
                stroke="url(#scan-gradient)"
                strokeWidth="2"
                className="animate-subtle-scan"
              />

              {/* Minimal Object Header Tag */}
              <g transform={`translate(${screen.x + 8}, ${screen.y - 12})`}>
                <rect
                  x="0"
                  y="0"
                  width={obj.label.length * 7 + 22}
                  height="20"
                  fill="#090a0f"
                  fillOpacity="0.92"
                  stroke={color}
                  strokeWidth="1"
                  rx="3"
                />
                <circle cx="9" cy="10" r="3" fill={color} />
                <text
                  x="18"
                  y="14"
                  fill="#f1f5f9"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  {obj.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* 6B. Component Highlights (Action 2: highlightComponent) */}
        {visualState.componentHighlights.map((cmp) => {
          const screen = videoGeometryMapper.mapBoxToScreen(cmp.box, geometry);
          const color = cmp.color || '#06b6d4';
          const cornerLen = Math.min(12, Math.min(screen.width, screen.height) / 3);

          return (
            <g key={cmp.id} className="transition-all duration-150">
              {/* Fine dashed focus perimeter */}
              <rect
                x={screen.x}
                y={screen.y}
                width={screen.width}
                height={screen.height}
                fill={color}
                fillOpacity="0.08"
                stroke={color}
                strokeWidth="1.5"
                strokeDasharray="4 3"
                rx="4"
              />

              {/* Sharp Corner Accents */}
              <path
                d={`M ${screen.x} ${screen.y + cornerLen} L ${screen.x} ${screen.y} L ${screen.x + cornerLen} ${screen.y}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
              <path
                d={`M ${screen.x + screen.width - cornerLen} ${screen.y} L ${screen.x + screen.width} ${screen.y} L ${screen.x + screen.width} ${screen.y + cornerLen}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
              <path
                d={`M ${screen.x} ${screen.y + screen.height - cornerLen} L ${screen.x} ${screen.y + screen.height} L ${screen.x + cornerLen} ${screen.y + screen.height}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
              <path
                d={`M ${screen.x + screen.width - cornerLen} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height - cornerLen}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />

              {/* Center Crosshair Tick for Precision */}
              <circle
                cx={screen.x + screen.width / 2}
                cy={screen.y + screen.height / 2}
                r="2"
                fill={color}
                opacity="0.8"
              />
            </g>
          );
        })}

        {/* 6C. Dynamic Connectors (Action 4: drawConnector & Callout Links) */}
        {visualState.callouts.map((callout) => {
          const targetScreen = videoGeometryMapper.mapBoxToScreen(callout.targetBox, geometry);
          const layout = visualExperienceEngine.computeOptimalPlacement(
            targetScreen,
            { width: geometry.containerWidth, height: geometry.containerHeight },
            [],
            isMobile
          );

          const { connectorStart: start, connectorEnd: end } = layout;

          // Compute elbow / orthogonal connector path:
          // Start at target anchor -> horizontal or vertical midpoint -> end at card anchor
          const isHorizontalPlacement = layout.placement === 'left' || layout.placement === 'right';
          let pathD = '';

          if (isHorizontalPlacement) {
            const midX = (start.x + end.x) / 2;
            pathD = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
          } else {
            const midY = (start.y + end.y) / 2;
            pathD = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
          }

          return (
            <g key={`conn_${callout.id}`} className="transition-all duration-200">
              {/* Connector line path */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
                strokeOpacity="0.85"
                className="animate-dash-flow"
              />
              {/* Target Anchor Dot */}
              <circle cx={start.x} cy={start.y} r="3.5" fill="#38bdf8" className="filter-luminous-cyan" />
              <circle cx={start.x} cy={start.y} r="6" fill="none" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />
              {/* Card Terminal Dot */}
              <circle cx={end.x} cy={end.y} r="2.5" fill="#ffffff" opacity="0.9" />
            </g>
          );
        })}

        {/* 6D. Additional Standalone Connectors */}
        {visualState.connectors.map((conn) => {
          const midX = (conn.startPoint.x + conn.endPoint.x) / 2;
          const pathD = `M ${conn.startPoint.x} ${conn.startPoint.y} L ${midX} ${conn.startPoint.y} L ${midX} ${conn.endPoint.y} L ${conn.endPoint.x} ${conn.endPoint.y}`;

          return (
            <g key={conn.id}>
              <path
                d={pathD}
                fill="none"
                stroke={conn.color || '#38bdf8'}
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <circle cx={conn.startPoint.x} cy={conn.startPoint.y} r="3" fill={conn.color || '#38bdf8'} />
              <circle cx={conn.endPoint.x} cy={conn.endPoint.y} r="2" fill="#ffffff" />
            </g>
          );
        })}

        {/* 6E. Fallback Standard Annotations (when no Phase 5 dev overlay is overriding) */}
        {!visualState.isDevOverlayMode &&
          annotations.map((ann) => {
            if (ann.visible === false || ann.uncertaintyReason) return null;
            const screen = videoGeometryMapper.mapBoxToScreen(ann.box, geometry);
            const isHighlighted = ann.isHighlighted;
            const strokeColor = ann.color || (isHighlighted ? '#f59e0b' : '#38bdf8');

            return (
              <g key={ann.id} className="transition-all duration-150">
                {isHighlighted && (
                  <rect
                    x={screen.x}
                    y={screen.y}
                    width={screen.width}
                    height={screen.height}
                    fill={strokeColor}
                    fillOpacity="0.12"
                    rx="6"
                  />
                )}
                <rect
                  x={screen.x}
                  y={screen.y}
                  width={screen.width}
                  height={screen.height}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeDasharray={isHighlighted ? 'none' : '6 4'}
                  rx="6"
                />
                <path
                  d={`M ${screen.x} ${screen.y + 12} L ${screen.x} ${screen.y} L ${screen.x + 12} ${screen.y}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
                <path
                  d={`M ${screen.x + screen.width - 12} ${screen.y} L ${screen.x + screen.width} ${screen.y} L ${screen.x + screen.width} ${screen.y + 12}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
                <path
                  d={`M ${screen.x} ${screen.y + screen.height - 12} L ${screen.x} ${screen.y + screen.height} L ${screen.x + 12} ${screen.y + screen.height}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
                <path
                  d={`M ${screen.x + screen.width - 12} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height} L ${screen.x + screen.width} ${screen.y + screen.height - 12}`}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                />
              </g>
            );
          })}
      </svg>

      {/* -------------------------------------------------------------
       * 7. HTML Floating Intelligence Layer
       * - Action 3: showCallout Cards (Adaptive Placement)
       * - Action 5: showSteps Sequential Guidance Card
       * - Standard Annotation Badges
       * ----------------------------------------------------------- */}

      {/* 7A. Phase 5 Callout Cards (Action 3: showCallout) */}
      {visualState.callouts.map((callout) => {
        const targetScreen = videoGeometryMapper.mapBoxToScreen(callout.targetBox, geometry);
        const layout = visualExperienceEngine.computeOptimalPlacement(
          targetScreen,
          { width: geometry.containerWidth, height: geometry.containerHeight },
          [],
          isMobile
        );

        const { cardRect } = layout;
        const status = callout.status || 'info';

        const statusColor =
          status === 'verified'
            ? 'bg-emerald-400'
            : status === 'warning'
            ? 'bg-amber-400'
            : status === 'action_needed'
            ? 'bg-sky-400 animate-pulse-subtle'
            : 'bg-neutral-400';

        return (
          <div
            key={callout.id}
            style={{
              transform: `translate3d(${cardRect.x}px, ${cardRect.y}px, 0)`,
              width: `${cardRect.width}px`,
            }}
            className="absolute top-0 left-0 z-30 pointer-events-auto transition-transform duration-200"
          >
            <div className="p-3 bg-neutral-950/90 hover:bg-neutral-950 border border-neutral-700/80 hover:border-sky-400/80 rounded-xl shadow-2xl backdrop-blur-xl text-neutral-200 transition-colors">
              {/* Header: Category & Status */}
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  <span className={`w-2 h-2 rounded-full ${statusColor}`} />
                  <span>{callout.category || 'Component'}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    visualExperienceEngine.clearAnnotations('callouts');
                  }}
                  className="p-0.5 text-neutral-400 hover:text-white rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Title */}
              <div className="text-xs font-semibold text-white tracking-tight flex items-center gap-1.5">
                <span>{callout.title}</span>
              </div>

              {/* Short Explanation */}
              <p className="mt-1 text-[11px] text-neutral-300 font-sans leading-snug">
                {callout.explanation}
              </p>

              {/* Key-Value Metadata Chips */}
              {callout.meta && (
                <div className="mt-2 pt-2 border-t border-neutral-800/80 flex flex-wrap gap-1.5">
                  {Object.entries(callout.meta).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-300"
                    >
                      <span className="text-neutral-500 mr-1">{k}:</span>
                      <span className="text-sky-300 font-medium">{v}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 7B. Phase 5 Step-by-Step Guidance Wizard (Action 5: showSteps) */}
      {visualState.activeSteps.length > 0 && (
        <div className="absolute bottom-24 inset-x-4 max-w-md mx-auto z-30 pointer-events-auto">
          <div className="p-3.5 bg-neutral-950/95 border border-sky-500/60 rounded-xl shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-sky-950 border border-sky-800 text-[11px] font-mono text-sky-300 font-semibold">
                  STEP {visualState.currentStepIndex + 1} OF {visualState.activeSteps.length}
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {visualState.activeSteps[visualState.currentStepIndex]?.title}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  visualExperienceEngine.clearAnnotations('steps');
                }}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 font-sans leading-relaxed">
              {visualState.activeSteps[visualState.currentStepIndex]?.instruction}
            </p>

            {visualState.activeSteps[visualState.currentStepIndex]?.actionPrompt && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-sky-400">
                <CornerDownRight className="w-3.5 h-3.5 shrink-0" />
                <span>{visualState.activeSteps[visualState.currentStepIndex].actionPrompt}</span>
              </div>
            )}

            {/* Step Navigation Controls */}
            <div className="mt-3 pt-2.5 border-t border-neutral-850 flex items-center justify-between gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  visualExperienceEngine.prevStep();
                }}
                disabled={visualState.currentStepIndex === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-neutral-300 rounded-lg text-xs font-mono transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              {/* Step indicator dots */}
              <div className="flex items-center gap-1.5">
                {visualState.activeSteps.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === visualState.currentStepIndex
                        ? 'w-5 bg-sky-400'
                        : idx < visualState.currentStepIndex
                        ? 'w-2 bg-emerald-500'
                        : 'w-2 bg-neutral-700'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (visualState.currentStepIndex < visualState.activeSteps.length - 1) {
                    visualExperienceEngine.nextStep();
                  } else {
                    visualExperienceEngine.clearAnnotations('steps');
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-mono font-medium transition-colors"
              >
                <span>
                  {visualState.currentStepIndex < visualState.activeSteps.length - 1
                    ? 'Next Step'
                    : 'Done'}
                </span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7C. Standard Annotation Floating Label Badges (when dev overlay is inactive) */}
      {!visualState.isDevOverlayMode &&
        annotations.map((ann) => {
          if (ann.visible === false || ann.uncertaintyReason) return null;
          const screen = videoGeometryMapper.mapBoxToScreen(ann.box, geometry);
          const isHighlighted = ann.isHighlighted;
          const badgeTop = Math.max(16, screen.y - 28);
          const badgeLeft = screen.x;

          return (
            <div
              key={`badge_${ann.id}`}
              onClick={(e) => {
                e.stopPropagation();
                groundingService.setHighlight(ann.id);
                if (onSelectAnnotation) onSelectAnnotation(ann);
              }}
              style={{
                transform: `translate3d(${badgeLeft}px, ${badgeTop}px, 0)`,
              }}
              className={`absolute top-0 left-0 z-20 pointer-events-auto transition-transform duration-100 cursor-pointer ${
                isHighlighted ? 'scale-105 z-30' : 'opacity-90 hover:opacity-100'
              }`}
            >
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono font-medium backdrop-blur-md shadow-lg border transition-colors ${
                  isHighlighted
                    ? 'bg-amber-950/90 text-amber-200 border-amber-500/80'
                    : 'bg-neutral-900/85 text-neutral-200 border-neutral-700/80 hover:border-sky-400'
                }`}
              >
                <Target className="w-3 h-3 text-sky-400" />
                <span className="font-semibold">{ann.label}</span>
                <span className="text-[10px] text-neutral-400 font-normal">
                  {Math.round(ann.confidence * 100)}%
                </span>
              </div>
            </div>
          );
        })}

      {/* -------------------------------------------------------------
       * 8. Top Floating Controls and Telemetry
       * ----------------------------------------------------------- */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Left Side: Fit Mode & Mirroring */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {/* Fit Mode Toggle Button (Cover vs Contain) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFitMode();
            }}
            title="Toggle Object-Fit: Cover vs Contain (F)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-xs font-mono text-neutral-300 rounded-lg backdrop-blur-md shadow-md transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="uppercase">{fitMode}</span>
          </button>

          {/* Mirror indicator */}
          {cameraState.isMirrored && (
            <div
              title="Front camera horizontal mirror active"
              className="flex items-center gap-1 px-2 py-1.5 bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono text-neutral-400 rounded-lg backdrop-blur-md"
            >
              <FlipHorizontal className="w-3 h-3 text-amber-400" />
              <span>MIRRORED</span>
            </div>
          )}

          {/* Simulated Stream Banner */}
          {cameraState.isSimulated && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-900/90 border border-neutral-800 rounded-lg text-xs text-neutral-300 backdrop-blur-md shadow-md">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono text-[11px]">DRIQ Lab Stream 60FPS</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  cameraController.startStream(cameraState.facingMode);
                }}
                className="flex items-center gap-1 ml-1 text-sky-400 hover:text-sky-300 underline"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry WebCam</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Visual Actions & Inspect Scene */}
        {/* Stop pointerdown here so pressing a button doesn't also drop a focus box under it. */}
        <div className="flex items-center gap-2 pointer-events-auto" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              interactionOrchestrator.clearFocus();
            }}
            disabled={!hasFocus}
            title="Remove the focus area"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900/90 hover:bg-neutral-800 active:scale-95 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-mono font-medium backdrop-blur-md shadow-lg transition-all disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Focus</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTriggerAnalysis();
            }}
            disabled={isAnalyzing}
            title="Demand-driven spatial grounding analysis with Gemini 3.8 Flash"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600/90 hover:bg-sky-500 active:scale-95 text-white rounded-lg text-xs font-mono font-medium backdrop-blur-md shadow-lg transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Scan className="w-3.5 h-3.5" />
            )}
            <span>{isAnalyzing ? 'Grounding...' : 'Inspect Scene'}</span>
          </button>
        </div>
      </div>

      {/* 9. Developer-Only Overlay Mode Warning Badge */}
      {visualState.isDevOverlayMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 bg-neutral-900/95 border border-sky-500/70 rounded-full text-xs text-sky-200 shadow-xl backdrop-blur-md">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span className="font-mono text-[11px]">
            DEV BENCHMARK: {visualState.devScenarioName || 'Custom'} (Synthetic coordinates)
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              visualExperienceEngine.disableDevOverlayTest();
            }}
            className="ml-1 px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-[10px] font-mono transition-colors"
          >
            Exit Dev Mode
          </button>
        </div>
      )}

      {/* 10. Scene Stale Warning Banner (if camera shifted) */}
      {isSceneStale && !visualState.isDevOverlayMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 bg-amber-950/90 border border-amber-500/70 rounded-full text-xs text-amber-200 shadow-xl backdrop-blur-md animate-bounce-once">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Scene changed — annotations cleared</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              groundingService.clearSceneStale();
              setIsSceneStale(false);
              handleTriggerAnalysis();
            }}
            className="ml-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded text-[11px] transition-colors"
          >
            Re-scan
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              groundingService.clearSceneStale();
              setIsSceneStale(false);
            }}
            className="p-0.5 text-amber-300 hover:text-white rounded"
            title="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 11. Camera Interruption Notification Banner (if any) */}
      {cameraState.interruptionReason && !cameraState.isSuspended && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 bg-neutral-900/95 border border-amber-500/50 rounded-xl text-xs text-neutral-200 shadow-2xl backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{cameraState.interruptionReason}</span>
          <button
            onClick={() => cameraController.startStream(cameraState.facingMode)}
            className="ml-2 px-2 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded text-xs transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
};
