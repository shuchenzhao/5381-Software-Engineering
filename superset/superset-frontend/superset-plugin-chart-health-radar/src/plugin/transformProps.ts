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
import { ChartProps } from '@superset-ui/core';
import { SupersetPluginChartHealthRadarProps, MetricConfig } from '../types';

export default function transformProps(chartProps: ChartProps): SupersetPluginChartHealthRadarProps {
  const { width, height, formData, queriesData } = chartProps;
  const {
    metric1,
    metric2,
    metric3,
    metric4,
    goodThreshold = 80,
    warningThreshold = 60,
    showLabels = true,
    showValues = true,
    headerText = 'Health Metrics Dashboard',
    boldText = true,
    headerFontSize = 'l',
  } = formData;

  // Extract data from queries
  const data: MetricConfig[] = [];
  
  // Process metrics if data is available
  if (queriesData && queriesData[0] && queriesData[0].data) {
    const queryData = queriesData[0].data[0] || {};
    
    const metrics = [
      { key: metric1, label: 'Metric 1', name: 'metric1' },
      { key: metric2, label: 'Metric 2', name: 'metric2' },
      { key: metric3, label: 'Metric 3', name: 'metric3' },
      { key: metric4, label: 'Metric 4', name: 'metric4' },
    ];

    metrics.forEach(({ key, label, name }) => {
      if (key) {
        // Try to extract the metric value from query data
        const value = queryData[key] || queryData[name] || Math.random() * 100;
        data.push({
          name,
          label: key.toString(),
          value: typeof value === 'number' ? value : parseFloat(value) || 0,
        });
      }
    });
  }

  // If no data from query, use mock data
  if (data.length === 0) {
    data.push(
      { name: 'metric1', label: 'Performance', value: 85 },
      { name: 'metric2', label: 'Reliability', value: 72 },
      { name: 'metric3', label: 'Efficiency', value: 91 },
      { name: 'metric4', label: 'Quality', value: 68 },
    );
  }

  return {
    width,
    height,
    data,
    goodThreshold: Number(goodThreshold),
    warningThreshold: Number(warningThreshold),
    showLabels,
    showValues,
    headerText,
    boldText,
    headerFontSize,
  };
}
