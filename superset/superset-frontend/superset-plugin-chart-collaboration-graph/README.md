# superset-plugin-chart-collaboration-graph

This is the Superset Plugin Chart Collaboration Graph Superset Chart Plugin.

### Usage

To build the plugin, run the following commands:

```
npm ci
npm run build
```

Alternatively, to run the plugin in development mode (=rebuilding whenever changes are made), start the dev server with the following command:

```
npm run dev
```

To add the package to Superset, go to the `superset-frontend` subdirectory in your Superset source folder (assuming both the `superset-plugin-chart-collaboration-graph` plugin and `superset` repos are in the same root directory) and run
```
npm i -S ../../superset-plugin-chart-collaboration-graph
```

### Mock data & Storybook demo

For local development we've added a small mock-data workflow to make it easy to preview the plugin without a running backend.

- Generate mock JSON (writes `src/mock/generated.json`):

```bash
npm run generate-mock
# or (without installing dev deps) run directly
node src/mock/generateMockData.js -o src/mock/generated.json
```

- Demo in Storybook: a Storybook story is provided at `src/stories/CollaborationGraph.stories.jsx`.

  The Storybook flow will try to import a small JS helper `src/mock/loadMockForDev.js` (this file will attach `src/mock/generated.json` to `window.__COLLAB_GRAPH_MOCK__` when present). If no generated file is found, the story falls back to `src/mock/mock_data.json`.

  To view the story locally in the root Superset Storybook, the root `.storybook/main.js` has been updated to include this plugin's stories glob. Run Storybook from the root `superset-frontend`:

```bash
cd superset-frontend
npm run storybook
```

  Then open the Storybook UI (usually at http://localhost:6006) and navigate to `Plugins -> CollaborationGraph`.

Note: if Storybook build fails due to dependency peer conflicts when installing plugin devDependencies, you can still generate the JSON and import the loader in a simple demo page (or run Storybook with the repository's existing dependencies; the root repo already has Storybook configured).

If your Superset plugin exists in the `superset-frontend` directory and you wish to resolve TypeScript errors about `@superset-ui/core` not being resolved correctly, add the following to your `tsconfig.json` file:

```
"references": [
  {
    "path": "../../packages/superset-ui-chart-controls"
  },
  {
    "path": "../../packages/superset-ui-core"
  }
]
```

You may also wish to add the following to the `include` array in `tsconfig.json` to make Superset types available to your plugin:

```
"../../types/**/*"
```

Finally, if you wish to ensure your plugin `tsconfig.json` is aligned with the root Superset project, you may add the following to your `tsconfig.json` file:

```
"extends": "../../tsconfig.json",
```

After this edit the `superset-frontend/src/visualizations/presets/MainPreset.js` and make the following changes:

```js
import { SupersetPluginChartCollaborationGraph } from 'superset-plugin-chart-collaboration-graph';
```

to import the plugin and later add the following to the array that's passed to the `plugins` property:
```js
new SupersetPluginChartCollaborationGraph().configure({ key: 'superset-plugin-chart-collaboration-graph' }),
```

After that the plugin should show up when you run Superset, e.g. the development server:

```
npm run dev-server
```
