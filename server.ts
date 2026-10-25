import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import {
  DRIQ_SYSTEM_INSTRUCTION,
  DRIQ_VOICE,
  DRIQ_LIVE_MODEL,
  DRIQ_BRAND,
  DRIQ_TAGLINE,
} from './src/config/personality.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Benchmark Grounding Scenarios Data for Testing & Fallbacks
const BENCHMARK_GROUNDING_CATALOG: Record<string, { sceneSummary: string; components: any[] }> = {
  router: {
    sceneSummary: 'Dual-band Wi-Fi 6 Gigabit Router rear port panel and status indicators.',
    components: [
      {
        objectId: 'router_ax3000',
        componentId: 'wan_port',
        label: 'WAN Internet Port (2.5 GbE)',
        normalizedBoundingBox: [460, 180, 710, 310],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'High-speed 2.5 Gbps WAN input port for incoming fiber/cable modem ethernet uplink.',
        category: 'port',
        confidenceQuality: 'high',
      },
      {
        objectId: 'router_ax3000',
        componentId: 'lan_ports_1_4',
        label: 'Gigabit LAN Ports 1-4',
        normalizedBoundingBox: [460, 340, 710, 680],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Four 1000BASE-T Gigabit Ethernet switch ports for wired local network devices.',
        category: 'port',
        confidenceQuality: 'high',
      },
      {
        objectId: 'router_ax3000',
        componentId: 'dc_power_jack',
        label: '12V DC Barrel Power Jack',
        normalizedBoundingBox: [510, 730, 690, 820],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Standard 12V 2.5A center-positive barrel connector powering the router motherboard.',
        category: 'port',
        confidenceQuality: 'high',
      },
      {
        objectId: 'router_ax3000',
        componentId: 'wps_button',
        label: 'WPS Pair Button',
        normalizedBoundingBox: [330, 740, 440, 810],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Push-button to initiate Wi-Fi Protected Setup handshake with client devices.',
        category: 'button',
        confidenceQuality: 'high',
      },
      {
        objectId: 'router_ax3000',
        componentId: 'recessed_reset_pinhole',
        label: 'Factory Reset Pinhole',
        normalizedBoundingBox: [340, 840, 420, 890],
        visible: false,
        uncertaintyReason: 'Recessed pinhole deeply shadowed beneath antenna hinge; requires pin probe',
        shortExplanation: 'Recessed button to restore factory firmware settings when held for 10 seconds.',
        category: 'button',
        confidenceQuality: 'medium',
      },
      {
        objectId: 'router_ax3000',
        componentId: 'status_led_array',
        label: 'Front LED Array (Power/Internet/WLAN)',
        normalizedBoundingBox: [180, 240, 290, 560],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Micro-LED indicators showing power status, internet connectivity, and 2.4/5GHz activity.',
        category: 'indicator',
        confidenceQuality: 'high',
      },
    ],
  },
  mouse: {
    sceneSummary: 'Ergonomic wireless optical gaming mouse top and side profile.',
    components: [
      {
        objectId: 'mouse_pro_x',
        componentId: 'left_click',
        label: 'Primary Left Click Button',
        normalizedBoundingBox: [140, 260, 480, 460],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Mechanical microswitch primary left trigger rated for 80 million actuations.',
        category: 'button',
        confidenceQuality: 'high',
      },
      {
        objectId: 'mouse_pro_x',
        componentId: 'right_click',
        label: 'Secondary Right Click Button',
        normalizedBoundingBox: [140, 540, 480, 740],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Secondary right trigger for context menus and alternative actions.',
        category: 'button',
        confidenceQuality: 'high',
      },
      {
        objectId: 'mouse_pro_x',
        componentId: 'scroll_wheel',
        label: 'Textured Scroll Wheel / Middle Click',
        normalizedBoundingBox: [220, 470, 430, 530],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Ribbed tactile encoder wheel supporting vertical scrolling and middle-click actuation.',
        category: 'control',
        confidenceQuality: 'high',
      },
      {
        objectId: 'mouse_pro_x',
        componentId: 'dpi_cycle_button',
        label: 'DPI Sensitivity Switch',
        normalizedBoundingBox: [460, 475, 530, 525],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Cycles through preset sensor resolutions (400, 800, 1600, 3200 DPI).',
        category: 'button',
        confidenceQuality: 'high',
      },
      {
        objectId: 'mouse_pro_x',
        componentId: 'thumb_forward_back',
        label: 'Thumb Navigation Keys (M4/M5)',
        normalizedBoundingBox: [520, 180, 680, 240],
        visible: false,
        uncertaintyReason: 'Positioned on lateral left flank, partially occluded by top-down viewing angle',
        shortExplanation: 'Dual lateral thumb buttons mapped by default to browser history forward and back.',
        category: 'button',
        confidenceQuality: 'low',
      },
    ],
  },
  keyboard: {
    sceneSummary: 'Compact 75% mechanical keyboard with tactile switches.',
    components: [
      {
        objectId: 'kbd_75',
        componentId: 'spacebar',
        label: 'Mechanical Spacebar',
        normalizedBoundingBox: [720, 330, 840, 670],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: '6.25u stabilized mechanical spacebar with factory-lubed PCB stabilizers.',
        category: 'key',
        confidenceQuality: 'high',
      },
      {
        objectId: 'kbd_75',
        componentId: 'return_key',
        label: 'ANSI Return / Enter Key',
        normalizedBoundingBox: [490, 760, 590, 890],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: '2.25u Return key terminating command strings and multiline text input.',
        category: 'key',
        confidenceQuality: 'high',
      },
      {
        objectId: 'kbd_75',
        componentId: 'esc_key',
        label: 'Escape Key (Esc)',
        normalizedBoundingBox: [160, 110, 260, 190],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Top-left escape key for cancellation and modal dismissal.',
        category: 'key',
        confidenceQuality: 'high',
      },
      {
        objectId: 'kbd_75',
        componentId: 'usbc_port',
        label: 'Rear USB-C Host Port',
        normalizedBoundingBox: [80, 470, 140, 530],
        visible: false,
        uncertaintyReason: 'Recessed rear lip connector hidden from top typing view',
        shortExplanation: 'High-speed USB Type-C connector providing 1000Hz polling and fast charging.',
        category: 'port',
        confidenceQuality: 'low',
      },
    ],
  },
  unfamiliar: {
    sceneSummary: 'Cryogenic precision fluid control valve and differential digital manometer.',
    components: [
      {
        objectId: 'cryo_rig_01',
        componentId: 'valve_spindle_lever',
        label: 'Cryogenic Quarter-Turn Valve Lever',
        normalizedBoundingBox: [210, 310, 440, 640],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Stainless steel 90-degree manual lever regulating high-pressure liquid nitrogen line.',
        category: 'control',
        confidenceQuality: 'high',
      },
      {
        objectId: 'cryo_rig_01',
        componentId: 'manometer_display',
        label: 'Digital Backlit Manometer Gauge',
        normalizedBoundingBox: [490, 380, 730, 620],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'LCD pressure transducer showing differential line pressure in bars / PSI.',
        category: 'indicator',
        confidenceQuality: 'high',
      },
      {
        objectId: 'cryo_rig_01',
        componentId: 'rs485_telemetry_bus',
        label: 'RS-485 Modbus Telemetry Port',
        normalizedBoundingBox: [760, 440, 860, 560],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Galvanically isolated industrial serial bus transmitting real-time sensor readouts.',
        category: 'port',
        confidenceQuality: 'high',
      },
    ],
  },
  obscured: {
    sceneSummary: 'Studio audio interface with cables and partially shadowed controls.',
    components: [
      {
        objectId: 'audio_iface_01',
        componentId: 'main_volume_pot',
        label: 'Rotary Master Volume Potentiometer',
        normalizedBoundingBox: [320, 280, 580, 490],
        visible: false,
        uncertaintyReason: 'Heavy XLR audio cable loops directly over knob; 60% lower quadrant occluded',
        shortExplanation: 'Continuous rotary attenuator controlling stereo balanced monitor output level.',
        category: 'control',
        confidenceQuality: 'low',
      },
      {
        objectId: 'audio_iface_01',
        componentId: 'phantom_power_switch',
        label: '+48V Phantom Power Toggle',
        normalizedBoundingBox: [610, 640, 720, 730],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Latching micro-switch applying +48V DC phantom power to condenser microphones.',
        category: 'button',
        confidenceQuality: 'high',
      },
      {
        objectId: 'audio_iface_01',
        componentId: 'combo_input_jack',
        label: 'Neutrik XLR / 1/4" Combo Jack',
        normalizedBoundingBox: [310, 610, 560, 820],
        visible: true,
        uncertaintyReason: null,
        shortExplanation: 'Balanced analog input accommodating XLR microphones or 1/4-inch instrument cables.',
        category: 'port',
        confidenceQuality: 'high',
      },
    ],
  },
};

