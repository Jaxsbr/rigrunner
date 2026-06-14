import type { World } from '@core/world';
import type { EntityId } from '@core/types';
import { Transform } from '@common/components/transform';
import { CollisionGrid } from '@features/terrain/collision-grid';
import { ModelLoader } from '@shared/model-loader';
import { spawnPlacement } from '../world-map/spawn-placements';
import { placementKind, type Placement } from '../world-map/placement';
import { bakeTemplateFootprint } from './mesh-bake';

/** A placed kind, every entity it spawned, and the grid cells its footprint blocked (for clean un-bake). */
export interface PlacementRecord {
  placement: Placement;
  entities: EntityId[];
  /** Cell indices this placement's auto-baked footprint set, so a move/delete clears exactly them. */
  stamped: Set<number>;
}

/**
 * The editor's authored-layout model over ONE authoritative collision grid.
 *
 * The grid is the single source of truth — the exact `blocked` bytes loaded from disk and saved back. The
 * brush edits it directly; a placed solid kind's footprint is STAMPED into it once. There is deliberately
 * no second layer and no re-derivation: opening a map shows precisely what was saved, and a hand edit
 * (including an erase that trims an over-baked footprint) sticks, because nothing recomputes over it.
 *
 * Moving or deleting a placement stays orphan-free by tracking the cells each footprint stamped and
 * clearing exactly them (minus any another placement still owns) — no whole-grid recompute, so hand edits
 * elsewhere are never touched. Footprints are baked from each kind's GLB template (loaded here), so the
 * bake never waits on the entity being drawn.
 */
export class PlacementStore {
  private readonly records: PlacementRecord[] = [];
  private readonly models = new ModelLoader();

  constructor(
    private readonly world: World,
    private readonly grid: CollisionGrid,
    /** Called after the grid changes — wired to the wash redraw. */
    private readonly onChanged: () => void,
  ) {}

  /**
   * Seed the editor from the map's authored placements. The grid already carries their saved footprints,
   * so this does NOT re-stamp (load stays faithful to `blocked`); it only RECORDS each footprint's cells
   * so a later move/delete can clear exactly them.
   */
  load(placements: readonly Placement[]): void {
    for (const p of placements) {
      const rec: PlacementRecord = { placement: { ...p }, entities: spawnPlacement(this.world, { ...p }), stamped: new Set() };
      this.records.push(rec);
      void this.footprintCells(rec).then((cells) => { rec.stamped = cells; });
    }
  }

  get all(): readonly PlacementRecord[] {
    return this.records;
  }

  /** The current authored layout, copied out for serialization. */
  placements(): Placement[] {
    return this.records.map((r) => ({ ...r.placement }));
  }

  /** Drop a new placement of `kind` at (x,z) facing `rotationY`; stamps its footprint into the grid. */
  add(kind: string, x: number, z: number, rotationY: number): PlacementRecord {
    const rec: PlacementRecord = { placement: { kind, x, z, rotationY }, entities: spawnPlacement(this.world, { kind, x, z, rotationY }), stamped: new Set() };
    this.records.push(rec);
    void this.stamp(rec);
    return rec;
  }

  /** Rigidly shift a placement and its entities by (dx,dz). Cheap by design — re-stamp on `commitMove`. */
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

  /** Finalise a drag: clear the old footprint, bake the new one at the moved position. */
  async commitMove(rec: PlacementRecord): Promise<void> {
    this.unstamp(rec);
    await this.stamp(rec);
  }

  /** Re-face a placement: respawn its entities and re-bake its footprint at the new heading. */
  async setRotation(rec: PlacementRecord, rotationY: number): Promise<void> {
    rec.placement.rotationY = rotationY;
    this.unstamp(rec);
    this.respawn(rec);
    await this.stamp(rec);
  }

  /** Remove a placement: clear its footprint and destroy every entity it spawned. */
  remove(rec: PlacementRecord): void {
    this.unstamp(rec);
    for (const e of rec.entities) this.world.destroyEntity(e);
    const i = this.records.indexOf(rec);
    if (i >= 0) this.records.splice(i, 1);
  }

  /** Re-stamp every placement footprint into the grid — after a mountain re-bake cleared the grid. */
  async restampAll(): Promise<void> {
    for (const rec of this.records) {
      rec.stamped = new Set();
      await this.stamp(rec);
    }
  }

  /** The placement that owns an entity (any of its spawned set) — a clicked camp guard resolves to its camp. */
  recordForEntity(e: EntityId): PlacementRecord | null {
    return this.records.find((r) => r.entities.includes(e)) ?? null;
  }

  /** Every placement-owned entity — the picker's candidate set for selection (never the backdrop scenery). */
  candidateEntities(): EntityId[] {
    return this.records.flatMap((r) => r.entities);
  }

  // ── footprint stamping ─────────────────────────────────────────────────────────────────────────────

  /** The cells a placement's footprint covers — its GLB template baked at its transform — or empty (no bake). */
  private async footprintCells(rec: PlacementRecord): Promise<Set<number>> {
    const def = placementKind(rec.placement.kind);
    if (!def?.autoBake) return new Set();
    const template = await this.models.load(def.ghostAssetId).catch(() => null);
    if (!template) return new Set();
    const scratch = new CollisionGrid({
      width: this.grid.width,
      height: this.grid.height,
      cellSize: this.grid.cellSize,
      originX: this.grid.originX,
      originZ: this.grid.originZ,
    });
    bakeTemplateFootprint(template, scratch, rec.placement.x, rec.placement.z, rec.placement.rotationY, def.ghostScale ?? 1);
    const cells = new Set<number>();
    for (let i = 0; i < scratch.cells.length; i++) if (scratch.cells[i]) cells.add(i);
    return cells;
  }

  /** Bake the footprint INTO the grid and record its cells (the auto-bake-on-placement). */
  private async stamp(rec: PlacementRecord): Promise<void> {
    const cells = await this.footprintCells(rec);
    for (const i of cells) this.grid.cells[i] = 1;
    rec.stamped = cells;
    this.onChanged();
  }

  /** Clear this placement's footprint cells, except any another placement still owns. Leaves the rest alone. */
  private unstamp(rec: PlacementRecord): void {
    for (const i of rec.stamped) {
      if (!this.records.some((r) => r !== rec && r.stamped.has(i))) this.grid.cells[i] = 0;
    }
    rec.stamped = new Set();
    this.onChanged();
  }

  private respawn(rec: PlacementRecord): void {
    for (const e of rec.entities) this.world.destroyEntity(e);
    rec.entities = spawnPlacement(this.world, rec.placement);
  }
}
