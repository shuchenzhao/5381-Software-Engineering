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
 * Health status thresholds and colors
 */
export interface HealthThresholds {
  good: number;    // Above this is green (healthy)
  warning: number; // Between warning and good is yellow (warning)
  // Below warning is red (critical)
}

/**
 * Configuration for a single metric
 */
export interface MetricConfig {
  name: string;
  value: number;
  label?: string;
  thresholds?: HealthThresholds;
}

/**
 * Project task for kanban board
 */
export interface ProjectTask {
  title: string;
  status: 'todo' | 'inProgress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assignee: string;
}

/**
 * Props for the HealthRadar component
 */
export interface SupersetPluginChartHealthRadarProps {
  height: number;
  width: number;
  data: MetricConfig[];
  tasks?: ProjectTask[];
  
  // Customization options
  metric1?: string;
  metric2?: string;
  metric3?: string;
  metric4?: string;
  
  // Threshold settings
  goodThreshold?: number;
  warningThreshold?: number;
  
  // Visual settings
  showLabels?: boolean;
  showValues?: boolean;
  colorScheme?: 'default' | 'colorblind';
  
  // Chart title
  headerText?: string;
  boldText?: boolean;
  headerFontSize?: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';
}

/**
 * Style settings
 */
export interface HealthRadarStylesProps {
  height: number;
  width: number;
  headerFontSize: string;
  boldText: boolean;
}

export interface SupersetPluginChartHealthRadarStylesProps {
  height: number;
  width: number;
  headerFontSize: string;
  boldText: boolean;
}

/**
 * Transform props type
 */
export interface HealthRadarTransformProps {
  height: number;
  width: number;
  formData: {
    metric1?: string;
    metric2?: string;
    metric3?: string;
    metric4?: string;
    goodThreshold?: number;
    warningThreshold?: number;
    showLabels?: boolean;
    showValues?: boolean;
    colorScheme?: string;
    headerText?: string;
    boldText?: boolean;
    headerFontSize?: string;
  };
  queriesData: Array<{
    data?: any[];
  }>;
}
