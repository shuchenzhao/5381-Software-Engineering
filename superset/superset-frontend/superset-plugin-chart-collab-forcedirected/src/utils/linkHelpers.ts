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

import { LinkDatum, NodeDatum } from './types';

/**
 * Normalize link endpoints to string IDs.
 * d3-force may replace source/target with node objects during simulation.
 */
export function normalizeLinkEndpoints(link: LinkDatum): { sourceId: string | null; targetId: string | null } {
  const sourceId = typeof link.source === 'string' ? link.source : (link.source as NodeDatum)?.id || null;
  const targetId = typeof link.target === 'string' ? link.target : (link.target as NodeDatum)?.id || null;
  return { sourceId, targetId };
}

/**
 * Generate a stable, order-independent ID for a link.
 * Returns null if either endpoint is missing.
 */
export function getLinkId(link: LinkDatum): string | null {
  const { sourceId, targetId } = normalizeLinkEndpoints(link);
  if (!sourceId || !targetId) return null;
  return sourceId < targetId ? `${sourceId}||${targetId}` : `${targetId}||${sourceId}`;
}

/**
 * Collect all node IDs connected to a given node via links.
 */
export function collectConnectedNodeIds(nodeId: string, links: LinkDatum[]): string[] {
  const neighbors: string[] = [];
  links.forEach((link) => {
    const { sourceId, targetId } = normalizeLinkEndpoints(link);
    if (sourceId === nodeId && targetId) {
      neighbors.push(targetId);
    } else if (targetId === nodeId && sourceId) {
      neighbors.push(sourceId);
    }
  });
  return Array.from(new Set(neighbors));
}

/**
 * Find all links connected to a given node.
 */
export function findConnectedLinks(nodeId: string, links: LinkDatum[]): LinkDatum[] {
  return links.filter((link) => {
    const { sourceId, targetId } = normalizeLinkEndpoints(link);
    return sourceId === nodeId || targetId === nodeId;
  });
}
