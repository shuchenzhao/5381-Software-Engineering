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

/**
 * Node data structure used in the force-directed graph.
 * Compatible with d3-force simulation nodes.
 */
export type NodeDatum = {
  id: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  size?: number;
  fx?: number; // fixed x position (for dragging)
  fy?: number; // fixed y position (for dragging)
  meta?: Record<string, any>; // optional metadata
};

/**
 * Link data structure representing collaboration between two nodes.
 * d3-force may mutate source/target to be node objects after initialization.
 */
export type LinkDatum = {
  source: string | NodeDatum;
  target: string | NodeDatum;
  weight: number;
  types?: {
    commits?: number;
    reviews?: number;
    pullRequests?: number;
    assigns?: number;
    discussion?: number;
  };
  sample_events?: Array<{
    type?: string;
    event_type?: string;
    actor?: string;
    user?: string;
    target?: string;
    timestamp?: string | number;
    time?: string | number;
    t?: string | number;
    ts?: string | number;
    timestamp_ms?: string | number;
    id?: string;
    lines_added?: number;
    lines_deleted?: number;
    [key: string]: any;
  }>;
  first?: number;
  last?: number;
};

/**
 * Time unit for time-range filtering.
 */
export type TimeUnit = 'year' | 'month' | 'week';

/**
 * Time bucket representing a discrete time interval.
 */
export type TimeBucket = {
  startMs: number;
  label: string;
};

/**
 * Window range for filtering events by time.
 */
export type WindowRange = {
  startMs: number;
  endMs: number;
};

/**
 * View transform state for pan/zoom.
 */
export type ViewTransform = {
  x: number;
  y: number;
  k: number; // scale factor
};

/**
 * Tooltip state.
 */
export type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  content: string;
};

/**
 * Weights for different collaboration types when computing link strength.
 */
export type CollaborationWeights = {
  commits: number;
  reviews: number;
  pullRequests: number;
  assigns: number;
  discussion: number;
};
