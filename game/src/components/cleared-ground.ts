import { defineComponent } from '../core/component';

/**
 * The "ground-cleared" signal (Option C / PR5) — left as a marker entity at the spot where a scrap
 * pile was fully rummaged and destroyed. It carries only the cleared location; it is data, not
 * behaviour. This is the SEAM the future restoration system (camp-to-restored-ground) subscribes to:
 * it will query `ClearedGround` markers to know where cleared earth is reclaimable. Nothing consumes
 * these yet — deliberately. PR5 only emits the signal; building anything restoration-aware on top of
 * it is later work, so the marker simply accumulates as honest record of where piles fell.
 */
export interface ClearedGround {
  x: number;
  z: number;
}

export const ClearedGround = defineComponent<ClearedGround>('ClearedGround');
