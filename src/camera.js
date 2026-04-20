// Folge-Kamera mit horizontaler Dead-Zone.

export const camera = {
  x: 0,
  y: 0,
  w: 1280,
  h: 720,
};

export function followCamera(player, level) {
  const deadZoneW = 360;
  const screenX = player.x - camera.x;
  const leftBound = (camera.w - deadZoneW) / 2;
  const rightBound = leftBound + deadZoneW;
  if (screenX < leftBound) camera.x -= (leftBound - screenX);
  else if (screenX > rightBound) camera.x += (screenX - rightBound);
  // Clamp
  camera.x = Math.max(0, Math.min(level.width - camera.w, camera.x));
}

export function centerCameraOn(x) {
  camera.x = x - camera.w / 2;
}
