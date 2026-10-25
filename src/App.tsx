/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Annotation,
  AudioState,
  CameraState,
  DevicePermissions,
  FitMode,
  SessionState,
  ViewportInfo,
  VisualHUDMode,
} from './types';
import { audioController } from './services/AudioController';
import { cameraController } from './services/CameraController';
import { groundingService } from './services/GroundingService';
import { interactionOrchestrator } from './services/InteractionOrchestrator';
import { liveSessionManager } from './services/LiveSessionManager';
import { permissionManager } from './services/PermissionManager';
import { responsiveLayoutManager } from './services/ResponsiveLayoutManager';
import { visualExperienceEngine } from './services/VisualExperienceEngine';

import { Header } from './components/Header';
import { CameraViewport } from './components/CameraViewport';
import { VoiceControlBar } from './components/VoiceControlBar';
import { ContextPanel } from './components/ContextPanel';
import { ShortcutsModal } from './components/ShortcutsModal';
import { PermissionModal } from './components/PermissionModal';

export default function App() {
  const [sessionState, setSessionState] = useState<SessionState>('initializing');
  const [cameraState, setCameraState] = useState<CameraState>(cameraController.getState());
  const [audioState, setAudioState] = useState<AudioState>({
    isMicActive: false,
    isMuted: false,
    inputVolume: 0,
    frequencyBins: new Uint8Array(32),
    isSpeaking: false,
    outputVolume: 0,
    error: null,
  });
  const [hudMode, setHudMode] = useState<VisualHUDMode>(visualExperienceEngine.mode);
  const [fitMode, setFitMode] = useState<FitMode>(interactionOrchestrator.fitMode);
  const [viewport, setViewport] = useState<ViewportInfo>(responsiveLayoutManager.viewport);
  const [isContextPanelOpen, setIsContextPanelOpen] = useState<boolean>(
    responsiveLayoutManager.isContextPanelOpen
  );
  const [permissions, setPermissions] = useState<DevicePermissions>({
    camera: 'prompt',
    microphone: 'prompt',
  });
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string>('DRIQ Live Intelligence · Ready');

  // Initialize service subscriptions and session
  useEffect(() => {
    // 1. Session Manager
    const unsubSession = liveSessionManager.subscribe((state) => {
      setSessionState(state);
    });

    // 2. Camera Controller
    const unsubCamera = cameraController.subscribe((cam) => {
      setCameraState(cam);
    });

    // 3. Audio Controller
    const unsubAudio = audioController.subscribe((aud) => {
      setAudioState(aud);
    });

    // 4. Visual Engine Mode
    const unsubVisual = visualExperienceEngine.subscribe((vState) => {
      setHudMode(vState.mode);
    });

    // 5. Layout Manager
    const unsubLayout = responsiveLayoutManager.subscribe((vp, panelOpen) => {
      setViewport(vp);
      setIsContextPanelOpen(panelOpen);
    });

    // 6. Interaction Orchestrator feedback
    const unsubOrchestrator = interactionOrchestrator.subscribe((action) => {
      setLastActionMessage(action);
      setFitMode(interactionOrchestrator.fitMode);
    });

    // Bootstrap hardware and session
    const bootstrap = async () => {
      await liveSessionManager.connect();
      const perms = await permissionManager.checkPermissions();
      setPermissions(perms);

      // Start camera feed (defaults to rear camera on mobile, webcam on desktop)
      await cameraController.startStream();
      // Initialize audio pipeline
      await audioController.startAudio();
    };

    bootstrap();

    return () => {
      unsubSession();
      unsubCamera();
      unsubAudio();
      unsubVisual();
      unsubLayout();
      unsubOrchestrator();
    };
  }, []);

  const handleCycleHudMode = () => {
    visualExperienceEngine.cycleMode();
  };

  const handleToggleFitMode = () => {
    const next = interactionOrchestrator.toggleFitMode();
    setFitMode(next);
  };

  const handleToggleContextPanel = () => {
    responsiveLayoutManager.toggleContextPanel();
  };

  const handleToggleMute = () => {
    interactionOrchestrator.toggleAudioMute();
  };

  const handleFlipCamera = () => {
    interactionOrchestrator.toggleCamera();
  };

  const handleToggleTorch = () => {
    cameraController.toggleTorch();
  };

  const handleTakeSnapshot = () => {
    interactionOrchestrator.takeSnapshot();
  };

  const handleGrantPermissions = async () => {
    await permissionManager.requestAll();
    const updated = await permissionManager.checkPermissions();
    setPermissions(updated);
    setShowPermissionModal(false);
    cameraController.startStream(cameraState.facingMode);
    audioController.startAudio();
  };

  const handleContinueSimulated = () => {
    cameraController.setSimulatedMode(true);
    setShowPermissionModal(false);
  };

  const handleSelectAnnotation = (ann: Annotation) => {
    setSelectedAnnotation(ann);
    groundingService.setHighlight(ann.id);
    visualExperienceEngine.clearAnnotations('callouts');
    visualExperienceEngine.showCallout({
      targetBox: ann.box,
      title: ann.label,
      status: ann.visible !== false ? 'verified' : 'warning',
      explanation: ann.description || ann.shortExplanation || 'Selected item',
      category: ann.category,
      meta: ann.attributes,
      placement: 'above',
    });
  };

  return (
    <div className="relative flex flex-col w-full h-dvh-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* 1. Header Bar */}
      <Header
        sessionState={sessionState}
        cameraState={cameraState}
        audioState={audioState}
        hudMode={hudMode}
        onCycleHudMode={handleCycleHudMode}
        isContextPanelOpen={isContextPanelOpen}
        onToggleContextPanel={handleToggleContextPanel}
        onToggleMute={handleToggleMute}
        onOpenShortcuts={() => setShowShortcutsModal(true)}
        lastActionMessage={lastActionMessage}
      />

      {/* 2. Main Responsive Stage */}
      <main className="relative flex-1 w-full h-full min-h-0 flex overflow-hidden">
        {/* Camera Viewport Canvas */}
        <div className="relative flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden">
          <CameraViewport
            cameraState={cameraState}
            hudMode={hudMode}
            fitMode={fitMode}
            onToggleFitMode={handleToggleFitMode}
            onSelectAnnotation={handleSelectAnnotation}
          />

          {/* Bottom Thumb Zone Floating Voice Controls */}
          <VoiceControlBar
            sessionState={sessionState}
            audioState={audioState}
            cameraState={cameraState}
            onFlipCamera={handleFlipCamera}
            onToggleTorch={handleToggleTorch}
            onToggleMute={handleToggleMute}
            onTakeSnapshot={handleTakeSnapshot}
          />
        </div>

        {/* Collapsible Context Panel (Desktop docked / Mobile drawer) */}
        <ContextPanel
          isOpen={isContextPanelOpen}
          onClose={() => responsiveLayoutManager.setContextPanelOpen(false)}
          viewport={viewport}
          cameraState={cameraState}
          audioState={audioState}
          sessionState={sessionState}
          fitMode={fitMode}
          selectedAnnotation={selectedAnnotation}
          onSelectAnnotation={handleSelectAnnotation}
        />
      </main>

      {/* 3. Helper Modals */}
      <ShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      <PermissionModal
        isOpen={showPermissionModal}
        permissions={permissions}
        onGrantAll={handleGrantPermissions}
        onContinueSimulated={handleContinueSimulated}
        onClose={() => setShowPermissionModal(false)}
      />
    </div>
  );
}
