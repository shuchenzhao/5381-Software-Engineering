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

import { CollaborationWeights } from './types';

/**
 * Minimum weight threshold for link distance calculations.
 * Prevents division by very small numbers.
 */
export const MIN_WEIGHT = 0.1;

/**
 * Minimum distance between connected nodes (in pixels).
 */
export const MIN_LINK_DISTANCE = 20;

/**
 * Maximum distance between connected nodes (in pixels).
 */
export const MAX_LINK_DISTANCE = 400;

/**
 * Minimum padding between any two nodes (in pixels).
 * Used in collision force to prevent visual overlap.
 */
export const NODE_MIN_PADDING = 20;

/**
 * Maximum strength for cluster centering forces.
 * Used to control how tightly nodes cluster together.
 */
export const MAX_CLUSTER_STRENGTH = 0.5;

/**
 * Default initial distance scale.
 * Will be auto-computed based on data if not overridden.
 */
export const DEFAULT_DISTANCE_SCALE = 10;

/**
 * Default cluster distance as a fraction of MAX_CLUSTER_STRENGTH.
 */
export const DEFAULT_CLUSTER_DISTANCE = MAX_CLUSTER_STRENGTH * 0.7;

/**
 * Number of initial ticks to run when creating a new simulation.
 * Helps nodes get initial positions before rendering.
 */
export const INITIAL_SIMULATION_TICKS = 60;

/**
 * Number of initial ticks for filtered/recreated simulations.
 */
export const FILTERED_SIMULATION_TICKS = 80;

/**
 * Debounce delay (ms) for time slider changes.
 */
export const TIME_SLIDER_DEBOUNCE_MS = 250;

/**
 * Animation duration (ms) for view transform animations.
 */
export const VIEW_ANIMATION_DURATION_MS = 300;

/**
 * Time threshold (ms) after drag ends to suppress click events.
 */
export const DRAG_CLICK_SUPPRESSION_MS = 200;

/**
 * Margin around graph content when fitting to viewport (pixels).
 */
export const FIT_MARGIN_PX = 40;

/**
 * Minimum and maximum zoom scale factors.
 */
export const MIN_ZOOM_SCALE = 0.2;
export const MAX_ZOOM_SCALE = 10;

/**
 * Wheel zoom sensitivity.
 */
export const WHEEL_ZOOM_SENSITIVITY = 0.001;

/**
 * Default weights for different collaboration event types.
 * Used to compute aggregate link strength.
 */
export const DEFAULT_COLLABORATION_WEIGHTS: CollaborationWeights = {
  commits: 1,
  reviews: 2,
  pullRequests: 2,
  assigns: 1,
  discussion: 0.5,
};

/**
 * Minimum visual radius for nodes (pixels).
 */
export const MIN_NODE_RADIUS = 4;

/**
 * Maximum visual radius for nodes (pixels).
 */
export const MAX_NODE_RADIUS = 20;

/**
 * Minimum stroke width for links (pixels).
 */
export const MIN_LINK_STROKE_WIDTH = 1;

/**
 * Multiplier for invisible hit area width relative to visual stroke.
 */
export const LINK_HIT_AREA_MULTIPLIER = 6;

/**
 * Minimum hit area width for links (pixels).
 */
export const MIN_LINK_HIT_AREA = 12;

/**
 * Strength of collision force (0-1).
 */
export const COLLISION_STRENGTH = 0.8;

/**
 * Strength of charge/repulsion force.
 */
export const CHARGE_STRENGTH = -100;

/**
 * Alpha value to restart simulation after parameter changes.
 */
export const RESTART_ALPHA = 0.3;

/**
 * Initial alpha for new simulations.
 */
export const INITIAL_ALPHA = 0.5;

/**
 * Alpha target for gentle simulation relaxation after drag.
 */
export const DRAG_RELEASE_ALPHA_TARGET = 0.1;
