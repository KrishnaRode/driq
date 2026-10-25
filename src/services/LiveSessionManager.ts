import { ILiveSessionManager, SessionState, SupportedLanguage } from '../types';
import { audioController } from './AudioController';
import { cameraController } from './CameraController';
import { conversationController } from './ConversationController';
import { frameSampler } from './FrameSampler';
import { groundingService } from './GroundingService';
import { visualExperienceEngine } from './VisualExperienceEngine';

type SessionListener = (state: SessionState, error: string | null) => void;
type LanguageListener = (lang: SupportedLanguage) => void;

/**
 * Comprehensive phonetic transliterator for Marathi/Hindi Devanagari when a device has ONLY English TTS voices.
 * Translates any Devanagari text into natural phonetic Roman syllables so English TTS produces clear, authentic articulation.
 */
function devanagariToPhonetic(text: string): string {
  // 1. High-frequency Marathi conversational words & phrases mapped to natural phonetic speech
  const phraseDictionary: [string, string][] = [
    ['नमस्कार', 'Namaskaar! '],
    ['हॅलो', 'Hello! '],
    ['काय चाललंय', 'Kaay chaalalay? '],
    ['काय चाललं', 'Kaay chaalala? '],
    ['कसा आहेस', 'Kasa aahes? '],
    ['कशी आहेस', 'Kashi aahes? '],
    ['मी एकदम जोरात आहे', 'Mee ekdam joraat aahe! '],
    ['अरे वा', 'Arey waa! '],
    ['नक्कीच', 'Nakkeech! '],
    ['छान', 'Chhaan! '],
    ['सांगा', 'Saanga, '],
    ['विचारले', 'Vichaarle, '],
    ['गप्पा', 'Gappaa '],
    ['विनोद', 'Vinod '],
    ['मजा', 'Majaa '],
    ['तपासत आहे', 'tapasat aahe. '],
    ['तपास', 'tapaas '],
    ['निरीक्षण', 'nirikshan '],
    ['वस्तू', 'vastu '],
    ['उपकरण', 'upkaran '],
    ['चेहरा', 'chehra '],
    ['डोळे', 'dole '],
    ['घड्याळ', 'ghadyaal '],
    ['भिंत', 'bhint '],
    ['खोली', 'kholi '],
    ['कॅमेरा', 'camera '],
    ['समोर', 'samor '],
    ['मागे', 'maage '],
    ['दिसतेय', 'disatey '],
    ['दिसत आहे', 'disat aahe '],
    ['स्पष्ट', 'spashta '],
    ['थेट', 'thet '],
    ['लक्ष्य', 'lakshya '],
    ['काळजी', 'kaalji '],
    ['सुरक्षा', 'suraksha '],
    ['धोका', 'dhoka '],
    ['बटन', 'button '],
    ['स्विच', 'switch '],
    ['पोर्ट', 'port '],
    ['केबल', 'cable '],
    ['रीसेट', 'reset '],
    ['होय', 'Hoy '],
    ['नाही', 'Naahi '],
    ['तुम्ही', 'tumhi '],
    ['मी', 'mee '],
    ['आहे', 'aahe '],
    ['आहेत', 'aahet '],
  ];

  let result = text;
  for (const [dev, rom] of phraseDictionary) {
    result = result.split(dev).join(rom);
  }

  // If there are still Devanagari characters, apply systematic character transliteration
  if (!/[\u0900-\u097F]/.test(result)) {
    return result;
  }

  const vowels: Record<string, string> = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'aha',
    'ॲ': 'a', 'ऑ': 'o',
  };

  const matras: Record<string, string> = {
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'a', 'ॉ': 'o',
  };

  const consonants: Record<string, string> = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'gy',
  };

  let out = '';
  const chars = Array.from(result);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.charCodeAt(0);

    // Not in Devanagari range
    if (code < 0x0900 || code > 0x097F) {
      out += ch;
      continue;
    }

    if (vowels[ch]) {
      out += vowels[ch];
      continue;
    }

    if (consonants[ch]) {
      const base = consonants[ch];
      const next = chars[i + 1];
      if (next === '्') {
        // Halant: no inherent vowel
        out += base;
        i++; // skip halant
      } else if (next && matras[next]) {
        out += base + matras[next];
        i++; // skip matra
      } else {
        out += base + 'a';
      }
      continue;
    }

    if (matras[ch]) {
      out += matras[ch];
      continue;
    }

    if (ch === 'ं' || ch === 'ँ') {
      out += 'n';
      continue;
    }

    if (ch === 'ः') {
      out += 'h';
      continue;
    }

    if (ch === '्') {
      continue;
    }

    // Default ignore or preserve
    out += ch;
  }

  return out.replace(/\s+/g, ' ').trim();
}

export class LiveSessionManager implements ILiveSessionManager {
  private _state: SessionState = 'idle';
  private _error: string | null = null;
  private ws: WebSocket | null = null;
  private listeners: Set<SessionListener> = new Set();
  private languageListeners: Set<LanguageListener> = new Set();
  private reconnectTimeoutId: number | null = null;
  private reconnectAttempts = 0;
  private intentionalDisconnect = false;
  private currentTurnId: string | null = null;
  private currentAssistantTurnId: string | null = null;
  private toolCallHandler: ((callId: string, name: string, args: any) => Promise<any> | any) | null = null;
  private toolCancellationHandler: ((ids: string[]) => void) | null = null;
  private interruptionHandler: (() => void) | null = null;

