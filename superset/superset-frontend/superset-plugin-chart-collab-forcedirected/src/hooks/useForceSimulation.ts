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
import { useEffect, useRef, useState } from 'react';
import { NodeDatum, LinkDatum, WindowRange } from '../utils/types';
import {
  buildSimulation,
  initializeAndTickSimulation,
  updateLinkDistance,
  updateClusterStrength,
  fixNodePosition as d3FixNode,
  releaseNodePosition as d3ReleaseNode,
  addInitialJitter,
  computeAutoDistanceScale,
} from '../utils/d3Utils';
import { INITIAL_SIMULATION_TICKS, MIN_NODE_RADIUS, MAX_NODE_RADIUS } from '../utils/constants';

interface UseForceSimulationOptions {
  width: number;
  height: number;
  distanceScale: number;
  clusterDistance: number;
  windowRange: WindowRange | null;
}

/**
 * Custom hook for managing D3 force simulation.
 * 
 * Handles:
 * - Simulation initialization from raw node/link data
 * - Time-based filtering and re-aggregation
 * - Simulation parameter updates (distance, cluster strength)
 * - Node position fixing/releasing for drag operations
 * - Auto-computation of reasonable default distance scale
 * 
 * @param rawNodes - Original node data from props
 * @param rawLinks - Original link data from props
 * @param options - Simulation options (viewport size, parameters, time filter)
 * @returns Simulation state and control functions
 */
