import {
  DisplayedVideoRect,
  FitMode,
  GeometryTestResult,
  GroundingBox,
  IVideoGeometryMapper,
  NormalizedPoint,
  SafeAreaInsets,
  ScreenPoint,
  VideoGeometry,
} from '../types';

export class VideoGeometryMapper implements IVideoGeometryMapper {
  /**
   * Computes the exact geometric transformation matrix for the video feed inside its container.
   * Handles cover/contain, letterboxing, pillarboxing, scale factors, cropping offsets,
   * camera mirroring, orientation, and safe-area insets.
   */
  computeGeometry(
    container: { width: number; height: number },
    video: { width: number; height: number },
    fit: FitMode = 'cover',
    isMirrored = false,
    safeArea: SafeAreaInsets = { top: 0, bottom: 0, left: 0, right: 0 }
  ): VideoGeometry {
    const cw = Math.max(1, container.width);
    const ch = Math.max(1, container.height);
    const vw = Math.max(1, video.width);
    const vh = Math.max(1, video.height);

    const containerAspect = cw / ch;
    const videoAspect = vw / vh;
    const orientation: 'portrait' | 'landscape' = cw < ch ? 'portrait' : 'landscape';

    let renderedWidth: number;
    let renderedHeight: number;
    let scale: number;

    if (fit === 'cover') {
      if (containerAspect > videoAspect) {
        // Container is wider than video aspect: match container width, crop top/bottom
        renderedWidth = cw;
        renderedHeight = cw / videoAspect;
        scale = cw / vw;
      } else {
        // Container is taller than video aspect: match container height, crop left/right
        renderedHeight = ch;
        renderedWidth = ch * videoAspect;
        scale = ch / vh;
      }
    } else {
      // 'contain'
      if (containerAspect > videoAspect) {
        // Fit by height with pillarbox bars on left/right
        renderedHeight = ch;
        renderedWidth = ch * videoAspect;
        scale = ch / vh;
      } else {
        // Fit by width with letterbox bars on top/bottom
        renderedWidth = cw;
        renderedHeight = cw / videoAspect;
        scale = cw / vw;
      }
    }

    const offsetX = (cw - renderedWidth) / 2;
    const offsetY = (ch - renderedHeight) / 2;

    const cropX = Math.max(0, -offsetX / scale);
    const cropY = Math.max(0, -offsetY / scale);

    const displayedRect: DisplayedVideoRect = {
      left: offsetX,
      top: offsetY,
      width: renderedWidth,
      height: renderedHeight,
      scale,
      scaleX: isMirrored ? -scale : scale,
      scaleY: scale,
      offsetX,
      offsetY,
      cropX,
      cropY,
    };

    return {
      containerWidth: cw,
      containerHeight: ch,
      videoWidth: vw,
      videoHeight: vh,
      fit,
      isMirrored,
      orientation,
      displayedRect,
      safeArea,
    };
  }

  /**
   * Maps a canonical 0-1000 normalized bounding box [ymin, xmin, ymax, xmax]
   * to exact screen pixel coordinates within the container.
   * Accurately handles horizontal mirroring when selfie camera is active.
   */
  mapBoxToScreen(
    box: GroundingBox,
    geometry: VideoGeometry
  ): { x: number; y: number; width: number; height: number } {
    const [ymin, xmin, ymax, xmax] = box;
    const { displayedRect, isMirrored } = geometry;

    const fXmin = Math.max(0, Math.min(1000, xmin)) / 1000;
    const fXmax = Math.max(0, Math.min(1000, xmax)) / 1000;
    const fYmin = Math.max(0, Math.min(1000, ymin)) / 1000;
    const fYmax = Math.max(0, Math.min(1000, ymax)) / 1000;

    const width = Math.max(0, (fXmax - fXmin) * displayedRect.width);
    const height = Math.max(0, (fYmax - fYmin) * displayedRect.height);

    let x: number;
    if (isMirrored) {
      // Mirrored horizontally: xmin appears at 1 - xmax
      x = displayedRect.left + (1 - fXmax) * displayedRect.width;
    } else {
      x = displayedRect.left + fXmin * displayedRect.width;
    }

    const y = displayedRect.top + fYmin * displayedRect.height;

    return { x, y, width, height };
  }

