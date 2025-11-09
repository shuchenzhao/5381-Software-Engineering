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
import React from 'react';
import { LinkDatum } from '../utils/types';
import { findConnectedLinks, getLinkId, normalizeLinkEndpoints } from '../utils/linkHelpers';
import { formatTimestamp } from '../utils/timeUtils';

export interface RecordsTableProps {
  selectedNodeId: string | null;
  expandedLinkId: string | null;
  links: LinkDatum[];
}

type TableRow = {
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

export function RecordsTable({ selectedNodeId, expandedLinkId, links }: RecordsTableProps) {
  const rows: TableRow[] = [];

  if (selectedNodeId) {
    // Find all links connected to the selected node
    const connectedLinks = findConnectedLinks(selectedNodeId, links);
    
    connectedLinks.forEach((link) => {
      const { sourceId, targetId } = normalizeLinkEndpoints(link);
      const linkId = getLinkId(link);
      const sampleEvents = link.sample_events;
      
      if (Array.isArray(sampleEvents) && sampleEvents.length) {
        sampleEvents.forEach((event) => {
          const ts = event.timestamp || event.time || event.t || event.timestamp_ms || event.ts;
          rows.push({
            source: sourceId,
            target: targetId,
            linkId,
            kind: 'event',
            type: event.type || event.event_type,
            actor: event.actor || event.user || event.actor_id,
            time: ts,
            payload: JSON.stringify(event),
          });
        });
      } else if (link.types) {
        Object.entries(link.types).forEach(([key, value]) => {
          rows.push({
            source: sourceId,
            target: targetId,
            linkId,
            kind: 'aggregate',
            type: key,
            count: value,
          });
        });
      }
    });
  } else if (expandedLinkId) {
    // Find the expanded link
    const link = links.find((l) => getLinkId(l) === expandedLinkId);
    
    if (link) {
      const { sourceId, targetId } = normalizeLinkEndpoints(link);
      const linkId = getLinkId(link);
      const sampleEvents = link.sample_events;
      
      if (Array.isArray(sampleEvents) && sampleEvents.length) {
        sampleEvents.forEach((event) => {
          const ts = event.timestamp || event.time || event.t || event.timestamp_ms || event.ts;
          rows.push({
            source: sourceId,
            target: targetId,
            linkId,
            kind: 'event',
            type: event.type || event.event_type,
            actor: event.actor || event.user,
            time: ts,
            payload: JSON.stringify(event),
          });
        });
      } else if (link.types) {
        Object.entries(link.types).forEach(([key, value]) => {
          rows.push({
            source: sourceId,
            target: targetId,
            linkId,
            kind: 'aggregate',
            type: key,
            count: value,
          });
        });
      }
    }
  }

  // Determine if we need to show the Actor column
  const showActor = rows.some((row) => {
    if (!row.actor) return false;
    const src = row.source || '';
    const tgt = row.target || '';
    return row.actor !== src && row.actor !== tgt;
  });

  if (!rows.length) {
    return (
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
        <div style={{ marginBottom: 8, fontWeight: 600 }}>
          {selectedNodeId
            ? `Username: ${selectedNodeId}`
            : expandedLinkId
            ? `Link: ${expandedLinkId}`
            : 'Records'}
        </div>
        <div style={{ color: 'rgba(0,0,0,0.6)' }}>No records to display</div>
      </div>
    );
  }

  return (
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
      <div style={{ marginBottom: 8, fontWeight: 600 }}>
        {selectedNodeId
          ? `Username: ${selectedNodeId}`
          : expandedLinkId
          ? `Link: ${expandedLinkId}`
          : 'Records'}
      </div>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Source
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Target
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Link
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Type
            </th>
            {showActor && (
              <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                Actor
              </th>
            )}
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Time
            </th>
            <th style={{ textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              Payload
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`rec-${i}`} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
              <td style={{ padding: '6px 8px' }}>{row.source}</td>
              <td style={{ padding: '6px 8px' }}>{row.target}</td>
              <td style={{ padding: '6px 8px' }}>{row.linkId}</td>
              <td style={{ padding: '6px 8px' }}>
                {row.type ?? (row.kind === 'aggregate' ? 'aggregate' : '')}
              </td>
              {showActor && <td style={{ padding: '6px 8px' }}>{row.actor ?? ''}</td>}
              <td style={{ padding: '6px 8px' }}>{formatTimestamp(row.time ?? '')}</td>
              <td style={{ padding: '6px 8px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {row.payload ?? (row.count !== undefined ? String(row.count) : '')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
