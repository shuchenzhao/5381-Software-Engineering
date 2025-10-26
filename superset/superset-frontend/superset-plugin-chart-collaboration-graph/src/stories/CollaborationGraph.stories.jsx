import React from 'react';
import SupersetPluginChartCollaborationGraph from '../SupersetPluginChartCollaborationGraph';

// Import dev loader which will attach generated.json to window.__COLLAB_GRAPH_MOCK__ if present.
try {
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  require('../mock/loadMockForDev');
} catch (e) {
  // ignore if loader not present
}

// Try to pick up the generated mock attached to window by the loader; fall back to small fixture.
let mockData = [];
try {
  // eslint-disable-next-line no-undef
  if (typeof window !== 'undefined' && window.__COLLAB_GRAPH_MOCK__ && Array.isArray(window.__COLLAB_GRAPH_MOCK__.data)) {
    // eslint-disable-next-line no-undef
    mockData = window.__COLLAB_GRAPH_MOCK__.data;
  } else {
    // fallback small fixture
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    mockData = require('../mock/mock_data.json').data;
  }
} catch (e) {
  mockData = [];
}

export default {
  title: 'Plugins/CollaborationGraph',
  component: SupersetPluginChartCollaborationGraph,
};

export function Demo() {
  return React.createElement(
    'div',
    { style: { width: '900px', height: '500px' } },
    React.createElement(SupersetPluginChartCollaborationGraph, {
      data: mockData,
      height: 480,
      width: 880,
      boldText: true,
      headerFontSize: 'l',
      headerText: 'Collaboration Graph — Mock Data',
    }),
  );
}
