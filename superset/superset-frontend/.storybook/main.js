import { dirname, join, resolve } from 'path';
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
// Superset's webpack.config.js
const customConfig = require('../webpack.config.js');

const pluginName = process.env.PLUGIN_NAME || 'superset-plugin-chart-collaboration-graph';
const pluginStories = `../${pluginName}/src/stories/**/*.stories.@(js|jsx|ts|tsx)`;

module.exports = {
  // If PLUGIN_STORYBOOK=1 is set in the environment, only load the plugin's stories.
  // stories: process.env.PLUGIN_STORYBOOK === '1' ? [
  //   '../superset-plugin-chart-collaboration-graph/src/stories/**/*.stories.@(js|jsx|ts|tsx)'
  // ] : [
  //   '../src/@(components|common|filters|explore|views|dashboard|features)/**/*.stories.@(tsx|jsx)',
  //   '../packages/superset-ui-demo/storybook/stories/**/*.*.@(tsx|jsx)',
  //   // include plugin stories for local plugin development
  //   '../superset-plugin-chart-collaboration-graph/src/stories/**/*.stories.@(js|jsx|ts|tsx)'
  // ],

  stories: process.env.PLUGIN_STORYBOOK === '1' ? [pluginStories] : [
    '../src/@(components|common|filters|explore|views|dashboard|features)/**/*.stories.@(tsx|jsx)',
    '../packages/superset-ui-demo/storybook/stories/**/*.*.@(tsx|jsx)',
    // include plugin stories for local plugin development (default when not using PLUGIN_STORYBOOK)
    '../superset-plugin-chart-collaboration-graph/src/stories/**/*.stories.@(js|jsx|ts|tsx)'
  ],

  addons: [
    getAbsolutePath('@storybook/addon-essentials'),
    getAbsolutePath('@storybook/addon-links'),
    '@mihkeleidast/storybook-addon-source',
    getAbsolutePath('@storybook/addon-controls'),
    getAbsolutePath('@storybook/addon-mdx-gfm'),
  ],

  staticDirs: ['../src/assets/images'],

  // Enhanced webpackFinal: alias deck.gl/luma.gl to root node_modules and
  // disable fullySpecified for luma.gl webgl adapter files.
  webpackFinal: async (config) => {
    // Merge resolver config and force aliases to root node_modules to avoid duplicate copies
    const mergedResolve = {
      ...(config.resolve || {}),
      ...(customConfig.resolve || {}),
    };

    mergedResolve.alias = {
      ...(mergedResolve.alias || {}),
      '@deck.gl/core': resolve(__dirname, '../node_modules/@deck.gl/core'),
      '@deck.gl/layers': resolve(__dirname, '../node_modules/@deck.gl/layers'),
      '@deck.gl/react': resolve(__dirname, '../node_modules/@deck.gl/react'),
      '@deck.gl/widgets': resolve(__dirname, '../node_modules/@deck.gl/widgets'),
      '@luma.gl/core': resolve(__dirname, '../node_modules/@luma.gl/core'),
      '@luma.gl/webgl': resolve(__dirname, '../node_modules/@luma.gl/webgl'),
    };

    // Base rules from custom webpack config (preserve presets)
    const baseRules = (customConfig.module && customConfig.module.rules) || [];
    const rules = [
      // Disable fullySpecified resolution for the luma.gl webgl adapter files
      {
        test: /node_modules[\\\/]@luma\.gl[\\\/]webgl[\\\/]dist[\\\/]adapter[\\\/].*\.js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      // keep existing rules so storybook handles css/ts/etc as before
      ...baseRules,
    ];

    return {
      ...config,
      module: {
        ...config.module,
        rules,
      },
      resolve: mergedResolve,
      plugins: [...config.plugins, ...(customConfig.plugins || [])],
    };
  },

  typescript: {
    reactDocgen: 'react-docgen-typescript',
  },

  framework: {
    name: getAbsolutePath('@storybook/react-webpack5'),
    options: {},
  },

  docs: {
    autodocs: false,
  },
};

function getAbsolutePath(value) {
  return dirname(require.resolve(join(value, 'package.json')));
}