  /**
   * Reverse-maps screen pixel coordinates (e.g. touch or click on container)
   * into canonical [0, 1000] normalized vision coordinates.
   * Inverts mirroring automatically so tap matches visual feature.
   */
  mapScreenToBox(
    screenX: number,
    screenY: number,
    geometry: VideoGeometry
  ): { normX: number; normY: number } {
    const { displayedRect, isMirrored } = geometry;

    if (displayedRect.width <= 0 || displayedRect.height <= 0) {
      return { normX: 500, normY: 500 };
    }

    const relX = screenX - displayedRect.left;
    const relY = screenY - displayedRect.top;

    let fracX = relX / displayedRect.width;
    const fracY = relY / displayedRect.height;

    if (isMirrored) {
      fracX = 1 - fracX;
    }

    const normX = Math.round(fracX * 1000);
    const normY = Math.round(fracY * 1000);

    return {
      normX: Math.max(0, Math.min(1000, normX)),
      normY: Math.max(0, Math.min(1000, normY)),
    };
  }

  mapNormalizedPointToScreen(point: NormalizedPoint, geometry: VideoGeometry): ScreenPoint {
    const { displayedRect, isMirrored } = geometry;
    const fracX = Math.max(0, Math.min(1000, point.normX)) / 1000;
    const fracY = Math.max(0, Math.min(1000, point.normY)) / 1000;

    let x: number;
    if (isMirrored) {
      x = displayedRect.left + (1 - fracX) * displayedRect.width;
    } else {
      x = displayedRect.left + fracX * displayedRect.width;
    }

    const y = displayedRect.top + fracY * displayedRect.height;
    return { x, y };
  }

  mapScreenPointToNormalized(point: ScreenPoint, geometry: VideoGeometry): NormalizedPoint {
    const { displayedRect, isMirrored } = geometry;
    const relX = point.x - displayedRect.left;
    const relY = point.y - displayedRect.top;

    let fracX = relX / (displayedRect.width || 1);
    const fracY = relY / (displayedRect.height || 1);

    if (isMirrored) {
      fracX = 1 - fracX;
    }

    return {
      normX: Math.max(0, Math.min(1000, Math.round(fracX * 1000))),
      normY: Math.max(0, Math.min(1000, Math.round(fracY * 1000))),
    };
  }

