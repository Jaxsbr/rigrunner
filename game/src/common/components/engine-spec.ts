import { defineComponent } from '@core/component';

/**
 * The performance an engine part contributes to the rig it's mounted on. This is what makes one
 * engine better than another: the drive system reads it (aggregated across all mounted engines)
 * instead of using fixed numbers, so a weak engine drives slow and a strong one drives fast.
 *
 *  - power  → top speed. How fast the rig can ultimately go.
 *  - torque → acceleration / pulling force. How hard it gets up to speed, and (once a cargo/load
 *             system exists) how well it holds performance under load. A high-torque, low-power
 *             engine is the "slow but strong hauler"; high-power, low-torque is "fast but can't
 *             carry much".
 *
 * Architecture note: today these attributes are authored per engine (the Mk1/Mk2 blueprints in
 * content/engines.ts). In future, an engine will be CUSTOM — assembled from sub-parts — and this
 * spec becomes the *computed sum* of those parts. The drive system never needs to change: it only
 * ever reads the resulting EngineSpec, however it was produced.
 */
export interface EngineSpec {
  power: number;  // contribution to top speed (units/s)
  torque: number; // contribution to acceleration (units/s^2)
}

export const EngineSpec = defineComponent<EngineSpec>('EngineSpec');
