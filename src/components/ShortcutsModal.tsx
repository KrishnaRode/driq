import React from 'react';
import { X, Keyboard, MousePointer, Mic, Camera } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Hold to talk / Push-to-talk voice prompt', action: 'Voice' },
    { key: 'C', desc: 'Switch camera between front and rear', action: 'Camera' },
    { key: 'M', desc: 'Toggle microphone mute/unmute', action: 'Audio' },
    { key: 'P', desc: 'Toggle context and intelligence panel', action: 'Panel' },
    { key: 'V', desc: 'Cycle HUD visual mode (Precision, Minimal, Inspector, Grid)', action: 'HUD' },
    { key: 'B', desc: 'Toggle Phase 5 Visual Engine Benchmark Overlay', action: 'Visual' },
    { key: 'Esc', desc: 'Clear active annotations and exit overlay test', action: 'Visual' },
    { key: 'T', desc: 'Toggle camera torch / flashlight (if supported)', action: 'Camera' },
    { key: 'F', desc: 'Toggle fitting mode (Cover vs Contain)', action: 'Geometry' },
    { key: 'Tap Viewport', desc: 'Touch or click any object on screen to focus & inspect', action: 'Vision' },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">Interaction & Keyboard Controls</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          DRIQ is engineered for seamless hands-free, tactile, and keyboard navigation across mobile, tablet, and desktop devices.
        </p>

        <div className="space-y-2">
          {shortcuts.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 text-xs"
            >
              <div className="flex items-center gap-3">
                <kbd className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700 font-mono text-neutral-200 font-semibold shadow-xs">
                  {item.key}
                </kbd>
                <span className="text-neutral-300">{item.desc}</span>
              </div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                {item.action}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-neutral-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
