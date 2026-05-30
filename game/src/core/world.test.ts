import { describe, it, expect } from 'vitest';
import { World } from './world';
import { defineComponent } from './component';

const Position = defineComponent<{ x: number }>('Position');
const Tag = defineComponent<{ on: boolean }>('Tag');

describe('World', () => {
  it('stores and retrieves components per entity', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Position, { x: 5 });
    expect(w.get(e, Position)).toEqual({ x: 5 });
    expect(w.has(e, Position)).toBe(true);
    expect(w.has(e, Tag)).toBe(false);
  });

  it('queries entities that have ALL given components', () => {
    const w = new World();
    const a = w.createEntity();
    w.add(a, Position, { x: 1 }).add(a, Tag, { on: true });
    const b = w.createEntity();
    w.add(b, Position, { x: 2 });

    expect(w.query(Position).sort()).toEqual([a, b].sort());
    expect(w.query(Position, Tag)).toEqual([a]);
  });

  it('removes components and destroys entities cleanly', () => {
    const w = new World();
    const e = w.createEntity();
    w.add(e, Position, { x: 1 });

    w.remove(e, Position);
    expect(w.has(e, Position)).toBe(false);

    w.destroyEntity(e);
    expect(w.isAlive(e)).toBe(false);
  });
});
