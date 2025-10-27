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
import React, { RefObject, useRef, useState } from 'react';
import { NodeDatum, TooltipState } from '../utils/types';

/**
 * Helper function to format node tooltip content
 */
function formatNodeTooltip(nd: NodeDatum): string {
  const lines: string[] = [];
  lines.push(`Username: ${nd.id}`);
  const extra = { ...((nd as any).meta || {}) };
  const extraKeys = Object.keys(extra).filter((k) => k !== 'id' && k !== 'size');
  extraKeys.forEach((k) => lines.push(`${k}: ${JSON.stringify((extra as any)[k])}`));
  return lines.join('\n');
}

/**
 * Custom hook for managing node interaction state and handlers.
 * 
 * Handles:
 * - Node selection (click to select/deselect)
 * - Node dragging (mousedown to start, movement tracking)
 * - Tooltip display (hover to show node info)
 * - Drag-click suppression (prevent clicks after drags)
 * 
 * @param containerRef - Reference to the container element for tooltip positioning
 * @returns Node interaction state and event handlers
 */
export function useNodeInteraction(
  containerRef: RefObject<HTMLDivElement>
) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: '',
  });

  const dragNodeRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);
  const lastDragTimeRef = useRef<number | null>(null);

  /**
   * Start dragging a node
   */
  const onNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    dragNodeRef.current = nodeId;
    dragMovedRef.current = false;
    setDragActiveId(nodeId);
  };

  /**
   * Handle node click (select/deselect)
   * Suppresses click if node was just dragged
   * Returns: { handled: boolean, selected: boolean }
   * - handled: false if click was suppressed (drag), true otherwise
   * - selected: true if node is selected after this click
   */
  const handleNodeClick = (nodeId: string): { handled: boolean; selected: boolean } => {
    const now = Date.now();
    const timeSinceLastDrag = lastDragTimeRef.current ? now - lastDragTimeRef.current : Infinity;
    
    // If we just dragged the node, don't treat this as a click
    if (dragMovedRef.current && lastDragTimeRef.current && timeSinceLastDrag < 200) {
      dragMovedRef.current = false;
      // Click suppressed - return current state without changes
      return { handled: false, selected: selectedNodeId !== null };
    }
    
    const next = selectedNodeId === nodeId ? null : nodeId;
    setSelectedNodeId(next);
    return { handled: true, selected: next !== null };
  };

  /**
   * Show tooltip on node hover
   */
  const onNodeMouseEnter = (e: React.MouseEvent, nd: NodeDatum) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) + 8;
    const y = e.clientY - (rect?.top ?? 0) + 8;
    setTooltip({ visible: true, x, y, content: formatNodeTooltip(nd) });
  };

  /**
   * Update tooltip position as mouse moves
   */
  const onNodeMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0) + 8;
    const y = e.clientY - (rect?.top ?? 0) + 8;
    setTooltip((t) => ({ ...t, x, y }));
  };

  /**
   * Hide tooltip on mouse leave
   */
  const onNodeMouseLeave = () => {
    setTooltip((t) => ({ ...t, visible: false }));
  };

  /**
   * Mark that drag has moved (called from external mouse move handler)
   */
  const markDragMoved = () => {
    dragMovedRef.current = true;
    lastDragTimeRef.current = Date.now();
  };

  /**
   * Complete drag operation (called from external mouse up handler)
   */
  const completeDrag = () => {
    dragNodeRef.current = null;
    setDragActiveId(null);
  };

  /**
   * Get current dragging node ID
   */
  const getDraggingNodeId = () => dragNodeRef.current;

  /**
   * Check if drag actually moved (not just mousedown/mouseup)
   */
  const wasDragMoved = () => dragMovedRef.current;

  /**
   * Clear node selection
   */
  const clearSelection = () => {
    setSelectedNodeId(null);
  };

  return {
    // State
    selectedNodeId,
    dragActiveId,
    tooltip,
    
    // Selection control
    setSelectedNodeId,
    clearSelection,
    
    // Event handlers
    onNodeMouseDown,
    handleNodeClick,
    onNodeMouseEnter,
    onNodeMouseMove,
    onNodeMouseLeave,
    
    // Drag helpers
    getDraggingNodeId,
    wasDragMoved,
    markDragMoved,
    completeDrag,
  };
}
