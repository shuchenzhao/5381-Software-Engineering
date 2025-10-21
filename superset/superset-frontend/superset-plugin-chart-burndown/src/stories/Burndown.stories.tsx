import React from 'react';
import SupersetPluginChartBurndown from '../SupersetPluginChartBurndown';

export default {
  title: 'Charts/Burndown',
};

const data = [
  { ds: '2025-10-01', remaining: 100 },
  { ds: '2025-10-05', remaining: 80 },
  { ds: '2025-10-10', remaining: 40 },
  { ds: '2025-10-15', remaining: 10 },
];

export const Basic = () => (
  <div style={{ width: 600 }}>
    <SupersetPluginChartBurndown data={data} width={600} height={300} />
  </div>
);
