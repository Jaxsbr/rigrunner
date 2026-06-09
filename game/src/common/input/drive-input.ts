export interface DriveIntent {
  throttle: number; // -1 reverse … 0 … 1 forward
  steer: number;    // -1 right … 0 … 1 left
  work: boolean;    // E held — hold-to-work a scrap pile (the rummage gate decides if it does anything)
  boost: boolean;   // Shift held — request boost (the boost system gates it on heat + engine type)
}

export interface DriveInput {
  poll(): DriveIntent;
  dispose(): void;
}

/**
 * Maps WASD device events to a DriveIntent. Knows nothing about the ECS, the World, or
 * any system — it only produces intent. The composition root feeds that intent to
 * whichever entity is being driven, keeping input fully decoupled from simulation.
 */
export function createDriveInput(target: Window = window): DriveInput {
  const keys: Record<string, boolean> = Object.create(null);
  const intent: DriveIntent = { throttle: 0, steer: 0, work: false, boost: false };

  const onDown = (e: KeyboardEvent): void => { keys[e.key.toLowerCase()] = true; };
  const onUp = (e: KeyboardEvent): void => { keys[e.key.toLowerCase()] = false; };
  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);

  return {
    poll(): DriveIntent {
      intent.throttle = (keys['w'] ? 1 : 0) - (keys['s'] ? 1 : 0);
      intent.steer = (keys['a'] ? 1 : 0) - (keys['d'] ? 1 : 0);
      intent.work = !!keys['e'];
      intent.boost = !!keys['shift']; // both Shift keys report key === 'Shift' → lowercased 'shift'
      return intent;
    },
    dispose(): void {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
    },
  };
}
