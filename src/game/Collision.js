/**
 * Честные столкновения по осям: X, Z и высоте.
 * Никаких «случайных» попаданий — только пересечение коробок.
 */

export function hitsObstacle(playerCollider, obstacle, sweptZ = 0) {
  const dx = Math.abs(playerCollider.x - obstacle.x);
  if (dx > playerCollider.halfW + obstacle.halfW) return false;

  const dz = Math.abs(obstacle.z);
  if (dz > playerCollider.halfD + obstacle.halfD + sweptZ) return false;

  if (playerCollider.maxY <= obstacle.minY) return false;
  if (playerCollider.minY >= obstacle.maxY) return false;

  return true;
}

export function inCollectRange(playerCollider, item, sweptZ = 0) {
  const dx = Math.abs(playerCollider.x - item.x);
  if (dx > 0.78) return false;

  if (Math.abs(item.z) > 0.85 + sweptZ) return false;

  const playerCenterY = (playerCollider.minY + playerCollider.maxY) * 0.5;
  if (Math.abs(playerCenterY - item.baseY) > 1.25) return false;

  return true;
}
