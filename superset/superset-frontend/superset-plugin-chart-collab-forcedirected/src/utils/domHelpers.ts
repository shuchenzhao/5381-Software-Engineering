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

import { ViewTransform } from './types';

/**
 * Convert screen (client) coordinates to graph coordinates.
 * Accounts for SVG bounding rect offset and current pan/zoom transform.
 */
export function screenToGraph(
  clientX: number,
  clientY: number,
  svgRect: DOMRect,
  transform: ViewTransform,
): { x: number; y: number } {
  const x = (clientX - svgRect.left - transform.x) / transform.k;
  const y = (clientY - svgRect.top - transform.y) / transform.k;
  return { x, y };
}

/**
 * Convert graph coordinates to screen coordinates.
 */
export function graphToScreen(
  graphX: number,
  graphY: number,
  svgRect: DOMRect,
  transform: ViewTransform,
): { x: number; y: number } {
  const x = graphX * transform.k + transform.x + svgRect.left;
  const y = graphY * transform.k + transform.y + svgRect.top;
  return { x, y };
}
