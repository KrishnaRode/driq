/**
 * DRIQ — Developer Overlay Test Suite (Phase 5)
 *
 * Interactive development-only verification suite for the Visual Experience Engine.
 * Allows instant verification of all 6 graphical actions across mobile, tablet, and desktop:
 * 1. highlightObject
 * 2. highlightComponent
 * 3. showCallout (Adaptive placement)
 * 4. drawConnector (Elbow & Bezier)
 * 5. showSteps (Interactive 3-step sequence)
 * 6. clearAnnotations
 *
 * NOTE: Strictly labeled as DEV BENCHMARK — never masquerades as live Gemini recognition.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Box,
  Target,
  MessageSquare,
  GitCommit,
  ListOrdered,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  Info,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
} from 'lucide-react';
import { visualExperienceEngine } from '../services/VisualExperienceEngine';
import { VisualEngineState } from '../types';

interface DevOverlayTestSuiteProps {
  onClose?: () => void;
}

export const DevOverlayTestSuite: React.FC<DevOverlayTestSuiteProps> = ({ onClose }) => {
  const [visualState, setVisualState] = useState<VisualEngineState>(visualExperienceEngine.getState());
  const [lastActionStatus, setLastActionStatus] = useState<string>('Ready for benchmark testing');

  useEffect(() => {
    return visualExperienceEngine.subscribe((state) => {
      setVisualState(state);
    });
  }, []);

  // Action 1: highlightObject
  const testHighlightObject = () => {
    visualExperienceEngine.clearAnnotations('objects');
    visualExperienceEngine.highlightObject(
      'dev_obj_demo',
      [240, 200, 760, 800],
      'Network Gateway Device',
      '#38bdf8'
    );
    setLastActionStatus('Action 1: highlightObject executed (Box [240, 200, 760, 800])');
  };

  // Action 2: highlightComponent
  const testHighlightComponent = () => {
    visualExperienceEngine.highlightComponent(
      'dev_cmp_wan',
      [440, 280, 560, 400],
      'WAN Uplink 2.5G Port',
      '#06b6d4'
    );
    visualExperienceEngine.highlightComponent(
      'dev_cmp_pwr',
      [450, 680, 550, 760],
      '12V DC Input Jack',
      '#f59e0b'
    );
    setLastActionStatus('Action 2: highlightComponent executed (2 precision components highlighted)');
  };

  // Action 3: showCallout with adaptive placement
  const testShowCallout = (placement: 'above' | 'below' | 'left' | 'right' | 'compact') => {
    visualExperienceEngine.clearAnnotations('callouts');
    visualExperienceEngine.showCallout({
      targetBox: [440, 280, 560, 400],
      title: 'WAN Uplink 2.5G Port',
      status: 'action_needed',
      explanation: 'Connect the blue Category 6 cable from your fiber ONT to establish the WAN handshake.',
      category: 'Ethernet',
      meta: { Speed: '2500 Mbps', Link: 'Negotiating' },
      placement,
    });
    setLastActionStatus(`Action 3: showCallout executed (Placement: ${placement})`);
  };

  // Action 4: drawConnector
  const testDrawConnector = () => {
    visualExperienceEngine.clearAnnotations('connectors');
    // Approximate screen coordinates for demo
    visualExperienceEngine.drawConnector(
      { x: 340, y: 320 },
      { x: 340, y: 220 },
      'elbow',
      '#38bdf8'
    );
    setLastActionStatus('Action 4: drawConnector executed (Elbow line from component to card)');
  };

  // Action 5: showSteps
  const testShowSteps = () => {
    visualExperienceEngine.showSteps([
      {
        targetBox: [440, 280, 560, 400],
        title: 'Step 1: Connect WAN Uplink',
        instruction: 'Firmly insert the blue Ethernet patch cable into the 2.5Gbps WAN socket.',
        status: 'current',
        actionPrompt: 'Awaiting physical connection',
      },
      {
        targetBox: [450, 680, 550, 760],
        title: 'Step 2: Connect Power Cable',
        instruction: 'Insert the 12V 2.5A barrel adapter plug into the rear power terminal.',
        status: 'pending',
        actionPrompt: 'Insert DC barrel',
      },
      {
        targetBox: [280, 470, 340, 530],
        title: 'Step 3: Confirm Status LED',
        instruction: 'Wait for the front indicator LED to illuminate solid cyan.',
        status: 'pending',
        actionPrompt: 'Observe front panel',
      },
    ], 0);
    setLastActionStatus('Action 5: showSteps executed (3-step interactive hardware guide)');
  };

  // Action 6: clearAnnotations
  const testClearAll = () => {
    visualExperienceEngine.clearAnnotations('all');
    visualExperienceEngine.disableDevOverlayTest();
    setLastActionStatus('Action 6: clearAnnotations executed (All overlays reset)');
  };

  return (
    <div className="space-y-4 text-xs font-mono">
      {/* Dev Warning Notice */}
      <div className="p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-200">
        <div className="flex items-center gap-2 mb-1 text-[11px] font-semibold text-sky-400">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>PHASE 5 VISUAL EXPERIENCE ENGINE BENCHMARK</span>
        </div>
        <p className="text-[11px] text-neutral-300 font-sans leading-relaxed">
          Synthetic coordinate harness to verify all 6 visual actions, collision avoidance, and responsive SVG viewBox geometry.
        </p>
      </div>

      {/* Benchmark Presets (Full Scenarios) */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
          Complete Benchmark Scenarios
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              visualExperienceEngine.enableDevOverlayTest('router_setup');
              setLastActionStatus('Loaded: Router Setup Scenario (Object + 3 Ports + Callout + Steps)');
            }}
            className={`p-2 rounded-lg border text-left transition-all ${
              visualState.isDevOverlayMode && visualState.devScenarioName === 'router_setup'
                ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                : 'bg-neutral-900 hover:bg-neutral-800/90 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="font-semibold text-white">Router Setup</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">WAN port & 3-step guide</div>
          </button>

          <button
            onClick={() => {
              visualExperienceEngine.enableDevOverlayTest('mouse_sensor');
              setLastActionStatus('Loaded: Optical Mouse Inspection Scenario');
            }}
            className={`p-2 rounded-lg border text-left transition-all ${
              visualState.isDevOverlayMode && visualState.devScenarioName === 'mouse_sensor'
                ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                : 'bg-neutral-900 hover:bg-neutral-800/90 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="font-semibold text-white">Mouse Sensor</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">Optical aperture & DPI card</div>
          </button>

          <button
            onClick={() => {
              visualExperienceEngine.enableDevOverlayTest('keyboard_matrix');
              setLastActionStatus('Loaded: Mechanical Keyboard Scenario');
            }}
            className={`p-2 rounded-lg border text-left transition-all ${
              visualState.isDevOverlayMode && visualState.devScenarioName === 'keyboard_matrix'
                ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                : 'bg-neutral-900 hover:bg-neutral-800/90 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="font-semibold text-white">Keyboard Matrix</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">USB-C socket & Esc key</div>
          </button>

          <button
            onClick={() => {
              visualExperienceEngine.enableDevOverlayTest('interactive_steps');
              setLastActionStatus('Loaded: Interactive Steps Scenario (Pin Reset Tutorial)');
            }}
            className={`p-2 rounded-lg border text-left transition-all ${
              visualState.isDevOverlayMode && visualState.devScenarioName === 'interactive_steps'
                ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
                : 'bg-neutral-900 hover:bg-neutral-800/90 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="font-semibold text-white">Interactive Steps</div>
            <div className="text-[10px] text-neutral-400 mt-0.5">3-step factory reset flow</div>
          </button>
        </div>
      </div>

      {/* Individual Action Triggers (1 to 6) */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider">
          Individual Graphical Actions
        </div>
        <div className="space-y-1.5">
          {/* Action 1 */}
          <button
            onClick={testHighlightObject}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-200 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Box className="w-3.5 h-3.5 text-sky-400" />
              <span>1. highlightObject()</span>
            </div>
            <span className="text-[10px] text-neutral-400">Contour outline</span>
          </button>

          {/* Action 2 */}
          <button
            onClick={testHighlightComponent}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-200 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. highlightComponent()</span>
            </div>
            <span className="text-[10px] text-neutral-400">Precision reticles</span>
          </button>

          {/* Action 3: Placement Variations */}
          <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-neutral-300 font-semibold">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>3. showCallout() Adaptive Placements:</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {(['above', 'below', 'left', 'right'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => testShowCallout(dir)}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[10px] capitalize text-center transition-colors"
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Action 4 */}
          <button
            onClick={testDrawConnector}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-200 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <GitCommit className="w-3.5 h-3.5 text-sky-400" />
              <span>4. drawConnector()</span>
            </div>
            <span className="text-[10px] text-neutral-400">Elbow / Bezier path</span>
          </button>

          {/* Action 5 */}
          <button
            onClick={testShowSteps}
            className="w-full flex items-center justify-between px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-200 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <ListOrdered className="w-3.5 h-3.5 text-emerald-400" />
              <span>5. showSteps()</span>
            </div>
            <span className="text-[10px] text-neutral-400">Sequential wizard</span>
          </button>

          {/* Action 6 */}
          <button
            onClick={testClearAll}
            className="w-full flex items-center justify-between px-3 py-2 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-900/60 rounded-lg text-rose-200 text-xs transition-colors"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>6. clearAnnotations()</span>
            </div>
            <span className="text-[10px] text-rose-400/80">Animated reset</span>
          </button>
        </div>
      </div>

      {/* Step Navigation Controls if steps are active */}
      {visualState.activeSteps.length > 0 && (
        <div className="p-3 bg-neutral-900/90 border border-neutral-800 rounded-lg space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white font-semibold">Active Step Wizard</span>
            <span className="text-neutral-400">
              Step {visualState.currentStepIndex + 1} of {visualState.activeSteps.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => visualExperienceEngine.prevStep()}
              disabled={visualState.currentStepIndex === 0}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 rounded text-xs transition-colors"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Prev Step</span>
            </button>
            <button
              onClick={() => visualExperienceEngine.nextStep()}
              disabled={visualState.currentStepIndex >= visualState.activeSteps.length - 1}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded text-xs transition-colors"
            >
              <span>Next Step</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Active Engine State Telemetry */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-1.5 text-[11px] text-neutral-400">
        <div className="text-white font-semibold flex items-center justify-between">
          <span>Engine Telemetry</span>
          {visualState.isDevOverlayMode && (
            <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-[10px] text-sky-400 font-mono">
              DEV MODE
            </span>
          )}
        </div>
        <div className="flex justify-between">
          <span>Object Highlights:</span>
          <span className="text-neutral-200 font-mono">{visualState.objectHighlights.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Component Highlights:</span>
          <span className="text-neutral-200 font-mono">{visualState.componentHighlights.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Callout Cards:</span>
          <span className="text-neutral-200 font-mono">{visualState.callouts.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Connector Lines:</span>
          <span className="text-neutral-200 font-mono">{visualState.connectors.length}</span>
        </div>
        <div className="flex justify-between">
          <span>Step Sequence:</span>
          <span className="text-neutral-200 font-mono">
            {visualState.activeSteps.length > 0 ? `${visualState.currentStepIndex + 1}/${visualState.activeSteps.length}` : 'None'}
          </span>
        </div>
        <div className="pt-1 border-t border-neutral-850 text-[10px] text-neutral-400 truncate">
          Status: {lastActionStatus}
        </div>
      </div>
    </div>
  );
};