// API Routes
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: `${DRIQ_BRAND} — Real-Time Visual Intelligence`,
    version: '1.0.0-production',
    uptime: process.uptime(),
    capabilities: [
      'MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API',
      'GEMINI_LIVE_AUDIO_STREAMING',
      'GEMINI_LIVE_VISION_CONTEXT',
      'SPATIAL_VISUAL_GROUNDING',
      'STRICT_COORDINATE_VALIDATION',
      'SCENE_CHANGE_DETECTION',
      'CAMERA_STREAM_COORDINATION',
      'WEB_AUDIO_METERING',
      'SPATIAL_GROUNDING_GEOMETRY',
    ],
    liveModel: DRIQ_LIVE_MODEL,
    voice: DRIQ_VOICE,
    hasApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: Date.now(),
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    brand: DRIQ_BRAND,
    tagline: DRIQ_TAGLINE,
    voice: DRIQ_VOICE,
    model: DRIQ_LIVE_MODEL,
    phase: 9,
    hasApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.post('/api/session/init', (req, res) => {
  res.json({
    sessionId: `driq_session_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    status: 'ready',
    voice: DRIQ_VOICE,
    model: DRIQ_LIVE_MODEL,
    phase: 'Production - Real-Time Multimodal Visual Intelligence',
    hasApiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
    createdAt: Date.now(),
    clientTimestamp: req.body?.clientTimestamp || Date.now(),
  });
});

// Grounding Validation Helper
function validateAndSanitizeBox(box: any): { isValid: boolean; box: [number, number, number, number]; error?: string } {
  if (!Array.isArray(box) || box.length !== 4) {
    return { isValid: false, box: [0, 0, 0, 0], error: 'Box must be array of 4 coordinates [ymin, xmin, ymax, xmax]' };
  }

  const [ymin, xmin, ymax, xmax] = box.map((v) => Number(v));

  if (!Number.isFinite(ymin) || !Number.isFinite(xmin) || !Number.isFinite(ymax) || !Number.isFinite(xmax)) {
    return { isValid: false, box: [0, 0, 0, 0], error: 'Box coordinates must be finite numbers' };
  }

  // Clamping to 0-1000
  const cYmin = Math.max(0, Math.min(1000, Math.round(ymin)));
  const cXmin = Math.max(0, Math.min(1000, Math.round(xmin)));
  const cYmax = Math.max(0, Math.min(1000, Math.round(ymax)));
  const cXmax = Math.max(0, Math.min(1000, Math.round(xmax)));

  if (cYmin >= cYmax) {
    return { isValid: false, box: [cYmin, cXmin, cYmax, cXmax], error: `Inverted or flat Y: ymin (${cYmin}) >= ymax (${cYmax})` };
  }

  if (cXmin >= cXmax) {
    return { isValid: false, box: [cYmin, cXmin, cYmax, cXmax], error: `Inverted or flat X: xmin (${cXmin}) >= xmax (${cXmax})` };
  }

  const area = (cXmax - cXmin) * (cYmax - cYmin);
  if (area < 4) {
    return { isValid: false, box: [cYmin, cXmin, cYmax, cXmax], error: `Degenerate box area (${area} < 4)` };
  }

  return { isValid: true, box: [cYmin, cXmin, cYmax, cXmax] };
}

// Conversational Multimodal Chat Endpoint (Multilingual & Open-Domain)
app.post('/api/chat', async (req, res) => {
  const { query, imageBase64, language } = req.body || {};
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.json({
      text: null,
      source: 'offline',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const isMarathi = language === 'mr' || /[\u0900-\u097F]/.test(query);
    const systemPrompt = isMarathi
      ? `${DRIQ_SYSTEM_INSTRUCTION}\n\nIMPORTANT: The user is speaking Marathi. Respond in authentic, fluent, witty, and engaging Marathi. Never resist questions or investigations; comment freely and insightfully.`
      : `${DRIQ_SYSTEM_INSTRUCTION}\n\nIMPORTANT: Respond with charm, wit, insight, and zero resistance. If the user shows any object, investigate it eagerly.`;

    const contents: any[] = [];
    if (imageBase64) {
      const base64Clean = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Clean,
        },
      });
    }
    contents.push({ text: query });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    return res.json({
      text: response.text || '',
      source: 'gemini-3.8-flash',
    });
  } catch (err: any) {
    console.warn('[DRIQ Server] /api/chat fallback:', err?.message);
    return res.json({
      text: null,
      error: err?.message,
    });
  }
});

// Visual Grounding Multimodal Endpoint
app.post('/api/grounding/analyze', async (req, res) => {
  const { frameId, imageBase64, query, presetScene } = req.body || {};

  const effectiveFrameId = frameId || `frm_${Date.now()}`;

  // If a benchmark preset is explicitly requested or client simulates offline benchmark
  if (presetScene && BENCHMARK_GROUNDING_CATALOG[presetScene]) {
    const catalog = BENCHMARK_GROUNDING_CATALOG[presetScene];
    const components = catalog.components.map((comp) => ({
      ...comp,
      frameId: effectiveFrameId,
    }));

    return res.json({
      frameId: effectiveFrameId,
      timestamp: Date.now(),
      sceneSummary: catalog.sceneSummary,
      components,
      source: 'benchmark_preset',
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !imageBase64) {
    return res.json({
      frameId: effectiveFrameId,
      timestamp: Date.now(),
      sceneSummary: 'Live Camera Frame (Visual Saliency)',
      components: [],
      warning: !apiKey ? 'GEMINI_API_KEY not configured. Utilizing client-side visual saliency engine.' : undefined,
      source: 'client_realtime_vision',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Clean base64 string
    const base64Clean = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

    const groundingPrompt = `You are DRIQ's spatial visual grounding engine.
Analyze this high-resolution camera frame and locate distinct physical parts, ports, buttons, controls, keys, indicators, or sensors.
Return a structured JSON object with sceneSummary and components.

For EACH identified component:
- objectId: identifier for the parent physical object (e.g. "router_01", "mouse_01", "keyboard_01")
- componentId: distinct identifier for the part (e.g. "wan_port", "scroll_wheel", "spacebar")
- label: concise human-readable title
- normalizedBoundingBox: [ymin, xmin, ymax, xmax] strictly in 0 to 1000 integer coordinates where [0,0] is top-left and [1000,1000] is bottom-right. Never return inverted boxes (ymin must be strictly less than ymax, xmin must be strictly less than xmax).
- visible: boolean. Set to TRUE ONLY if the component is clearly visible and directly identifiable. Set to FALSE if it is obscured, occluded by cables/hands, cropped out, or in deep shadow.
- uncertaintyReason: string if not clearly visible or ambiguous (e.g., "Partially obscured by cable", "Cut off at frame edge", "Shadowed pinhole"). Set to null if perfectly clear.
- shortExplanation: 1-2 sentence description of its purpose or status.
- category: one of "port", "button", "indicator", "key", "component", "sensor", "control"
- confidenceQuality: "high" | "medium" | "low"

Focus request: ${query || 'Identify all prominent physical components, connection ports, controls, and buttons.'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Clean,
            },
          },
          {
            text: groundingPrompt,
          },
        ],
      },
      config: {
        systemInstruction:
          'You are DRIQ, a real-time visual intelligence companion. Provide precise, calibrated bounding boxes in 0-1000 coordinate space. Never fabricate positions for occluded or unseen parts; instead set visible=false and describe uncertaintyReason.',
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Fallback clean extraction
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse model JSON output');
      }
    }

    const sceneSummary = parsed.sceneSummary || 'Physical object detected in camera view';
    const rawComponents = Array.isArray(parsed.components) ? parsed.components : [];

    // Strictly validate every component
    const validatedComponents: any[] = [];
    const validationErrors: string[] = [];

    rawComponents.forEach((comp: any, idx: number) => {
      const boxValidation = validateAndSanitizeBox(comp.normalizedBoundingBox);

      if (!boxValidation.isValid) {
        validationErrors.push(`Component #${idx} (${comp.label || 'unknown'}): ${boxValidation.error}`);
        // If box is invalid, only keep if it is marked invisible/uncertain
        if (comp.visible === false) {
          validatedComponents.push({
            frameId: effectiveFrameId,
            objectId: String(comp.objectId || 'object_01'),
            componentId: String(comp.componentId || `comp_${idx}`),
            label: String(comp.label || 'Unidentified Component'),
            normalizedBoundingBox: [0, 0, 0, 0],
            visible: false,
            uncertaintyReason: comp.uncertaintyReason || 'Invalid coordinates / not localized in view',
            shortExplanation: String(comp.shortExplanation || 'Component location could not be verified geometrically.'),
            category: comp.category || 'component',
            confidenceQuality: 'low',
          });
        }
        return;
      }

      validatedComponents.push({
        frameId: effectiveFrameId,
        objectId: String(comp.objectId || 'object_01'),
        componentId: String(comp.componentId || `comp_${idx}`),
        label: String(comp.label || `Component ${idx + 1}`),
        normalizedBoundingBox: boxValidation.box,
        visible: Boolean(comp.visible),
        uncertaintyReason: comp.uncertaintyReason || null,
        shortExplanation: String(comp.shortExplanation || 'Detected visual element.'),
        category: comp.category || 'component',
        confidenceQuality: comp.confidenceQuality || (comp.visible ? 'high' : 'low'),
      });
    });

    return res.json({
      frameId: effectiveFrameId,
      timestamp: Date.now(),
      sceneSummary,
      components: validatedComponents,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
      source: 'gemini-3.8-flash',
    });
  } catch (err: any) {
    return res.json({
      frameId: effectiveFrameId,
      timestamp: Date.now(),
      sceneSummary: 'Live Camera Frame (Visual Saliency)',
      components: [],
      error: err?.message || 'Grounding analysis error',
      source: 'client_realtime_vision',
    });
  }
});


