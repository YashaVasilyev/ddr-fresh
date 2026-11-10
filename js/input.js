// input.js — keyboard + mouse input for DDR Fresh.
// Arrows = lanes 0..3 (left/down/up/right), Space = ok/start, click = ok.
// Lane presses are edge-triggered (key-repeat ignored) and queued for polling;
// menu actions are emitted as events ('left'|'down'|'up'|'right'|'ok'|'click').

const LANE_KEYS = Object.freeze({
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
});

const MENU_ACTION = Object.freeze({
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
});

function makeEmitter() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(fn);
      return this;
    },
    emit(name, ...args) {
      const list = map.get(name);
      if (list) for (const fn of list.slice()) fn(...args);
      return this;
    },
  };
}

/**
 * createInput({ bus?, onLanePress?, onLeft?, onRight?, onUp?, onDown?, onOk?, onClick?, ... })
 *   bus   — optional emitter with .emit(); an internal one is exposed as input.bus.
 *   onXxx — optional direct callbacks, fired in addition to the bus.
 * Events: 'lanePress'(lane), 'left'|'down'|'up'|'right'(lane), 'ok'(), 'click'(event)
 */
export function createInput(opts = {}) {
  const bus = opts.bus && typeof opts.bus.emit === 'function' ? opts.bus : makeEmitter();

  function emit(name, ...args) {
    bus.emit(name, ...args);
    const h = opts[name];
    if (typeof h === 'function') h(...args);
  }

  const pressQueue = [];      // edge-triggered lane presses, FIFO
  const held = new Set();     // held lane indices + 'space'

  function onKeyDown(e) {
    const lane = LANE_KEYS[e.key];
    if (lane !== undefined) {
      if (e.preventDefault) e.preventDefault();
      if (!e.repeat) {
        pressQueue.push(lane);
        emit('lanePress', lane);
        emit(MENU_ACTION[e.key], lane);
      }
      held.add(lane);
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      if (e.preventDefault) e.preventDefault();
      if (!e.repeat) emit('ok');
      held.add('space');
    }
  }

  function onKeyUp(e) {
    const lane = LANE_KEYS[e.key];
    if (lane !== undefined) { held.delete(lane); return; }
    if (e.key === ' ' || e.code === 'Space') held.delete('space');
  }

  function onMouseDown(e) {
    emit('click', e);
    emit('ok');
  }

  function onBlur() {
    held.clear(); // avoid stuck keys when the window loses focus
  }

  const hasWindow = typeof window !== 'undefined' && typeof window.addEventListener === 'function';
  if (hasWindow) {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('blur', onBlur);
  }

  return {
    bus,
    /** Edge-triggered: returns the next queued lane press (0..3) or null. */
    consumeLanePress() {
      return pressQueue.length ? pressQueue.shift() : null;
    },
    /** Snapshot of currently held keys: lane indices (0..3) and/or 'space'. */
    heldKeys() {
      return new Set(held);
    },
    on(name, fn) { return bus.on(name, fn); },
    /** Test/manual injection helpers. */
    injectKeyDown(key, { repeat = false } = {}) { onKeyDown({ key, repeat, preventDefault() {} }); },
    injectKeyUp(key) { onKeyUp({ key }); },
    /** Detach all window listeners. */
    destroy() {
      if (!hasWindow) return;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('blur', onBlur);
    },
  };
}

export { LANE_KEYS };
export default createInput;
