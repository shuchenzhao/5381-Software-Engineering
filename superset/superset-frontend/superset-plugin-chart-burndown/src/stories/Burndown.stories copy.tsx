import React from 'react';
import SupersetPluginChartBurndown from '../SupersetPluginChartBurndown';

export default {
  title: 'Charts/Burndown',
};

const data = [
  { ds: '2025-10-01', remaining: 100 },
  { ds: '2025-10-02', remaining: 94 },
  { ds: '2025-10-03', remaining: 91 },
  { ds: '2025-10-04', remaining: 83 },
  { ds: '2025-10-05', remaining: 80 },
  { ds: '2025-10-06', remaining: 72 },
  { ds: '2025-10-07', remaining: 68 },
  { ds: '2025-10-08', remaining: 60 },
  { ds: '2025-10-09', remaining: 56 },
  { ds: '2025-10-10', remaining: 50 },
  { ds: '2025-10-11', remaining: 45 },
  { ds: '2025-10-12', remaining: 40 },
  { ds: '2025-10-13', remaining: 32 },
  { ds: '2025-10-14', remaining: 26 },
  // { ds: '2025-10-15', remaining: 10 },
  // { ds: '2025-10-16', remaining: 5 },
  // { ds: '2025-10-17', remaining: 0 },
];



export const Basic = () => (
  <div style={{ width: 600 }}>
    <SupersetPluginChartBurndown data={data} width={600} height={300} />
  </div>
);
