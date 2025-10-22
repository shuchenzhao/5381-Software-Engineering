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
import { ChartProps } from '@superset-ui/core';

type Event = {
  id: string;
  type: string;
  actor?: string;
  target?: string;
  files?: string[];
  pr_id?: string;
  issue_id?: string;
  timestamp?: string;
  [k: string]: any;
};

type Node = {
  id: string;
  size?: number;
  color?: string;
  is_bot?: boolean;
  metadata?: object;
};

type Link = {
  source: string;
  target: string;
  weight: number;
  types: {
    commits?: number;
    reviews?: number;
    pullRequests?: number;
    assigns?: number;
    discussion?: number;
  };
  first?: number;
  last?: number;
  sample_events?: any[];
};

export default function transformProps(chartProps: ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your CollabForcedirected.tsx file, but
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

  // Try to use queriesData if it contains events; otherwise fall back to bundled mock.
  let events: Event[] = [];
  try {
    const q = queriesData && queriesData[0] && (queriesData[0].data as any[]);
    if (Array.isArray(q) && q.length > 0 && (q[0].type || q[0].actor)) {
      events = q as Event[];
    } else {
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      // @ts-ignore - import json
      events = require('../mock/events_mock.json') as Event[];
    }
  } catch (e) {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    // @ts-ignore
    events = require('../mock/events_mock.json') as Event[];
  }

  // Aggregation maps
  const nodeMap: Map<string, { id: string; count: number }> = new Map();
  const linkMap: Map<string, Link> = new Map();

  function addNode(id?: string) {
    if (!id) return;
    const key = id.toString();
    if (!nodeMap.has(key)) nodeMap.set(key, { id: key, count: 0 });
    nodeMap.get(key)!.count += 1;
  }

  function linkKey(a: string, b: string) {
    return [a, b].sort().join('||');
  }

  function ensureLink(a: string, b: string) {
    const key = linkKey(a, b);
    if (!linkMap.has(key)) {
      linkMap.set(key, {
        source: a,
        target: b,
        weight: 0,
        types: {},
        first: undefined,
        last: undefined,
        sample_events: [],
      });
    }
    return linkMap.get(key)!;
  }

  // Helper to push sample events and update first/last
  function recordEventOnLink(a: string, b: string, ev: Event, typeKey: keyof Link['types']) {
    const link = ensureLink(a, b);
    link.types[typeKey] = (link.types[typeKey] || 0) + 1;
    const t = ev.timestamp ? Date.parse(ev.timestamp) : Date.now();
    link.first = link.first === undefined ? t : Math.min(link.first, t);
    link.last = link.last === undefined ? t : Math.max(link.last, t);
    if (link.sample_events!.length < 3) link.sample_events!.push(ev);
  }

  // 1) Build file->authors map for commits
  const fileAuthors: Map<string, Set<string>> = new Map();
  events.forEach((ev) => {
    if (ev.type === 'commit' && ev.files && Array.isArray(ev.files)) {
      const actor = ev.actor;
      if (!actor) return;
      addNode(actor);
      ev.files.forEach((f) => {
        if (!fileAuthors.has(f)) fileAuthors.set(f, new Set());
        fileAuthors.get(f)!.add(actor);
      });
    } else {
      // other event: count actor and target as nodes
      if (ev.actor) addNode(ev.actor);
      if (ev.target) addNode(ev.target);
    }
  });

  // 2) For each file, add commit co-edit links between all pairs
  fileAuthors.forEach((authors) => {
    const arr = Array.from(authors);
    for (let i = 0; i < arr.length; i += 1) {
      for (let j = i + 1; j < arr.length; j += 1) {
        recordEventOnLink(arr[i], arr[j], { id: 'commit-coedit', type: 'commit' }, 'commits');
      }
    }
  });

  // 3) Process other event types
  events.forEach((ev) => {
    const a = ev.actor;
    const b = ev.target;
    if (ev.type === 'review' && a && b) {
      recordEventOnLink(a, b, ev, 'reviews');
    } else if (ev.type === 'assign' && a && b) {
      recordEventOnLink(a, b, ev, 'assigns');
    } else if (ev.type === 'comment' && a && b) {
      recordEventOnLink(a, b, ev, 'discussion');
    } else if (ev.type === 'pull_request' && a && ev.pr_id) {
      // keep track of PR presence — reviewers will generate review links
      // Optionally we could mark pullRequests between author and reviewers if reviewer events reference pr_id
    }
  });

  // 4) Compute weights with default factors
  const factors = {
    commits: 1,
    reviews: 2,
    pullRequests: 2,
    assigns: 1,
    discussion: 0.5,
  };

  const links: Link[] = [];
  linkMap.forEach((link) => {
    const types = link.types || ({} as Link['types']);
    let w = 0;
    w += (types.commits || 0) * factors.commits;
    w += (types.reviews || 0) * factors.reviews;
    w += (types.pullRequests || 0) * factors.pullRequests;
    w += (types.assigns || 0) * factors.assigns;
    w += (types.discussion || 0) * factors.discussion;
    link.weight = w;
    links.push(link);
  });

  const nodes: Node[] = Array.from(nodeMap.values()).map((n) => ({ id: n.id, size: n.count }));

  return {
    width,
    height,
    nodes,
    links,
    // keep existing passthroughs
    boldText,
    headerFontSize,
    headerText,
  };
}
