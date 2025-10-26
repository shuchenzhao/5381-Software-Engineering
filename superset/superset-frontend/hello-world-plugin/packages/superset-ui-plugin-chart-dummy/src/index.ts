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
// import { t } from '@superset-ui/translation';
// import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
// import transformProps from './transformProps';
// import thumbnail from './images/thumbnail.png';

// const metadata = new ChartMetadata({
//   description: '',
//   name: t('Example dummy chart'),
//   thumbnail,
// });

// export default class DummyChartPlugin extends ChartPlugin {
//   constructor() {
//     super({
//       loadChart: () => import('./DummyChart'),
//       metadata,
//       transformProps,
//     });
//   }
// }

import { t } from '@superset-ui/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/chart';
import transformProps from './transformProps';
import thumbnail from './images/thumbnail.png';
// import { controlPanel } from './controlPanel'; // 新增：导入控制面板

const metadata = new ChartMetadata({
  description: t('A simple metric card that displays a number with input capability'), // 更新描述
  name: t('Metric Card with Input'), // 更新名称
  thumbnail,
//   tags: ['metric', 'kpi', 'card', 'input'], // 新增标签
//   category: 'KPI', // 新增分类
});

export default class DummyChartPlugin extends ChartPlugin {
  constructor() {
    super({
      loadChart: () => import('./DummyChart'),
      metadata,
      transformProps,
    //   controlPanel, // 新增：关联控制面板
    });
  }
}