export function useForceSimulation(
  rawNodes: any[],
  rawLinks: any[],
  options: UseForceSimulationOptions
) {
  const { width, height, distanceScale, clusterDistance, windowRange } = options;
  
  const simulationRef = useRef<any>(null);
  const originalLinksRef = useRef<LinkDatum[] | null>(null);
  const originalNodesRef = useRef<NodeDatum[] | null>(null);
  
  const [simNodes, setSimNodes] = useState<NodeDatum[]>([]);
  const [simLinks, setSimLinks] = useState<LinkDatum[]>([]);

  // Initialize simulation on mount or when raw data changes
  useEffect(() => {
    const nodes = (rawNodes as any[]).map((d) => ({ id: d.id, size: d.size || MIN_NODE_RADIUS }));
    const links = (rawLinks as any[]).map((d) => ({
      source: d.source,
      target: d.target,
      weight: d.weight,
      types: d.types,
      sample_events: d.sample_events || d.sampleEvents || d.events || undefined,
    }));

    // Normalize node sizes to fit within MIN_NODE_RADIUS to MAX_NODE_RADIUS range
    // Algorithm: Linear scaling based on min/max node weights
    // - Node with minimum weight → MIN_NODE_RADIUS (smallest visual size)
    // - Node with maximum weight → MAX_NODE_RADIUS (largest visual size)
    // - Other nodes → proportionally scaled between MIN and MAX
    if (nodes.length > 0) {
      const sizes = nodes.map((n) => n.size || 1);
      const minSize = Math.min(...sizes);
      const maxSize = Math.max(...sizes);
      
      if (maxSize > minSize) {
        // Scale sizes proportionally: normalized = (value - min) / (max - min)
        // Result: 0 (min weight) → MIN_RADIUS, 1 (max weight) → MAX_RADIUS
        nodes.forEach((n) => {
          const rawSize = n.size || 1;
          const normalized = (rawSize - minSize) / (maxSize - minSize); // 0 to 1
          n.size = MIN_NODE_RADIUS + normalized * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
        });
      } else {
        // All nodes have the same size, use average of MIN and MAX
        const avgRadius = (MIN_NODE_RADIUS + MAX_NODE_RADIUS) / 2;
        nodes.forEach((n) => {
          n.size = avgRadius;
        });
      }
    }

    setSimNodes(nodes);
    setSimLinks(links);
    
    // Store originals for later time-based filtering
    originalLinksRef.current = links.map((x) => ({ ...x }));
    originalNodesRef.current = nodes.map((x) => ({ ...x }));

    // Give newly created nodes a small random jitter so they don't all start at (0,0)
    addInitialJitter(nodes);
    
    // Build simulation
    const simulation = buildSimulation(nodes, links, {
      distanceScale,
      clusterDistance,
      onTick: (nodes) => setSimNodes([...nodes]),
    });

    // Initialize and run initial ticks
    initializeAndTickSimulation(simulation, nodes, links, INITIAL_SIMULATION_TICKS);
    
    // Ensure initial render has positions
    setSimNodes([...nodes]);
    setSimLinks([...links]);
    
    simulationRef.current = simulation;

    // Debug helper: log unresolved links
    setTimeout(() => {
      try {
        const missing = (links as any[])
          .map((ln) => {
            const sourceId = typeof ln.source === 'string' ? ln.source : ln.source?.id;
            const targetId = typeof ln.target === 'string' ? ln.target : ln.target?.id;
            const s = nodes.find((x) => x.id === sourceId);
            const t = nodes.find((x) => x.id === targetId);
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
        if (simulationRef.current === simulation) simulation.stop();
      } catch (err) {
        // ignore
      }
    };
  }, [rawNodes, rawLinks, width, height]);

  // Rebuild simulation when time window changes
  useEffect(() => {
    const src = originalLinksRef.current;
    const srcNodes = originalNodesRef.current;
    if (!src || !srcNodes) return;

    // If no range selected, use original full dataset
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
          // Include
          sampleFiltered.push(ev);
          // Determine type key
          let key: 'commits' | 'reviews' | 'assigns' | 'discussion' | 'pullRequests' | undefined;
          if (ev.type === 'commit') key = 'commits';
          else if (ev.type === 'review') key = 'reviews';
          else if (ev.type === 'assign') key = 'assigns';
          else if (ev.type === 'comment') key = 'discussion';
          else if (ev.type === 'pull_request') key = 'pullRequests';
          if (!key) return;
          // Compute increment: for coedit commit events we assign fractional weight
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
          // Node counts
          if (ev.actor) nodeCounts.set(ev.actor, (nodeCounts.get(ev.actor) || 0) + 1);
          if (ev.target) nodeCounts.set(ev.target, (nodeCounts.get(ev.target) || 0) + 1);
        });
      }
      
      // Include link if it has any filtered sample events or non-zero types
      const hasTypes = Object.keys(types).length > 0 && Object.values(types).some((v) => (v as number) > 0);
      if (sampleFiltered.length || hasTypes) {
        const linkObj: LinkDatum = { source: a, target: b, weight: 0, types, sample_events: sampleFiltered };
        // Compute weight same as transformProps
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

    // Build nodes from counts and links
    const newNodesMap: Map<string, NodeDatum> = new Map();
    
    if (windowRange) {
      // When time window is active, use counts from filtered events
      // First, add all nodes from nodeCounts with their event-based size
      nodeCounts.forEach((count, id) => newNodesMap.set(id, { id, size: count || 1 }));
      
      // Then ensure all nodes from filtered links are included (even if count is 0)
      newLinks.forEach((ln) => {
        const sourceId = typeof ln.source === 'string' ? ln.source : (ln.source as any)?.id;
        const targetId = typeof ln.target === 'string' ? ln.target : (ln.target as any)?.id;
        if (sourceId && !newNodesMap.has(sourceId)) {
          newNodesMap.set(sourceId, { id: sourceId, size: 1 }); // minimal size
        }
        if (targetId && !newNodesMap.has(targetId)) {
          newNodesMap.set(targetId, { id: targetId, size: 1 }); // minimal size
        }
      });
    } else {
      // No active window: show original nodes with original sizes
      (srcNodes || []).forEach((n) => newNodesMap.set(n.id, { id: n.id, size: n.size || 1 }));
    }

    const newNodes = Array.from(newNodesMap.values());

    // Normalize node sizes to fit within MIN_NODE_RADIUS to MAX_NODE_RADIUS range
    if (newNodes.length > 0) {
      const sizes = newNodes.map((n) => n.size || 1);
      const minSize = Math.min(...sizes);
      const maxSize = Math.max(...sizes);
      
      if (maxSize > minSize) {
        // Scale sizes proportionally between MIN and MAX radius
        newNodes.forEach((n) => {
          const rawSize = n.size || 1;
          const normalized = (rawSize - minSize) / (maxSize - minSize);
          n.size = MIN_NODE_RADIUS + normalized * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
        });
      } else {
        // All nodes have the same size, use average of MIN and MAX
        const avgRadius = (MIN_NODE_RADIUS + MAX_NODE_RADIUS) / 2;
        newNodes.forEach((n) => {
          n.size = avgRadius;
        });
      }
    }

    // Update state and rebuild simulation
    setSimNodes(newNodes);
    setSimLinks(newLinks);

    const prevSimulation = simulationRef.current;

    try {
      // Give filtered nodes a small jitter
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

      // Stop the previous simulation
      try {
        if (prevSimulation && prevSimulation !== sim) prevSimulation.stop();
      } catch (err) {
        // ignore
      }
    } catch (err) {
      // ignore
    }
  }, [windowRange, distanceScale, clusterDistance, width, height]);

  // Update link force distance when distanceScale changes (without recreating simulation)
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    updateLinkDistance(sim, distanceScale);
  }, [distanceScale]);

  // Update cluster pull strength when user changes slider
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    updateClusterStrength(sim, clusterDistance);
  }, [clusterDistance]);

  /**
   * Fix node position during drag
   */
  const fixNodePosition = (nodeId: string, x: number, y: number) => {
    setSimNodes((nodes) =>
      nodes.map((n) => (n.id === nodeId ? { ...n, x, y, fx: x, fy: y } : n))
    );
    d3FixNode(simulationRef.current, nodeId, x, y);
  };

  /**
   * Release node position after drag
   */
  const releaseNodePosition = (nodeId: string) => {
    setSimNodes((nodes) =>
      nodes.map((n) => (n.id === nodeId ? { ...n, fx: undefined, fy: undefined } : n))
    );
    d3ReleaseNode(simulationRef.current, nodeId);
  };

  /**
   * Compute auto distance scale (call once)
   */
  const computeAutoDistance = () => {
    return computeAutoDistanceScale(originalLinksRef.current || rawLinks, width, height);
  };

  return {
    simNodes,
    simLinks,
    simulationRef,
    fixNodePosition,
    releaseNodePosition,
    computeAutoDistance,
  };
}
