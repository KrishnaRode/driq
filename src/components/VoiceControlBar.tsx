import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  SwitchCamera,
  Zap,
  ZapOff,
  Aperture,
  Radio,
  Square,
  Sparkles,
  Volume2,
  Globe,
} from 'lucide-react';
import { AudioState, CameraState, SessionState, SupportedLanguage } from '../types';
import { interactionOrchestrator } from '../services/InteractionOrchestrator';
import { audioController } from '../services/AudioController';
import { liveSessionManager } from '../services/LiveSessionManager';

interface VoiceControlBarProps {
  sessionState: SessionState;
  audioState: AudioState;
  cameraState: CameraState;
  onFlipCamera: () => void;
  onToggleTorch: () => void;
  onToggleMute: () => void;
  onTakeSnapshot: () => void;
}

export const VoiceControlBar: React.FC<VoiceControlBarProps> = ({
  sessionState,
  audioState,
  cameraState,
  onFlipCamera,
  onToggleTorch,
  onToggleMute,
  onTakeSnapshot,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const [isContinuous, setIsContinuous] = useState(interactionOrchestrator.isContinuous);
  const [lang, setLang] = useState<SupportedLanguage>(liveSessionManager.getLanguage());

  useEffect(() => {
    return liveSessionManager.subscribeLanguage(setLang);
  }, []);

  const handleCycleLanguage = () => {
    const cycle: Record<SupportedLanguage, SupportedLanguage> = {
      auto: 'mr',
      mr: 'en',
      en: 'hi',
      hi: 'auto',
    };
    const nextLang = cycle[lang] || 'auto';
    liveSessionManager.setLanguage(nextLang);
    audioController.synthesizeTestChime();
  };

  const isListening = sessionState === 'active_listening';
  const isSpeaking = sessionState === 'speaking';
  const isAnalyzing = sessionState === 'analyzing';

  // Toggle Continuous Hands-Free VAD vs Push-to-Talk
  const handleToggleContinuous = () => {
    const next = interactionOrchestrator.toggleContinuousMode();
    setIsContinuous(next);
  };

  // Intuitive Tap-to-Talk Toggle + Hold support
  const handleMicClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSpeaking) {
      audioController.stopPlayback();
      liveSessionManager.stopSpeakingVoice();
      return;
    }
    if (isListening) {
      interactionOrchestrator.stopVoiceInteraction();
    } else {
      await interactionOrchestrator.startVoiceInteraction();
    }
  };

  // Dynamic scale from live audio volume (RMS 0.0 - 1.0)
  const volumeScale = 1 + (isListening ? Math.min(0.6, audioState.inputVolume * 1.5) : 0);

  const getLangBadge = () => {
    switch (lang) {
      case 'mr':
        return { label: 'मराठी MR', flag: '🇮🇳' };
      case 'hi':
        return { label: 'हिंदी HI', flag: '🇮🇳' };
      case 'en':
        return { label: 'EN (Aoede)', flag: '🇬🇧' };
      default:
        return { label: 'Auto (MR/EN)', flag: '🌐' };
    }
  };

  const langBadge = getLangBadge();

  return (
    <div className="relative z-30 flex flex-col items-center justify-end pb-safe px-2 sm:px-4 pt-2 pointer-events-none bg-gradient-to-t from-neutral-950/95 via-neutral-950/50 to-transparent">
      {/* Dynamic Status / Interactive Hint Badge */}
      <div className="mb-2 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] font-mono shadow-md backdrop-blur-md pointer-events-auto animate-fade-in flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${
            isSpeaking
              ? 'bg-emerald-400 animate-pulse'
              : isListening
              ? 'bg-amber-400 animate-ping'
              : isAnalyzing
              ? 'bg-sky-400 animate-spin'
              : 'bg-emerald-400'
          }`}
        />
        <span className="text-neutral-300 font-sans">
          {isSpeaking
            ? (lang === 'mr' ? 'DRIQ बोलत आहे · थांबवण्यासाठी टॅप करा' : 'Aoede speaking · Tap mic to interrupt')
            : isListening
            ? (lang === 'mr' ? 'ऐकत आहे... (मराठी/English)' : 'Listening to you... (Tap mic to finish)')
            : isAnalyzing
            ? (lang === 'mr' ? 'विचार करत आहे...' : 'Analyzing question...')
            : isContinuous
            ? (lang === 'mr' ? 'हँड्स-फ्री व्हॉइस मोड सक्रिय' : 'Hands-free voice mode active')
            : (lang === 'mr' ? 'बोलण्यासाठी माइक टॅप करा (मराठी)' : 'Tap mic to talk to DRIQ')}
        </span>
      </div>

      {/* Floating Control Island */}
      <div className="flex items-center justify-center gap-1.5 xs:gap-2.5 sm:gap-4 p-1.5 xs:p-2 rounded-full bg-neutral-950/85 border border-neutral-800/80 backdrop-blur-md shadow-2xl pointer-events-auto">
        {/* 1. Camera Switch (Rear / Front) */}
        <button
          onClick={onFlipCamera}
          title="Switch Camera (C)"
          aria-label="Switch Camera (C)"
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-neutral-900/90 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 transition-all"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>

        {/* 2. Language Switcher (1-tap toggle for Marathi / English / Hindi) */}
        <button
          onClick={handleCycleLanguage}
          title={`Language: ${langBadge.label} (Tap to switch: मराठी / EN / Hindi / Auto)`}
          aria-label={`Language: ${langBadge.label}`}
          className="h-11 sm:h-12 px-2.5 sm:px-3 flex items-center justify-center gap-1.5 rounded-full bg-neutral-900/90 border border-neutral-700/80 hover:border-sky-400 text-neutral-200 hover:text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 transition-all"
        >
          <span className="text-sm">{langBadge.flag}</span>
          <span className="text-[11px] font-semibold tracking-tight">{langBadge.label}</span>
        </button>

        {/* 2. Continuous Hands-Free VAD vs Push-To-Talk Mode Toggle */}
        <button
          onClick={handleToggleContinuous}
          title={isContinuous ? 'Switch to Tap-To-Talk' : 'Switch to Continuous Hands-Free Dialogue'}
          aria-label={isContinuous ? 'Switch to Tap-To-Talk' : 'Switch to Continuous Hands-Free Dialogue'}
          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:ring-sky-400 transition-all ${
            isContinuous
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Radio className={`w-5 h-5 ${isContinuous ? 'animate-pulse text-sky-400' : ''}`} />
        </button>

        {/* 3. Primary Tactile Push-To-Talk / Speaking Mic Button */}
        <div className="relative flex items-center justify-center">
          {/* Animated concentric audio wave rings */}
          {isListening && (
            <>
              <div
                className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-400/20 border border-amber-400/40 animate-ping pointer-events-none"
                style={{ transform: `scale(${volumeScale})` }}
              />
              <div
                className="absolute w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-amber-400/30 blur-xs pointer-events-none transition-transform duration-75"
                style={{ transform: `scale(${volumeScale})` }}
              />
            </>
          )}

          {isSpeaking && (
            <div className="absolute w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-emerald-400/80 animate-ping pointer-events-none" />
          )}

          {isAnalyzing && (
            <div className="absolute w-18 h-18 sm:w-22 sm:h-22 rounded-full border-2 border-sky-400/60 border-t-transparent animate-spin pointer-events-none" />
          )}

          <button
            onClick={handleMicClick}
            title={
              isSpeaking
                ? 'Aoede is speaking (Tap to interrupt)'
                : isListening
                ? 'Listening to you... (Tap to finish)'
                : 'Tap to speak with DRIQ'
            }
            aria-label={
              isSpeaking
                ? 'Interrupt speech'
                : isListening
                ? 'Finish speaking'
                : 'Speak to DRIQ'
            }
            className={`relative z-10 w-16 h-16 sm:w-18 sm:h-18 rounded-full flex flex-col items-center justify-center shadow-lg focus-visible:ring-4 focus-visible:ring-sky-400 transition-transform active:scale-95 ${
              isSpeaking
                ? 'bg-gradient-to-b from-emerald-500 to-emerald-600 text-neutral-950 shadow-emerald-500/30 ring-4 ring-emerald-500/20'
                : isListening
                ? 'bg-gradient-to-b from-amber-400 to-amber-500 text-neutral-950 shadow-amber-500/30 ring-4 ring-amber-400/20'
                : isAnalyzing
                ? 'bg-sky-500 text-neutral-950 shadow-sky-500/20'
                : isContinuous
                ? 'bg-gradient-to-b from-sky-600 to-sky-700 text-white shadow-sky-500/20'
                : 'bg-gradient-to-b from-neutral-800 to-neutral-900 border border-neutral-700/80 text-white hover:border-sky-400/60 hover:text-sky-300'
            }`}
          >
            {isSpeaking ? (
              <Volume2 className="w-7 h-7 animate-pulse text-neutral-950" />
            ) : (
              <Mic className={`w-7 h-7 ${isListening ? 'animate-pulse text-neutral-950' : ''}`} />
            )}
          </button>
        </div>

        {/* 4. Snapshot / Visual Grounding Frame Grab */}
        <button
          onClick={onTakeSnapshot}
          title="Send camera frame snapshot to Gemini"
          aria-label="Send snapshot to Gemini"
          className="w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-neutral-900/90 border border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-sky-400 active:scale-95 transition-all"
        >
          <Aperture className="w-5 h-5 text-sky-400" />
        </button>

        {/* 5. Microphone Mute / Live State */}
        <button
          onClick={onToggleMute}
          title={audioState.isMuted ? 'Unmute microphone (M)' : 'Mute microphone (M)'}
          aria-label={audioState.isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:ring-sky-400 transition-all ${
            audioState.isMuted
              ? 'bg-rose-950/50 border-rose-800 text-rose-300'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800 active:scale-95'
          }`}
        >
          {audioState.isMuted ? <MicOff className="w-5 h-5 text-rose-400" /> : <Mic className="w-5 h-5 text-neutral-300" />}
        </button>
      </div>

      {/* Helpful Hint (Unobtrusive) */}
      <div className="mt-2 text-center flex items-center justify-center gap-2">
        <span className="text-[11px] font-mono text-neutral-400">
          {isSpeaking ? (
            <span className="text-emerald-400 font-medium">Aoede speaking · Tap mic to barge in</span>
          ) : isContinuous ? (
            <span className="text-sky-400">Hands-Free Active · Speak naturally</span>
          ) : (
            <>
              Hold to talk · Press <kbd className="px-1 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">Space</kbd>
            </>
          )}
        </span>
      </div>
    </div>
  );
};
