import { DevicePermissions, IPermissionManager, PermissionStatus } from '../types';

export class PermissionManager implements IPermissionManager {
  private permissions: DevicePermissions = {
    camera: 'prompt',
    microphone: 'prompt',
  };

  async checkPermissions(): Promise<DevicePermissions> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return this.permissions;
    }

    try {
      // Permission API for camera
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      this.permissions.camera = (camStatus.state as PermissionStatus) || 'prompt';

      camStatus.onchange = () => {
        this.permissions.camera = camStatus.state as PermissionStatus;
      };
    } catch {
      // Camera query might fail in Safari or Firefox; remains 'prompt'
    }

    try {
      // Permission API for microphone
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.permissions.microphone = (micStatus.state as PermissionStatus) || 'prompt';

      micStatus.onchange = () => {
        this.permissions.microphone = micStatus.state as PermissionStatus;
      };
    } catch {
      // Microphone query fallback
    }

    return { ...this.permissions };
  }

  async requestCamera(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.permissions.camera = 'unsupported';
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      // Stop temporary track right after testing permission
      stream.getTracks().forEach((track) => track.stop());
      this.permissions.camera = 'granted';
      return true;
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.permissions.camera = 'denied';
      } else {
        this.permissions.camera = 'unsupported';
      }
      return false;
    }
  }

  async requestMicrophone(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.permissions.microphone = 'unsupported';
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      this.permissions.microphone = 'granted';
      return true;
    } catch (err) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.permissions.microphone = 'denied';
      } else {
        this.permissions.microphone = 'unsupported';
      }
      return false;
    }
  }

  async requestAll(): Promise<DevicePermissions> {
    await this.requestCamera();
    await this.requestMicrophone();
    return { ...this.permissions };
  }

  get currentPermissions(): DevicePermissions {
    return { ...this.permissions };
  }
}

export const permissionManager = new PermissionManager();
