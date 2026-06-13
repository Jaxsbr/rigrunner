import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { CollisionGrid } from '@features/terrain/collision-grid';
import { ModelLoader } from '@shared/model-loader';
import { spawnPlacement } from '../world-map/spawn-placements';
import { placementKind, type Placement } from '../world-map/placement';
import { bakeTemplateFootprint } from './mesh-bake';

/** A placed kind and every entity it spawned (a composite makes several — a shop + its yard, a camp + guards). */
export interface PlacementRecord {
  placement: Placement;
  entities: EntityId[];
}

/**
 * The editor's authored-layout model: the live list of placements, the entities each one spawned (for
 * select / move / delete), and the collision bake that keeps the wall grid honest as the layout changes.
 *
 * Collision uses TWO grids of identical geometry:
 *  - `base`     — the hand-painted layer (the mountain + brush touch-ups). The paint tool edits this.
 *  - `effective`— what the game loads and the wash shows: `base ∪ (footprints of every autoBake kind)`.
 *
 * `recompute` rebuilds `effective` from scratch on every layout change, so moving or deleting a placement
 * can never leave an orphaned blocked cell — the old footprint simply isn't in the new union. Footprints
 * are baked from each placement's GLB template (loaded here, independent of the render), so the bake never
 * waits on the entity being drawn. The save writes `effective` as `blocked` and `base` as `baseBlocked`,
 * so a re-opened editor reconstructs the same two layers (see `editor.ts`).
 */
export class PlacementStore {
  private readonly records: PlacementRecord[] = [];
  private readonly models = new ModelLoader();
  private version = 0; // bumped per recompute so a stale async bake can detect it was superseded

  constructor(
    private readonly world: World,
    private readonly base: CollisionGrid,
    private readonly effective: CollisionGrid,
    /** Called after a recompute updates `effective` — wired to the wash redraw. */
    private readonly onChanged: () => void,
  ) {}

  /** Seed the editor from the map's authored placements (all persistence classes — it shows everything). */
  load(placements: readonly Placement[]): void {
    for (const p of placements) {
      const placement = { ...p };
      this.records.push({ placement, entities: spawnPlacement(this.world, placement) });
    }
    void this.recompute();
  }

  get all(): readonly PlacementRecord[] {
    return this.records;
  }

  /** The current authored layout, copied out for serialization. */
  placements(): Placement[] {
    return this.records.map((r) => ({ ...r.placement }));
  }

  /** Drop a new placement of `kind` at (x,z) facing `rotationY`; returns its record. */
  add(kind: string, x: number, z: number, rotationY: number): PlacementRecord {
    const placement: Placement = { kind, x, z, rotationY };
    const rec: PlacementRecord = { placement, entities: spawnPlacement(this.world, placement) };
    this.records.push(rec);
    void this.recompute();
    return rec;
  }

  /** Rigidly shift a placement and its entities by (dx,dz). Cheap by design — recompute the bake on drop. */
  translate(rec: PlacementRecord, dx: number, dz: number): void {
    rec.placement.x += dx;
    rec.placement.z += dz;
    for (const e of rec.entities) {
      const t = this.world.get(e, Transform);
      if (t) {
        t.x += dx;
        t.z += dz;
      }
    }
  }

  /** Re-face a placement: respawn its entities at the new heading (so a composite re-lays correctly). */
  setRotation(rec: PlacementRecord, rotationY: number): void {
    rec.placement.rotationY = rotationY;
    this.respawn(rec);
    void this.recompute();
  }

  /** Remove a placement and every entity it spawned. */
  remove(rec: PlacementRecord): void {
    for (const e of rec.entities) this.world.destroyEntity(e);
    const i = this.records.indexOf(rec);
    if (i >= 0) this.records.splice(i, 1);
    void this.recompute();
  }

  /** The placement that owns an entity (any of its spawned set) — a clicked camp guard resolves to its camp. */
  recordForEntity(e: EntityId): PlacementRecord | null {
    return this.records.find((r) => r.entities.includes(e)) ?? null;
  }

  /** Every placement-owned entity — the picker's candidate set for selection (never the backdrop scenery). */
  candidateEntities(): EntityId[] {
    return this.records.flatMap((r) => r.entities);
  }

  /**
   * Re-derive `effective = base ∪ (footprints of all autoBake placements)`. Called after any layout change
   * and after the mountain re-bake. Async because footprints come from GLB templates the loader fetches;
   * a `version` guard drops a recompute that a newer one has overtaken, so rapid edits converge cleanly.
   */
  async recompute(): Promise<void> {
    const v = ++this.version;

    // Footprints accumulate into a scratch grid (clear to start) so we never read a half-updated base.
    const footprint = new CollisionGrid({
      width: this.base.width,
      height: this.base.height,
      cellSize: this.base.cellSize,
      originX: this.base.originX,
      originZ: this.base.originZ,
    });
    for (const rec of this.records) {
      const def = placementKind(rec.placement.kind);
      if (!def?.autoBake) continue;
      const template = await this.models.load(def.ghostAssetId).catch(() => null);
      if (this.version !== v) return; // superseded by a newer recompute — abandon this stale pass
      if (!template) continue;
      bakeTemplateFootprint(template, footprint, rec.placement.x, rec.placement.z, rec.placement.rotationY, def.ghostScale ?? 1);
    }
    if (this.version !== v) return;

    // effective = base ∪ footprint, reading base NOW so any brush stroke that landed mid-recompute is kept.
    const eff = this.effective.cells;
    const b = this.base.cells;
    const f = footprint.cells;
    for (let i = 0; i < eff.length; i++) eff[i] = b[i]! | f[i]! ? 1 : 0;
    this.onChanged();
  }

  private respawn(rec: PlacementRecord): void {
    for (const e of rec.entities) this.world.destroyEntity(e);
    rec.entities = spawnPlacement(this.world, rec.placement);
  }
}
