import React from 'react';

import { ChartProps, DataRecord } from './types';

const SupersetPluginChartBurndown: React.FC<ChartProps> = ({ data = [], width = 400, height = 300 }) => {
  // Very small, dependency-free burndown rendering using SVG
  if (!data || data.length === 0) {
    return <div>No data</div>;
  }

  // Expect data sorted by date ascending, x=ds, y=remaining
  const xs = data.map(d => new Date(d.ds).getTime());
  const ys = data.map(d => Number(d.remaining ?? d.remaining_hours ?? 0));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys);

  const xScale = (x: number) => ((x - minX) / (maxX - minX || 1)) * (width - 40) + 30;
  const yScale = (y: number) => height - 30 - ((y - minY) / (maxY - minY || 1)) * (height - 60);

  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(ys[i])}`).join(' ');

  return (
    <svg width={width} height={height} role="img" aria-label="Burndown chart">
      <rect x={0} y={0} width={width} height={height} fill="#fff" />
      <path d={path} stroke="#1f77b4" strokeWidth={2} fill="none" />
      {xs.map((x, i) => (
        <circle key={i} cx={xScale(x)} cy={yScale(ys[i])} r={3} fill="#1f77b4" />
      ))}
    </svg>
  );
};

export default SupersetPluginChartBurndown;
