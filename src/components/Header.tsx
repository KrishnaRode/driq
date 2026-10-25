import React from 'react';
import {
  Camera,
  Maximize2,
  Minimize2,
  Sliders,
  Sparkles,
  Volume2,
  VolumeX,
  Keyboard,
  SidebarClose,
  SidebarOpen,
  RefreshCw,
  Radio,
} from 'lucide-react';
import { AudioState, CameraState, SessionState, SupportedLanguage, VisualHUDMode } from '../types';
import { liveSessionManager } from '../services/LiveSessionManager';

interface HeaderProps {
  sessionState: SessionState;
  cameraState: CameraState;
  audioState: AudioState;
  hudMode: VisualHUDMode;
  onCycleHudMode: () => void;
  isContextPanelOpen: boolean;
  onToggleContextPanel: () => void;
  onToggleMute: () => void;
  onOpenShortcuts: () => void;
  lastActionMessage?: string;
}

export const Header: React.FC<HeaderProps> = ({
  sessionState,
  cameraState,
  audioState,
  hudMode,
  onCycleHudMode,
  isContextPanelOpen,
  onToggleContextPanel,
  onToggleMute,
  onOpenShortcuts,
  lastActionMessage,
}) => {
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [lang, setLang] = React.useState<SupportedLanguage>(liveSessionManager.getLanguage());

  React.useEffect(() => {
    return liveSessionManager.subscribeLanguage(setLang);
  }, []);

  const handleCycleLanguage = () => {
    const cycle: Record<SupportedLanguage, SupportedLanguage> = {
      auto: 'mr',
      mr: 'en',
      en: 'hi',
      hi: 'auto',
    };
    liveSessionManager.setLanguage(cycle[lang] || 'auto');
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const getStatusBadge = () => {
    switch (sessionState) {
      case 'speaking':
        return {
          text: 'Aoede Speaking',
          dotClass: 'bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse',
          textColor: 'text-emerald-300',
        };
      case 'active_listening':
        return {
          text: 'Listening...',
          dotClass: 'bg-amber-400 ring-4 ring-amber-400/30 animate-pulse',
          textColor: 'text-amber-300',
        };
      case 'analyzing':
        return {
          text: 'Thinking...',
          dotClass: 'bg-sky-400 ring-4 ring-sky-400/30 animate-pulse',
          textColor: 'text-sky-300',
        };
      case 'ready':
        return {
          text: 'Live Ready (Aoede)',
          dotClass: 'bg-emerald-400',
          textColor: 'text-neutral-200',
        };
      case 'initializing':
        return {
          text: 'Connecting Live...',
          dotClass: 'bg-sky-400 animate-spin',
          textColor: 'text-neutral-300',
        };
      case 'error':
      case 'disconnected':
        return {
          text: 'Live Disconnected',
          dotClass: 'bg-rose-400',
          textColor: 'text-rose-300',
        };
      default:
        return {
          text: 'Standby',
          dotClass: 'bg-neutral-500',
          textColor: 'text-neutral-400',
        };
    }
  };

  const status = getStatusBadge();

  return (
    <header className="relative z-30 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 pt-safe bg-gradient-to-b from-neutral-950/90 via-neutral-950/50 to-transparent backdrop-blur-xs select-none">
      {/* Zone 1: DRIQ Brand & Live State */}
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            DRIQ
          </span>
          <span className="hidden sm:inline-block text-xs font-normal text-neutral-400">
            See. Ask. Understand.
          </span>
        </div>

        {/* Live Session Status Indicator */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-800 text-xs">
          <span className={`w-2 h-2 rounded-full ${status.dotClass}`} aria-hidden="true" />
          <span className={`font-medium tracking-wide ${status.textColor}`}>
            {status.text}
          </span>

          {(sessionState === 'disconnected' || sessionState === 'error') && (
            <button
              onClick={() => liveSessionManager.connect()}
              className="flex items-center gap-1 text-[11px] font-mono text-sky-400 hover:text-sky-300 underline ml-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reconnect</span>
            </button>
          )}

          {cameraState.isSimulated && (
            <span className="hidden md:inline-block text-[10px] font-mono text-amber-300/90 bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-800/40">
              SIMULATED STREAM
            </span>
          )}
        </div>
      </div>

      {/* Middle contextual message display */}
      {lastActionMessage && (
        <div className="hidden lg:flex items-center text-xs font-mono text-neutral-400 max-w-xs truncate animate-fade-in">
          <span>{lastActionMessage}</span>
        </div>
      )}

      {/* Zone 3: Interactive Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* HUD Mode Switcher */}
        <button
          onClick={onCycleHudMode}
          title={`HUD Mode: ${hudMode} (Press V)`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden xs:inline uppercase">{hudMode}</span>
        </button>

        {/* Language Quick Selector */}
        <button
          onClick={handleCycleLanguage}
          title={`Language: ${lang === 'mr' ? 'मराठी' : lang === 'hi' ? 'हिंदी' : lang === 'en' ? 'English' : 'Auto'} (Tap to switch)`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/70 text-neutral-200 hover:text-white transition-colors"
        >
          <span className="text-xs">
            {lang === 'mr' ? '🇮🇳 मराठी' : lang === 'hi' ? '🇮🇳 हिंदी' : lang === 'en' ? '🇬🇧 EN' : '🌐 Auto'}
          </span>
        </button>

        {/* Audio Mute quick toggle */}
        <button
          onClick={onToggleMute}
          title={audioState.isMuted ? 'Unmute Mic (M)' : 'Mute Mic (M)'}
          className={`p-2 rounded-lg border transition-colors ${
            audioState.isMuted
              ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
              : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:text-white'
          }`}
        >
          {audioState.isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-neutral-300" />
          )}
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts & gestures"
          className="hidden sm:flex p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          title="Toggle Fullscreen"
          className="hidden sm:flex p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Context Panel Toggle */}
        <button
          onClick={onToggleContextPanel}
          title="Toggle Context Panel (P)"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
            isContextPanelOpen
              ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-200 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          {isContextPanelOpen ? (
            <SidebarClose className="w-3.5 h-3.5" />
          ) : (
            <SidebarOpen className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Panel</span>
        </button>
      </div>
    </header>
  );
};
