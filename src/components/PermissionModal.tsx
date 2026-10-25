import React from 'react';
import { Camera, Mic, ShieldCheck, X } from 'lucide-react';
import { DevicePermissions } from '../types';

interface PermissionModalProps {
  isOpen: boolean;
  permissions: DevicePermissions;
  onGrantAll: () => void;
  onContinueSimulated: () => void;
  onClose: () => void;
}

export const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  permissions,
  onGrantAll,
  onContinueSimulated,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-semibold text-white">Device Permissions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-neutral-300 leading-relaxed">
          DRIQ uses your device camera to inspect physical objects and your microphone to enable natural spoken dialogue.
        </p>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 text-xs">
            <div className="flex items-center gap-3">
              <Camera className="w-4 h-4 text-sky-400" />
              <div>
                <div className="font-medium text-white">Camera Feed</div>
                <div className="text-[11px] text-neutral-400">Object inspection and visual grounding</div>
              </div>
            </div>
            <span
              className={`text-[11px] font-mono capitalize ${
                permissions.camera === 'granted' ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
              }`}
            >
              {permissions.camera}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/80 border border-neutral-800 text-xs">
            <div className="flex items-center gap-3">
              <Mic className="w-4 h-4 text-amber-400" />
              <div>
                <div className="font-medium text-white">Microphone Input</div>
                <div className="text-[11px] text-neutral-400">Natural voice questions & conversation</div>
              </div>
            </div>
            <span
              className={`text-[11px] font-mono capitalize ${
                permissions.microphone === 'granted' ? 'text-emerald-400 font-semibold' : 'text-neutral-400'
              }`}
            >
              {permissions.microphone}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
          <button
            onClick={onGrantAll}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 transition-colors"
          >
            Enable Camera & Microphone
          </button>
          <button
            onClick={onContinueSimulated}
            className="w-full py-2 text-xs font-medium rounded-lg text-neutral-400 hover:text-white transition-colors"
          >
            Continue with DRIQ Test Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
