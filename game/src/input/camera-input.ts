export interface CameraIntent {
  zoom: number;   // wheel deltaY accumulated since last poll (+ = zoom out)
  rotate: number; // middle-drag horizontal movement accumulated (movementX)
}

export interface CameraInput {
  poll(): CameraIntent;
  dispose(): void;
}

/**
 * Maps mouse device events to a CameraIntent. Like DriveInput, it knows nothing about the
 * render layer or camera state — it only accumulates raw control deltas (wheel for zoom,
 * middle-button horizontal drag for orbit) and hands them over each frame, leaving the view
 * to own how those deltas move the camera. Deltas accumulate so a poll never drops events
 * fired between frames.
 *
 * Wheel + pointerdown bind to the canvas (the view surface); pointermove/up bind to the
 * window so a drag keeps tracking even if the cursor leaves the canvas mid-gesture.
 */
export function createCameraInput(canvas: HTMLCanvasElement): CameraInput {
  const intent: CameraIntent = { zoom: 0, rotate: 0 };
  let dragging = false;

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    intent.zoom += e.deltaY;
  };
  // Middle-button down: suppress the browser's autoscroll, then begin an orbit drag.
  const onMouseDown = (e: MouseEvent): void => { if (e.button === 1) e.preventDefault(); };
  const onPointerDown = (e: PointerEvent): void => { if (e.button === 1) dragging = true; };
  const onPointerMove = (e: PointerEvent): void => {
    if (!dragging) return;
    intent.rotate += e.movementX;
  };
  const onPointerUp = (e: PointerEvent): void => { if (e.button === 1) dragging = false; };

  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    poll(): CameraIntent {
      const snapshot = { zoom: intent.zoom, rotate: intent.rotate };
      intent.zoom = 0;
      intent.rotate = 0;
      return snapshot;
    },
    dispose(): void {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
  };
}
