/**
 * Does an emitter at (ox, oz) facing `rotationY` have the point (px, pz) within its field-of-view cone
 * `fov`? The emitter's front is local −Z — direction (−sin θ, −cos θ) at yaw θ (the convention shared
 * with movement and MountFacing). We compare the angle between that front and the direction to the
 * point against half the full FOV via a dot product, so a 120° FOV admits anything up to 60° off-axis.
 *
 * A shared `@common/sim` primitive (ADR-003): two features aim through it — scrap (the Reclaimer's dig
 * gate) and camps (the weapon's auto-fire cone) — and it carries no feature semantics, so it lives in
 * the kernel rather than being copied. Pure planar geometry, trivially testable.
 */
export function facingWithinFov(
  ox: number,
  oz: number,
  rotationY: number,
  px: number,
  pz: number,
  fov: number,
): boolean {
  const toX = px - ox;
  const toZ = pz - oz;
  const len = Math.hypot(toX, toZ);
  if (len === 0) return true; // standing on it — trivially "facing"
  const fwdX = -Math.sin(rotationY);
  const fwdZ = -Math.cos(rotationY);
  const cosTo = (fwdX * toX + fwdZ * toZ) / len; // both fwd and to/len are unit-length
  return cosTo >= Math.cos(fov / 2);
}