  /**
   * Runs automated mathematical verification suite across all critical aspect ratios:
   * 9:16, 16:9, 4:3, 3:4, 1:1, 21:9, and arbitrary odd resized container dimensions.
   * Validates both 'cover' and 'contain' modes and verifies round-trip coordinate invariance.
   */
  runComprehensiveGeometryTests(): GeometryTestResult[] {
    const testCases: Array<{
      name: string;
      video: { width: number; height: number };
      container: { width: number; height: number };
      fit: FitMode;
      mirrored: boolean;
    }> = [
      // 1. 9:16 Vertical Smartphone
      {
        name: '9:16 Mobile Portrait (Cover)',
        video: { width: 1080, height: 1920 },
        container: { width: 390, height: 844 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '9:16 Mobile Portrait (Contain)',
        video: { width: 1080, height: 1920 },
        container: { width: 390, height: 844 },
        fit: 'contain',
        mirrored: false,
      },
      // 2. 16:9 Standard Widescreen
      {
        name: '16:9 Desktop Widescreen (Cover)',
        video: { width: 1920, height: 1080 },
        container: { width: 1440, height: 900 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '16:9 Desktop Widescreen (Contain)',
        video: { width: 1920, height: 1080 },
        container: { width: 1440, height: 900 },
        fit: 'contain',
        mirrored: false,
      },
      // 3. 4:3 Tablet / Classic Camera
      {
        name: '4:3 Tablet Horizontal (Cover)',
        video: { width: 1600, height: 1200 },
        container: { width: 1024, height: 768 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '4:3 Tablet Horizontal (Contain)',
        video: { width: 1600, height: 1200 },
        container: { width: 1024, height: 768 },
        fit: 'contain',
        mirrored: false,
      },
      // 4. 3:4 Vertical Tablet
      {
        name: '3:4 Tablet Portrait (Cover)',
        video: { width: 1200, height: 1600 },
        container: { width: 768, height: 1024 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '3:4 Tablet Portrait (Contain)',
        video: { width: 1200, height: 1600 },
        container: { width: 768, height: 1024 },
        fit: 'contain',
        mirrored: false,
      },
      // 5. 1:1 Square Split-Screen
      {
        name: '1:1 Square Viewport (Cover)',
        video: { width: 1280, height: 720 },
        container: { width: 600, height: 600 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '1:1 Square Viewport (Contain)',
        video: { width: 1280, height: 720 },
        container: { width: 600, height: 600 },
        fit: 'contain',
        mirrored: false,
      },
      // 6. 21:9 Ultrawide Cinematic Monitor
      {
        name: '21:9 Ultrawide Display (Cover)',
        video: { width: 1920, height: 1080 },
        container: { width: 2560, height: 1080 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: '21:9 Ultrawide Display (Contain)',
        video: { width: 1920, height: 1080 },
        container: { width: 2560, height: 1080 },
        fit: 'contain',
        mirrored: false,
      },
      // 7. Arbitrary Resized Window / Multi-window
      {
        name: 'Arbitrary Window 733×419 (Cover)',
        video: { width: 1280, height: 720 },
        container: { width: 733, height: 419 },
        fit: 'cover',
        mirrored: false,
      },
      {
        name: 'Arbitrary Window 733×419 (Contain)',
        video: { width: 1280, height: 720 },
        container: { width: 733, height: 419 },
        fit: 'contain',
        mirrored: false,
      },
      // 8. Front Camera Mirroring Invariance Test
      {
        name: 'Front Camera Mirrored Mode (Cover)',
        video: { width: 1280, height: 720 },
        container: { width: 1000, height: 600 },
        fit: 'cover',
        mirrored: true,
      },
    ];

    const results: GeometryTestResult[] = [];

    for (const tc of testCases) {
      const geom = this.computeGeometry(tc.container, tc.video, tc.fit, tc.mirrored);

      // Invariance test: Map test boxes [250, 250, 750, 750] and check round-trip
      const testBoxes: GroundingBox[] = [
        [0, 0, 1000, 1000],       // Full Frame
        [250, 250, 750, 750],     // Center Square
        [100, 200, 400, 600],     // Asymmetric quadrant
        [500, 500, 510, 510],     // Focal point
      ];

      let maxDrift = 0;
      for (const box of testBoxes) {
        const screenRect = this.mapBoxToScreen(box, geom);

        // Reverse map center of box
        const centerScreenX = screenRect.x + screenRect.width / 2;
        const centerScreenY = screenRect.y + screenRect.height / 2;
        const mappedBack = this.mapScreenToBox(centerScreenX, centerScreenY, geom);

        const expectedNormX = (box[1] + box[3]) / 2;
        const expectedNormY = (box[0] + box[2]) / 2;

        const driftX = Math.abs(mappedBack.normX - expectedNormX);
        const driftY = Math.abs(mappedBack.normY - expectedNormY);
        maxDrift = Math.max(maxDrift, driftX, driftY);
      }

      // Max drift <= 1 coordinate unit out of 1000 (0.1% rounding tolerance)
      const passed = maxDrift <= 1;

      results.push({
        aspectName: tc.name,
        videoDimensions: tc.video,
        containerDimensions: tc.container,
        fitMode: tc.fit,
        isMirrored: tc.mirrored,
        passed,
        maxCoordinateDrift: maxDrift,
        details: passed
          ? `Rendered: ${Math.round(geom.displayedRect.width)}×${Math.round(geom.displayedRect.height)}px · Scale: ${geom.displayedRect.scale.toFixed(3)}x · Drift: ${maxDrift}u`
          : `Drift threshold exceeded: ${maxDrift}u`,
      });
    }

    return results;
  }
}

export const videoGeometryMapper = new VideoGeometryMapper();
