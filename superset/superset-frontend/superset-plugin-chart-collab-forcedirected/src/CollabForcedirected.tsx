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
import React, { useEffect, useRef, useState } from 'react';
import { styled } from '@superset-ui/core';
import { CollabForcedirectedProps, CollabForcedirectedStylesProps } from './types';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY, forceCollide } from 'd3-force';

type NodeDatum = { id: string; x?: number; y?: number; vx?: number; vy?: number; size?: number };
type LinkDatum = { source: string; target: string; weight: number; types?: any; sample_events?: any[]; first?: number; last?: number };

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<CollabForcedirectedStylesProps>`
  position: relative;
  background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;

  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  pre {
    height: ${({ theme, headerFontSize, height }) =>
      height - theme.gridUnit * 12 - theme.typography.sizes[headerFontSize]}px;
  }
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function CollabForcedirected(props: CollabForcedirectedProps) {
  const { nodes = [], links = [], height, width, headerText } = props as any;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<any>(null);
  // keep original full dataset so filtering can re-aggregate from source
  const originalLinksRef = useRef<LinkDatum[] | null>(null);
  const originalNodesRef = useRef<NodeDatum[] | null>(null);
  const [simNodes, setSimNodes] = useState<NodeDatum[]>([]);
  const [simLinks, setSimLinks] = useState<LinkDatum[]>([]);
  const [hoveredLink, setHoveredLink] = useState<LinkDatum | null>(null);
  // store expanded link as a stable id ("source||target") so clicks work
  // even if d3 mutates link objects
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  // selected node (when user clicks a node) — used to expand all adjacent aggregated links
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // control for link distance (lower => nodes cluster closer)
  // default reduced so nodes start more clustered
  const [distanceScale, setDistanceScale] = useState<number>(10);
  // don't override user's manual changes; compute an automatic default once
  const autoDistanceComputedRef = useRef(false);
  // control for cluster distance: slider value (0..max) where larger = more separation
  // internally we map this to a pull strength = maxStrength - clusterDistance so
  // moving the slider right (increasing clusterDistance) will reduce pull (clusters disperse)
  const MAX_CLUSTER_STRENGTH = 0.5;
  const [clusterDistance, setClusterDistance] = useState<number>(MAX_CLUSTER_STRENGTH * 0.7);
  // link distance clamping to avoid extremely large separations when weight is tiny
  const MIN_WEIGHT = 0.1;
  const MIN_LINK_DISTANCE = 20;
  const MAX_LINK_DISTANCE = 400;

  // compute a reasonable default distanceScale from data and viewport
  useEffect(() => {
    try {
      if (autoDistanceComputedRef.current) return;
      const src = originalLinksRef.current || (links as any[]);
      if (!src || !src.length) return;
      const weights = src.map((ln: any) => Math.max(MIN_WEIGHT, Number((ln && ln.weight) || 0)));
      const avgWeight = weights.reduce((a: number, b: number) => a + b, 0) / weights.length || MIN_WEIGHT;
      // target average visual link length: a fraction of the smaller viewport dimension
      const targetLen = Math.min(Math.max(Math.min(width, height) / 6, MIN_LINK_DISTANCE), MAX_LINK_DISTANCE / 2);
      const computed = Math.max(1, Math.round(targetLen * avgWeight));
      setDistanceScale(computed);
      autoDistanceComputedRef.current = true;
    } catch (err) {
      // noop
    }
  }, [links, width, height]);

  // time-range filter state
  type TimeUnit = 'year' | 'month' | 'week';
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  // time buckets: array of { startMs, label }
  const [timeBuckets, setTimeBuckets] = useState<{ startMs: number; label: string }[]>([]);
  // selected bucket index (single slider selecting one bucket)
  const [timeIndex, setTimeIndex] = useState<number>(0);
  // local slider value (debounced into timeIndex to avoid frequent re-aggregation)
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const sliderDebounceRef = useRef<number | null>(null);
  // computed window start/end based on selected bucket
  const [windowRange, setWindowRange] = useState<{ startMs: number; endMs: number } | null>(null);

  // pan / zoom state
  const [viewTransform, setViewTransform] = useState({ x: 0, y: 0, k: 1 });
  const viewTransformRef = useRef(viewTransform);
  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);
  // store initial view so we can return to it on deselect
  const initialViewRef = useRef<{ x: number; y: number; k: number } | null>(null);
  // animation raf id
  const animRef = useRef<number | null>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragNodeRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const lastDragTimeRef = useRef<number | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  // tooltip state for showing full user info on hover
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string }>({
    visible: false,
    x: 0,
    y: 0,
    content: '',
  });

  useEffect(() => {
    // initialize sim nodes/links from props
    const n = (nodes as any[]).map((d) => ({ id: d.id, size: d.size || 4 }));
    // d3 expects link.source/link.target to be node objects or ids
    const l = (links as any[]).map((d) => ({
      source: d.source,
      target: d.target,
      weight: d.weight,
      types: d.types,
      // preserve sample events if provided under common keys
      sample_events: d.sample_events || d.sampleEvents || d.events || undefined,
    }));
    setSimNodes(n);
    setSimLinks(l);
  // store originals for later time-based filtering
  originalLinksRef.current = l.map((x) => ({ ...x }));
  originalNodesRef.current = n.map((x) => ({ ...x }));

  // give newly created nodes a small random jitter so they don't all start at (0,0)
  n.forEach((nd) => {
    if ((nd as any).x === undefined) (nd as any).x = (Math.random() - 0.5) * 20;
    if ((nd as any).y === undefined) (nd as any).y = (Math.random() - 0.5) * 20;
  });

  // use the state-driven clusterPullStrength
    const simulation = forceSimulation(n as any)
      .force(
        'link',
        forceLink(l as any)
          .id((d: any) => d.id)
          .distance((d: any) => {
            const w = (d && (d.weight || 0)) || 0;
            const eff = Math.max(MIN_WEIGHT, w);
            const raw = distanceScale / eff;
            return Math.min(MAX_LINK_DISTANCE, Math.max(MIN_LINK_DISTANCE, raw));
          }),
      )
      // disable the global charge (we'll rely on collide to avoid overlaps)
      .force('charge', forceManyBody().strength(-100))
      // collision force to prevent node overlap while keeping layout compact
      .force(
        'collide',
        forceCollide()
          .radius((d: any) => Math.max(6, (d.size || 4) + 2))
          .strength(0.8),
      )
      // gentle centering forces to pull separated clusters closer together
      .force('x', forceX(0).strength(MAX_CLUSTER_STRENGTH - clusterDistance))
      .force('y', forceY(0).strength(MAX_CLUSTER_STRENGTH - clusterDistance))
      // use a neutral simulation center (0,0). We'll compute a viewTransform
      // that maps the node cloud to the canvas center, so forceCenter should
      // not use absolute canvas coordinates which conflicts with our transform.
      .force('center', forceCenter(0, 0))
      .on('tick', () => {
        // update local state to re-render
        setSimNodes([...n]);
      });

    // ensure d3 internal nodes/links are using our arrays (helps avoid mismatches)
    try {
      if (typeof (simulation as any).nodes === 'function') (simulation as any).nodes(n as any);
      const linkForce: any = (simulation as any).force && (simulation as any).force('link');
      if (linkForce && typeof linkForce.links === 'function') linkForce.links(l as any);
    } catch (err) {
      // ignore
    }

    // nudge simulation so it actively relaxes and doesn't require a click to start
    try {
      simulation.alpha(0.5).restart();
    } catch (err) {
      // ignore if simulation API isn't available
    }
    // set ref after wiring nodes/links so cleanup comparisons are stable
    simulationRef.current = simulation;

    // Run a few synchronous ticks so nodes get initial x/y coordinates immediately
    // Reduced to avoid blocking the main thread when many rebuilds occur.
    for (let i = 0; i < 60; i += 1) {
      simulation.tick();
    }
    // ensure initial render has positions
    setSimNodes([...n]);
    // Also capture links after d3 may have replaced link.source/target with node objects
    setSimLinks([...l]);

    // compute bounding box of nodes and set a viewTransform that fits all nodes
    try {
      const nn = n as NodeDatum[];
      const xs = nn.map((d) => d.x || 0);
      const ys = nn.map((d) => d.y || 0);
      if (xs.length && ys.length) {
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const margin = 40; // pixels
        const availableW = Math.max(10, width - margin * 2);
        const availableH = Math.max(10, height - margin * 2);
        let k = Math.min(availableW / contentW, availableH / contentH);
        // clamp k to reasonable range
        k = Math.max(0.2, Math.min(4, k));
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
          // We'll use transform: scale(k) translate(tx,ty) so final = k*p + t
          // Want final center = (width/2, height/2) => t = (width/2, height/2) - k*center
          const tx = width / 2 - k * centerX;
          const ty = height / 2 - k * centerY;
          setViewTransform({ x: tx, y: ty, k });
          // record the initial view immediately so deselect can restore reliably
          initialViewRef.current = { x: tx, y: ty, k };
      }
    } catch (err) {
      // ignore
    }

    // (initial view already saved above when we computed tx/ty/k)

    // Debug helper: log unresolved links where source/target node can't be found
    // Non-critical debug: detect any links whose source/target id couldn't be resolved
    setTimeout(() => {
      try {
        const missing = (l as any[])
          .map((ln) => {
            const sourceId = typeof ln.source === 'string' ? ln.source : ln.source?.id;
            const targetId = typeof ln.target === 'string' ? ln.target : ln.target?.id;
            const s = n.find((x) => x.id === sourceId);
            const t = n.find((x) => x.id === targetId);
            return { sourceId, targetId, hasSource: !!s, hasTarget: !!t };
          })
          .filter((r) => !r.hasSource || !r.hasTarget);
        // eslint-disable-next-line no-console
        console.debug('CollabForcedirected unresolved links', missing);
      } catch (err) {
        // ignore
      }
    }, 0);

    return () => {
      try {
        // only stop this simulation if it is still the active one
        if (simulationRef.current === simulation) simulation.stop();
      } catch (err) {
        // ignore
      }
    };
  }, [nodes, links, width, height]);

  // compute time buckets from originalLinks' sample_events when originalLinks or unit change
  useEffect(() => {
    try {
      const allTimestamps: number[] = [];
      const sourceLinks = originalLinksRef.current || [];
      (sourceLinks || []).forEach((ln) => {
        const sample = (ln as any).sample_events as any[] | undefined;
        if (Array.isArray(sample)) {
          sample.forEach((ev) => {
            const s = ev && (ev.timestamp || ev.time || ev.t || ev.ts || ev.timestamp_ms);
            const parsed = s ? Date.parse(String(s)) : NaN;
            if (!Number.isNaN(parsed)) allTimestamps.push(parsed);
          });
        }
      });
      if (!allTimestamps.length) {
        setTimeBuckets([]);
        setTimeIndex(0);
        setWindowRange(null);
        return;
      }
      const min = Math.min(...allTimestamps);
      const max = Math.max(...allTimestamps);
  const buckets: { startMs: number; label: string }[] = [];
      // helper to build buckets per unit
      const buildBuckets = (unit: TimeUnit) => {
        buckets.length = 0;
        const startDate = new Date(min);
        const endDate = new Date(max);
        // We'll only create buckets that actually contain at least one event.
        if (unit === 'year') {
          for (let y = startDate.getUTCFullYear(); y <= endDate.getUTCFullYear(); y += 1) {
            const s = Date.UTC(y, 0, 1);
            const e = Date.UTC(y + 1, 0, 1) - 1;
            // include this year only if any timestamp falls within [s,e]
            const has = allTimestamps.some((ts) => ts >= s && ts <= e);
            if (has) buckets.push({ startMs: s, label: String(y) });
          }
        } else if (unit === 'month') {
          let y = startDate.getUTCFullYear();
          let m = startDate.getUTCMonth();
          while (y < endDate.getUTCFullYear() || (y === endDate.getUTCFullYear() && m <= endDate.getUTCMonth())) {
            const s = Date.UTC(y, m, 1);
            const next = Date.UTC(y, m + 1, 1) - 1;
            const label = `${y}-${String(m + 1).padStart(2, '0')}`;
            // only push month if it has any timestamps
            const has = allTimestamps.some((ts) => ts >= s && ts <= next);
            if (has) buckets.push({ startMs: s, label });
            m += 1;
            if (m > 11) {
              m = 0; y += 1;
            }
          }
        } else if (unit === 'week') {
          // Week buckets that restart at W1 each year. We compute Monday-start weeks.
          const date = new Date(min);
          // normalize to UTC midnight
          date.setUTCHours(0, 0, 0, 0);
          // shift back to Monday of that week
          const day = date.getUTCDay();
          const diff = ((day + 6) % 7); // 0 => Monday
          date.setUTCDate(date.getUTCDate() - diff);
          while (date.getTime() <= max) {
            const wkStart = date.getTime();
            const wkEnd = wkStart + 7 * 24 * 3600 * 1000 - 1;
            const y = new Date(wkStart).getUTCFullYear();
            // compute week number relative to the start of the year
            const yearStart = Date.UTC(y, 0, 1);
            const daysSinceYearStart = Math.floor((wkStart - yearStart) / 86400000);
            const weekNum = Math.floor(daysSinceYearStart / 7) + 1;
            const label = `${y}-W${weekNum}`;
            const has = allTimestamps.some((ts) => ts >= wkStart && ts <= wkEnd);
            if (has) buckets.push({ startMs: wkStart, label });
            date.setUTCDate(date.getUTCDate() + 7);
          }
        }
      };
      buildBuckets(timeUnit);
      setTimeBuckets(buckets);
      // clamp timeIndex
      setTimeIndex((idx) => Math.min(Math.max(0, idx || 0), Math.max(0, buckets.length - 1)));
    } catch (err) {
      setTimeBuckets([]);
      setWindowRange(null);
    }
  }, [timeUnit]);

  // keep sliderIndex in sync if timeIndex is updated programmatically
  useEffect(() => {
    setSliderIndex(timeIndex);
  }, [timeIndex]);

  // debounce sliderIndex -> timeIndex so we don't recreate simulation on every small move
  useEffect(() => {
    if (sliderDebounceRef.current) window.clearTimeout(sliderDebounceRef.current);
    // eslint-disable-next-line no-restricted-globals
    sliderDebounceRef.current = window.setTimeout(() => {
      setTimeIndex(sliderIndex);
    }, 250);
    return () => {
      if (sliderDebounceRef.current) window.clearTimeout(sliderDebounceRef.current);
    };
  }, [sliderIndex]);

  // When windowRange changes, re-aggregate links from originalLinksRef and recreate simulation
  useEffect(() => {
    // if no original data, nothing to do
    const src = originalLinksRef.current;
    const srcNodes = originalNodesRef.current;
    if (!src || !srcNodes) return;

    // if no range selected, use original full dataset
    const startMs = windowRange ? windowRange.startMs : Number.NEGATIVE_INFINITY;
    const endMs = windowRange ? windowRange.endMs : Number.POSITIVE_INFINITY;

    const factors = {
      commits: 1,
      reviews: 2,
      pullRequests: 2,
      assigns: 1,
      discussion: 0.5,
    };

    const newLinks: LinkDatum[] = [];
    const nodeCounts: Map<string, number> = new Map();

    src.forEach((ln) => {
      const a = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
      const b = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
      if (!a || !b) return;
      const types: any = {};
      let first: number | undefined = undefined;
      let last: number | undefined = undefined;
      const sampleFiltered: any[] = [];
      const sample = (ln as any).sample_events as any[] | undefined;
      if (Array.isArray(sample)) {
        sample.forEach((ev) => {
          const s = ev && (ev.timestamp || ev.time || ev.t || ev.ts || ev.timestamp_ms);
          const parsed = s ? Date.parse(String(s)) : NaN;
          if (Number.isNaN(parsed)) return;
          if (parsed < startMs || parsed > endMs) return;
          // include
          sampleFiltered.push(ev);
          // determine type key
          let key: keyof LinkDatum['types'] | null = null as any;
          if (ev.type === 'commit') key = 'commits';
          else if (ev.type === 'review') key = 'reviews';
          else if (ev.type === 'assign') key = 'assigns';
          else if (ev.type === 'comment') key = 'discussion';
          else if (ev.type === 'pull_request') key = 'pullRequests';
          if (!key) return;
          // compute increment: for coedit commit events we assign fractional weight
          let inc = 1;
          if (ev.type === 'commit' && typeof ev.id === 'string' && ev.id.endsWith('-commit-coedit')) {
            const la = Number(ev.lines_added) || 0;
            const ld = Number(ev.lines_deleted) || 0;
            inc = 0.001 * (la + ld);
            if (inc <= 0) inc = 0.001; // minimal
          }
          types[key] = (types[key] || 0) + inc;
          first = first === undefined ? parsed : Math.min(first, parsed);
          last = last === undefined ? parsed : Math.max(last, parsed);
          // node counts
          if (ev.actor) nodeCounts.set(ev.actor, (nodeCounts.get(ev.actor) || 0) + 1);
          if (ev.target) nodeCounts.set(ev.target, (nodeCounts.get(ev.target) || 0) + 1);
        });
      }
      // include link if it has any filtered sample events or non-zero types
      const hasTypes = Object.keys(types).length > 0 && Object.values(types).some((v) => (v as number) > 0);
      if (sampleFiltered.length || hasTypes) {
        const linkObj: LinkDatum = { source: a, target: b, weight: 0, types, sample_events: sampleFiltered };
        // compute weight same as transformProps
        let w = 0;
        w += (types.commits || 0) * factors.commits;
        w += (types.reviews || 0) * factors.reviews;
        w += (types.pullRequests || 0) * factors.pullRequests;
        w += (types.assigns || 0) * factors.assigns;
        w += (types.discussion || 0) * factors.discussion;
        linkObj.weight = w;
        linkObj.first = first;
        linkObj.last = last;
        newLinks.push(linkObj);
      }
    });

    // build nodes from counts. When a windowRange is active we only show nodes
    // that appear in the filtered events (this hides nodes with no collaboration
    // in the selected interval). If windowRange is null (no filtering) fall back
    // to showing original nodes.
    const newNodesMap: Map<string, NodeDatum> = new Map();
    if (nodeCounts.size) {
      nodeCounts.forEach((count, id) => newNodesMap.set(id, { id, size: count || 1 }));
    } else if (!windowRange) {
      // no active window: show original nodes
      (srcNodes || []).forEach((n) => newNodesMap.set(n.id, { id: n.id, size: n.size || 1 }));
    }

    const newNodes = Array.from(newNodesMap.values());

    // update state and rebuild simulation
    setSimNodes(newNodes);
    setSimLinks(newLinks);

    // capture previous simulation; we'll stop it after the new one is installed
    const prevSimulation = simulationRef.current;

    // create new simulation for filtered data
    try {
      // give filtered nodes a small jitter so they don't all overlap at creation
      newNodes.forEach((nd) => {
        if ((nd as any).x === undefined) (nd as any).x = (Math.random() - 0.5) * 20;
        if ((nd as any).y === undefined) (nd as any).y = (Math.random() - 0.5) * 20;
      });

      const sim = forceSimulation(newNodes as any)
        .force(
          'link',
          forceLink(newLinks as any)
            .id((d: any) => d.id)
            .distance((d: any) => {
              const w = (d && (d.weight || 0)) || 0;
              const eff = Math.max(MIN_WEIGHT, w);
              const raw = distanceScale / eff;
              return Math.min(MAX_LINK_DISTANCE, Math.max(MIN_LINK_DISTANCE, raw));
            }),
        )
          .force('charge', forceManyBody().strength(0))
          // collision force to prevent node overlap in filtered simulation as well
          .force(
            'collide',
            forceCollide()
              .radius((d: any) => Math.max(6, (d.size || 4) + 2))
              .strength(0.8),
          )
          .force('x', forceX(0).strength(MAX_CLUSTER_STRENGTH - clusterDistance))
          .force('y', forceY(0).strength(MAX_CLUSTER_STRENGTH - clusterDistance))
        .force('center', forceCenter(0, 0))
        .on('tick', () => {
          setSimNodes([...newNodes]);
        });

      // nudge and run initial ticks so layout relaxes immediately
        // ensure d3 internal nodes/links are our arrays
        try {
          if (typeof (sim as any).nodes === 'function') (sim as any).nodes(newNodes as any);
          const linkForce: any = (sim as any).force && (sim as any).force('link');
          if (linkForce && typeof linkForce.links === 'function') linkForce.links(newLinks as any);
        } catch (err) {
          // ignore
        }
        try {
          sim.alpha(0.5).restart();
        } catch (err) {
          // ignore
        }
      // run initial ticks
      for (let i = 0; i < 80; i += 1) sim.tick();
      setSimNodes([...newNodes]);
      setSimLinks([...newLinks]);
      simulationRef.current = sim;

      // stop the previous simulation only if it's not the one we just created
      try {
        if (prevSimulation && prevSimulation !== sim) prevSimulation.stop();
      } catch (err) {
        // ignore
      }

      // fit view
      try {
        if (newNodes.length) {
          const xs = newNodes.map((d) => d.x || 0);
          const ys = newNodes.map((d) => d.y || 0);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          const contentW = Math.max(1, maxX - minX);
          const contentH = Math.max(1, maxY - minY);
          const margin = 40;
          const availableW = Math.max(10, width - margin * 2);
          const availableH = Math.max(10, height - margin * 2);
          let k = Math.min(availableW / contentW, availableH / contentH);
          k = Math.max(0.2, Math.min(4, k));
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const tx = width / 2 - k * centerX;
          const ty = height / 2 - k * centerY;
          setViewTransform({ x: tx, y: ty, k });
          initialViewRef.current = { x: tx, y: ty, k };
        }
      } catch (err) {
        // ignore
      }
    } catch (err) {
      // ignore
    }
  }, [windowRange, distanceScale, clusterDistance, width, height]);

  // compute windowRange from selected bucket index
  useEffect(() => {
    if (!timeBuckets || timeBuckets.length === 0) {
      setWindowRange(null);
      return;
    }
    const idx = Math.min(Math.max(0, timeIndex), timeBuckets.length - 1);
    const start = timeBuckets[idx].startMs;
    // compute end based on unit by looking at next bucket start or adding unit duration
    let end = start;
    if (idx + 1 < timeBuckets.length) {
      end = timeBuckets[idx + 1].startMs - 1;
    } else {
      // last bucket: extend based on unit
      if (timeUnit === 'year') end = Date.UTC(new Date(start).getUTCFullYear() + 1, 0, 1) - 1;
      else if (timeUnit === 'month') {
        const d = new Date(start);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        end = Date.UTC(y, m + 1, 1) - 1;
      } else if (timeUnit === 'week') {
        end = start + 7 * 24 * 3600 * 1000 - 1;
      }
    }
    setWindowRange({ startMs: start, endMs: end });
  }, [timeIndex, timeBuckets, timeUnit]);

  // update link force distance when distanceScale changes (without recreating simulation)
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    try {
      const linkForce: any = sim.force && sim.force('link');
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance((d: any) => {
          const w = (d && (d.weight || 0)) || 0;
          const eff = Math.max(MIN_WEIGHT, w);
          const raw = distanceScale / eff;
          return Math.min(MAX_LINK_DISTANCE, Math.max(MIN_LINK_DISTANCE, raw));
        });
        sim.alpha(0.3).restart();
      }
    } catch (err) {
      // ignore
    }
  }, [distanceScale]);

  // update cluster pull strength when user changes slider
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    try {
      const fx: any = sim.force && sim.force('x');
      const fy: any = sim.force && sim.force('y');
      const eff = MAX_CLUSTER_STRENGTH - clusterDistance;
      if (fx && typeof fx.strength === 'function') fx.strength(eff);
      if (fy && typeof fy.strength === 'function') fy.strength(eff);
      sim.alpha(0.3).restart();
    } catch (err) {
      // ignore
    }
  }, [clusterDistance]);

  // Convert screen coordinates to graph coordinates (accounting for pan/zoom)
  const screenToGraph = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: clientX, y: clientY };
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left - viewTransform.x) / viewTransform.k;
    const y = (clientY - rect.top - viewTransform.y) / viewTransform.k;
    return { x, y };
  };

  // Background pan handlers
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // only start pan when clicking the background (svg itself)
    if (e.target === svgRef.current) {
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      // clicking background clears any node selection
      setSelectedNodeId(null);
      setExpandedLinkId(null);
    }
  };
  const onWindowMouseMove = (e: MouseEvent) => {
    if (panningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setViewTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (dragNodeRef.current) {
      // dragging a node
      dragMovedRef.current = true;
      lastDragTimeRef.current = Date.now();
      const id = dragNodeRef.current;
      const graphPos = screenToGraph(e.clientX, e.clientY);
      setSimNodes((cur) => {
        const next = cur.map((nd) => {
          if (nd.id === id) {
            return { ...nd, x: graphPos.x, y: graphPos.y, fx: graphPos.x, fy: graphPos.y } as any;
          }
          return nd;
        });
        return next;
      });
      // Also update the simulation's internal node object so the force layout uses the dragged position
      try {
        const sim = simulationRef.current;
        if (sim && typeof sim.nodes === 'function') {
          const simNodesArr = sim.nodes();
          const sn = simNodesArr.find((n: any) => n.id === id);
          if (sn) {
            sn.x = graphPos.x;
            sn.y = graphPos.y;
            sn.fx = graphPos.x;
            sn.fy = graphPos.y;
            // nudge simulation so it responds immediately
            if (typeof sim.alpha === 'function') sim.alpha(0.3).restart();
          }
        }
      } catch (err) {
        // ignore
      }
    }
  };
  const onWindowMouseUp = () => {
    if (panningRef.current) {
      panningRef.current = false;
      panStartRef.current = null;
    }
    if (dragNodeRef.current) {
      const id = dragNodeRef.current;
      dragNodeRef.current = null;
  // don't immediately clear dragMovedRef here; use timestamp-based suppression in click handler
  // dragMovedRef.current = false; // Commented out to prevent immediate clearing
      setDragActiveId(null);
      // release fixed position in React state
      setSimNodes((cur) => cur.map((nd) => (nd.id === id ? { ...nd, fx: undefined, fy: undefined } : nd)));
      // release fixed position in the simulation's internal node
      try {
        const sim = simulationRef.current;
        if (sim && typeof sim.nodes === 'function') {
          const simNodesArr = sim.nodes();
          const sn = simNodesArr.find((n: any) => n.id === id);
          if (sn) {
            sn.fx = undefined;
            sn.fy = undefined;
          }
          // nudge simulation so it relaxes
          if (typeof sim.alphaTarget === 'function') sim.alphaTarget(0.1).restart();
          else if (typeof sim.alpha === 'function') sim.alpha(0.1).restart();
        }
      } catch (err) {
        // ignore
      }
    }
  };

  useEffect(() => {
    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [viewTransform]);

  // Wheel zoom
  const onSvgWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newK = Math.min(4, Math.max(0.2, viewTransform.k * (1 + delta)));
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const newX = mx - (mx - viewTransform.x) * (newK / viewTransform.k);
    const newY = my - (my - viewTransform.y) * (newK / viewTransform.k);
    setViewTransform({ x: newX, y: newY, k: newK });
  };

  // Node dragging: start
  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    dragNodeRef.current = nodeId;
    dragMovedRef.current = false;
    setDragActiveId(nodeId);
    // fix node position
    setSimNodes((cur) => cur.map((nd) => (nd.id === nodeId ? { ...nd, fx: nd.x, fy: nd.y } : nd)));
    // also set fx/fy on the simulation node so the layout respects the fixed state immediately
    try {
      const sim = simulationRef.current;
      if (sim && typeof sim.nodes === 'function') {
        const simNodesArr = sim.nodes();
        const sn = simNodesArr.find((n: any) => n.id === nodeId);
        if (sn) {
          sn.fx = sn.x;
          sn.fy = sn.y;
        }
        if (typeof sim.alpha === 'function') sim.alpha(0.3).restart();
      }
    } catch (err) {
      // ignore
    }
  };

  // Tooltip handlers: show full info when hovering nodes
  const formatNodeTooltip = (nd: NodeDatum) => {
    const lines: string[] = [];
    lines.push(`Username: ${nd.id}`);
    // if (nd.size !== undefined) lines.push(`Size: ${nd.size}`);
    // include any other properties if present
    const extra = { ...((nd as any).meta || {}) };
    const extraKeys = Object.keys(extra).filter((k) => k !== 'id' && k !== 'size');
    extraKeys.forEach((k) => lines.push(`${k}: ${JSON.stringify((extra as any)[k])}`));
    return lines.join('\n');
  };

  const onNodeMouseEnter = (e: React.MouseEvent, nd: NodeDatum) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) + 8;
    const y = e.clientY - (rect?.top ?? 0) + 8;
    setTooltip({ visible: true, x, y, content: formatNodeTooltip(nd) });
  };

  const onNodeMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) + 8;
    const y = e.clientY - (rect?.top ?? 0) + 8;
    setTooltip((t) => ({ ...t, x, y }));
  };

  const onNodeMouseLeave = () => {
    setTooltip((t) => ({ ...t, visible: false }));
  };

  // Node click: select/deselect and center view on node + its neighbors
  const onNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    // if we just dragged the node, don't treat this as a click
    if (dragMovedRef.current && lastDragTimeRef.current && Date.now() - lastDragTimeRef.current < 200) {
      dragMovedRef.current = false;
      return;
    }
    const next = selectedNodeId === nodeId ? null : nodeId;
    // if selecting a node, clear any expanded link but do NOT restore initial view
    if (next) {
      setExpandedLinkId(null);
    }
    setSelectedNodeId(next);
    // if selecting, compute neighbor nodes and center view on them
    if (next) {
      // collect neighbor ids from current simLinks
      const neigh = simLinks
        .map((l) => {
          const a = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
          const b = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
          return { a, b, id: getLinkId(l as LinkDatum) };
        })
        .filter((x) => x.a === nodeId || x.b === nodeId)
        .reduce<string[]>((acc, cur) => {
          const other = cur.a === nodeId ? cur.b : cur.a;
          if (other) acc.push(other);
          return acc;
        }, []);
      const ids = Array.from(new Set([nodeId, ...neigh]));
      centerOnNodeIds(ids);
    } else {
      // deselect: restore initial view if we have it
      if (initialViewRef.current) {
        animateTo(initialViewRef.current);
      }
    }
  };

  // Center view on a set of node ids (ensure they are visible and centered)
  const centerOnNodeIds = (ids: string[]) => {
    const nodesForBox = ids
      .map((id) => simNodes.find((n) => n.id === id))
      .filter(Boolean) as NodeDatum[];
    if (!nodesForBox.length) return;
    const xs = nodesForBox.map((d) => d.x || 0);
    const ys = nodesForBox.map((d) => d.y || 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const margin = 40;
    const availableW = Math.max(10, width - margin * 2);
    const availableH = Math.max(10, height - margin * 2);
  let k = Math.min(availableW / contentW, availableH / contentH);
  k = Math.max(0.2, Math.min(4, k));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  // use scale(k) translate(tx,ty): final = k*p + t -> t = targetCenter - k*center
  const tx = width / 2 - k * centerX;
  const ty = height / 2 - k * centerY;
    // animate to target view
    animateTo({ x: tx, y: ty, k });
  };

  // animate viewTransform to target over duration ms
  const animateTo = (target: { x: number; y: number; k: number }, duration = 300) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const start = performance.now();
    const from = viewTransformRef.current || { x: 0, y: 0, k: 1 };
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t); // easeInOutQuad
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const tt = ease(t);
      const nx = from.x + (target.x - from.x) * tt;
      const ny = from.y + (target.y - from.y) * tt;
      const nk = from.k + (target.k - from.k) * tt;
      setViewTransform({ x: nx, y: ny, k: nk });
      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        animRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(step);
  };

  const getLinkId = (ln: LinkDatum) => {
    const a = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
    const b = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
    if (!a || !b) return null;
    return a < b ? `${a}||${b}` : `${b}||${a}`;
  };

  // Toggle expanded link on click using stable id
  const onLinkClick = (e: React.MouseEvent, ln: LinkDatum) => {
    e.stopPropagation();
    const id = getLinkId(ln);
    if (!id) return;
    // debug
    // eslint-disable-next-line no-console
    console.debug('CollabForcedirected link clicked', { clickedId: id, ln });
    setExpandedLinkId((cur) => {
      const next = cur === id ? null : id;
      // eslint-disable-next-line no-console
      console.debug('CollabForcedirected expandedLinkId ->', next);
      // if selecting this link, center on its endpoints
      if (next) {
        // clear any selected node when user selects a link
        setSelectedNodeId(null);
        const a = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
        const b = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
        const ids = Array.from(new Set([...(a ? [a] : []), ...(b ? [b] : [])]));
        if (ids.length) centerOnNodeIds(ids);
      } else {
        // deselecting by clicking the same link: restore initial view
        if (initialViewRef.current) animateTo(initialViewRef.current);
      }
      return next;
    });
  };

  return (
    <Styles
      ref={containerRef}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <h3>{headerText}</h3>
      <svg
        ref={svgRef}
        width={width * 0.95}
        height={height * 0.875}
        onMouseDown={onSvgMouseDown}
        onWheel={onSvgWheel}
        style={{ cursor: panningRef.current ? 'grabbing' : 'default' }}
      >
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          {/* aggregated links (baseline) - hide when a node or link is selected */}
          {!(selectedNodeId || expandedLinkId) && simLinks.map((ln, i) => {
            // ln.source/ln.target may be node objects (from d3) or id strings; normalize to ids
            const sourceId = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
            const targetId = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
            const s = simNodes.find((n) => n.id === sourceId) as NodeDatum | undefined;
            const t = simNodes.find((n) => n.id === targetId) as NodeDatum | undefined;
            if (!s || !t) return null;
            return (
              <g key={`link-${i}`}>
                {/* visual line (keeps original strokeWidth) */}
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="#999"
                  strokeWidth={Math.max(1, ln.weight)}
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
                {/* invisible, thicker hit area for easier interaction */}
                <line
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke="transparent"
                  strokeWidth={Math.max(12, Math.max(1, ln.weight) * 6)}
                  opacity={0.0001}
                  onMouseEnter={() => setHoveredLink(ln)}
                  onMouseLeave={() => setHoveredLink(null)}
                  onClick={(e) => onLinkClick(e, ln)}
                  style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                />
              </g>
            );
          })}

          {/* overlay sub-edges when hovering a link, when it's expanded, or when a node is selected */}
          {(() => {
            // If a node is selected, show overlays for all connected links
            if (selectedNodeId) {
              const connected = simLinks.filter((l) => {
                const a = typeof (l as any).source === 'string' ? (l as any).source : (l as any).source?.id;
                const b = typeof (l as any).target === 'string' ? (l as any).target : (l as any).target?.id;
                return a === selectedNodeId || b === selectedNodeId;
              });
              return (
                <g>
                  {connected.map((ln, idx) => {
                    const sourceId = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
                    const targetId = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
                    const s = simNodes.find((n) => n.id === sourceId) as NodeDatum | undefined;
                    const t = simNodes.find((n) => n.id === targetId) as NodeDatum | undefined;
                    if (!s || !t) return null;
                    const types = (ln as any).types || {};
                    const typeEntries = Object.entries(types);
                    return (
                      <g key={`conn-${idx}`}>
                        {typeEntries.map(([k, v], j) => {
                          const visualStroke = Math.max(1, (v as number) / 1.5);
                          const hitWidth = Math.max(10, visualStroke * 6);
                          return (
                            <g key={`conn-${idx}-sub-${k}`}>
                              <line
                                x1={s.x}
                                y1={s.y}
                                x2={t.x}
                                y2={t.y}
                                stroke={k === 'commits' ? 'green' : k === 'reviews' ? 'blue' : k === 'assigns' ? 'orange' : 'gray'}
                                strokeWidth={visualStroke}
                                opacity={0.95}
                                strokeDasharray={k === 'assigns' ? '4 2' : undefined}
                                transform={`translate(0, ${j * 3 - (typeEntries.length * 3) / 2})`}
                                style={{ pointerEvents: 'none' }}
                              />
                              <line
                                x1={s.x}
                                y1={s.y}
                                x2={t.x}
                                y2={t.y}
                                stroke="transparent"
                                strokeWidth={hitWidth}
                                opacity={0.0001}
                                transform={`translate(0, ${j * 3 - (typeEntries.length * 3) / 2})`}
                                onClick={(e) => onLinkClick(e, ln)}
                                style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                              />
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}
                </g>
              );
            }

            // fallback: single-active link (hover or expanded)
            let activeLink: LinkDatum | null = hoveredLink as LinkDatum | null;
            // if nothing hovered, but expandedLinkId set, find that link
            if (!activeLink && expandedLinkId) {
              const ln = simLinks.find((l) => getLinkId(l as LinkDatum) === expandedLinkId) as LinkDatum | undefined;
              if (ln) {
                // show expanded link from simLinks (may be mutated by d3)
                activeLink = ln;
              }
            }
            if (!activeLink) return null;
            const sourceId = typeof (activeLink as any).source === 'string' ? (activeLink as any).source : (activeLink as any).source?.id;
            const targetId = typeof (activeLink as any).target === 'string' ? (activeLink as any).target : (activeLink as any).target?.id;
            const s = simNodes.find((n) => n.id === sourceId) as NodeDatum | undefined;
            const t = simNodes.find((n) => n.id === targetId) as NodeDatum | undefined;
            if (!s || !t) return null;
            const types = (activeLink as any).types || {};
            const typeEntries = Object.entries(types);
            return (
              <g>
                {typeEntries.map(([k, v], idx) => {
                  const visualStroke = Math.max(1, (v as number) / 1.5);
                  const hitWidth = Math.max(10, visualStroke * 6);
                  return (
                    <g key={`sub-${k}`}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={k === 'commits' ? 'green' : k === 'reviews' ? 'blue' : k === 'assigns' ? 'orange' : 'gray'}
                        strokeWidth={visualStroke}
                        opacity={0.9}
                        strokeDasharray={k === 'assigns' ? '4 2' : undefined}
                        transform={`translate(0, ${idx * 3 - (typeEntries.length * 3) / 2})`}
                        style={{ pointerEvents: 'none' }}
                      />
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke="transparent"
                        strokeWidth={hitWidth}
                        opacity={0.0001}
                        transform={`translate(0, ${idx * 3 - (typeEntries.length * 3) / 2})`}
                        onClick={(e) => onLinkClick(e, activeLink as LinkDatum)}
                        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      />
                    </g>
                  );
                })}
                {/* When a link is expanded we intentionally do not render inline sample event text (no type or actor) */}
              </g>
            );
          })()}

          {/* nodes */}
          {simNodes.map((n) => (
            <g
              key={`node-${n.id}`}
              transform={`translate(${n.x}, ${n.y})`}
              onMouseDown={(e) => onNodeMouseDown(e, n.id)}
              onClick={(e) => onNodeClick(e, n.id)}
              onMouseEnter={(e) => onNodeMouseEnter(e, n)}
              onMouseMove={onNodeMouseMove}
              onMouseLeave={onNodeMouseLeave}
              style={{ cursor: dragActiveId === n.id ? 'grabbing' : 'grab' }}
            >
              <circle r={Math.max(4, n.size || 4)} fill="#3182bd" />
              <text x={8} y={4} fontSize={10}>
                {String(n.id).slice(0, 3)}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {/* tooltip: absolute positioned element inside Styles */}
      {tooltip.visible && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '6px 8px',
            borderRadius: 4,
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'pre',
            maxWidth: 300,
            zIndex: 10,
          }}
        >
          {tooltip.content}
        </div>
      )}
      {/* controls: both sliders side-by-side, each control uses two lines */}
  <div style={{ display: 'flex', gap: 24, marginTop: 18, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="distanceRange">Node distance: </label>
          <div>
            <input
              id="distanceRange"
              type="range"
              min={1}
              max={120}
              step={1}
              value={distanceScale}
              onChange={(e) => setDistanceScale(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ marginLeft: 8 }}>{distanceScale}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label htmlFor="clusterRange">Cluster distance: </label>
          <div>
            <input
              id="clusterRange"
              type="range"
              min={0}
              max={MAX_CLUSTER_STRENGTH}
              step={0.01}
              value={clusterDistance}
              onChange={(e) => setClusterDistance(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ marginLeft: 8 }}>{clusterDistance.toFixed(2)}</span>
          </div>
        </div>
      </div>
          {/* time-range selector: unit select + single slider */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label htmlFor="timeUnit">Time unit:</label>
              <select id="timeUnit" value={timeUnit} onChange={(e) => setTimeUnit(e.target.value as any)} style={{ width: 120 }}>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="week">Week</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <label >Selected interval: </label>
                <div style={{ fontSize: 12, textAlign: 'right', marginBottom: '3px' }}>
                  {windowRange ? (
                    <div>
                      {timeBuckets[timeIndex] ? timeBuckets[timeIndex].label : '—'}
                      {' '}
                      <span style={{ color: 'rgba(0,0,0,0.6)', marginLeft: 8 }}>
                        {new Date(windowRange.startMs).toLocaleDateString()} — {new Date(windowRange.endMs).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <div style={{ color: 'rgba(0,0,0,0.5)' }}>No time buckets</div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: 6 }}>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, timeBuckets.length - 1)}
                  step={1}
                  value={sliderIndex}
                  onChange={(e) => setSliderIndex(Number(e.target.value))}
                  style={{ width: 300 }}
                />
              </div>
            </div>
          </div>
      {/* records table: show when node or link is selected */}
      <div
        style={{
          marginTop: 12,
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 4,
          padding: 8,
          maxHeight: 300,
          overflowY: 'auto',
          background: 'white',
        }}
      >
        {/* title */}
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          {selectedNodeId ? `Username: ${selectedNodeId}` : expandedLinkId ? `Link: ${expandedLinkId}` : 'Records'}
        </div>
        {
          // compute rows for selected node or expanded link
        }
        {
          (() => {
            type Row = {
              source: string | null;
              target: string | null;
              linkId: string | null;
              kind: 'event' | 'aggregate';
              type?: string;
              count?: number;
              actor?: string;
              time?: string | number;
              payload?: string;
            };

            const rows: Row[] = [];

            // helper to normalize ids
            const getIds = (ln: LinkDatum) => {
              const a = typeof (ln as any).source === 'string' ? (ln as any).source : (ln as any).source?.id;
              const b = typeof (ln as any).target === 'string' ? (ln as any).target : (ln as any).target?.id;
              return { a: a || null, b: b || null };
            };

            if (selectedNodeId) {
              // find all links touching the node
              simLinks.forEach((ln) => {
                const { a, b } = getIds(ln);
                if (a === selectedNodeId || b === selectedNodeId) {
                  const linkId = getLinkId(ln as LinkDatum);
                  const sample = (ln as any).sample_events as any[] | undefined;
                  if (Array.isArray(sample) && sample.length) {
                    sample.forEach((ev) => {
                      // prefer ISO timestamp fields if present
                      const ts = ev.timestamp || ev.time || ev.t || ev.timestamp_ms || ev.ts;
                      rows.push({
                        source: a,
                        target: b,
                        linkId,
                        kind: 'event',
                        type: ev.type || ev.event_type || (ev.kind as any) || undefined,
                        actor: ev.actor || ev.user || ev.actor_id || undefined,
                        time: ts,
                        payload: JSON.stringify(ev),
                      });
                    });
                  } else if (ln.types) {
                    const typeEntries = Object.entries(ln.types || {});
                    typeEntries.forEach(([k, v]) => {
                      rows.push({ source: a, target: b, linkId, kind: 'aggregate', type: k, count: v as number });
                    });
                  }
                }
              });
            } else if (expandedLinkId) {
              // find expanded link
              const ln = simLinks.find((l) => getLinkId(l as LinkDatum) === expandedLinkId) as any | undefined;
              if (ln) {
                const { a, b } = getIds(ln as LinkDatum);
                const linkId = getLinkId(ln as LinkDatum);
                const sample = ln.sample_events as any[] | undefined;
                if (Array.isArray(sample) && sample.length) {
                  sample.forEach((ev) => {
                    const ts = ev.timestamp || ev.time || ev.t || ev.timestamp_ms || ev.ts;
                    rows.push({
                      source: a,
                      target: b,
                      linkId,
                      kind: 'event',
                      type: ev.type || ev.event_type || undefined,
                      actor: ev.actor || ev.user || undefined,
                      time: ts,
                      payload: JSON.stringify(ev),
                    });
                  });
                } else if (ln.types) {
                  Object.entries(ln.types || {}).forEach(([k, v]) => rows.push({ source: a, target: b, linkId, kind: 'aggregate', type: k, count: v as number }));
                }
              }
            }

            if (!rows.length) {
              return <div style={{ color: 'rgba(0,0,0,0.6)' }}>No records to display</div>;
            }

            const formatTime = (t: any) => {
              if (t === undefined || t === null) return '';
              // try to parse numeric timestamp (seconds or ms)
              if (typeof t === 'number') {
                // assume ms if > 1e12, else seconds
                const ms = t > 1e12 ? t : t > 1e9 ? t : t * 1000;
                try {
                  return new Date(ms).toLocaleString();
                } catch (err) {
                  return String(t);
                }
              }
              // try ISO string
              const s = String(t);
              const parsed = Date.parse(s);
              if (!Number.isNaN(parsed)) return new Date(parsed).toLocaleString();
              return s;
            };

            // decide whether Actor column is redundant: if every row.actor equals source or target or is falsy, we can hide it
            const showActor = rows.some((r) => {
              if (!r.actor) return false;
              const src = r.source || '';
              const tgt = r.target || '';
              return r.actor !== src && r.actor !== tgt;
            });

            return (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Source</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Target</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Link</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Type</th>
                    {showActor && (
                      <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Actor</th>
                    )}
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Time</th>
                    <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`rec-${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '6px 8px' }}>{r.source}</td>
                      <td style={{ padding: '6px 8px' }}>{r.target}</td>
                      <td style={{ padding: '6px 8px' }}>{r.linkId}</td>
                      <td style={{ padding: '6px 8px' }}>{r.type ?? (r.kind === 'aggregate' ? 'aggregate' : '')}</td>
                      {showActor && <td style={{ padding: '6px 8px' }}>{r.actor ?? ''}</td>}
                      <td style={{ padding: '6px 8px' }}>{formatTime(r.time ?? '')}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'normal', wordBreak: 'break-word' }}>{r.payload ?? (r.count !== undefined ? String(r.count) : '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()
        }
      </div>
    </Styles>
  );
}
