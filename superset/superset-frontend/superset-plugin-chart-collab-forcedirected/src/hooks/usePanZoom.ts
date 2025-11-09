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
import React, { RefObject, useEffect, useRef, useState } from 'react';
import { NodeDatum, ViewTransform } from '../utils/types';
import { MIN_ZOOM_SCALE, MAX_ZOOM_SCALE } from '../utils/constants';

/**
 * Custom hook for managing pan and zoom interactions on an SVG viewport.
 * 
 * Handles:
 * - Pan (click and drag background)
 * - Zoom (mouse wheel)
 * - View fitting (calculate transform to show all nodes)
 * - View centering (focus on specific nodes)
 * - Smooth animations between view states
 * 
 * @param svgRef - Reference to the SVG element
 * @param width - Viewport width
 * @param height - Viewport height
 * @returns View transform state, event handlers, and utility functions
 */
export function usePanZoom(
  svgRef: RefObject<SVGSVGElement>,
  width: number,
  height: number
) {
  const [viewTransform, setViewTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const viewTransformRef = useRef(viewTransform);
  const initialViewRef = useRef<ViewTransform | null>(null);
  const animRef = useRef<number | null>(null);
  const panningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keep ref in sync with state for animation callbacks
  useEffect(() => {
    viewTransformRef.current = viewTransform;
  }, [viewTransform]);

  // Add wheel event listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const current = viewTransformRef.current;
      const newK = Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, current.k * (1 + delta)));
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newX = mx - (mx - current.x) * (newK / current.k);
      const newY = my - (my - current.y) * (newK / current.k);
      setViewTransform({ x: newX, y: newY, k: newK });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [svgRef]);

  /**
   * Fit view to show all given nodes with margin
   * Ensures all nodes fit within the center 70% of the viewport
   * (15% margin on each side)
   */
  const fitViewToNodes = (nodesToFit: NodeDatum[]) => {
    try {
      // Calculate bounding box including node sizes
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      nodesToFit.forEach((d) => {
        const x = d.x || 0;
        const y = d.y || 0;
        const radius = d.size || 4; // Include node radius in bounds
        minX = Math.min(minX, x - radius);
        maxX = Math.max(maxX, x + radius);
        minY = Math.min(minY, y - radius);
        maxY = Math.max(maxY, y + radius);
      });
      
      if (!isFinite(minX)) return;

      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      
      // Use 70% of viewport for content (15% margin on each side)
      const availableW = Math.max(10, width * 0.7);
      const availableH = Math.max(10, height * 0.7);
      
      let k = Math.min(availableW / contentW, availableH / contentH);
      // Clamp k to reasonable range
      k = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, k));
      
      // Calculate geometric center of bounding box
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      // Transform to place bbox center at viewport center
      const tx = width / 2 - k * centerX;
      const ty = height / 2 - k * centerY;
      setViewTransform({ x: tx, y: ty, k });
      initialViewRef.current = { x: tx, y: ty, k };
    } catch (err) {
      // ignore
    }
  };

  /**
   * Update initial view reference without changing current view
   * (used when nodes change but we don't want to re-center)
   * Ensures all nodes fit within the center 70% of the viewport
   */
  const updateInitialView = (nodesToFit: NodeDatum[]) => {
    try {
      // Calculate bounding box including node sizes
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      nodesToFit.forEach((d) => {
        const x = d.x || 0;
        const y = d.y || 0;
        const radius = d.size || 4; // Include node radius in bounds
        minX = Math.min(minX, x - radius);
        maxX = Math.max(maxX, x + radius);
        minY = Math.min(minY, y - radius);
        maxY = Math.max(maxY, y + radius);
      });
      
      if (!isFinite(minX)) return;

      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      
      // Use 70% of viewport for content (15% margin on each side)
      const availableW = Math.max(10, width * 0.7);
      const availableH = Math.max(10, height * 0.7);
      
      let k = Math.min(availableW / contentW, availableH / contentH);
      const unclamped_k = k;
      k = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, k));
      
      console.log('[PanZoom] updateInitialView - Content size:', { contentW, contentH });
      console.log('[PanZoom] updateInitialView - Available space (70%):', { availableW, availableH });
      console.log('[PanZoom] updateInitialView - Calculated k:', unclamped_k, '→ Clamped k:', k);
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const tx = width / 2 - k * centerX;
      const ty = height / 2 - k * centerY;
      // Only update ref, don't change current view
      initialViewRef.current = { x: tx, y: ty, k };
      console.log('[PanZoom] updateInitialView - Updated initial view:', { x: tx, y: ty, k });
    } catch (err) {
      // ignore
    }
  };

  /**
   * Center view on a set of node ids
   */
  const centerOnNodeIds = (nodeIds: string[], allNodes: NodeDatum[]) => {
    const nodesForBox = nodeIds
      .map((id) => allNodes.find((n) => n.id === id))
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
    const tx = width / 2 - k * centerX;
    const ty = height / 2 - k * centerY;
    // Animate to target view
    animateTo({ x: tx, y: ty, k });
  };

  /**
   * Animate viewTransform to target over duration ms
   */
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

  /**
   * Restore initial view
   * Uses the saved initial view reference (which is updated when time filter changes)
   */
  const restoreInitialView = (currentNodes?: NodeDatum[]) => {
    if (initialViewRef.current) {
      console.log('[PanZoom] Restoring saved initial view:', initialViewRef.current);
      animateTo(initialViewRef.current);
    } else {
      console.log('[PanZoom] No initial view saved, cannot restore');
    }
  };

  /**
   * Start panning on SVG background click
   */
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only start pan when clicking the background (svg itself)
    if (e.target === svgRef.current) {
      panningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  /**
   * Handle window mouse move (for panning)
   * Returns true if panning occurred
   */
  const handleWindowMouseMove = (e: MouseEvent): boolean => {
    if (panningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      setViewTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
      return true;
    }
    return false;
  };

  /**
   * Handle window mouse up (end panning)
   * Returns true if panning was active
   */
  const handleWindowMouseUp = (): boolean => {
    if (panningRef.current) {
      panningRef.current = false;
      panStartRef.current = null;
      return true;
    }
    return false;
  };

  /**
   * Check if currently panning
   */
  const isPanning = () => panningRef.current;

  return {
    // State
    viewTransform,
    
    // View manipulation
    fitViewToNodes,
    updateInitialView,
    centerOnNodeIds,
    animateTo,
    restoreInitialView,
    
    // SVG event handlers
    onSvgMouseDown,
    
    // Window event handlers (to be called from external listeners)
    handleWindowMouseMove,
    handleWindowMouseUp,
    isPanning,
  };
}
