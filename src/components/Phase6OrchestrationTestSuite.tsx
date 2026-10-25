/**
 * DRIQ — Phase 6 Voice and Visual Orchestration Test Suite
 *
 * Verifies the end-to-end integration between Gemini Live reasoning and DRIQ's
 * graphical intelligence layer:
 * 1. Official tool calling (highlightObject, highlightComponent, showCallout, drawConnector, showSteps, clearAnnotations)
 * 2. Grounding data resolution against verified camera coordinates
 * 3. Occlusion/Uncertainty guard (refuses false highlights for obscured components like reset pinhole)
 * 4. Interruption / barge-in cancellation and audio silencing
 * 5. Responsive transformation during rotation & resizing
 * 6. Material scene-shift invalidation
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Target,
  EyeOff,
  RefreshCw,
  Compass,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { interactionOrchestrator } from '../services/InteractionOrchestrator';
import { groundingService } from '../services/GroundingService';
import { liveSessionManager } from '../services/LiveSessionManager';
import { visualExperienceEngine } from '../services/VisualExperienceEngine';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  details: any;
}

export const Phase6OrchestrationTestSuite: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [lastLog, setLastLog] = useState<string>('Select a test scenario or run all checks.');

  const runSingleTest = async (testId: 'wan' | 'reset' | 'interrupt' | 'rotate' | 'shift') => {
    setIsRunning(true);
    setActiveTestId(testId);
    setLastLog(`Running test: ${testId}...`);

    try {
      const res = await interactionOrchestrator.runPhase6Test(testId);
      setTestResults((prev) => ({ ...prev, [testId]: res }));
      setLastLog(res.message);
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [testId]: {
          id: testId,
          name: testId,
          passed: false,
          message: `Execution error: ${err?.message}`,
          details: err,
        },
      }));
      setLastLog(`Error running test ${testId}: ${err?.message}`);
    } finally {
      setIsRunning(false);
      setActiveTestId(null);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setLastLog('Executing Phase 6 Voice & Visual Verification Suite...');
    const results: Record<string, TestResult> = {};

    const tests: Array<'wan' | 'reset' | 'interrupt' | 'rotate' | 'shift'> = [
      'wan',
      'reset',
      'interrupt',
      'rotate',
      'shift',
    ];

    for (const t of tests) {
      setActiveTestId(t);
      try {
        const res = await interactionOrchestrator.runPhase6Test(t);
        results[t] = res;
        setTestResults({ ...results });
      } catch (err: any) {
        results[t] = {
          id: t,
          name: t,
          passed: false,
          message: err?.message || 'Failed',
          details: err,
        };
        setTestResults({ ...results });
      }
      // Brief pause between tests for visual inspection
      await new Promise((r) => setTimeout(r, 250));
    }

    setIsRunning(false);
    setActiveTestId(null);
    const passCount = Object.values(results).filter((r) => r.passed).length;
    setLastLog(`Verification complete: ${passCount}/5 test scenarios passed.`);
  };

  const clearAllHighlights = () => {
    visualExperienceEngine.clearAnnotations('all');
    setLastLog('All active visual annotations cleared.');
  };

  const testDefinitions = [
    {
      id: 'wan' as const,
      name: '1. Identify & Highlight WAN Port',
      desc: 'Simulates inquiry "Where is the WAN port?". Dispatches highlightComponent tool call, verifies precision contour on WAN port [460, 180, 710, 310], and returns execution confirmation.',
      icon: Target,
      color: 'text-sky-400',
    },
    {
      id: 'reset' as const,
      name: '2. Obscured Reset Button (Verbal Only)',
      desc: 'Simulates follow-up "Where is the factory reset pinhole?". Confirms that because component is recessed/obscured (visible: false), the engine REFUSES false box and provides verbal guidance.',
      icon: EyeOff,
      color: 'text-amber-400',
    },
    {
      id: 'interrupt' as const,
      name: '3. Interruption & Audio Stop (Barge-In)',
      desc: 'Simulates user barge-in mid-explanation: verifies instantaneous audio cutoff, callout dismissal, and pending tool cancellation.',
      icon: VolumeX,
      color: 'text-rose-400',
    },
    {
      id: 'rotate' as const,
      name: '4. Device Rotation & Viewport Resize',
      desc: 'Simulates device rotation from landscape (800×400) to portrait (400×800) during active highlight. Confirms VideoGeometryMapper preserves normalized coordinates without drift.',
      icon: Compass,
      color: 'text-emerald-400',
    },
    {
      id: 'shift' as const,
      name: '5. Camera Movement / Scene Shift',
      desc: 'Simulates moving camera to another physical object: confirms material scene delta (>0.22) automatically invalidates outdated annotations rather than letting them drift.',
      icon: RefreshCw,
      color: 'text-indigo-400',
    },
  ];

  const totalPassed = Object.values(testResults).filter((r) => r.passed).length;

  return (
    <div className="space-y-3 font-sans">
      {/* Header Banner */}
      <div className="p-3 bg-gradient-to-r from-sky-950/40 via-neutral-900 to-indigo-950/30 border border-sky-800/40 rounded-xl space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-semibold text-white tracking-tight">
              Phase 6: Voice & Visual Orchestration
            </h4>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-sky-950 border border-sky-800 text-[10px] font-mono text-sky-300 font-medium">
            LIVE TOOLS
          </span>
        </div>
        <p className="text-[11px] text-neutral-300 leading-snug">
          Validates official Gemini Live tool calling (<code className="text-sky-300 font-mono text-[10px]">highlightComponent</code>, <code className="text-sky-300 font-mono text-[10px]">showCallout</code>), occlusion guards, barge-in synchronization, and responsive geometry.
        </p>

        {/* Global Action Bar */}
        <div className="pt-2 flex items-center gap-2 border-t border-neutral-800">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-all shadow-md shadow-sky-950"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying {activeTestId ? `[${activeTestId}]` : '...'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run All 5 Orchestration Checks</span>
              </>
            )}
          </button>
          <button
            onClick={clearAllHighlights}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
            title="Clear active annotations"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Test Scenarios List */}
      <div className="space-y-2">
        {testDefinitions.map((test) => {
          const result = testResults[test.id];
          const isCurrent = activeTestId === test.id;
          const Icon = test.icon;

          return (
            <div
              key={test.id}
              className={`p-3 rounded-xl border transition-all ${
                result
                  ? result.passed
                    ? 'bg-emerald-950/20 border-emerald-800/40'
                    : 'bg-rose-950/20 border-rose-800/40'
                  : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className={`p-1.5 rounded-lg bg-neutral-950 border border-neutral-800 mt-0.5 ${test.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-100">{test.name}</span>
                      {result && (
                        <span
                          className={`flex items-center gap-1 text-[10px] font-mono font-medium px-1.5 py-0.2 rounded ${
                            result.passed
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-rose-950 text-rose-400 border border-rose-800'
                          }`}
                        >
                          {result.passed ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              PASSED
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              FAILED
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-snug">{test.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => runSingleTest(test.id)}
                  disabled={isRunning}
                  className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 text-[11px] rounded font-medium shrink-0 flex items-center gap-1 transition-colors"
                >
                  {isCurrent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-current" />}
                  <span>Test</span>
                </button>
              </div>

              {/* Detail Output if tested */}
              {result && (
                <div className="mt-2.5 p-2 rounded-lg bg-neutral-950 border border-neutral-850 font-mono text-[10px] text-neutral-300 space-y-1">
                  <p className={result.passed ? 'text-emerald-300' : 'text-rose-300'}>
                    {result.passed ? '✓' : '✗'} {result.message}
                  </p>
                  {result.details?.confirmedBox && (
                    <div className="text-neutral-400 text-[9px]">
                      Confirmed Box: [{result.details.confirmedBox.join(', ')}]
                    </div>
                  )}
                  {result.details?.uncertaintyReason && (
                    <div className="text-amber-400 text-[9px]">
                      Uncertainty Guard: {result.details.uncertaintyReason}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Tool Execution History */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-200">Tool Execution History</span>
          <span className="font-mono text-[10px] text-neutral-400">
            {interactionOrchestrator.getActionHistory().length} actions recorded
          </span>
        </div>

        {interactionOrchestrator.getActionHistory().length === 0 ? (
          <p className="text-[11px] text-neutral-500 italic">No tool calls executed in this session yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {interactionOrchestrator.getActionHistory().slice(0, 6).map((item, idx) => (
              <div
                key={`${item.callId}_${idx}`}
                className="p-1.5 rounded bg-neutral-900 border border-neutral-850 flex items-center justify-between text-[10px] font-mono"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className={item.success ? 'text-emerald-400' : 'text-amber-400'}>
                    {item.success ? '●' : '▲'}
                  </span>
                  <span className="font-semibold text-neutral-200 truncate">{item.name}</span>
                  {item.componentId && <span className="text-neutral-400 truncate">({item.componentId})</span>}
                </div>
                <span className="text-neutral-500 shrink-0">
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Telemetry Status Bar */}
      <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-[11px]">
        <span className="text-neutral-400 truncate">Status: {lastLog}</span>
        <span className="font-mono text-[10px] text-sky-400 font-semibold shrink-0">
          {totalPassed}/5 VERIFIED
        </span>
      </div>
    </div>
  );
};
