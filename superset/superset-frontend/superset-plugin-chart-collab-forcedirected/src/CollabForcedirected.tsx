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
import {
  NodeDatum,
  LinkDatum,
  TimeUnit,
  TimeBucket,
  WindowRange,
  TooltipState,
  ViewTransform,
} from './utils/types';
import {
  DEFAULT_DISTANCE_SCALE,
  DEFAULT_CLUSTER_DISTANCE,
  INITIAL_SIMULATION_TICKS,
  FIT_MARGIN_PX,
  MIN_ZOOM_SCALE,
  MAX_ZOOM_SCALE,
  MIN_NODE_RADIUS,
} from './utils/constants';
import {
  buildSimulation,
  initializeAndTickSimulation,
  updateLinkDistance,
  updateClusterStrength,
  fixNodePosition,
  releaseNodePosition,
  addInitialJitter,
  computeAutoDistanceScale,
} from './utils/d3Utils';
import { getLinkId } from './utils/linkHelpers';
import { screenToGraph } from './utils/domHelpers';
import {
  extractTimestampsFromLinks,
  buildTimeBuckets,
  computeWindowEnd,
} from './utils/timeUtils';
import { Tooltip, Controls, RecordsTable } from './components';

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
  const [distanceScale, setDistanceScale] = useState<number>(DEFAULT_DISTANCE_SCALE);
  // don't override user's manual changes; compute an automatic default once
  const autoDistanceComputedRef = useRef(false);
  // control for cluster distance: slider value (0..max) where larger = more separation
  const [clusterDistance, setClusterDistance] = useState<number>(DEFAULT_CLUSTER_DISTANCE);

  // compute a reasonable default distanceScale from data and viewport
  useEffect(() => {
    try {
      if (autoDistanceComputedRef.current) return;
      const computed = computeAutoDistanceScale(originalLinksRef.current || links, width, height);
      setDistanceScale(computed);
      autoDistanceComputedRef.current = true;
    } catch (err) {
      // noop
    }
  }, [links, width, height]);

  // time-range filter state
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  // time buckets: array of { startMs, label }
  const [timeBuckets, setTimeBuckets] = useState<TimeBucket[]>([]);
  // selected bucket index (single slider selecting one bucket)
  const [timeIndex, setTimeIndex] = useState<number>(0);
  // local slider value (debounced into timeIndex to avoid frequent re-aggregation)
  const [sliderIndex, setSliderIndex] = useState<number>(0);
  const sliderDebounceRef = useRef<number | null>(null);
  // computed window start/end based on selected bucket
  const [windowRange, setWindowRange] = useState<WindowRange | null>(null);

  // pan / zoom state
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const viewTransformRef = useRef(viewTransform);
  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);
  // store initial view so we can return to it on deselect
  const initialViewRef = useRef<ViewTransform | null>(null);
  // animation raf id
  const animRef = useRef<number | null>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragNodeRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const lastDragTimeRef = useRef<number | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  // tooltip state for showing full user info on hover
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: '',
  });

  // Helper: fit view to show all given nodes
  const fitViewToNodes = (nodesToFit: NodeDatum[]) => {
    try {
      const xs = nodesToFit.map((d) => d.x || 0);
      const ys = nodesToFit.map((d) => d.y || 0);
      if (!xs.length || !ys.length) return;

      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const availableW = Math.max(10, width - FIT_MARGIN_PX * 2);
      const availableH = Math.max(10, height - FIT_MARGIN_PX * 2);
      let k = Math.min(availableW / contentW, availableH / contentH);
      // clamp k to reasonable range
      k = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, k));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const tx = width / 2 - k * centerX;
      const ty = height / 2 - k * centerY;
      setViewTransform({ x: tx, y: ty, k });
      initialViewRef.current = { x: tx, y: ty, k };
    } catch (err) {
      // ignore
    }
  };

  // Helper: format node tooltip
  const formatNodeTooltip = (nd: NodeDatum) => {
    const lines: string[] = [];
    lines.push(`Username: ${nd.id}`);
    const extra = { ...((nd as any).meta || {}) };
    const extraKeys = Object.keys(extra).filter((k) => k !== 'id' && k !== 'size');
    extraKeys.forEach((k) => lines.push(`${k}: ${JSON.stringify((extra as any)[k])}`));
    return lines.join('\n');
  };

  useEffect(() => {
    // initialize sim nodes/links from props
    const n = (nodes as any[]).map((d) => ({ id: d.id, size: d.size || MIN_NODE_RADIUS }));
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
    addInitialJitter(n);

    // Build simulation using our util function
    const simulation = buildSimulation(n, l, {
      distanceScale,
      clusterDistance,
      onTick: (nodes) => setSimNodes([...nodes]),
    });

    // Initialize and run initial ticks
    initializeAndTickSimulation(simulation, n, l, INITIAL_SIMULATION_TICKS);
    
    // ensure initial render has positions
    setSimNodes([...n]);
    // Also capture links after d3 may have replaced link.source/target with node objects
    setSimLinks([...l]);
    
    // set ref after wiring nodes/links so cleanup comparisons are stable
    simulationRef.current = simulation;

    // compute bounding box of nodes and set a viewTransform that fits all nodes
    fitViewToNodes(n);

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
      const sourceLinks = originalLinksRef.current || [];
      const allTimestamps = extractTimestampsFromLinks(sourceLinks);
      
      if (!allTimestamps.length) {
        setTimeBuckets([]);
        setTimeIndex(0);
        setWindowRange(null);
        return;
      }

      const buckets = buildTimeBuckets(allTimestamps, timeUnit);
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
          let key: 'commits' | 'reviews' | 'assigns' | 'discussion' | 'pullRequests' | undefined;
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
      addInitialJitter(newNodes);

      const sim = buildSimulation(newNodes, newLinks, {
        distanceScale,
        clusterDistance,
        onTick: (nodes) => setSimNodes([...nodes]),
      });

      initializeAndTickSimulation(sim, newNodes, newLinks, 80);

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
    const end = computeWindowEnd(timeBuckets, idx, timeUnit);
    setWindowRange({ startMs: start, endMs: end });
  }, [timeIndex, timeBuckets, timeUnit]);

  // update link force distance when distanceScale changes (without recreating simulation)
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    updateLinkDistance(sim, distanceScale);
  }, [distanceScale]);

  // update cluster pull strength when user changes slider
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    updateClusterStrength(sim, clusterDistance);
  }, [clusterDistance]);

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
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const graphPos = screenToGraph(e.clientX, e.clientY, rect, viewTransform);
      setSimNodes((cur) => {
        const next = cur.map((nd) => {
          if (nd.id === id) {
            return { ...nd, x: graphPos.x, y: graphPos.y, fx: graphPos.x, fy: graphPos.y } as any;
          }
          return nd;
        });
        return next;
      });
      // Also update the simulation's internal node object
      fixNodePosition(simulationRef.current, id, graphPos.x, graphPos.y);
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
      setDragActiveId(null);
      // release fixed position in React state
      setSimNodes((cur) => cur.map((nd) => (nd.id === id ? { ...nd, fx: undefined, fy: undefined } : nd)));
      // release fixed position in the simulation
      releaseNodePosition(simulationRef.current, id);
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
    // fix node position in React state and simulation
    setSimNodes((cur) => {
      const node = cur.find((nd) => nd.id === nodeId);
      if (node && node.x !== undefined && node.y !== undefined) {
        fixNodePosition(simulationRef.current, nodeId, node.x, node.y);
      }
      return cur.map((nd) => (nd.id === nodeId ? { ...nd, fx: nd.x, fy: nd.y } : nd));
    });
  };

  // Tooltip handlers: show full info when hovering nodes
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
      
      {/* Tooltip component */}
      <Tooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />

      {/* Controls component */}
      <Controls
        distanceScale={distanceScale}
        onDistanceScaleChange={setDistanceScale}
        clusterDistance={clusterDistance}
        onClusterDistanceChange={setClusterDistance}
        timeUnit={timeUnit}
        onTimeUnitChange={setTimeUnit}
        timeBuckets={timeBuckets}
        sliderIndex={sliderIndex}
        onSliderIndexChange={setSliderIndex}
        windowRange={windowRange}
      />

      {/* RecordsTable component */}
      <RecordsTable
        selectedNodeId={selectedNodeId}
        expandedLinkId={expandedLinkId}
        links={simLinks}
      />
    </Styles>
  );
}
