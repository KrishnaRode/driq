import { FrameSamplingStats, IFrameSampler, SampledFrame } from '../types';

export class FrameSampler implements IFrameSampler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private samplingIntervalId: number | null = null;
  private isSampling = false;
  private sampleCount = 0;
  private lastSampleTime: number | null = null;
  private sampleIntervals: number[] = [];
  private onSampleCallback: ((frame: SampledFrame) => void) | null = null;
  private lastFingerprint: number[] | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Captures an on-demand high-resolution frame independently of the displayed preview.
   * Clamps dimensions to maxDimension (default 1280) to preserve memory and network efficiency.
   * Assigns a distinct frameId and calculates a 16-cell luminance fingerprint for scene-change detection.
   */
  captureFrame(
    video: HTMLVideoElement,
    quality = 0.85,
    maxDimension = 1280,
    format: 'image/jpeg' | 'image/webp' = 'image/jpeg'
  ): SampledFrame | null {
    if (!video || video.readyState < 2) {
      return null;
    }

    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;

    let targetW = vw;
    let targetH = vh;

    // Aspect-ratio-preserving downscale if exceeding maxDimension
    if (vw > maxDimension || vh > maxDimension) {
      if (vw > vh) {
        targetW = maxDimension;
        targetH = Math.round((vh / vw) * maxDimension);
      } else {
        targetH = maxDimension;
        targetW = Math.round((vw / vh) * maxDimension);
      }
    }

    this.canvas.width = targetW;
    this.canvas.height = targetH;

    if (!this.ctx) return null;

    // Draw directly from video source stream (offscreen, independent of preview DOM)
    this.ctx.drawImage(video, 0, 0, targetW, targetH);

    const dataUrl = this.canvas.toDataURL(format, quality);
    const frameId = `frm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fingerprint = this.computeFingerprint(this.ctx, targetW, targetH);
    this.lastFingerprint = fingerprint;

    return {
      id: frameId,
      dataUrl,
      width: targetW,
      height: targetH,
      timestamp: Date.now(),
      format,
      fingerprint,
    };
  }

  /**
   * Computes a fast, lightweight 16-cell (4x4) average luminance fingerprint.
   * Enables conservative scene-change detection without heavy CV models.
   */
  private computeFingerprint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number[] {
    const fp: number[] = [];
    const cellW = Math.max(1, Math.floor(width / 4));
    const cellH = Math.max(1, Math.floor(height / 4));

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const d = imgData.data;

      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          let sum = 0;
          let count = 0;
          const startX = c * cellW;
          const startY = r * cellH;

          // Stride of 8px for microsecond execution
          for (let y = startY; y < Math.min(height, startY + cellH); y += 8) {
            for (let x = startX; x < Math.min(width, startX + cellW); x += 8) {
              const idx = (y * width + x) * 4;
              const lum = 0.299 * d[idx] + 0.587 * d[idx + 1] + 0.114 * d[idx + 2];
              sum += lum;
              count++;
            }
          }
          fp.push(count > 0 ? Math.round(sum / count) : 128);
        }
      }
    } catch {
      return new Array(16).fill(128);
    }
    return fp;
  }

  /**
   * Measures visual delta between two frame fingerprints (0.0 to 1.0).
   * A value > 0.22 indicates a material scene shift (camera moved or major object displaced).
   */
  computeSceneDelta(fp1?: number[], fp2?: number[]): number {
    if (!fp1 || !fp2 || fp1.length !== fp2.length) return 1.0;
    let totalDelta = 0;
    for (let i = 0; i < fp1.length; i++) {
      totalDelta += Math.abs(fp1[i] - fp2[i]) / 255;
    }
    return totalDelta / fp1.length;
  }

  getLastFingerprint(): number[] | null {
    return this.lastFingerprint;
  }

  /**
   * Starts periodic AI frame sampling.
   * Capped at 1 FPS maximum (minimum 1000ms delta).
   */
  startAiSampling(
    video: HTMLVideoElement,
    onSample: (frame: SampledFrame) => void,
    intervalMs = 1000
  ): void {
    this.stopAiSampling();

    const enforcedInterval = Math.max(1000, intervalMs);

    this.isSampling = true;
    this.onSampleCallback = onSample;
    this.lastSampleTime = null;
    this.sampleCount = 0;
    this.sampleIntervals = [];

    const initialFrame = this.captureFrame(video);
    if (initialFrame) {
      this.sampleCount++;
      this.lastSampleTime = Date.now();
      onSample(initialFrame);
    }

    this.samplingIntervalId = window.setInterval(() => {
      if (!this.isSampling || !video || video.readyState < 2) return;

      const now = Date.now();
      if (this.lastSampleTime && now - this.lastSampleTime < 950) {
        return;
      }

      if (this.lastSampleTime) {
        const delta = now - this.lastSampleTime;
        this.sampleIntervals.push(delta);
        if (this.sampleIntervals.length > 10) this.sampleIntervals.shift();
      }

      this.lastSampleTime = now;
      this.sampleCount++;

      const frame = this.captureFrame(video);
      if (frame && this.onSampleCallback) {
        this.onSampleCallback(frame);
      }
    }, enforcedInterval);
  }

  stopAiSampling(): void {
    if (this.samplingIntervalId) {
      window.clearInterval(this.samplingIntervalId);
      this.samplingIntervalId = null;
    }
    this.isSampling = false;
    this.onSampleCallback = null;
  }

  isAiSampling(): boolean {
    return this.isSampling;
  }

  getStats(): FrameSamplingStats {
    let avgDelta = 0;
    if (this.sampleIntervals.length > 0) {
      const sum = this.sampleIntervals.reduce((a, b) => a + b, 0);
      avgDelta = Math.round(sum / this.sampleIntervals.length);
    }

    const effectiveFps = avgDelta > 0 ? parseFloat((1000 / avgDelta).toFixed(2)) : 0;

    return {
      isSamplingActive: this.isSampling,
      sampleCount: this.sampleCount,
      lastSampleTime: this.lastSampleTime,
      averageIntervalMs: avgDelta,
      effectiveFps,
    };
  }

  async captureBlob(video: HTMLVideoElement, quality = 0.85): Promise<Blob | null> {
    const frame = this.captureFrame(video, quality);
    if (!frame) return null;

    return new Promise((resolve) => {
      this.canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        quality
      );
    });
  }
}

export const frameSampler = new FrameSampler();
