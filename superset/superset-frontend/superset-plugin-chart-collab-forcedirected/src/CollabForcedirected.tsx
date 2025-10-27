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
import React, { useRef, useState, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { CollabForcedirectedProps, CollabForcedirectedStylesProps } from './types';
import { LinkDatum } from './utils/types';
import { DEFAULT_DISTANCE_SCALE, DEFAULT_CLUSTER_DISTANCE } from './utils/constants';
import { getLinkId } from './utils/linkHelpers';
import { screenToGraph } from './utils/domHelpers';
import { Tooltip, Controls, RecordsTable } from './components';
import {
  useForceSimulation,
  usePanZoom,
  useTimeFilter,
  useNodeInteraction,
} from './hooks';

const Styles = styled.div<CollabForcedirectedStylesProps>`
  position: relative;
  background-color: ${({ theme }) => theme.colors.secondary.light2};
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }) => theme.gridUnit * 2}px;
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;

  h3 {
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

export default function CollabForcedirected(props: CollabForcedirectedProps) {
  const { nodes = [], links = [], height, width, headerText } = props as any;

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialCenterDoneRef = useRef(false);
  const lastManualClickTimeRef = useRef<number>(0);
  
  // Local state for link visualization
  const [hoveredLink, setHoveredLink] = useState<LinkDatum | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  
  // Control sliders
  const [distanceScale, setDistanceScale] = useState<number>(DEFAULT_DISTANCE_SCALE);
  const [clusterDistance, setClusterDistance] = useState<number>(DEFAULT_CLUSTER_DISTANCE);

  // Initialize hooks - all state management now delegated to hooks
  const timeFilter = useTimeFilter(links, 'month');
  const nodeInteraction = useNodeInteraction(containerRef);
  const panZoom = usePanZoom(svgRef, width, height);
  const simulation = useForceSimulation(nodes, links, {
    width,
    height,
    distanceScale,
    clusterDistance,
    windowRange: timeFilter.windowRange,
  });

  // Center view on initial load when nodes are ready
  useEffect(() => {
    if (simulation.simNodes.length > 0 && !initialCenterDoneRef.current) {
      panZoom.fitViewToNodes(simulation.simNodes);
      initialCenterDoneRef.current = true;
    }
  }, [simulation.simNodes.length]);

  // Update initial view when time filter changes (but don't re-center the view)
  useEffect(() => {
    if (simulation.simNodes.length > 0 && initialCenterDoneRef.current) {
      panZoom.updateInitialView(simulation.simNodes);
    }
  }, [timeFilter.windowRange]);

  // ===== Event handlers using hook APIs =====
  
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      panZoom.onSvgMouseDown(e);
      nodeInteraction.clearSelection();
      setExpandedLinkId(null);
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    nodeInteraction.onNodeMouseDown(e, nodeId);
    // Note: fixNodePosition is called during drag movement, not on mouse down
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    
    // Avoid duplicate processing if we just handled this in mouseup
    const now = Date.now();
    if (now - lastManualClickTimeRef.current < 50) {
      return;
    }
    
    const result = nodeInteraction.handleNodeClick(nodeId);
    
    // If click was suppressed (after drag), don't do anything
    if (!result.handled) {
      return;
    }
    
    if (result.selected) {
      // Node is now selected - clear any expanded link and center view on it
      setExpandedLinkId(null);
      panZoom.centerOnNodeIds([nodeId], simulation.simNodes);
    } else {
      // Node deselected - restore initial view
      setExpandedLinkId(null);
      panZoom.restoreInitialView();
    }
  };

  const handleLinkClick = (e: React.MouseEvent, link: LinkDatum) => {
    e.stopPropagation();
    const linkId = getLinkId(link);
    
    // Toggle expanded link
    if (expandedLinkId === linkId) {
      setExpandedLinkId(null);
      panZoom.restoreInitialView();
    } else {
      setExpandedLinkId(linkId);
      nodeInteraction.clearSelection();
      
      // Center on both nodes of the link
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any)?.id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any)?.id;
      if (sourceId && targetId) {
        panZoom.centerOnNodeIds([sourceId, targetId], simulation.simNodes);
      }
    }
  };

  // Set up window event listeners for pan/drag
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (panZoom.isPanning()) {
        panZoom.handleWindowMouseMove(e);
      }
      const draggedNodeId = nodeInteraction.getDraggingNodeId();
      if (draggedNodeId) {
        nodeInteraction.markDragMoved();
        // Update node position during drag
        const svg = svgRef.current;
        if (svg) {
          const rect = svg.getBoundingClientRect();
          const graphPos = screenToGraph(e.clientX, e.clientY, rect, panZoom.viewTransform);
          simulation.fixNodePosition(draggedNodeId, graphPos.x, graphPos.y);
        }
      }
    };

    const handleWindowMouseUp = () => {
      const draggedNodeId = nodeInteraction.getDraggingNodeId();
      const dragMoved = nodeInteraction.wasDragMoved();
      
      panZoom.handleWindowMouseUp();
      
      // Only release node position if it was actually dragged (moved)
      if (draggedNodeId && dragMoved) {
        simulation.releaseNodePosition(draggedNodeId);
      } else if (draggedNodeId && !dragMoved) {
        // Node was mousedown but not dragged - treat as a click
        const result = nodeInteraction.handleNodeClick(draggedNodeId);
        
        if (result.handled) {
          // Mark that we handled this to avoid duplicate processing if click event also fires
          lastManualClickTimeRef.current = Date.now();
          
          if (result.selected) {
            setExpandedLinkId(null);
            panZoom.centerOnNodeIds([draggedNodeId], simulation.simNodes);
          } else {
            setExpandedLinkId(null);
            panZoom.restoreInitialView();
          }
        }
      }
      
      nodeInteraction.completeDrag();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [panZoom, nodeInteraction, simulation]);

  // ===== Render =====
  
  const { simNodes, simLinks } = simulation;
  const { selectedNodeId, dragActiveId, tooltip } = nodeInteraction;
  const { viewTransform } = panZoom;

  return (
    <Styles
      ref={containerRef}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      {headerText && <h3>{headerText}</h3>}

      <svg
        ref={svgRef}
        width={0.98*width}
        height={0.9*height}
        style={{ border: '1px solid #ccc', cursor: panZoom.isPanning() ? 'grabbing' : 'grab' }}
        onMouseDown={handleSvgMouseDown}
      >
        <g transform={`translate(${viewTransform.x}, ${viewTransform.y}) scale(${viewTransform.k})`}>
          {/* Links */}
          {simLinks.map((ln) => {
            const linkId = getLinkId(ln);
            const isExpanded = linkId === expandedLinkId;
            const isHovered = hoveredLink === ln;
            const isAdjacent =
              selectedNodeId &&
              ((typeof ln.source === 'string' ? ln.source : (ln.source as any)?.id) === selectedNodeId ||
                (typeof ln.target === 'string' ? ln.target : (ln.target as any)?.id) === selectedNodeId);

            const sourceId = typeof ln.source === 'string' ? ln.source : (ln.source as any)?.id;
            const targetId = typeof ln.target === 'string' ? ln.target : (ln.target as any)?.id;
            const s = simNodes.find((n) => n.id === sourceId);
            const t = simNodes.find((n) => n.id === targetId);
            if (!s || !t) return null;

            // When a node is selected, adjacent links should show detailed types instead of gray line
            // So we hide the gray line for adjacent links when node is selected
            const shouldShowGrayLine = !isAdjacent || !selectedNodeId;

            const weight = ln.weight || 1;
            // When a node is selected, highlight adjacent links and dim others
            const strokeWidth = isExpanded || isAdjacent ? Math.max(2, weight / 2) : Math.max(1, weight / 4);
            const opacity = isExpanded || isHovered || isAdjacent ? 0.9 : selectedNodeId ? 0.05 : 0.3;

            return (
              <g key={linkId}>
                {shouldShowGrayLine && (
                  <>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="#999"
                      strokeWidth={strokeWidth}
                      opacity={opacity}
                      style={{ pointerEvents: 'none' }}
                    />
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="transparent"
                      strokeWidth={Math.max(10, strokeWidth * 4)}
                      onClick={(e) => handleLinkClick(e, ln)}
                      onMouseEnter={() => setHoveredLink(ln)}
                      onMouseLeave={() => setHoveredLink(null)}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* Expanded link detail for expandedLinkId (show event types as separate lines) */}
          {(() => {
            if (!expandedLinkId) return null;
            const activeLink = simLinks.find((ln) => getLinkId(ln) === expandedLinkId);
            if (!activeLink) return null;

            const sourceId = typeof activeLink.source === 'string' ? activeLink.source : (activeLink.source as any)?.id;
            const targetId = typeof activeLink.target === 'string' ? activeLink.target : (activeLink.target as any)?.id;
            const s = simNodes.find((n) => n.id === sourceId);
            const t = simNodes.find((n) => n.id === targetId);
            if (!s || !t) return null;

            const types = (activeLink as any).types || {};
            const typeEntries = Object.entries(types);

            return (
              <g>
                {typeEntries.map(([k, v], idx) => {
                  const visualStroke = Math.max(1, (v as number) / 1.5);
                  const hitWidth = Math.max(10, visualStroke * 6);
                  return (
                    <g key={`expanded-${k}`}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={
                          k === 'commits'
                            ? 'green'
                            : k === 'reviews'
                            ? 'blue'
                            : k === 'assigns'
                            ? 'orange'
                            : 'gray'
                        }
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
                        onClick={(e) => handleLinkClick(e, activeLink)}
                        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* Adjacent link details when a node is selected (show event types as separate lines) */}
          {selectedNodeId && simLinks.map((ln) => {
            const sourceId = typeof ln.source === 'string' ? ln.source : (ln.source as any)?.id;
            const targetId = typeof ln.target === 'string' ? ln.target : (ln.target as any)?.id;
            const isAdjacent = (sourceId === selectedNodeId || targetId === selectedNodeId);
            
            if (!isAdjacent) return null;

            const s = simNodes.find((n) => n.id === sourceId);
            const t = simNodes.find((n) => n.id === targetId);
            if (!s || !t) return null;

            const types = (ln as any).types || {};
            const typeEntries = Object.entries(types);
            const linkId = getLinkId(ln);

            return (
              <g key={`adjacent-${linkId}`}>
                {typeEntries.map(([k, v], idx) => {
                  const visualStroke = Math.max(1, (v as number) / 1.5);
                  const hitWidth = Math.max(10, visualStroke * 6);
                  return (
                    <g key={`adjacent-${linkId}-${k}`}>
                      <line
                        x1={s.x}
                        y1={s.y}
                        x2={t.x}
                        y2={t.y}
                        stroke={
                          k === 'commits'
                            ? 'green'
                            : k === 'reviews'
                            ? 'blue'
                            : k === 'assigns'
                            ? 'orange'
                            : 'gray'
                        }
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
                        onClick={(e) => handleLinkClick(e, ln)}
                        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Nodes */}
          {simNodes.map((n) => {
            // Check if this node is adjacent to the selected node
            const isAdjacent = selectedNodeId && simLinks.some((ln) => {
              const sourceId = typeof ln.source === 'string' ? ln.source : (ln.source as any)?.id;
              const targetId = typeof ln.target === 'string' ? ln.target : (ln.target as any)?.id;
              return (
                (sourceId === selectedNodeId && targetId === n.id) ||
                (targetId === selectedNodeId && sourceId === n.id)
              );
            });
            const isSelected = n.id === selectedNodeId;
            const nodeOpacity = isSelected || isAdjacent || !selectedNodeId ? 1 : 0.2;
            
            return (
              <g
                key={`node-${n.id}`}
                transform={`translate(${n.x}, ${n.y})`}
                onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                onClick={(e) => handleNodeClick(e, n.id)}
                onMouseEnter={(e) => nodeInteraction.onNodeMouseEnter(e, n)}
                onMouseMove={nodeInteraction.onNodeMouseMove}
                onMouseLeave={nodeInteraction.onNodeMouseLeave}
                style={{ cursor: dragActiveId === n.id ? 'grabbing' : 'grab' }}
                opacity={nodeOpacity}
              >
                <circle 
                  r={Math.max(4, n.size || 4)} 
                  fill="#3182bd"
                />
                <text x={8} y={4} fontSize={10}>
                  {String(n.id).slice(0, 3)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      <Tooltip
        visible={tooltip.visible}
        x={tooltip.x}
        y={tooltip.y}
        content={tooltip.content}
      />

      {/* Controls */}
      <Controls
        distanceScale={distanceScale}
        onDistanceScaleChange={setDistanceScale}
        clusterDistance={clusterDistance}
        onClusterDistanceChange={setClusterDistance}
        timeUnit={timeFilter.timeUnit}
        onTimeUnitChange={timeFilter.setTimeUnit}
        timeBuckets={timeFilter.timeBuckets}
        sliderIndex={timeFilter.sliderIndex}
        onSliderIndexChange={timeFilter.setSliderIndex}
        windowRange={timeFilter.windowRange}
      />

      {/* RecordsTable */}
      <RecordsTable
        selectedNodeId={selectedNodeId}
        expandedLinkId={expandedLinkId}
        links={simLinks}
      />
    </Styles>
  );
}