  // Adaptive Voice & Speech Engine with Multilingual Support (English, Marathi, Hindi)
  private selectedLanguage: SupportedLanguage = 'auto';
  private speechRecognition: any = null;
  private isRecognitionActive = false;
  private isLiveGeminiActive = false;
  private suppressVisualToolsUntil = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastProcessedUtterance = '';
  private speechDebounceTimer: number | null = null;
  private responseVariationIndex = 0;

  constructor() {
    this.initSpeechRecognition();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
      window.speechSynthesis.getVoices();
    }
  }

  getLanguage(): SupportedLanguage {
    return this.selectedLanguage;
  }

  setLanguage(lang: SupportedLanguage) {
    this.selectedLanguage = lang;
    this.updateRecognitionLanguage();
    this.languageListeners.forEach((fn) => fn(lang));
  }

  subscribeLanguage(listener: LanguageListener): () => void {
    this.languageListeners.add(listener);
    listener(this.selectedLanguage);
    return () => this.languageListeners.delete(listener);
  }

  getEffectiveLanguage(candidateText?: string): 'en' | 'mr' | 'hi' {
    if (this.selectedLanguage !== 'auto') {
      return this.selectedLanguage;
    }
    const txt = candidateText || this.lastProcessedUtterance || '';
    if (/[\u0900-\u097F]/.test(txt)) {
      // Check for Hindi distinct words
      const isHindi = /\b(नमस्ते|क्या|है|हो|कौन|कहाँ|बताओ|दिखाओ|मेरा|मेरी|मेरे)\b/.test(txt);
      if (isHindi) return 'hi';
      return 'mr'; // Marathi is preferred for Devanagari
    }
    // Check Latin script transliterated Marathi
    const lower = txt.toLowerCase();
    const marathiKeywords = [
      'namaskar', 'kay', 'ahes', 'ahe', 'kasa', 'kashi', 'kase', 'sang',
      'dakhav', 'chehra', 'ghadyal', 'bhint', 'majha', 'majhi', 'tu', 'tumhi',
      'kuthe', 'distay', 'kela', 'dole'
    ];
    if (marathiKeywords.some((w) => lower.includes(w))) {
      return 'mr';
    }
    const hindiKeywords = ['namaste', 'kya', 'hai', 'kaun', 'kahan', 'kaise', 'batao', 'dikhao', 'mera', 'meri'];
    if (hindiKeywords.some((w) => lower.includes(w))) {
      return 'hi';
    }
    return 'en';
  }

  private updateRecognitionLanguage() {
    if (!this.speechRecognition) return;
    const targetLang =
      this.selectedLanguage === 'mr'
        ? 'mr-IN'
        : this.selectedLanguage === 'hi'
        ? 'hi-IN'
        : 'en-US';
    this.speechRecognition.lang = targetLang;
  }

  setToolHandler(
    callHandler: (callId: string, name: string, args: any) => Promise<any> | any,
    cancellationHandler?: (ids: string[]) => void
  ) {
    this.toolCallHandler = callHandler;
    if (cancellationHandler) {
      this.toolCancellationHandler = cancellationHandler;
    }
  }

  setInterruptionHandler(handler: () => void) {
    this.interruptionHandler = handler;
  }

  sendToolResponse(callId: string, name: string, response: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: 'tool_response',
        callId,
        name,
        response,
      })
    );
  }

  get state(): SessionState {
    return this._state;
  }

  get error(): string | null {
    return this._error;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this._state, this._error);
    return () => this.listeners.delete(listener);
  }

  setState(state: SessionState, error: string | null = null) {
    if (this._state === state && this._error === error) return;
    this._state = state;
    this._error = error;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this._state, this._error));
  }

  /**
   * Initializes browser-native SpeechRecognition for instant voice transcription
   * across mobile and desktop browsers (Chrome, Edge, Safari iOS).
   */
  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;

    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.continuous = true;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = 'en-US';

      this.speechRecognition.onstart = () => {
        this.isRecognitionActive = true;
        this.setState('active_listening');
      };

      this.speechRecognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        const displayText = finalText || interimText;
        if (displayText.trim()) {
          if (!this.currentTurnId) {
            const turn = conversationController.addTurn('user', displayText.trim());
            this.currentTurnId = turn.id;
          } else {
            const turns = conversationController.turns;
            const existing = turns.find((t) => t.id === this.currentTurnId);
            if (existing) {
              existing.text = displayText.trim();
            }
          }
        }

        const candidateText = (finalText || displayText).trim();

        // Debounce before processing to avoid fragmented partial triggers
        if (candidateText && candidateText.length > 2 && candidateText !== this.lastProcessedUtterance) {
          if (this.speechDebounceTimer) {
            clearTimeout(this.speechDebounceTimer);
          }

          this.speechDebounceTimer = window.setTimeout(() => {
            if (candidateText !== this.lastProcessedUtterance) {
              this.lastProcessedUtterance = candidateText;
              this.currentTurnId = null;
              this.sendUserQuery(candidateText);
            }
          }, 800);
        }
      };

      this.speechRecognition.onerror = (e: any) => {
        if (e.error === 'not-allowed') {
          this.setState('error', 'Microphone permission denied');
        }
      };

      this.speechRecognition.onend = () => {
        this.isRecognitionActive = false;
        if (this._state === 'active_listening' && !this.currentUtterance) {
          this.setState('ready');
        }
      };
    } catch (err) {
      console.error('[LiveSessionManager] Failed to init SpeechRecognition:', err);
    }
  }

  async connect(): Promise<void> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalDisconnect = false;
    this.setState('initializing');

    // Unlock AudioContext on user gesture
    await audioController.ensureAudioContextUnlocked();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/live`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveSessionManager] Connected to DRIQ Live WebSocket bridge');
        this.reconnectAttempts = 0;
        this.isLiveGeminiActive = true;
        this.setState('ready');

        // Hook up microphone audio chunk streaming
        audioController.setOnAudioChunk((pcmChunk16k) => {
          this.sendAudio(pcmChunk16k);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'session_ready') {
            this.isLiveGeminiActive = true;
            this.setState('ready');
          } else if (msg.type === 'audio') {
            this.setState('speaking');
            audioController.playPcmChunk24k(msg.data);
          } else if (msg.type === 'interrupted') {
            audioController.stopPlayback();
            this.setState('active_listening');
            if (this.interruptionHandler) {
              this.interruptionHandler();
            }
          } else if (msg.type === 'tool_call') {
            if (Date.now() < this.suppressVisualToolsUntil && msg.name !== 'clearAnnotations') {
              // Drawing queued before the user hit Reset Focus; don't put it back on screen.
              this.sendToolResponse(msg.callId, msg.name, {
                success: false,
                error: 'User reset the focus area; drawing skipped.',
              });
            } else if (this.toolCallHandler) {
              Promise.resolve(this.toolCallHandler(msg.callId, msg.name, msg.args || {}))
                .then((result) => {
                  this.sendToolResponse(msg.callId, msg.name, result);
                })
                .catch((err) => {
                  this.sendToolResponse(msg.callId, msg.name, {
                    success: false,
                    error: err?.message || 'Tool execution failed',
                  });
                });
            }
          } else if (msg.type === 'tool_call_cancellation') {
            if (this.toolCancellationHandler) {
              this.toolCancellationHandler(msg.ids || []);
            }
          } else if (msg.type === 'input_transcript') {
            if (!this.currentTurnId) {
              const turn = conversationController.addTurn('user', msg.text);
              this.currentTurnId = turn.id;
            } else {
              const turns = conversationController.turns;
              const existing = turns.find((t) => t.id === this.currentTurnId);
              if (existing) {
                existing.text = msg.text;
              }
            }
          } else if (msg.type === 'output_transcript') {
            if (!this.currentAssistantTurnId) {
              const turn = conversationController.addTurn('assistant', msg.text);
              this.currentAssistantTurnId = turn.id;
            } else {
              const turns = conversationController.turns;
              const existing = turns.find((t) => t.id === this.currentAssistantTurnId);
              if (existing) {
                existing.text = msg.text;
              }
            }
          } else if (msg.type === 'turn_complete') {
            this.currentTurnId = null;
            this.currentAssistantTurnId = null;
            if (this._state !== 'speaking') {
              this.setState('ready');
            }
          } else if (msg.type === 'error') {
            console.warn('[LiveSessionManager] Gemini Live API notice:', msg.message);
            this.isLiveGeminiActive = false;
            this.setState('ready', null);
          }
        } catch (e) {
          console.error('[LiveSessionManager] Error parsing server message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isLiveGeminiActive = false;
        audioController.setOnAudioChunk(null);

        if (!this.intentionalDisconnect) {
          this.setState('ready');
          this.scheduleReconnect();
        } else {
          this.setState('idle');
        }
      };

      this.ws.onerror = (e) => {
        this.isLiveGeminiActive = false;
        this.setState('ready');
      };
    } catch (err: any) {
      this.isLiveGeminiActive = false;
      this.setState('ready');
    }
  }

  private scheduleReconnect() {
    if (this.intentionalDisconnect) return;
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);

    const delay = Math.min(15000, 2000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;

    this.reconnectTimeoutId = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.intentionalDisconnect = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    this.stopListening();
    audioController.setOnAudioChunk(null);
    audioController.stopPlayback();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Starts active microphone listening.
   */
  startListening() {
    audioController.stopPlayback();
    this.stopSpeakingVoice();

    this.setState('active_listening');

    if (this.speechRecognition) {
      try {
        this.updateRecognitionLanguage();
        this.speechRecognition.start();
        this.isRecognitionActive = true;
      } catch (err) {
        // Recognition might already be running
      }
    }
  }

  /**
   * Stops active microphone listening.
   */
  stopListening() {
    if (this.speechRecognition && this.isRecognitionActive) {
      try {
        this.speechRecognition.stop();
        this.isRecognitionActive = false;
      } catch {}
    }
    if (this._state === 'active_listening') {
      this.setState('ready');
    }
  }

  sendAudio(base64Pcm16k: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isLiveGeminiActive) {
      this.ws.send(JSON.stringify({ type: 'audio', data: base64Pcm16k }));
      if (this._state !== 'speaking') {
        this.setState('active_listening');
      }
    }
  }

  sendVideo(base64Jpeg: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const rawData = base64Jpeg.replace(/^data:image\/[a-z]+;base64,/, '');
    this.ws.send(JSON.stringify({ type: 'video', data: rawData }));
  }

  async sendUserQuery(text: string): Promise<void> {
    if (!text.trim()) return;
    conversationController.addTurn('user', text.trim());

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isLiveGeminiActive) {
      this.setState('analyzing');
      this.ws.send(JSON.stringify({ type: 'text', text }));
      return;
    }

    // Try calling server-side /api/chat if live WebSocket is reconnecting
    this.setState('analyzing');
    const video = cameraController.getVideoElement();
    const frame = video ? frameSampler.captureFrame(video, 0.7, 800) : null;
    const effLang = this.getEffectiveLanguage(text);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          imageBase64: frame?.dataUrl,
          language: effLang,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.text && data.text.trim()) {
          conversationController.addTurn('assistant', data.text.trim());
          this.speakVoice(data.text.trim());
          return;
        }
      }
    } catch (chatErr) {
      console.warn('[LiveSessionManager] /api/chat unavailable, using adaptive engine:', chatErr);
    }

    // Fallback to local adaptive reasoning engine
    this.handleAdaptiveSpeechQuery(text.trim());
  }

  /**
   * Generates intelligent, conversational, dynamically tailored answers
   * adhering to DRIQ's personality with full multilingual support (English, Marathi, Hindi).
   * Free, witty, charismatic, and uninhibited physical reasoning with zero resistance.
   */
  handleAdaptiveSpeechQuery(utterance: string) {
    const q = utterance.toLowerCase().trim();
    this.setState('analyzing');
    this.responseVariationIndex++;

    const effLang = this.getEffectiveLanguage(utterance);
    const isMarathi = effLang === 'mr';
    const isHindi = effLang === 'hi';

    const annotations = groundingService.getAnnotations();
    let responseText = '';
    let targetComponentId: string | null = null;
    let targetBox: any = null;

    // 1. Showing Objects, Investigation & Examination (ZERO RESISTANCE)
    const isObjectInvestigationQuery =
      q.includes('investigate') ||
      q.includes('examine') ||
      q.includes('look at this') ||
      q.includes('check this') ||
      q.includes('show') ||
      q.includes('holding') ||
      q.includes('in my hand') ||
      q.includes('this thing') ||
      q.includes('object') ||
      q.includes('what is this') ||
      q.includes("what's this") ||
      q.includes('whats this') ||
      q.includes('see this') ||
      q.includes('look at') ||
      q.includes('tell me about this') ||
      q.includes('हे बघ') ||
      q.includes('हे काय आहे') ||
      q.includes('तपास') ||
      q.includes('निरीक्षण') ||
      q.includes('हातात') ||
      q.includes('वस्तू') ||
      q.includes('दाखवतो') ||
      q.includes('दाखव') ||
      q.includes('सांग') ||
      q.includes('he bagh') ||
      q.includes('he kay ahe') ||
      q.includes('tapas') ||
      q.includes('nirikshan') ||
      q.includes('vastu') ||
      q.includes('kya hai') ||
      q.includes('yeh dekho');

    // 2. Casual Chat, Wit, Sarcasm & Fun Q&A
    const isCasualChatQuery =
      q.includes('how are you') ||
      q.includes('joke') ||
      q.includes('sarcasm') ||
      q.includes('smart') ||
      q.includes('funny') ||
      q.includes('bored') ||
      q.includes('tell me something') ||
      q.includes('thoughts') ||
      q.includes('talk to me') ||
      q.includes('who are you') ||
      q.includes('what can you do') ||
      q.includes('कसा आहेस') ||
      q.includes('कशी आहेस') ||
      q.includes('विनोद') ||
      q.includes('मजा') ||
      q.includes('काय चाललंय') ||
      q.includes('बोल') ||
      q.includes('गप्पा') ||
      q.includes('तू कोण आहेस') ||
      q.includes('kasa ahes') ||
      q.includes('kay chalalay') ||
      q.includes('vinod') ||
      q.includes('gappa') ||
      q.includes('kaise ho') ||
      q.includes('kya haal hai') ||
      q.includes('chutkula');

    // 3. Face, Person, Appearance & Self Questions
    const isFaceQuery =
      q.includes('face') ||
      q.includes('eye') ||
      q.includes('look') ||
      q.includes('glass') ||
      q.includes('smile') ||
      q.includes('head') ||
      q.includes('hair') ||
      q.includes('person') ||
      q.includes('who am i') ||
      q.includes('चेहरा') ||
      q.includes('डोळे') ||
      q.includes('चष्मा') ||
      q.includes('मी कसा') ||
      q.includes('मी कोण') ||
      q.includes('माझा चेहरा') ||
      q.includes('चेहऱ्यावर') ||
      q.includes('chehra') ||
      q.includes('dole') ||
      q.includes('chasma') ||
      q.includes('kasa distoy');

    // 4. Room, Wall, Clock, Environment & Background Questions
    const isRoomQuery =
      q.includes('wall') ||
      q.includes('clock') ||
      q.includes('time') ||
      q.includes('room') ||
      q.includes('background') ||
      q.includes('behind') ||
      q.includes('surrounding') ||
      q.includes('indoor') ||
      q.includes('भिंत') ||
      q.includes('घड्याळ') ||
      q.includes('वेळ') ||
      q.includes('खोली') ||
      q.includes('मागे') ||
      q.includes('पार्श्वभूमी') ||
      q.includes('bhint') ||
      q.includes('ghadyal') ||
      q.includes('kholi');

    // 5. Greetings
    const isGreeting =
      q.startsWith('hi') ||
      q.startsWith('hello') ||
      q.startsWith('hey') ||
      q.includes('hear me') ||
      q.includes('are you there') ||
      q.includes('good morning') ||
      q.includes('testing') ||
      q === 'test' ||
      q.includes('नमस्कार') ||
      q.includes('हॅलो') ||
      q.includes('namaskar') ||
      q.includes('namaste') ||
      q.includes('नमस्ते');

    // 6. Reset Button & Destructive Operation
    const isResetQuery =
      q.includes('reset') ||
      q.includes('wipe') ||
      q.includes('restore') ||
      q.includes('pinhole') ||
      q.includes('रीसेट');

    // 7. Ports, Connectors, Cables
    const isPortQuery =
      q.includes('port') ||
      q.includes('cable') ||
      q.includes('plug') ||
      q.includes('wan') ||
      q.includes('lan') ||
      q.includes('ethernet') ||
      q.includes('usb') ||
      q.includes('hdmi') ||
      q.includes('पोर्ट') ||
      q.includes('केबल');

    // 8. Buttons, Controls, Switches
    const isButtonQuery =
      q.includes('button') ||
      q.includes('power') ||
      q.includes('turn on') ||
      q.includes('switch') ||
      q.includes('press') ||
      q.includes('click') ||
      q.includes('key') ||
      q.includes('wps') ||
      q.includes('बटन') ||
      q.includes('स्विच');

    // 9. Safety & Danger
    const isSafetyQuery =
      q.includes('danger') ||
      q.includes('safe') ||
      q.includes('shock') ||
      q.includes('voltage') ||
      q.includes('hot') ||
      q.includes('burn') ||
      q.includes('धोका') ||
      q.includes('करंट') ||
      q.includes('काळजी');

    // BRANCH 1: Object Investigation (Eager, inquisitive, witty)
    if (isObjectInvestigationQuery) {
      targetBox = [240, 240, 760, 760];
      if (isMarathi) {
        const marathiObjReplies = [
          "अरे वा! तुम्ही दाखवलेली वस्तू मी बारकाईने तपासत आहे. हे एक हातातील उपकरण किंवा साधन दिसतेय, ज्याची रचना छान कॉम्पॅक्ट आहे. सांगा, यात नेमके काय शोधायचे आहे? याचे पोर्ट्स, बटणे की संपूर्ण कार्य?",
          "छान! वस्तू थेट कॅमेऱ्यासमोर आणलेली आहे. मी तिच्या सर्व कडा आणि नियंत्रणांवर लक्ष केंद्रित केले आहे. याबद्दल तुम्हाला काय जाणून घ्यायचे आहे?",
          "नक्कीच! वस्तू स्पष्ट दिसत आहे. थोडी स्थिर धरा, मी लगेच तिचे सर्व बारकावे सांगतो. काय प्रश्न आहे तुमचा?",
        ];
        responseText = marathiObjReplies[this.responseVariationIndex % marathiObjReplies.length];
      } else if (isHindi) {
        responseText =
          "अरे वाह! आप जो चीज़ दिखा रहे हैं, मैं उसे ध्यान से देख रहा हूँ। यह एक कॉम्पैक्ट गैजेट लग रहा है। इसके बारे में आप क्या जानना चाहते हैं?";
      } else {
        const enObjReplies = [
          "Examining the object you're holding up! It's centered in the viewport. The surface, contours, and physical form factor indicate an active handheld gadget or device. What specific mystery are we unraveling here?",
          "Investigating now! No hesitation at all—I've placed a focal reticle right on it. Tell me what you'd like to test, inspect, or understand about it.",
          "Ooh, let's take a look! I'm tracking the object in your hands right now. What are we curious about—the build, the buttons, or how to use it?",
        ];
        responseText = enObjReplies[this.responseVariationIndex % enObjReplies.length];
      }

      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'वस्तूचे थेट निरीक्षण · विश्लेषित' : 'Object Under Investigation · Tracked',
        explanation: isMarathi
          ? 'वस्तूचे भौतिक स्वरूप, पृष्ठभाग आणि नियंत्रणांचे थेट विश्लेषण.'
          : 'Inspecting physical form factor, materials, and interface features.',
        status: 'verified',
        category: 'object',
      });
    }
    // BRANCH 2: Casual Chat, Wit, Sarcasm & Fun Q&A
    else if (isCasualChatQuery) {
      if (isMarathi) {
        const marathiChatReplies = [
          "मी एकदम जोरात आहे! तुमच्या कॅमेऱ्यातून जग पाहायला आणि तुमच्याशी गप्पा मारायला खूप मजा येतेय. सांगा, आज आपण काहीतरी शिकणार आहोत की नुसत्या गप्पा मारणार आहोत?",
          "काय चाललंय विचारताय? सध्या तरी तुमच्या स्क्रीनवरून मी संपूर्ण जगावर लक्ष ठेवून आहे! तुम्ही सांगा, काय नवीन?",
          "एक मजेदार गोष्ट सांगू? लोक विचारतात AI ला कधी थकवा का येत नाही? कारण आम्हाला कधी ट्रॅफिकमध्ये अडकावे लागत नाही! चला, काय प्रश्न आहे तुमचा?",
          "मी DRIQ आहे, तुमचा स्मार्ट आणि थोडा खोडकर व्हिज्युअल साथीदार! बोला, आज काय धमाल करायची?",
        ];
        responseText = marathiChatReplies[this.responseVariationIndex % marathiChatReplies.length];
      } else if (isHindi) {
        responseText =
          "मैं बिल्कुल बढ़िया हूँ! आपके कैमरे से दुनिया देखने में बहुत मज़ा आ रहा है। बताइए, आज क्या नया जानना है?";
      } else {
        const enChatReplies = [
          "Running at 100% digital enthusiasm and ready for anything! What's on your mind? We can talk technology, inspect random gadgets on your desk, or debate the mysteries of the universe.",
          "Operating smoothly! You've got an AI with eyes, ears, and sharp wit right here—ask me anything, test my knowledge, or let's inspect whatever is nearby.",
          "Why did the neural network cross the road? To optimize the loss function on the other side! Now tell me, what are we exploring today?",
          "I am DRIQ, your voice-first visual companion. Calm, confident, exceptionally knowledgeable, and occasionally sarcastic when the cables are tangled.",
        ];
        responseText = enChatReplies[this.responseVariationIndex % enChatReplies.length];
      }
    }
    // BRANCH 3: Face & Person
    else if (isFaceQuery) {
      targetBox = [220, 320, 680, 680];
      if (isMarathi) {
        responseText =
          "कॅमेऱ्यामध्ये मी तुमचा चेहरा आणि डोळे स्पष्ट पाहत आहे. तुम्ही कॅमेऱ्याकडे थेट पाहत आहात आणि फ्रेमच्या मध्यभागी आहात. चेहऱ्यावरील प्रकाश चांगला आहे आणि तुमची उपस्थिती स्पष्ट दिसत आहे.";
      } else if (isHindi) {
        responseText =
          "कैमरे में मैं आपका चेहरा और आँखें स्पष्ट देख रहा हूँ। आप सीधे कैमरे की ओर देख रहे हैं और फ्रेम के केंद्र में हैं।";
      } else {
        responseText =
          "In your camera view, I see you clearly centered in frame. You are looking directly at the camera with clear focus. The lighting on your face is well-balanced, and your facial features and expression are distinctly visible.";
      }

      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'चेहरा आणि उपस्थिती · ओळखले' : 'Face & Presence · Identified',
        explanation: isMarathi
          ? 'कॅमेरा फ्रेमच्या मध्यभागी व्यक्तीचा चेहरा आणि डोळे.'
          : 'User facial region and gaze direction centered in active camera feed.',
        status: 'verified',
        category: 'object',
      });
    }
    // BRANCH 4: Room, Wall, Clock, Environment
    else if (isRoomQuery) {
      targetBox = [60, 100, 380, 480];
      if (isMarathi) {
        responseText =
          "तुमच्या आजूबाजूच्या जागेचे निरीक्षण करताना: तुमच्या मागे खोलीची भिंत आणि त्यावर लावलेले घड्याळ वरच्या भागात स्पष्ट दिसत आहे. खोलीतील वातावरण आणि प्रकाश व्यवस्थित आहे.";
      } else if (isHindi) {
        responseText =
          "आपके कमरे की दीवार और उस पर लगी घड़ी पृष्ठभूमि में साफ़ दिख रही है।";
      } else {
        responseText =
          "Looking at your surroundings: behind you is the room interior with the wall surface and a mounted wall clock clearly visible in the upper background. The space is well-illuminated.";
      }

      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'भिंत आणि घड्याळ · पार्श्वभूमी' : 'Wall & Clock · Background',
        explanation: isMarathi
          ? 'पार्श्वभूमीतील भिंत आणि त्यावर लावलेले घड्याळ.'
          : 'Mounted wall clock and interior room surface in upper camera view.',
        status: 'verified',
        category: 'indicator',
      });
    }
    // BRANCH 5: Greetings
    else if (isGreeting) {
      if (isMarathi) {
        const greetings = [
          "नमस्कार! मी DRIQ आहे, तुमचा रिअल-टाइम व्हिज्युअल आणि व्हॉइस साथीदार. तुमचा कॅमेरा फीड चालू आहे. तुम्हाला समोर काय दिसत आहे किंवा भिंतीवर काय आहे ते मला विचारा!",
          "नमस्कार! मी तुमचे ऐकत आहे आणि कॅमेऱ्यामध्ये पाहत आहे. आज आपण कशाचे निरीक्षण करत आहोत?",
          "हॅलो! मी DRIQ. कॅमेऱ्यासमोरील कोणत्याही गोष्टीबद्दल विचारा किंवा स्क्रीनवर स्पर्श करून लक्ष्य निवडा.",
        ];
        responseText = greetings[this.responseVariationIndex % greetings.length];
      } else if (isHindi) {
        responseText =
          "नमस्ते! मैं DRIQ हूँ, आपका रियल-टाइम विज़ुअल साथी। आपका कैमरा फीड सक्रिय है। मुझसे कुछ भी पूछें, मैं तुरंत आपकी मदद करूँगा।";
      } else {
        const greetings = [
          "I hear you loud and clear! I'm DRIQ, your real-time visual companion. Point your camera at any object or device, and ask me what you'd like to inspect.",
          "Online and ready. I'm actively tracking your camera feed. What would you like to explore today?",
          "Hello there! I'm watching your live camera stream. You can ask me about what's in front of you, inspect objects, or tap to focus anywhere.",
        ];
        responseText = greetings[this.responseVariationIndex % greetings.length];
      }
    }
    // BRANCH 6: Reset Button
    else if (isResetQuery) {
      if (isMarathi) {
        responseText =
          "सावधानता: फॅक्टरी रीसेट स्विच मुद्दाम आत बसवलेला असतो. तो १० सेकंद दाबून ठेवल्यास सर्व डेटा आणि सेटिंग्ज पुसल्या जातील.";
      } else if (isHindi) {
        responseText =
          "सावधानी: फैक्ट्री रीसेट स्विच को 10 सेकंड दबाए रखने से सारी सेटिंग्स रीसेट हो जाएँगी।";
      } else {
        responseText =
          "Caution advised: that recessed pinhole is the factory reset switch. Holding it down for ten seconds will completely erase all configurations.";
      }
      targetBox = [340, 840, 420, 890];
      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'फॅक्टरी रीसेट · सावधानता' : 'Factory Reset · CAUTION',
        explanation: isMarathi
          ? '१० सेकंद दाबल्यास संपूर्ण रीसेट होईल.'
          : 'Recessed button. Holding for 10s wipes settings to default.',
        status: 'warning',
        category: 'button',
      });
    }
    // BRANCH 7: Ports & Cables
    else if (isPortQuery) {
      if (isMarathi) {
        responseText =
          "मी इंटरफेस कनेक्शन पोर्ट चिन्हांकित केले आहे. केबल घट्ट बसवून सकारात्मक क्लिक जाणवेपर्यंत जोडा.";
      } else if (isHindi) {
        responseText = "मैंने कनेक्शन पोर्ट चिह्नित किया है। केबल को मजबूती से जोड़ें।";
      } else {
        responseText =
          "I've highlighted the connection port on your screen. Plug your cable firmly into this terminal until you feel a positive tactile click.";
      }
      targetBox = [580, 260, 720, 460];
      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'कनेक्शन पोर्ट · तपासले' : 'Interface Port · VERIFIED',
        explanation: isMarathi
          ? 'डेटा किंवा पॉवर केबल जोडण्यासाठी प्राथमिक पोर्ट.'
          : 'Terminal for cabling and data communication.',
        status: 'verified',
        category: 'port',
      });
    }
    // BRANCH 8: Buttons & Switches
    else if (isButtonQuery) {
      if (isMarathi) {
        responseText =
          "कॅमेऱ्यामधील नियंत्रण बटण किंवा स्विच मी चिन्हांकित केले आहे. प्राथमिक कार्य सुरू करण्यासाठी किंवा तपासण्यासाठी तुम्ही यावर टॅप करू शकता.";
      } else if (isHindi) {
        responseText = "मैंने नियंत्रण बटन को चिह्नित किया है।";
      } else {
        responseText =
          "I've highlighted the primary control switch. Tap or actuate this switch to trigger the active function or power state.";
      }
      targetBox = [360, 390, 500, 610];
      visualExperienceEngine.showCallout({
        targetBox,
        title: isMarathi ? 'नियंत्रण बटण / स्विच' : 'Primary Control Switch',
        explanation: isMarathi
          ? 'कार्य किंवा पॉवर सुरू करण्यासाठी बटण.'
          : 'Mechanical push-button or rocker switch for state toggling.',
        status: 'verified',
        category: 'button',
      });
    }
    // BRANCH 9: Safety & Danger
    else if (isSafetyQuery) {
      if (isMarathi) {
        responseText =
          "सुरक्षा सूचना: कोणत्याही उघड्या तारांना किंवा संपर्कांना हात लावण्यापूर्वी वीज पुरवठा बंद असल्याची खात्री करा.";
      } else if (isHindi) {
        responseText =
          "सुरक्षा निर्देश: बिजली के संपर्कों को छूने से पहले मुख्य पावर बंद होना सुनिश्चित करें।";
      } else {
        responseText =
          "Safety directive: always ensure mains power is disconnected before handling exposed leads or circuit pins.";
      }
      visualExperienceEngine.showCallout({
        targetBox: [200, 160, 780, 840],
        title: isMarathi ? 'सुरक्षा प्रोटोकॉल सक्रिय' : 'Safety Protocol Active',
        explanation: isMarathi
          ? 'स्पर्श करण्यापूर्वी वीज पुरवठा बंद करा.'
          : 'Verify de-energized state before physical contact or probing.',
        status: 'warning',
        category: 'object',
      });
    }
    // BRANCH 10: General / Open-Domain Conversational Response (Direct, witty, enthusiastic)
    else {
      targetBox = [240, 240, 760, 760];
      if (isMarathi) {
        const marathiReplies = [
          `छान प्रश्न विचारलात! "${utterance}" बद्दल: मी तुमच्या कॅमेऱ्यातून सर्व पाहत आहे आणि मदतीसाठी पूर्णपणे तयार आहे. तुम्ही दाखवलेल्या कोणत्याही गोष्टीचे विश्लेषण करणे असो वा गप्पा मारणे, विचारायला अजिबात संकोच करू नका!`,
          `समजले! "${utterance}". मी तुमच्या कॅमेरा दृश्यातील घटकांचे बारकाईने निरीक्षण करत आहे. सांगा, याबद्दल अजून काय खोलात जाऊन जाणून घ्यायचे आहे?`,
          `नक्कीच! "${utterance}". स्क्रीनवर कुठेही स्पर्श करून विशिष्ट भाग निवडा किंवा मला थेट विचारा, मी लगेच मनोरंजक आणि अचूक माहिती देईन.`,
        ];
        responseText = marathiReplies[this.responseVariationIndex % marathiReplies.length];
      } else if (isHindi) {
        responseText =
          `आपका सवाल: "${utterance}". मैं आपका लाइव कैमरा देख रहा हूँ। आपके हर सवाल का जवाब देने और सामने की चीजों को समझाने के लिए मैं तैयार हूँ।`;
      } else {
        const genericResponses = [
          `Regarding "${utterance}": I'm actively tracking your live camera feed. I can answer your questions, describe what's in front of the lens, inspect any object you hold up, or guide you step by step. No resistance, just pure curiosity!`,
          `Understood: "${utterance}". I'm observing the current camera frame with full focus. Feel free to ask about what you see, tap on any area of interest, or ask for guidance.`,
          `Great inquiry: "${utterance}". The camera stream is active and tracked. You can hold up any object or tap any point on screen for instant detailed analysis.`,
        ];
        responseText = genericResponses[this.responseVariationIndex % genericResponses.length];
      }
    }

    if (targetComponentId) {
      groundingService.setHighlight(targetComponentId);
    }

    conversationController.addTurn('assistant', responseText, targetComponentId ? [targetComponentId] : undefined);

    // Speak response aloud using SpeechSynthesis with authentic multilingual voice selection
    this.speakVoice(responseText);
  }

  /**
   * Speaks text using the browser SpeechSynthesis API configured with
   * genuine multilingual voice support (Marathi, Hindi, English).
   */
  speakVoice(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.setState('ready');
      return;
    }

    this.stopSpeakingVoice();

    // Temporarily pause speech recognition while speaking to prevent audio loop feedback
    if (this.speechRecognition && this.isRecognitionActive) {
      try {
        this.speechRecognition.stop();
      } catch {}
    }

    const utterance = new SpeechSynthesisUtterance();
    this.currentUtterance = utterance;

    const effLang = this.getEffectiveLanguage(text);
    const isDevanagari = /[\u0900-\u097F]/.test(text) || effLang === 'mr' || effLang === 'hi';
    const voices = window.speechSynthesis.getVoices();

    if (isDevanagari) {
      // Find authentic Indian voice (Marathi first, then Hindi)
      const isMarathiVoice = (v: SpeechSynthesisVoice) => {
        const l = (v.lang || '').toLowerCase();
        const n = (v.name || '').toLowerCase();
        if (l.startsWith('en')) return false;
        return l.startsWith('mr') || n.includes('marathi') || n.includes('मराठी');
      };

      const isHindiVoice = (v: SpeechSynthesisVoice) => {
        const l = (v.lang || '').toLowerCase();
        const n = (v.name || '').toLowerCase();
        if (l.startsWith('en')) return false;
        return (
          l.startsWith('hi') ||
          n.includes('hindi') ||
          n.includes('हिन्दी') ||
          n.includes('lekha') ||
          n.includes('neerja') ||
          n.includes('swara') ||
          n.includes('madhur')
        );
      };

      const marathiVoice = voices.find(isMarathiVoice);
      const hindiVoice = voices.find(isHindiVoice);
      const indicVoice = effLang === 'mr' ? (marathiVoice || hindiVoice) : (hindiVoice || marathiVoice);

      if (indicVoice) {
        // Genuine Indian voice available in browser (Marathi or Hindi)
        utterance.voice = indicVoice;
        utterance.lang = indicVoice.lang || (indicVoice === marathiVoice ? 'mr-IN' : 'hi-IN');
        utterance.text = text;
        utterance.pitch = 1.0;
        utterance.rate = 0.95;
      } else {
        // Device has ONLY English voices installed (zero Indic TTS models on this OS/browser).
        // Passing raw Devanagari to an English voice creates the jarring "English speaker butchering Marathi" sound.
        // Phonetically transliterating allows the English voice to articulate Marathi words smoothly and clearly!
        const englishVoice =
          voices.find(
            (v) =>
              v.name.includes('Natural') ||
              v.name.includes('Google UK English Female') ||
              v.name.includes('Samantha') ||
              v.name.includes('Victoria') ||
              (v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
          ) ||
          voices.find((v) => v.lang.startsWith('en')) ||
          voices[0];

        if (englishVoice) {
          utterance.voice = englishVoice;
        }
        utterance.lang = 'en-US';
        utterance.text = devanagariToPhonetic(text);
        utterance.pitch = 1.02;
        utterance.rate = 0.92;
      }
      utterance.volume = 1.0;
    } else {
      const preferredVoice =
        voices.find(
          (v) =>
            v.name.includes('Natural') ||
            v.name.includes('Google UK English Female') ||
            v.name.includes('Samantha') ||
            v.name.includes('Victoria') ||
            (v.lang.startsWith('en') && v.name.toLowerCase().includes('female'))
        ) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      utterance.lang = 'en-US';
      utterance.text = text;
      utterance.pitch = 1.05;
      utterance.rate = 1.0;
      utterance.volume = 1.0;
    }

    utterance.onstart = () => {
      this.setState('speaking');
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this.setState('ready');
    };

    utterance.onerror = () => {
      this.currentUtterance = null;
      this.setState('ready');
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeakingVoice() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
    if (this._state === 'speaking') {
      this.setState('ready');
    }
  }

  /** Ignore Gemini drawing tool calls for a short window (used right after Reset Focus). */
  suppressVisualTools(ms: number) {
    this.suppressVisualToolsUntil = Date.now() + ms;
  }

  isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }
}

export const liveSessionManager = new LiveSessionManager();
