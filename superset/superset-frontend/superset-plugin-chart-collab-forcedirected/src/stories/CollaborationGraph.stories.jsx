import React from 'react';
import CollabForcedirected from '../CollabForcedirected';
import transformProps from '../plugin/transformProps';

// Full JSX story: load mock events, run transformProps, and render the component with props.
let events = [];
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  // prefer plugin data/fetch.json (written by github_connector), fallback to bundled mock
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  let raw = null;
  try {
    // plugin data may be present at ../data/fetch.json
    // @ts-ignore
    raw = require('../data/fetch.json');
  } catch (err) {
    // fallback to mock
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    raw = require('../mock/events_mock.json');
  }
  events = Array.isArray(raw) ? raw : raw.events || [];
} catch (e) {
  events = [];
}

export default {
  title: 'Plugins/CollabForcedirected',
  component: CollabForcedirected,
};

export function Demo() {
  const width = 880;
  const height = 480;
  // call transformProps with a minimal chartProps-like object; transformProps will accept queriesData or fallback to provided events
  const chartProps = { formData: {}, width, height, queriesData: [{ data: events }] };
  const tp = transformProps(chartProps);

  // log for quick inspection in Storybook console
  // eslint-disable-next-line no-console
  console.log('Collab story transformProps output', tp);

  // Render without JSX to avoid parser/loader issues in some Storybook setups.
  return React.createElement(
    'div',
    { style: { width: '900px', height: '500px' } },
    React.createElement(CollabForcedirected, {
      nodes: tp.nodes,
      links: tp.links,
      height,
      width,
      headerText: 'Collaboration Graph — Mock Data',
      boldText: true,
      headerFontSize: 'l',
    }),
  );
}
