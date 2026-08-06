(function () {
  "use strict";

  const events = new Map();

  window.SimpleAdvEventRegistry = Object.freeze({
    register(id, definition) {
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) throw new Error(`INVALID_EVENT_ID:${id}`);
      if (!definition || typeof definition.run !== "function" || typeof definition.validate !== "function" || !definition.resultTypes) {
        throw new Error(`INVALID_EVENT_DEFINITION:${id}`);
      }
      if (events.has(id)) throw new Error(`DUPLICATE_EVENT:${id}`);
      events.set(id, Object.freeze(definition));
    },
    has(id) { return events.has(id); },
    get(id) { return events.get(id); },
    ids() { return [...events.keys()]; }
  });
}());