// Phase 6: Canonical Graphical Intelligence Tools for Gemini Live Function Calling
const DRIQ_GRAPHICAL_TOOLS: any = [
  {
    functionDeclarations: [
      {
        name: 'highlightObject',
        description: 'Highlight a primary physical object (e.g., router, mouse, keyboard) with a luminous contour in DRIQ viewport.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            objectId: {
              type: Type.STRING,
              description: 'Target object identifier or name.',
            },
            label: {
              type: Type.STRING,
              description: 'Readable title for the object contour tag.',
            },
            color: {
              type: Type.STRING,
              description: 'Optional hex color for highlight contour.',
            },
          },
          required: ['objectId', 'label'],
        },
      },
      {
        name: 'highlightComponent',
        description: 'Highlight a physical sub-component, port, button, switch, or key with a precision target reticle.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            componentId: {
              type: Type.STRING,
              description: 'Target component identifier (e.g., wan_port, lan_ports, power_jack, reset_pinhole, scroll_wheel).',
            },
            label: {
              type: Type.STRING,
              description: 'Readable title for the component.',
            },
            color: {
              type: Type.STRING,
              description: 'Optional hex color for the focus box.',
            },
          },
          required: ['componentId', 'label'],
        },
      },
      {
        name: 'showCallout',
        description: 'Display a floating contextual information card connected to a target component, showing title, status, and concise explanation.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            componentId: {
              type: Type.STRING,
              description: 'Target component identifier to anchor the callout card.',
            },
            title: {
              type: Type.STRING,
              description: 'Headline title for the callout card.',
            },
            explanation: {
              type: Type.STRING,
              description: '1-2 sentence concise explanation of its function or action needed.',
            },
            status: {
              type: Type.STRING,
              description: 'Status indicator: verified, action_needed, warning, or info.',
            },
            category: {
              type: Type.STRING,
              description: 'Category tag (e.g., port, button, sensor, indicator).',
            },
            placement: {
              type: Type.STRING,
              description: 'Optional preferred placement: above, below, left, right, or compact.',
            },
          },
          required: ['componentId', 'title', 'explanation'],
        },
      },
      {
        name: 'drawConnector',
        description: 'Draw an elbow or curved connector line linking a target component to a callout card.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            fromComponentId: {
              type: Type.STRING,
              description: 'Source component identifier.',
            },
            toComponentId: {
              type: Type.STRING,
              description: 'Destination component or card identifier.',
            },
            style: {
              type: Type.STRING,
              description: 'Connector geometry: elbow, curved, or direct.',
            },
          },
          required: ['fromComponentId'],
        },
      },
      {
        name: 'showSteps',
        description: 'Display interactive sequential step-by-step guidance overlays on the live camera viewport.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              description: 'List of step objects.',
              items: {
                type: Type.OBJECT,
                properties: {
                  componentId: {
                    type: Type.STRING,
                    description: 'Component ID to highlight for this step.',
                  },
                  title: {
                    type: Type.STRING,
                    description: 'Step title (e.g. Plug in WAN Cable).',
                  },
                  instruction: {
                    type: Type.STRING,
                    description: 'Actionable guidance instruction.',
                  },
                  actionPrompt: {
                    type: Type.STRING,
                    description: 'Short indicator prompt (e.g. Insert cable until it clicks).',
                  },
                },
                required: ['title', 'instruction'],
              },
            },
            initialIndex: {
              type: Type.NUMBER,
              description: 'Zero-based initial step index.',
            },
          },
          required: ['steps'],
        },
      },
      {
        name: 'clearAnnotations',
        description: 'Clear on-screen graphical annotations, highlights, or callout cards.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            filter: {
              type: Type.STRING,
              description: 'What to clear: all, objects, components, callouts, steps, or connectors.',
            },
          },
        },
      },
    ],
  },
];

