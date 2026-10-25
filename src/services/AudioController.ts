import { AudioState, IAudioController } from '../types';

type AudioListener = (state: AudioState) => void;
type AudioChunkCallback = (base64Pcm16k: string) => void;

export class AudioController implements IAudioController {
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private animFrameId: number | null = null;
  private listeners: Set<AudioListener> = new Set();
  private dataArray: Uint8Array = new Uint8Array(32);
  private simulatedInterval: number | null = null;

  // Gapless audio playback scheduling
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private onAudioChunkCallback: AudioChunkCallback | null = null;

  private state: AudioState = {
    isMicActive: false,
    isMuted: false,
    inputVolume: 0,
    frequencyBins: new Uint8Array(32),
    isSpeaking: false,
    outputVolume: 0,
    error: null,
  };

  subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const snapshot = { ...this.state, frequencyBins: Uint8Array.from(this.dataArray) };
    this.listeners.forEach((fn) => fn(snapshot));
  }

  /**
   * Sets callback to receive outgoing 16kHz 16-bit linear PCM microphone chunks
   * to transmit to Gemini Live API.
   */
  setOnAudioChunk(callback: AudioChunkCallback | null) {
    this.onAudioChunkCallback = callback;
  }

  /**
   * Ensures browser AudioContexts are resumed on user click/touch gesture
   * to satisfy Safari iOS and Chrome autoplay policies.
   */
  async ensureAudioContextUnlocked(): Promise<void> {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!this.inputAudioCtx) {
      this.inputAudioCtx = new AudioCtxClass();
    }
    if (this.inputAudioCtx.state === 'suspended') {
      await this.inputAudioCtx.resume().catch(() => {});
    }

    if (!this.outputAudioCtx) {
      // Create output context; standard sample rate or 24kHz
      try {
        this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      } catch {
        this.outputAudioCtx = new AudioCtxClass();
      }
    }
    if (this.outputAudioCtx.state === 'suspended') {
      await this.outputAudioCtx.resume().catch(() => {});
    }
  }

  async startAudio(): Promise<boolean> {
    this.stopAudio();
    await this.ensureAudioContextUnlocked();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.startSimulatedAudio();
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      this.micStream = stream;
      const ctx = this.inputAudioCtx!;
      this.sourceNode = ctx.createMediaStreamSource(stream);

      // Metering analyser node
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      // PCM Audio processor node: 2048 sample buffer (~42ms at 48kHz, ~128ms at 16kHz)
      this.processorNode = ctx.createScriptProcessor(2048, 1, 1);
      const inputSampleRate = ctx.sampleRate;

      this.processorNode.onaudioprocess = (e) => {
        if (this.state.isMuted) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);

        // Downsample to 16kHz 16-bit linear PCM
        const pcm16 = this.downsampleTo16k(inputChannelData, inputSampleRate);

        if (this.onAudioChunkCallback && pcm16.length > 0) {
          const base64Chunk = this.int16ToBase64(pcm16);
          this.onAudioChunkCallback(base64Chunk);
        }
      };

      this.sourceNode.connect(this.processorNode);
      // Connect to a mute dummy gain instead of destination to prevent microphone echo feedback
      const dummyGain = ctx.createGain();
      dummyGain.gain.value = 0;
      this.processorNode.connect(dummyGain);
      dummyGain.connect(ctx.destination);

      this.state.isMicActive = true;
      this.state.isMuted = false;
      this.state.error = null;

      this.startMetering();
      this.notify();
      return true;
    } catch (err) {
      const error = err as Error;
      this.state.error = error.message || 'Microphone unavailable';
      this.startSimulatedAudio();
      return true;
    }
  }

  /**
   * Downsamples input float audio buffer to 16000Hz 16-bit linear PCM (Int16Array).
   */
  private downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
    if (inputSampleRate === 16000) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      return output;
    }

    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const output = new Int16Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const pos = i * ratio;
      const index = Math.floor(pos);
      const frac = pos - index;
      const s0 = input[index] ?? 0;
      const s1 = input[index + 1] ?? s0;
      const interpolated = s0 + frac * (s1 - s0);
      const s = Math.max(-1, Math.min(1, interpolated));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private int16ToBase64(int16: Int16Array): string {
    const bytes = new Uint8Array(int16.buffer, int16.byteOffset, int16.byteLength);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Plays a 24kHz 16-bit PCM chunk streamed back from Gemini Live.
   * Employs gapless audio scheduling via nextStartTime to eliminate jitter.
   */
  playPcmChunk24k(base64Pcm: string): void {
    if (!base64Pcm || this.state.isMuted) return;

    if (!this.outputAudioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      } catch {
        this.outputAudioCtx = new AudioCtxClass();
      }
    }

    const ctx = this.outputAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const binary = atob(base64Pcm);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
      }

      // AudioBuffer at 24000Hz (native Gemini Live output rate)
      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const currentTime = ctx.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime + 0.025; // 25ms jitter cushion
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(this.nextStartTime);

      this.nextStartTime += audioBuffer.duration;
      this.activeSources.add(source);

      if (!this.state.isSpeaking) {
        this.state.isSpeaking = true;
        this.notify();
      }

      source.onended = () => {
        this.activeSources.delete(source);
        if (this.activeSources.size === 0) {
          this.state.isSpeaking = false;
          this.notify();
        }
      };
    } catch (e) {
      console.error('[AudioController] Error scheduling PCM chunk:', e);
    }
  }

  /**
   * Immediately terminates all ongoing audio playback.
   * Triggered when the user interrupts / barges in on model speech.
   */
  stopPlayback(): void {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources.clear();
    this.nextStartTime = 0;

    if (this.state.isSpeaking) {
      this.state.isSpeaking = false;
      this.notify();
    }
  }

  private startMetering() {
    const update = () => {
      if (!this.analyser || this.state.isMuted) {
        this.state.inputVolume = 0;
        this.dataArray.fill(0);
        this.notify();
        this.animFrameId = requestAnimationFrame(update);
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray as unknown as Uint8Array<ArrayBuffer>);

      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const avg = sum / this.dataArray.length;
      const normalized = Math.min(1.0, avg / 128);

      this.state.inputVolume = normalized;
      this.notify();

      this.animFrameId = requestAnimationFrame(update);
    };

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame(update);
  }

  private startSimulatedAudio() {
    this.state.isMicActive = true;
    this.state.isMuted = false;
    let phase = 0;

    if (this.simulatedInterval) clearInterval(this.simulatedInterval);
    this.simulatedInterval = window.setInterval(() => {
      if (this.state.isMuted) {
        this.state.inputVolume = 0;
        this.dataArray.fill(0);
      } else {
        phase += 0.15;
        const baseLevel = 0.08 + Math.abs(Math.sin(phase * 0.8)) * 0.15;
        this.state.inputVolume = baseLevel;

        for (let i = 0; i < this.dataArray.length; i++) {
          this.dataArray[i] = Math.floor(baseLevel * 180 * (1 - (i / this.dataArray.length) * 0.5));
        }
      }
      this.notify();
    }, 50);
  }

  stopAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.simulatedInterval) {
      clearInterval(this.simulatedInterval);
      this.simulatedInterval = null;
    }
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.stopPlayback();
    this.state.isMicActive = false;
    this.state.inputVolume = 0;
    this.dataArray.fill(0);
    this.notify();
  }

  toggleMute(): boolean {
    const nextMuted = !this.state.isMuted;
    this.state.isMuted = nextMuted;

    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (nextMuted) {
      this.stopPlayback();
    }

    this.notify();
    return nextMuted;
  }

  getVolume(): number {
    return this.state.inputVolume;
  }

  getFrequencyData(): Uint8Array {
    return this.dataArray;
  }

  synthesizeTestChime() {
    try {
      if (!this.outputAudioCtx) {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.outputAudioCtx = new AudioCtxClass();
      }
      const ctx = this.outputAudioCtx;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(587.33, now);
      osc2.frequency.setValueAtTime(880.0, now + 0.08);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.15);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch {}
  }
}

export const audioController = new AudioController();
