# Collaboration Graph Plugin — Mock Data

This small helper provides test data for the `superset-plugin-chart-collaboration-graph` plugin.

Files added

- `src/mock/generateMockData.js` — Node.js script to generate mock collaboration edges.
- `src/mock/mock_data.json` — a small sample fixture.

Data shape

The script writes a JSON object with a top-level `data` array. Each row is an object with the following fields:

- `source` (string): source node identifier (e.g. `user_1`)
- `target` (string): target node identifier
- `weight` (number): strength/weight of the relationship
- `timestamp` (ISO string): event timestamp

This shape maps naturally to Superset's `queriesData[0].data` that the plugin `transformProps.ts` expects.

Quick start

Requirements: Node.js (>=12) and npm. In the repo root run:

```bash
# from plugin folder
cd superset-frontend/superset-plugin-chart-collaboration-graph

# install small dependency used by the script
npm install minimist

# generate default mock_data.json in this folder
node src/mock/generateMockData.js -o src/mock/generated.json

# or produce a larger dataset
node src/mock/generateMockData.js -n 50 -e 300 -w 8 -o src/mock/generated_big.json
```

The script will print the number of rows written and create the output JSON with a top-level `data` array.

Next steps

- Import `src/mock/generated.json` into your local Superset instance as a static dataset or configure the plugin demo to read it for visualization.
- Optionally wire the generator into test fixtures or storybook stories for the plugin.
Dev-only automatic fallback (recommended for local plugin development)

To make the plugin automatically use the generated JSON when no backend data is available in development, you can load a tiny JS helper in a non-TypeScript demo or story:

1. Generate the mock file in the plugin's `src/mock` folder (see above):

```bash
node src/mock/generateMockData.js -o src/mock/generated.json
```

2. In your local demo (storybook or a simple HTML/JS demo), import the loader to attach the mock to `window`:

```js
// inside a demo entry file (JS, not TS), relative to plugin root
import './src/mock/loadMockForDev';
```

3. The `transformProps.ts` in this plugin will check for `window.__COLLAB_GRAPH_MOCK__` when the backend response is empty and use it as the data source. This avoids TypeScript/tsconfig changes and keeps the fallback opt-in.

This approach is safe for development: the helper only runs when the generated JSON exists and when imported in a demo. Production bundles will not include it unless you explicitly import the loader.