async function startServer() {
  const server = http.createServer(app);

  // Initialize WebSocket server for Gemini Live stream bridging
  const wss = new WebSocketServer({ server, path: '/api/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[DRIQ Server] Client connected to /api/live WebSocket');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('[DRIQ Server] GEMINI_API_KEY not configured.');
      clientWs.send(
        JSON.stringify({
          type: 'error',
          code: 'MISSING_API_KEY',
          message:
            'GEMINI_API_KEY is not configured on the server. Please attach an API key in Secrets.',
        })
      );
      return;
    }

    let liveSession: any = null;
    let isSessionAlive = true;

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      console.log(`[DRIQ Server] Connecting to Gemini Live API with model: ${DRIQ_LIVE_MODEL}, voice: ${DRIQ_VOICE}`);

      liveSession = await ai.live.connect({
        model: DRIQ_LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: DRIQ_VOICE },
            },
          },
          systemInstruction: DRIQ_SYSTEM_INSTRUCTION,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: DRIQ_GRAPHICAL_TOOLS,
        },
        callbacks: {
          onopen: () => {
            console.log('[DRIQ Server] Gemini Live session opened successfully');
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'session_ready',
                  model: DRIQ_LIVE_MODEL,
                  voice: DRIQ_VOICE,
                })
              );
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (!isSessionAlive || clientWs.readyState !== WebSocket.OPEN) return;

            // 1. Audio data chunks (24kHz 16-bit raw PCM)
            const audioData =
              message.serverContent?.modelTurn?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;

            if (audioData) {
              clientWs.send(
                JSON.stringify({
                  type: 'audio',
                  data: audioData,
                })
              );
            }

            // 2. Transcriptions (User input & Model output)
            const inText = (message.serverContent as any)?.inputTranscription?.text ||
              (message.serverContent as any)?.inputAudioTranscription?.text;
            if (inText) {
              clientWs.send(
                JSON.stringify({
                  type: 'input_transcript',
                  text: inText,
                })
              );
            }

            const outText = (message.serverContent as any)?.outputTranscription?.text ||
              (message.serverContent as any)?.outputAudioTranscription?.text;
            if (outText) {
              clientWs.send(
                JSON.stringify({
                  type: 'output_transcript',
                  text: outText,
                })
              );
            }

            // 3. User Interruption / Barge-in
            if (message.serverContent?.interrupted) {
              console.log('[DRIQ Server] Model interrupted by user speech');
              clientWs.send(JSON.stringify({ type: 'interrupted' }));
            }

            // 4. Turn Complete
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: 'turn_complete' }));
            }

            // 5. Official Function Calling: Tool Calls from Gemini Live
            if (message.toolCall?.functionCalls && message.toolCall.functionCalls.length > 0) {
              console.log('[DRIQ Server] Received toolCall from Gemini Live:', message.toolCall.functionCalls.map((f) => f.name));
              for (const fc of message.toolCall.functionCalls) {
                clientWs.send(
                  JSON.stringify({
                    type: 'tool_call',
                    callId: fc.id,
                    name: fc.name,
                    args: fc.args,
                  })
                );
              }
            }

            // 6. Tool Call Cancellation (if interrupted by user before execution)
            if (message.toolCallCancellation?.ids && message.toolCallCancellation.ids.length > 0) {
              console.log('[DRIQ Server] Received toolCallCancellation from Gemini Live:', message.toolCallCancellation.ids);
              clientWs.send(
                JSON.stringify({
                  type: 'tool_call_cancellation',
                  ids: message.toolCallCancellation.ids,
                })
              );
            }
          },
          onclose: () => {
            console.log('[DRIQ Server] Gemini Live session closed');
            isSessionAlive = false;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: 'session_closed' }));
            }
          },
          onerror: (err: any) => {
            console.error('[DRIQ Server] Gemini Live session error:', err);
            isSessionAlive = false;
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: err?.message || 'Gemini Live session encountered an error',
                })
              );
            }
          },
        },
      });

      // Handle messages from client browser
      clientWs.on('message', (raw: Buffer) => {
        if (!liveSession || !isSessionAlive) return;

        try {
          const msg = JSON.parse(raw.toString());

          if (msg.type === 'audio' && msg.data) {
            // Forward 16kHz PCM audio chunk to Live API
            liveSession.sendRealtimeInput({
              audio: {
                data: msg.data,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (msg.type === 'video' && msg.data) {
            // Forward sampled camera JPEG frame for visual context
            liveSession.sendRealtimeInput({
              video: {
                data: msg.data,
                mimeType: 'image/jpeg',
              },
            });
          } else if (msg.type === 'text' && msg.text) {
            // Forward textual inquiry or contextual note
            liveSession.sendRealtimeInput({
              text: msg.text,
            });
          } else if (msg.type === 'audio_end') {
            liveSession.sendRealtimeInput({
              audioStreamEnd: true,
            });
          } else if (msg.type === 'tool_response' && msg.callId) {
            console.log(`[DRIQ Server] Forwarding tool_response for ${msg.name || msg.callId} to Gemini Live:`, msg.response);
            try {
              liveSession.sendToolResponse({
                functionResponses: [
                  {
                    id: msg.callId,
                    name: msg.name,
                    response: {
                      output: msg.response || { status: 'confirmed' },
                    },
                  },
                ],
              });
            } catch (toolErr) {
              console.error('[DRIQ Server] Error dispatching sendToolResponse to Gemini Live:', toolErr);
            }
          }
        } catch (parseErr) {
          console.error('[DRIQ Server] Error parsing client message:', parseErr);
        }
      });

      clientWs.on('close', () => {
        console.log('[DRIQ Server] Client WebSocket closed. Tearing down Live session.');
        isSessionAlive = false;
        if (liveSession) {
          try {
            liveSession.close();
          } catch {}
          liveSession = null;
        }
      });

      clientWs.on('error', (err) => {
        console.error('[DRIQ Server] Client WebSocket error:', err);
        isSessionAlive = false;
        if (liveSession) {
          try {
            liveSession.close();
          } catch {}
          liveSession = null;
        }
      });
    } catch (sessionErr: any) {
      console.error('[DRIQ Server] Failed to establish Gemini Live connection:', sessionErr);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            type: 'error',
            message: sessionErr?.message || 'Failed to connect to Gemini Live service',
          })
        );
      }
    }
  });

  // Client Static / Dev Middleware
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DRIQ] Server running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[DRIQ] Failed to start server:', err);
  process.exit(1);
});
