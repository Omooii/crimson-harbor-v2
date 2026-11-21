// Keyboard and mouse state. Keys are tracked by code; `pressed` fires once per keydown.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const input = {
    keys, pressed,
    mouseDown: false, mouseClicked: false,
    down(code) { return keys.has(code); },
    hit(code) { return pressed.has(code); },
    axis() { // steering: -1 left, +1 right; throttle: -1 reverse, +1 forward
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const t = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { steer: s, throttle: t };
    },
    endFrame() { pressed.clear(); input.mouseClicked = false; },
  };
  addEventListener('keydown', (e) => {
    if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  addEventListener('mousedown', (e) => { if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; } });
  addEventListener('mouseup', (e) => { if (e.button === 0) input.mouseDown = false; });
  addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
