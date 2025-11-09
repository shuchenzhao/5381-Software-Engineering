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

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceX,
  forceY,
  forceCollide,
} from 'd3-force';
import { NodeDatum, LinkDatum } from './types';
import {
  MIN_WEIGHT,
  MIN_LINK_DISTANCE,
  MAX_LINK_DISTANCE,
  NODE_MIN_PADDING,
  MAX_CLUSTER_STRENGTH,
  MIN_NODE_RADIUS,
  COLLISION_STRENGTH,
  CHARGE_STRENGTH,
  INITIAL_ALPHA,
  RESTART_ALPHA,
  DRAG_RELEASE_ALPHA_TARGET,
} from './constants';

/**
 * Compute link distance based on weight and distance scale.
 */
export function computeLinkDistance(weight: number, distanceScale: number): number {
  const effectiveWeight = Math.max(MIN_WEIGHT, weight);
  const rawDistance = distanceScale / effectiveWeight;
  return Math.min(MAX_LINK_DISTANCE, Math.max(MIN_LINK_DISTANCE, rawDistance));
}

/**
 * Options for building a d3 force simulation.
 */
export interface SimulationOptions {
  distanceScale: number;
  clusterDistance: number;
  onTick?: (nodes: NodeDatum[]) => void;
}

/**
 * Build a new d3 force simulation with the given nodes and links.
 * Returns the simulation instance.
 */
export function buildSimulation(
  nodes: NodeDatum[],
  links: LinkDatum[],
  options: SimulationOptions,
): any {
  const { distanceScale, clusterDistance, onTick } = options;
  const clusterPullStrength = MAX_CLUSTER_STRENGTH - clusterDistance;

  const simulation = forceSimulation(nodes as any)
    .force(
      'link',
      forceLink(links as any)
        .id((d: any) => d.id)
        .distance((d: any) => {
          const weight = (d && d.weight) || 0;
          return computeLinkDistance(weight, distanceScale);
        }),
    )
    .force('charge', forceManyBody().strength(CHARGE_STRENGTH))
    .force(
      'collide',
      forceCollide()
        .radius((d: any) => {
          const visualRadius = Math.max(MIN_NODE_RADIUS, d.size || MIN_NODE_RADIUS);
          return visualRadius + NODE_MIN_PADDING / 2;
        })
        .strength(COLLISION_STRENGTH),
    )
    .force('x', forceX(0).strength(clusterPullStrength))
    .force('y', forceY(0).strength(clusterPullStrength))
    .force('center', forceCenter(0, 0));

  if (onTick) {
    simulation.on('tick', () => onTick([...nodes]));
  }

  return simulation as any;
}

/**
 * Initialize simulation and run it for a number of ticks synchronously.
 * This helps nodes get initial positions before rendering.
 */
export function initializeAndTickSimulation(
  simulation: any,
  nodes: NodeDatum[],
  links: LinkDatum[],
  initialTicks: number,
): void {
  try {
    // Ensure d3 internal nodes/links are using our arrays
    if (typeof (simulation as any).nodes === 'function') {
      (simulation as any).nodes(nodes as any);
    }
    const linkForce: any = (simulation as any).force && (simulation as any).force('link');
    if (linkForce && typeof linkForce.links === 'function') {
      linkForce.links(links as any);
    }
  } catch (err) {
    // Ignore if API not available
  }

  try {
    simulation.alpha(INITIAL_ALPHA).restart();
  } catch (err) {
    // Ignore
  }

  // Run initial ticks
  for (let i = 0; i < initialTicks; i += 1) {
    simulation.tick();
  }
}

/**
 * Update the link distance function in an existing simulation.
 */
export function updateLinkDistance(
  simulation: any,
  distanceScale: number,
): void {
  try {
    const linkForce: any = (simulation as any).force && (simulation as any).force('link');
    if (linkForce && typeof linkForce.distance === 'function') {
      linkForce.distance((d: any) => {
        const weight = (d && d.weight) || 0;
        return computeLinkDistance(weight, distanceScale);
      });
      simulation.alpha(RESTART_ALPHA).restart();
    }
  } catch (err) {
    // Ignore
  }
}

/**
 * Update cluster pull strength (x/y forces) in an existing simulation.
 */
export function updateClusterStrength(
  simulation: any,
  clusterDistance: number,
): void {
  try {
    const effectiveStrength = MAX_CLUSTER_STRENGTH - clusterDistance;
    const fx: any = (simulation as any).force && (simulation as any).force('x');
    const fy: any = (simulation as any).force && (simulation as any).force('y');
    
    if (fx && typeof fx.strength === 'function') {
      fx.strength(effectiveStrength);
    }
    if (fy && typeof fy.strength === 'function') {
      fy.strength(effectiveStrength);
    }
    
    simulation.alpha(RESTART_ALPHA).restart();
  } catch (err) {
    // Ignore
  }
}

/**
 * Fix a node's position (for dragging).
 */
export function fixNodePosition(
  simulation: any,
  nodeId: string,
  x: number,
  y: number,
): void {
  try {
    if (typeof (simulation as any).nodes === 'function') {
      const simNodes = (simulation as any).nodes();
      const node = simNodes.find((n: any) => n.id === nodeId);
      if (node) {
        node.x = x;
        node.y = y;
        node.fx = x;
        node.fy = y;
        simulation.alpha(RESTART_ALPHA).restart();
      }
    }
  } catch (err) {
    // Ignore
  }
}

/**
 * Release a node's fixed position (after dragging).
 */
export function releaseNodePosition(
  simulation: any,
  nodeId: string,
): void {
  try {
    if (typeof (simulation as any).nodes === 'function') {
      const simNodes = (simulation as any).nodes();
      const node = simNodes.find((n: any) => n.id === nodeId);
      if (node) {
        node.fx = undefined;
        node.fy = undefined;
      }
      
      // Gentle relaxation after drag release
      if (typeof (simulation as any).alphaTarget === 'function') {
        (simulation as any).alphaTarget(DRAG_RELEASE_ALPHA_TARGET).restart();
      } else if (typeof simulation.alpha === 'function') {
        simulation.alpha(DRAG_RELEASE_ALPHA_TARGET).restart();
      }
    }
  } catch (err) {
    // Ignore
  }
}

/**
 * Add small random jitter to nodes that don't have initial positions.
 * Prevents all nodes from starting at (0, 0).
 */
export function addInitialJitter(nodes: NodeDatum[]): void {
  nodes.forEach((node) => {
    if (node.x === undefined) {
      node.x = (Math.random() - 0.5) * 20;
    }
    if (node.y === undefined) {
      node.y = (Math.random() - 0.5) * 20;
    }
  });
}

/**
 * Compute automatic distance scale based on data and viewport.
 */
export function computeAutoDistanceScale(
  links: LinkDatum[],
  width: number,
  height: number,
): number {
  if (!links || !links.length) return 10;
  
  try {
    const weights = links.map((link) => Math.max(MIN_WEIGHT, Number(link.weight || 0)));
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length || MIN_WEIGHT;
    
    // Target average visual link length: fraction of smaller viewport dimension
    const targetLength = Math.min(
      Math.max(Math.min(width, height) / 6, MIN_LINK_DISTANCE),
      MAX_LINK_DISTANCE / 2,
    );
    
    return Math.max(1, Math.round(targetLength * avgWeight));
  } catch (err) {
    return 10;
  }
}
