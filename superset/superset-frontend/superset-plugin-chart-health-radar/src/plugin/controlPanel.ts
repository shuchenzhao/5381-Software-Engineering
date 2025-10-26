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
import { t, validateNonEmpty } from '@superset-ui/core';
import { ControlPanelConfig, sections } from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    sections.legacyRegularTime,
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: t('Health Metrics Configuration'),
      expanded: true,
      description: t('Configure the four metrics to display in the health radar'),
      controlSetRows: [
        [
          {
            name: 'metric1',
            config: {
              type: 'MetricsControl',
              label: t('Metric 1 (Top-Left)'),
              description: t('First health metric to display'),
              validators: [validateNonEmpty],
              multi: false,
            },
          },
        ],
        [
          {
            name: 'metric2',
            config: {
              type: 'MetricsControl',
              label: t('Metric 2 (Top-Right)'),
              description: t('Second health metric to display'),
              validators: [validateNonEmpty],
              multi: false,
            },
          },
        ],
        [
          {
            name: 'metric3',
            config: {
              type: 'MetricsControl',
              label: t('Metric 3 (Bottom-Left)'),
              description: t('Third health metric to display'),
              validators: [validateNonEmpty],
              multi: false,
            },
          },
        ],
        [
          {
            name: 'metric4',
            config: {
              type: 'MetricsControl',
              label: t('Metric 4 (Bottom-Right)'),
              description: t('Fourth health metric to display'),
              validators: [validateNonEmpty],
              multi: false,
            },
          },
        ],
      ],
    },
    {
      label: t('Health Thresholds'),
      expanded: true,
      description: t('Define thresholds for health status colors'),
      controlSetRows: [
        [
          {
            name: 'good_threshold',
            config: {
              type: 'TextControl',
              label: t('Good Threshold (Green)'),
              description: t('Values above this threshold are shown in green'),
              default: 80,
              isInt: true,
            },
          },
        ],
        [
          {
            name: 'warning_threshold',
            config: {
              type: 'TextControl',
              label: t('Warning Threshold (Yellow)'),
              description: t('Values between warning and good thresholds are shown in yellow'),
              default: 60,
              isInt: true,
            },
          },
        ],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'header_text',
            config: {
              type: 'TextControl',
              label: t('Header Text'),
              description: t('Text to display as chart header'),
              default: 'Health Metrics Dashboard',
            },
          },
        ],
        [
          {
            name: 'show_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Show Metric Labels'),
              default: true,
              description: t('Whether to show labels for each metric'),
            },
          },
        ],
        [
          {
            name: 'show_values',
            config: {
              type: 'CheckboxControl',
              label: t('Show Metric Values'),
              default: true,
              description: t('Whether to show numeric values for each metric'),
            },
          },
        ],
        [
          {
            name: 'bold_text',
            config: {
              type: 'CheckboxControl',
              label: t('Bold Header Text'),
              default: true,
              description: t('Whether to make the header text bold'),
            },
          },
        ],
        [
          {
            name: 'header_font_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Header Font Size'),
              choices: [
                ['xs', 'Extra Small'],
                ['s', 'Small'],
                ['m', 'Medium'],
                ['l', 'Large'],
                ['xl', 'Extra Large'],
                ['xxl', 'Extra Extra Large'],
              ],
              default: 'l',
              description: t('Font size for the chart header'),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
