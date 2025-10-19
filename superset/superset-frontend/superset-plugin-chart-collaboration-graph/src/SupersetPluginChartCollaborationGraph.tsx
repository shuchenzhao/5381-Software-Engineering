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
// Use require to avoid TypeScript d3 module typing issues in this plugin file
// Import specific d3 submodules to avoid UMD/global differences across environments
// Use require with ts-ignore to avoid requiring @types for d3 subpackages in this plugin
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3select: any = require('d3-selection');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3scale: any = require('d3-scale');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3array: any = require('d3-array');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3drag: any = require('d3-drag');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3force: any = require('d3-force');
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const d3zoom: any = require('d3-zoom');

const select: any = d3select.select;
const scaleLinear: any = d3scale.scaleLinear;
const extent: any = d3array.extent;
const drag: any = d3drag.drag;
const forceSimulation: any = d3force.forceSimulation;
const forceLink: any = d3force.forceLink;
const forceManyBody: any = d3force.forceManyBody;
const forceCenter: any = d3force.forceCenter;
const forceX: any = d3force.forceX;
const forceY: any = d3force.forceY;
const forceCollide: any = d3force.forceCollide;
const zoom: any = d3zoom.zoom;
import { SupersetPluginChartCollaborationGraphProps, SupersetPluginChartCollaborationGraphStylesProps } from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<SupersetPluginChartCollaborationGraphStylesProps>`
  background-color: ${({ theme }: any) => theme.colors.secondary.light2};
  padding: ${({ theme }: any) => theme.gridUnit * 4}px;
  border-radius: ${({ theme }: any) => theme.gridUnit * 2}px;
  height: ${({ height }: any) => height}px;
  width: ${({ width }: any) => width}px;

  h3 {
    /* You can use your props to control CSS! */
    margin-top: 0;
    margin-bottom: ${({ theme }: any) => theme.gridUnit * 3}px;
    font-size: ${({ theme, headerFontSize }: any) =>
      theme.typography.sizes[headerFontSize]}px;
    font-weight: ${({ theme, boldText }: any) =>
      theme.typography.weights[boldText ? 'bold' : 'normal']};
  }

  .collab-tooltip {
    position: absolute;
  }
  position: relative;
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

export default function SupersetPluginChartCollaborationGraph(props: SupersetPluginChartCollaborationGraphProps) {
  const { data = [], height, width } = props;

  // Adjust the SVG size slightly smaller than the container to avoid overflow
  // and visual misalignment between the background box and the svg.
  // Keep some safe minimums in case props are undefined or small.
  const svgPadding = 12; // pixels of padding inside the background box
  const svgWidth = typeof width === 'number' ? Math.max(100, width - svgPadding * 2) : 800;
  const svgHeight = typeof height === 'number' ? Math.max(100, height - svgPadding * 2 - 40) : 400;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<any>(null);

  // physics parameters stateful via refs to avoid rerendering the entire React tree on each slider move
  const paramsRef = useRef({ charge: -600, linkDistance: 80, linkStrength: 0.5 });

  // compute node metrics: degree and local clustering coefficient
  function computeNodeMetrics(nodes: any[], links: any[]) {
    const neigh = new Map();
    nodes.forEach((n: any) => neigh.set(n.id, new Set()));
    links.forEach((l: any) => {
      neigh.get(l.source.id ? l.source.id : l.source).add(l.target.id ? l.target.id : l.target);
      neigh.get(l.target.id ? l.target.id : l.target).add(l.source.id ? l.source.id : l.source);
    });
    const metrics: any = {};
    nodes.forEach((n: any) => {
      const neighbors = Array.from(neigh.get(n.id) || []);
      const k = neighbors.length;
      let triangles = 0;
      for (let i = 0; i < neighbors.length; i++) {
        for (let j = i + 1; j < neighbors.length; j++) {
          const a = neighbors[i];
          const b = neighbors[j];
          // check if a and b are connected
          if (neigh.get(a) && neigh.get(a).has(b)) triangles++;
        }
      }
      const clustering = k > 1 ? (2 * triangles) / (k * (k - 1)) : 0;
      metrics[n.id] = { degree: k, clustering };
    });
    return metrics;
  }
  // timeline controls: granularity, segments, selected segment
  const [granularity, setGranularity] = useState<'year' | 'month' | 'week'>('year');
  const [segments, setSegments] = useState<any[]>([]);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);

  // derive time range segments from raw data
  function buildSegments(raw: any[], by: 'year' | 'month' | 'week') {
    if (!raw || raw.length === 0) return [];
    const times = raw.map((r: any) => new Date(r.timestamp)).filter((d: any) => !Number.isNaN(d.getTime()));
    const minT = new Date(Math.min(...times.map((d: any) => d.getTime())));
    const maxT = new Date(Math.max(...times.map((d: any) => d.getTime())));

    const segs: any[] = [];
    if (by === 'year') {
      let curYear = minT.getFullYear();
      const lastYear = maxT.getFullYear();
      while (curYear <= lastYear) {
        const start = new Date(curYear, 0, 1);
        const next = new Date(curYear + 1, 0, 1);
        segs.push({ start, end: new Date(next.getTime() - 1), label: `${curYear}` });
        curYear += 1;
      }
      return segs;
    }
    if (by === 'month') {
      let cur = new Date(minT.getFullYear(), minT.getMonth(), 1);
      const end = new Date(maxT.getFullYear(), maxT.getMonth(), 1);
      while (cur <= end) {
        const start = new Date(cur.getFullYear(), cur.getMonth(), 1);
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        segs.push({ start, end: new Date(next.getTime() - 1), label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` });
        cur = next;
      }
    } else {
      // week granularity: use weeks starting from minT's week start (Monday)
      const weekStart = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay();
        const diff = (day + 6) % 7; // days since Monday
        copy.setDate(copy.getDate() - diff);
        copy.setHours(0, 0, 0, 0);
        return copy;
      };
      const start = weekStart(minT);
      let cur = start;
      const last = weekStart(maxT);
      while (cur <= last) {
        const s = new Date(cur);
        const next = new Date(cur);
        next.setDate(next.getDate() + 7);
        segs.push({ start: s, end: new Date(next.getTime() - 1), label: `${s.getFullYear()}-W${String(Math.ceil(((s.getTime() - new Date(s.getFullYear(),0,1).getTime())/(24*3600*1000)+1)/7)).padStart(2,'0')}` });
        cur = next;
      }
    }
    return segs;
  }

  // build segments when data or granularity changes
  useEffect(() => {
    const s = buildSegments(data, granularity);
    setSegments(s);
    // default select last segment (most recent)
    setSelectedSegmentIdx(s.length ? s.length - 1 : null);
  }, [data, granularity]);

  // filtered data based on selected segment
  const filteredData = (() => {
    if (selectedSegmentIdx === null || !segments || segments.length === 0) return data;
    const seg = segments[selectedSegmentIdx];
    if (!seg) return data;
    const start = seg.start.getTime();
    const end = seg.end.getTime();
    return data.filter((r: any) => {
      const t = new Date(r.timestamp).getTime();
      return t >= start && t <= end;
    });
  })();

  // selected node and collapsible sections (declared before effects that use them)
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(true);
  const [targetOpen, setTargetOpen] = useState(true);

  useEffect(() => {
    // parse edges (rows) into nodes and links using filteredData
    const links = filteredData.map((d: any) => ({ source: d.source, target: d.target, weight: +d.weight || 1, timestamp: d.timestamp }));

    // build node list with unique ids
    const nodeById = new Map();
    links.forEach((l: any) => {
      if (!nodeById.has(l.source)) nodeById.set(l.source, { id: l.source });
      if (!nodeById.has(l.target)) nodeById.set(l.target, { id: l.target });
    });
  const nodes = Array.from(nodeById.values());

    // compute metrics
  const metrics = computeNodeMetrics(nodes, links);

  // detect connected components so we can adjust forces when there are multiple islands
  const adj = new Map<string, Set<string>>();
  nodes.forEach((n: any) => adj.set(n.id, new Set()));
  links.forEach((l: any) => {
    const s = l.source.id ? l.source.id : l.source;
    const t = l.target.id ? l.target.id : l.target;
    if (!adj.has(s)) adj.set(s, new Set());
    if (!adj.has(t)) adj.set(t, new Set());
    const setS = adj.get(s) as Set<string> | undefined;
    const setT = adj.get(t) as Set<string> | undefined;
    if (setS) setS.add(t);
    if (setT) setT.add(s);
  });
  const visited = new Set<string>();
  let components = 0;
  nodes.forEach((n: any) => {
    const id = n.id;
    if (visited.has(id)) return;
    components += 1;
    // bfs
    const q = [id];
    visited.add(id);
    while (q.length) {
      const u = q.shift() as string;
      const neigh = adj.get(u);
      if (!neigh) continue;
      neigh.forEach((v: string) => {
        if (!visited.has(v)) {
          visited.add(v);
          q.push(v);
        }
      });
    }
  });

  // create scales
  const weightExtent = extent(links, (d: any) => d.weight) as [number, number];
  const linkWidth = scaleLinear().domain([weightExtent[0] || 1, weightExtent[1] || 1]).range([1, 6]);

  // prepare svg
  const svgEl = svgRef.current;
  if (!svgEl || !containerRef.current) return undefined;
  // set explicit width/height on the svg element so layout matches our calculations
  svgEl.setAttribute('width', String(svgWidth));
  svgEl.setAttribute('height', String(svgHeight));
  const svg = select(svgEl as any);
  svg.selectAll('*').remove();

  const g = svg.append('g');

    // draw links and nodes groups
    const link = g.append('g').attr('class', 'links').selectAll('line').data(links).enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => linkWidth(d.weight));

    const node = g.append('g').attr('class', 'nodes').selectAll('circle').data(nodes).enter()
      .append('circle')
      .attr('r', (d: any) => {
        const m = metrics[d.id] || { degree: 1 };
        return 6 + Math.min(16, m.degree * 2);
      })
      .attr('fill', '#1f77b4')
  .call(drag()
        .on('start', (event: any, d: any) => {
          if (!event.active) (simulation as any).alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event: any, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event: any, d: any) => {
          if (!event.active) (simulation as any).alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
        .on('click', (event: any, d: any) => {
          // select node and expose its collaborations below the chart
          try {
            setSelectedNode(d.id);
          } catch (e) {
            // ignore
          }
        })
        .on('mouseover', (event: any, d: any) => {
        const target = event.currentTarget as any;
        select(target).attr('stroke', '#333').attr('stroke-width', 2);
        // show id, degree and clustering in tooltip
        const m = metrics && metrics[d.id] ? metrics[d.id] : { degree: 0, clustering: 0 };
        tooltip.style('display', 'block').html(`
          <div><strong>${d.id}</strong></div>
          <div>degree: ${m.degree}</div>
          <div>clustering: ${Number(m.clustering).toFixed(2)}</div>
        `);
      })
      .on('mousemove', (event: any) => {
        tooltip.style('left', event.pageX + 10 + 'px').style('top', event.pageY + 10 + 'px');
      })
      .on('mouseout', (event: any) => {
        const target = event.currentTarget as any;
        select(target).attr('stroke', null);
        tooltip.style('display', 'none');
      });

    // node labels
    const labels = g.append('g').attr('class', 'labels').selectAll('text').data(nodes).enter()
      .append('text')
      .attr('font-size', 10)
      .attr('dx', 10)
      .attr('dy', 3)
      .text((d: any) => d.id);

    // tooltip
    const tooltip = select(containerRef.current as any)
      .append('div')
      .attr('class', 'collab-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.7)')
      .style('color', '#fff')
      .style('padding', '4px 8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('display', 'none');

    // adjust dynamics when multiple disconnected components exist
    const componentCount = components || 1;
    // reduce repulsion when there are several components so they don't spread too far
    const computedCharge = paramsRef.current.charge * (componentCount > 1 ? 0.6 : 1);
    const computedLinkDistance = paramsRef.current.linkDistance * (componentCount > 1 ? 0.75 : 1);
    // centering strength scales with number of components but is capped
    const centerStrength = Math.min(0.2, 0.02 * componentCount);

    // compute a collision radius based on node degrees (prevent overlap)
    const maxRadius = nodes.length ? Math.max(...nodes.map((n: any) => {
      const m = metrics[n.id] || { degree: 1 };
      return 6 + Math.min(16, m.degree * 2);
    })) : 8;

    // simulation with additional centering and collision
    const simulation = forceSimulation(nodes as any)
      .force('link', forceLink(links as any).id((d: any) => d.id).distance(computedLinkDistance).strength(paramsRef.current.linkStrength))
      .force('charge', forceManyBody().strength(computedCharge))
      // center using the adjusted svg width/height so the graph is centered inside the visible svg
      .force('center', forceCenter(svgWidth / 2, svgHeight / 2))
      // gentle global centering to pull islands closer
      .force('x', forceX(svgWidth / 2).strength(centerStrength))
      .force('y', forceY(svgHeight / 2).strength(centerStrength))
      // collision to avoid node overlap
      .force('collide', forceCollide().radius(maxRadius + 2).strength(1))
      .on('tick', ticked);

    simRef.current = simulation;

    function ticked() {
      link
        .attr('x1', (d: any) => (d.source as any).x)
        .attr('y1', (d: any) => (d.source as any).y)
        .attr('x2', (d: any) => (d.target as any).x)
        .attr('y2', (d: any) => (d.target as any).y);

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    }

    // zoom behavior
    svg.call(zoom().on('zoom', (event: any) => {
      g.attr('transform', event.transform as any);
    }));

    // cleanup on unmount
    return () => {
      simulation.stop();
      tooltip.remove();
      svg.selectAll('*').remove();
    };
  }, [filteredData, svgWidth, svgHeight]);



  // functions to update physics parameters (called by UI controls)
  function updateCharge(value: number) {
    paramsRef.current.charge = value;
    if (simRef.current) {
      // set force strength on the charge force, then restart the simulation
      const chargeForce = simRef.current.force('charge');
      if (chargeForce && typeof chargeForce.strength === 'function') {
        chargeForce.strength(value);
      }
      simRef.current.alpha(0.3).restart();
    }
  }
  function updateLinkDistance(value: number) {
    paramsRef.current.linkDistance = value;
    if (simRef.current) {
      const linkForce = simRef.current.force('link');
      if (linkForce && typeof linkForce.distance === 'function') {
        linkForce.distance(value);
      }
      simRef.current.alpha(0.3).restart();
    }
  }
  function updateLinkStrength(value: number) {
    paramsRef.current.linkStrength = value;
    if (simRef.current) {
      const linkForce = simRef.current.force('link');
      if (linkForce && typeof linkForce.strength === 'function') {
        linkForce.strength(value);
      }
      simRef.current.alpha(0.3).restart();
    }
  }

  return (
    <Styles
      ref={containerRef}
      boldText={props.boldText}
      headerFontSize={props.headerFontSize}
      height={height}
      width={width}
    >
      <h3>{props.headerText}</h3>
  <svg ref={svgRef} width={width} height={height} style={{ display: 'block', marginBottom: 32 }} />

  <div style={{ display: 'flex', gap: 12, marginTop: 32, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <select aria-label="granularity" value={granularity} onChange={(e) => setGranularity((e.target.value as any))} style={{ fontSize: 12 }}>
              <option value="year">Year</option>
              <option value="month">Month</option>
              <option value="week">Week</option>
          </select>
          {/* draggable time slider displays the selected time segment */}
          <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="range"
              min={0}
              max={Math.max(0, segments.length - 1)}
              step={1}
              value={selectedSegmentIdx ?? (segments.length ? segments.length - 1 : 0)}
              onChange={(e) => setSelectedSegmentIdx(Number(e.target.value))}
              disabled={segments.length === 0}
              aria-label="time-segment"
              style={{ width: 160 }}
            />
            <span style={{ fontSize: 12, minWidth: 80 }}>{(selectedSegmentIdx !== null && segments[selectedSegmentIdx]) ? segments[selectedSegmentIdx].label : 'All'}</span>
          </div>
        </div>
        <label style={{ fontSize: 12 }}>
          Charge: <input type="range" min={-1200} max={-50} defaultValue={-600} onChange={(e) => updateCharge(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 12 }}>
          Link distance: <input type="range" min={10} max={300} defaultValue={80} onChange={(e) => updateLinkDistance(Number(e.target.value))} />
        </label>
        <label style={{ fontSize: 12 }}>
          Link strength: <input type="range" min={0} max={1} step={0.05} defaultValue={0.5} onChange={(e) => updateLinkStrength(Number(e.target.value))} />
        </label>
      </div>
      {selectedNode ? (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '8px 0' }}>Collaborations for {selectedNode}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: '100%' }}>
              <h5 style={{ cursor: 'pointer' }} onClick={() => setSourceOpen((s) => !s)}>
                {sourceOpen ? '▾' : '▸'} As source
              </h5>
              {sourceOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>target</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>weight</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                      {filteredData
                        .filter((r: any) => r.source === selectedNode)
                      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((r: any, i: number) => (
                        <tr key={`s-${i}`}>
                          <td style={{ padding: '4px 8px' }}>{r.target}</td>
                          <td style={{ padding: '4px 8px' }}>{r.weight}</td>
                          <td style={{ padding: '4px 8px' }}>{r.timestamp}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ width: '100%' }}>
              <h5 style={{ cursor: 'pointer' }} onClick={() => setTargetOpen((s) => !s)}>
                {targetOpen ? '▾' : '▸'} As target
              </h5>
              {targetOpen && (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>source</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>weight</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                      {filteredData
                        .filter((r: any) => r.target === selectedNode)
                      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                      .map((r: any, i: number) => (
                        <tr key={`t-${i}`}>
                          <td style={{ padding: '4px 8px' }}>{r.source}</td>
                          <td style={{ padding: '4px 8px' }}>{r.weight}</td>
                          <td style={{ padding: '4px 8px' }}>{r.timestamp}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </Styles>
  );
}
