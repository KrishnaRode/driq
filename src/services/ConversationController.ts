import { Annotation, ConversationTurn, IConversationController } from '../types';

type ConversationListener = (turns: ConversationTurn[]) => void;

export class ConversationController implements IConversationController {
  private _turns: ConversationTurn[] = [];
  private listeners: Set<ConversationListener> = new Set();

  // Phase 7: Contextual Memory & Subject Tracking
  private currentSubject: string | null = 'Wi-Fi 6 Router';
  private focalComponentId: string | null = null;
  private explanationDepth: 'concise' | 'standard' | 'deep' = 'concise';

  constructor() {
    this.initWelcomeTurns();
  }

  private initWelcomeTurns() {
    this._turns = [
      {
        id: 'turn_sys_welcome',
        role: 'system',
        text: 'DRIQ Visual Intelligence initialized. Voice persona: Aoede. Multimodal spatial grounding active.',
        timestamp: Date.now() - 4000,
      },
      {
        id: 'turn_ast_intro',
        role: 'assistant',
        text: "I am DRIQ. Point your camera at any object or hardware in your room, and ask me anything about what you see.",
        timestamp: Date.now() - 2000,
        referencedAnnotationIds: [],
      },
    ];
  }

  get turns(): ConversationTurn[] {
    return [...this._turns];
  }

  get subject(): string | null {
    return this.currentSubject;
  }

  get focalComponent(): string | null {
    return this.focalComponentId;
  }

  get depth(): 'concise' | 'standard' | 'deep' {
    return this.explanationDepth;
  }

  setSubject(subject: string) {
    this.currentSubject = subject;
  }

  setFocalComponent(componentId: string | null) {
    this.focalComponentId = componentId;
  }

  setDepth(depth: 'concise' | 'standard' | 'deep') {
    this.explanationDepth = depth;
  }

  /**
   * Detects whether the user utterance requests more depth or brevity
   */
  detectDepthPreference(utterance: string): 'concise' | 'deep' | null {
    const text = utterance.toLowerCase();
    if (
      text.includes('tell me more') ||
      text.includes('explain in detail') ||
      text.includes('deep dive') ||
      text.includes('how does that work') ||
      text.includes('elaborate')
    ) {
      this.explanationDepth = 'deep';
      return 'deep';
    }
    if (
      text.includes('in short') ||
      text.includes('briefly') ||
      text.includes('quick summary') ||
      text.includes('keep it simple')
    ) {
      this.explanationDepth = 'concise';
      return 'concise';
    }
    return null;
  }

  /**
   * Detects when the user has panned to a distinctly different object
   */
  detectSubjectChange(newSceneSummary: string): boolean {
    if (!this.currentSubject) {
      this.currentSubject = newSceneSummary;
      return false;
    }
    const currentNorm = this.currentSubject.toLowerCase();
    const newNorm = newSceneSummary.toLowerCase();

    // Check for fundamental object category divergence
    const isDifferent =
      (currentNorm.includes('router') && !newNorm.includes('router')) ||
      (currentNorm.includes('mouse') && !newNorm.includes('mouse')) ||
      (currentNorm.includes('keyboard') && !newNorm.includes('keyboard'));

    if (isDifferent) {
      console.log(`[ConversationController] Detected subject change from "${this.currentSubject}" to "${newSceneSummary}"`);
      this.currentSubject = newSceneSummary;
      this.focalComponentId = null;
      return true;
    }
    return false;
  }

  /**
   * Resolves deictic or ambiguous references like "this", "that", "the port"
   * If multiple candidate components exist, provides a clarifying prompt
   */
  resolveAmbiguity(
    utterance: string,
    candidates: Annotation[]
  ): {
    isAmbiguous: boolean;
    clarificationPrompt?: string;
    resolvedComponent?: Annotation;
  } {
    const text = utterance.toLowerCase().trim();
    const isDeictic =
      text.includes('this') ||
      text.includes('that') ||
      text.includes('what is it') ||
      text.includes('what does it do') ||
      text.includes('the button') ||
      text.includes('the port');

    if (!isDeictic) {
      return { isAmbiguous: false };
    }

    // If user previously focused on a specific component, assume context continuity
    if (this.focalComponentId) {
      const prior = candidates.find((c) => c.id === this.focalComponentId);
      if (prior) {
        return { isAmbiguous: false, resolvedComponent: prior };
      }
    }

    const visibleItems = candidates.filter((c) => c.visible !== false && !c.uncertaintyReason);

    // If there are multiple ports or buttons in view and user just said "this port"
    if (visibleItems.length > 1) {
      const names = visibleItems.slice(0, 3).map((c) => c.label);
      const prompt = `Are you referring to the ${names.join(' or the ')}?`;
      return {
        isAmbiguous: true,
        clarificationPrompt: prompt,
      };
    } else if (visibleItems.length === 1) {
      return {
        isAmbiguous: false,
        resolvedComponent: visibleItems[0],
      };
    }

    return { isAmbiguous: false };
  }

  subscribe(listener: ConversationListener): () => void {
    this.listeners.add(listener);
    listener(this.turns);
    return () => this.listeners.delete(listener);
  }

  addTurn(
    role: 'user' | 'assistant' | 'system',
    text: string,
    referencedAnnotationIds?: string[]
  ): ConversationTurn {
    const turn: ConversationTurn = {
      id: `turn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role,
      text,
      timestamp: Date.now(),
      referencedAnnotationIds,
    };
    this._turns.push(turn);
    this.notify();
    return turn;
  }

  clear() {
    this._turns = [];
    this.notify();
  }

  private notify() {
    const copy = this.turns;
    this.listeners.forEach((fn) => fn(copy));
  }
}

export const conversationController = new ConversationController();
