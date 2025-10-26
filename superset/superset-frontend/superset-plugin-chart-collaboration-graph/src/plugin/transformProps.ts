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
import { ChartProps, TimeseriesDataRecord } from '@superset-ui/core';

// Fallback mechanism for development: if a global `window.__COLLAB_GRAPH_MOCK__` is set
// (e.g., by importing a small non-TS helper in a dev demo), use that as data.
function getDevMock(): { data: TimeseriesDataRecord[] } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win && win.__COLLAB_GRAPH_MOCK__ && Array.isArray(win.__COLLAB_GRAPH_MOCK__.data)) {
    return win.__COLLAB_GRAPH_MOCK__ as { data: TimeseriesDataRecord[] };
  }
  return null;
}

export default function transformProps(chartProps: ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your SupersetPluginChartCollaborationGraph.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const { width, height, formData, queriesData } = chartProps;
  const { boldText, headerFontSize, headerText } = formData;

  // Use backend data when present; otherwise try the dev mock JSON if available.
  let data = [] as TimeseriesDataRecord[];
  if (queriesData && queriesData.length > 0 && Array.isArray(queriesData[0].data)) {
    data = queriesData[0].data as TimeseriesDataRecord[];
  } else {
    const dm = getDevMock();
    if (dm && Array.isArray(dm.data)) {
      // eslint-disable-next-line no-console
      console.warn('Using local mock data for collaboration graph (development fallback)');
      data = dm.data as TimeseriesDataRecord[];
    }
  }

  console.log('formData via TransformProps.ts', formData);

  return {
    width,
    height,
    data,
    // and now your control data, manipulated as needed, and passed through as props!
    boldText,
    headerFontSize,
    headerText,
  };
}
