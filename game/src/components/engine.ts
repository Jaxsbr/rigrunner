import { defineComponent } from '../core/component';

/** The capability to propel + steer: tuning only. Dynamic state lives in Velocity. */
export interface Engine {
  accel: number;         // units/s^2 applied under full throttle
  maxSpeed: number;      // forward top speed
  reverseMax: number;    // reverse top speed
  friction: number;      // deceleration/s when coasting
  turnRate: number;      // rad/s at full steering authority
  turnFullSpeed: number; // speed at which steering reaches full authority
}

export const Engine = defineComponent<Engine>('Engine');
