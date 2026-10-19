// A small take on Open MCT's TelemetryAPI: each telemetry point is an object described by
// metadata (key, name, unit), and providers serve it through request (history) and/or
// subscribe (live). Views only talk to this API and never know where the data comes from.
export function createTelemetryApi() {
  const objects = new Map();
  const providers = [];

  function get(key) {
    const object = objects.get(key);
    if (!object) throw new Error(`Unknown telemetry point: ${key}`);
    return object;
  }

  return {
    addObject(object) {
      objects.set(object.key, object);
    },
    getObjects() {
      return [...objects.values()];
    },
    // Like Open MCT, the most recently added provider wins.
    addProvider(provider) {
      providers.unshift(provider);
    },
    findProvider(key, capability) {
      const object = get(key);
      return providers.find((provider) => provider[capability]?.(object)) ?? null;
    },
    async request(key, options = {}) {
      const provider = this.findProvider(key, 'supportsRequest');
      if (!provider) throw new Error(`No history provider for ${key}`);
      return provider.request(get(key), options);
    },
    subscribe(key, callback) {
      const provider = this.findProvider(key, 'supportsSubscribe');
      return provider ? provider.subscribe(get(key), callback) : () => {};
    },
  };
}
