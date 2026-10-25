import { IResponsiveLayoutManager, LayoutMode, ViewportInfo } from '../types';

type LayoutListener = (viewport: ViewportInfo, isContextPanelOpen: boolean) => void;

export class ResponsiveLayoutManager implements IResponsiveLayoutManager {
  private _viewport: ViewportInfo;
  private _isContextPanelOpen = false;
  private listeners: Set<LayoutListener> = new Set();
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this._viewport = this.calculateViewport();
    this.initListeners();
  }

  private calculateViewport(): ViewportInfo {
    if (typeof window === 'undefined') {
      return {
        width: 1280,
        height: 720,
        aspect: 16 / 9,
        isTouch: false,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        orientation: 'landscape',
        layoutMode: 'desktop-wide',
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      };
    }

    // Dynamic viewport measurement
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / (height || 1);
    const orientation: 'portrait' | 'landscape' = width < height ? 'portrait' : 'landscape';

    const isTouch =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error msMaxTouchPoints
      navigator.msMaxTouchPoints > 0;

    let isMobile = false;
    let isTablet = false;
    let isDesktop = false;
    let layoutMode: LayoutMode;

    if (width < 640) {
      isMobile = true;
      layoutMode = orientation === 'portrait' ? 'mobile-portrait' : 'mobile-landscape';
    } else if (width < 1024) {
      isTablet = true;
      layoutMode = 'tablet';
    } else if (width < 1440) {
      isDesktop = true;
      layoutMode = 'desktop-compact';
    } else {
      isDesktop = true;
      layoutMode = 'desktop-wide';
    }

    // Calculate safe areas (fallback defaults if env() is not directly readable via JS)
    const safeTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10);
    const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0', 10);

    return {
      width,
      height,
      aspect,
      isTouch,
      isMobile,
      isTablet,
      isDesktop,
      orientation,
      layoutMode,
      safeArea: {
        top: isNaN(safeTop) ? 0 : safeTop,
        bottom: isNaN(safeBottom) ? 0 : safeBottom,
        left: 0,
        right: 0,
      },
    };
  }

  private initListeners() {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      this._viewport = this.calculateViewport();
      // On wide desktop screens, default context panel open if not explicitly toggled
      if (this._viewport.width >= 1200 && !this._isContextPanelOpen) {
        // Keep user preference if already interacted
      }
      this.notify();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    // Also observe root document body
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      this.resizeObserver.observe(document.body);
    }
  }

  get viewport(): ViewportInfo {
    return this._viewport;
  }

  get isContextPanelOpen(): boolean {
    return this._isContextPanelOpen;
  }

  subscribe(listener: LayoutListener): () => void {
    this.listeners.add(listener);
    listener(this._viewport, this._isContextPanelOpen);
    return () => this.listeners.delete(listener);
  }

  toggleContextPanel() {
    this._isContextPanelOpen = !this._isContextPanelOpen;
    this.notify();
  }

  setContextPanelOpen(open: boolean) {
    if (this._isContextPanelOpen === open) return;
    this._isContextPanelOpen = open;
    this.notify();
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this._viewport, this._isContextPanelOpen));
  }
}

export const responsiveLayoutManager = new ResponsiveLayoutManager();
