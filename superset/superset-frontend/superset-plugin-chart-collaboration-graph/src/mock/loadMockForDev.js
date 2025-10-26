// Helper to attach the generated mock JSON to window for development demos.
// Usage (in a non-TS demo/story file):
// import './src/mock/loadMockForDev';
try {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const mock = require('./generated.json');
  // eslint-disable-next-line no-undef
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-underscore-dangle
    window.__COLLAB_GRAPH_MOCK__ = mock;
    // eslint-disable-next-line no-console
    console.info('Attached local collaboration graph mock to window.__COLLAB_GRAPH_MOCK__');
  }
} catch (e) {
  // no-op if file not present
}
