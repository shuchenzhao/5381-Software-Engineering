/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ChartProps, TimeseriesDataRecord } from '@superset-ui/core';

// Fallback mechanism for development: if a global `window.__COLLAB_GRAPH_MOCK__` is set
// (e.g., by importing a small non-TS helper in a dev demo), use that as data.
function getDevMock(): { data: TimeseriesDataRecord[] } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win && win.__COLLAB_GRAPH_MOCK__ && Array.isArray(win.__COLLAB_GRAPH_MOCK__.data)) {
    return win.__COLLAB_GRAPH_MOCK__ as { data: TimeseriesDataRecord[] };
  }
  return null;
}

export default function transformProps(chartProps: ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your SupersetPluginChartCollaborationGraph.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const { width, height, formData, queriesData } = chartProps;
  const { boldText, headerFontSize, headerText } = formData;

  // Use backend data when present; otherwise try the dev mock JSON if available.
  let data = [] as TimeseriesDataRecord[];
  // If backend returned rows, use them directly (legacy shape: edges rows)
  if (queriesData && queriesData.length > 0 && Array.isArray(queriesData[0].data)) {
    data = queriesData[0].data as TimeseriesDataRecord[];
  } else {
    // Try window mock first
    const dm = getDevMock();
    if (dm && Array.isArray(dm.data)) {
      // eslint-disable-next-line no-console
      console.warn('Using window-provided local mock data for collaboration graph (development fallback)');
      data = dm.data as TimeseriesDataRecord[];
    } else {
      // Finally, load the built-in mock events from src/mock/events_mock.json
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const mockEvents = require('../mock/events_mock.json') as any[];
      if (Array.isArray(mockEvents) && mockEvents.length > 0) {
        // Aggregate events into person-person links so the existing visualization (which
        // expects rows of { source, target, weight, timestamp }) can consume them.
        // We'll also return `nodes` for future use.

        type LinkEntry = {
          source: string;
          target: string;
          types: { commits: number; reviews: number; pullRequests: number; assigns: number; discussion: number };
          first?: number;
          last?: number;
          sample_events: any[];
        };

        const fileAuthors = new Map<string, Set<string>>();
        // first pass: collect file -> authors from commits/PRs
        mockEvents.forEach((ev: any) => {
          if (ev.type === 'commit' && Array.isArray(ev.files)) {
            ev.files.forEach((f: string) => {
              if (!fileAuthors.has(f)) fileAuthors.set(f, new Set());
              fileAuthors.get(f)!.add(ev.actor);
            });
          }
          if (ev.type === 'pull_request' && Array.isArray(ev.files)) {
            // treat PR author as an editor of listed files
            ev.files.forEach((f: string) => {
              if (!fileAuthors.has(f)) fileAuthors.set(f, new Set());
              fileAuthors.get(f)!.add(ev.actor);
            });
          }
        });

        // aggregate pairwise relationships
        const pairMap = new Map<string, LinkEntry>();
        function addPair(a: string, b: string, typeKey: keyof LinkEntry['types'], ev: any) {
          if (!a || !b) return;
          const [s, t] = a < b ? [a, b] : [b, a];
          const key = `${s}||${t}`;
          if (!pairMap.has(key)) {
            pairMap.set(key, {
              source: s,
              target: t,
              types: { commits: 0, reviews: 0, pullRequests: 0, assigns: 0, discussion: 0 },
              first: undefined,
              last: undefined,
              sample_events: [],
            });
          }
          const entry = pairMap.get(key)!;
          entry.types[typeKey] += 1;
          const ts = ev.timestamp ? new Date(ev.timestamp).getTime() : Date.now();
          if (!entry.first || ts < (entry.first as number)) entry.first = ts;
          if (!entry.last || ts > (entry.last as number)) entry.last = ts;
          if (entry.sample_events.length < 5) entry.sample_events.push(ev);
        }

        // From fileAuthors: for each file, every pair of authors get a 'commits' increment
        fileAuthors.forEach((authors, file) => {
          const arr = Array.from(authors);
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              addPair(arr[i], arr[j], 'commits', { timestamp: Date.now(), origin: 'file_coedit', file });
            }
          }
        });

        // Second pass: other event types
        mockEvents.forEach((ev: any) => {
          if (ev.type === 'review') {
            // actor = reviewer, target = PR author
            addPair(ev.actor, ev.target || ev.pr_author || ev.pr_author, 'reviews', ev);
          } else if (ev.type === 'assign') {
            // actor assigns target
            addPair(ev.actor, ev.target, 'assigns', ev);
          } else if (ev.type === 'comment') {
            // comment may indicate discussion between actor and target
            if (ev.target) addPair(ev.actor, ev.target, 'discussion', ev);
          } else if (ev.type === 'pull_request') {
            // link PR author to reviewers will be captured by review events; but count PR as pullRequests between author and listed reviewers if provided
            // we don't have reviewers here, so skip or treat PR as light interaction (pullRequests)
            // For simplicity, if PR has actor only we don't create a self-link.
          }
        });

        // build nodes from pairs and fileAuthors
        const nodeSet = new Set<string>();
        pairMap.forEach((v) => {
          nodeSet.add(v.source);
          nodeSet.add(v.target);
        });
        // also include any standalone actors from events
        mockEvents.forEach((ev: any) => {
          if (ev.actor) nodeSet.add(ev.actor);
          if (ev.target) nodeSet.add(ev.target);
        });

        const nodes = Array.from(nodeSet).map((id) => ({ id }));

        // compute weight using default factors
        const factors: { [k: string]: number } = { commits: 1, reviews: 3, pullRequests: 2, assigns: 1.5, discussion: 0.5 };
        const links = Array.from(pairMap.values()).map((entry) => {
          const weight = Object.keys(entry.types).reduce((acc, k) => acc + (entry.types as any)[k] * (factors[k] || 1), 0);
          return {
            source: entry.source,
            target: entry.target,
            weight,
            types: entry.types,
            first: entry.first,
            last: entry.last,
            sample_events: entry.sample_events,
          };
        });

        // Return the aggregated links as `data` so existing visualization code can consume it,
        // and also return `nodes` for future use.
        // eslint-disable-next-line no-console
        console.warn('Using built-in events_mock.json and aggregated person-person links for development');
        data = links as unknown as TimeseriesDataRecord[];
        // Attach nodes so component can access them if updated to use nodes/links
        // We'll return nodes in the returned props below.
        // @ts-ignore
        chartProps['__mock_nodes'] = nodes;
      }
    }
  }

  console.log('formData via TransformProps.ts', formData);

  return {
    width,
    height,
    data,
    // @ts-ignore - optional nodes attached when using local mock aggregation
    nodes: (chartProps as any).__mock_nodes || null,
    // and now your control data, manipulated as needed, and passed through as props!
    boldText,
    headerFontSize,
    headerText,
  };
}
