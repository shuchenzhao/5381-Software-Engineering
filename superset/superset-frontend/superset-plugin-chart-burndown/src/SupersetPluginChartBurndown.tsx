import React from 'react';
import { ChartProps } from './types';

const SupersetPluginChartBurndown: React.FC<ChartProps> = ({
  data = [],
  width = 600,
  height = 400,
}) => {
  if (!data || data.length === 0) return <div>No data</div>;

  // --- 数据预处理 ---
  const xs = data.map(d => new Date(d.ds).getTime());
  const ys = data.map(d => Number(d.remaining ?? d.remaining_hours ?? 0));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys);

  const margin = { left: 50, right: 50, top: 50, bottom: 80 };

  // --- 延长线计算 ---
  let projectionPath = '';
  let projectedDateStr = '';
  let xProj = 0;
  let xProjScaled = 0;

  if (ys.length >= 2) {
    const x1 = xs[xs.length - 2];
    const y1 = ys[xs.length - 2];
    const x2 = xs[xs.length - 1];
    const y2 = ys[xs.length - 1];
    const k = (y2 - y1) / (x2 - x1);
    if (k < 0 && y2 > 0) {
      xProj = x2 - y2 / k;
      xProjScaled =
        margin.left +
        ((xProj - minX) / (Math.max(maxX, xProj) - minX || 1)) *
          (width - margin.left - margin.right);
      projectionPath = `M ${
        margin.left +
        ((x2 - minX) / (Math.max(maxX, xProj) - minX || 1)) *
          (width - margin.left - margin.right)
      } ${
        height -
        margin.bottom -
        ((y2 - minY) / (maxY - minY || 1)) * (height - margin.top - margin.bottom)
      } L ${xProjScaled} ${height - margin.bottom}`;

      const projDate = new Date(xProj);
      projDate.setHours(0, 0, 0, 0);
      if (xProj > projDate.getTime()) projDate.setDate(projDate.getDate() + 1);
      projectedDateStr = `${projDate.getFullYear()}-${(projDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${projDate.getDate().toString().padStart(2, '0')}`;
    }
  }

  const rightmostX = projectionPath ? Math.max(maxX, xProj) : maxX;
  const xScale = (x: number) =>
    margin.left + ((x - minX) / (rightmostX - minX || 1)) * (width - margin.left - margin.right);
  const yScale = (y: number) =>
    height - margin.bottom - ((y - minY) / (maxY - minY || 1)) * (height - margin.top - margin.bottom);

  const xAxisEnd = xScale(rightmostX);

  // --- 横轴智能间隔显示 ---
  const keyDates: number[] = [];
  const firstDate = xs[0];
  const lastDate = xs[xs.length - 1];
  keyDates.push(firstDate);

  const minGap = 2 * 24 * 60 * 60 * 1000; // 2天最小间隔
  let d = new Date(firstDate);
  d.setHours(0, 0, 0, 0);

  while (d.getTime() < lastDate) {
    d.setDate(d.getDate() + 1);
    const t = d.getTime();
    const day = d.getDate();
    if ((day % 5 === 0 || day % 10 === 0) &&
        keyDates.every(k => Math.abs(k - t) > minGap) &&
        lastDate - t > minGap) {
      keyDates.push(t);
    }
  }

  if (keyDates.every(k => Math.abs(k - lastDate) > 0)) keyDates.push(lastDate);

  let projTime: number | null = null;
  if (projectionPath) {
    const projDate = new Date(xProj);
    projDate.setHours(0, 0, 0, 0);
    // 横轴不使用预测日期
    projTime = projDate.getTime();
    // 不 push 到 keyDates
    // if (keyDates.every(k => Math.abs(k - projTime!) > 0)) keyDates.push(projTime);
  }

  keyDates.sort((a, b) => a - b);

  const actualPath = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(ys[i])}`)
    .join(' ');

  const idealPath = `M ${xScale(xs[0])} ${yScale(ys[0])} L ${xScale(xs[xs.length - 1])} ${yScale(0)}`;

  const yTicks = 5;
  const yStep = maxY / yTicks;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  // --- tooltip & 横纵虚线状态 ---
  const [tooltip, setTooltip] = React.useState<{ visible: boolean; x: number; y: number; content: string }>({ visible: false, x: 0, y: 0, content: '' });
  const [hoverLine, setHoverLine] = React.useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Burndown chart"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setHoverLine({ visible: true, x: mouseX, y: mouseY });

        // --- 找最近数据点 ---
        const distances = xs.map((x, i) => Math.abs(xScale(x) - mouseX));
        const minIndex = distances.indexOf(Math.min(...distances));
        const nearestX = xs[minIndex];
        const nearestY = ys[minIndex];

        setTooltip({
          visible: true,
          x: xScale(nearestX),
          y: yScale(nearestY) - 30,
          content: `Date: ${formatDate(nearestX)}\nRemaining Work / Issues: ${nearestY}`,
        });
      }}
      onMouseLeave={() => setHoverLine({ visible: false })}
    >
      {/* 背景 */}
      <rect x={0} y={0} width={width} height={height} fill="#fff" />

      {/* Y轴网格线 */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yVal = yStep * i;
        const yPos = yScale(yVal);
        return (
          <g key={`y-grid-${i}`}>
            <line x1={margin.left} y1={yPos} x2={xAxisEnd} y2={yPos} stroke="#eee" strokeWidth={1} />
            <text x={margin.left - 8} y={yPos + 4} fontSize="10" textAnchor="end" fill="#555">
              {Math.round(yVal)}
            </text>
          </g>
        );
      })}

      {/* 横轴智能间隔日期显示 */}
      {keyDates.map((x, i) => {
        // const isProj = projectionPath && x === projTime;
        const isProj = false; // 横轴不标红
        return (
          <g key={`x-grid-${i}`}>
            <line x1={xScale(x)} y1={yScale(minY)} x2={xScale(x)} y2={margin.top} stroke="#f3f3f3" strokeWidth={1} />
            <text
              x={xScale(x)}
              y={height - margin.bottom + 15}
              fontSize="10"
              textAnchor="end"
              transform={`rotate(-45, ${xScale(x)}, ${height - margin.bottom + 15})`}
              fill={isProj ? '#ff0000' : '#555'}
            >
              {formatDate(x)}
            </text>
          </g>
        );
      })}

      {/* 坐标轴 */}
      <line x1={margin.left} y1={yScale(minY)} x2={xAxisEnd} y2={yScale(minY)} stroke="#000" strokeWidth={1.2} />
      <line x1={margin.left} y1={yScale(minY)} x2={margin.left} y2={margin.top} stroke="#000" strokeWidth={1.2} />

      {/* 理想燃尽线 */}
      <path d={idealPath} stroke="#ff7f0e" strokeWidth={2} strokeDasharray="5,5" fill="none" />
      <circle cx={xScale(xs[xs.length - 1])} cy={yScale(0)} r={2} fill="#ff7f0e" stroke="#ff7f0e" strokeWidth={1.5} />

      {/* 实际燃尽线 */}
      <path d={actualPath} stroke="#1f77b4" strokeWidth={2} fill="none" />

      {/* 延长线 */}
      {projectionPath && (
        <g>
          <path d={projectionPath} stroke="#1f77b4" strokeWidth={2} strokeDasharray="4,4" fill="none" />
          <text
            x={xProjScaled}
            y={height - margin.bottom + 15}
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            fill="#ff0000"
            transform={`rotate(-45, ${xProjScaled}, ${height - margin.bottom + 15})`}
          >
            {projectedDateStr}
          </text>
        </g>
      )}



      {/* 数据点 */}
      {xs.map((x, i) => (
        <circle key={i} cx={xScale(x)} cy={yScale(ys[i])} r={3} fill="#1f77b4" />
      ))}

      {/* 预测日期红圈 */}
      {projectionPath && projTime !== null && (
        <circle
          cx={xScale(projTime)}
          cy={yScale(0)}
          r={2}
          fill="#ff0000"
          stroke="#d62728"
          strokeWidth={1.5}
        />
      )}

      {/* 鼠标悬浮横纵虚线 */}
      {hoverLine.visible && (
        <g>
          <line x1={hoverLine.x} y1={margin.top} x2={hoverLine.x} y2={height - margin.bottom} stroke="#aaa" strokeWidth={1} strokeDasharray="4,4" />
          <line x1={margin.left} y1={hoverLine.y} x2={width - margin.right} y2={hoverLine.y} stroke="#aaa" strokeWidth={1} strokeDasharray="4,4" />
        </g>
      )}

      {/* Tooltip */}
      {tooltip.visible && (
        <foreignObject x={tooltip.x + 5} y={tooltip.y} width={150} height={40}>
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              color: '#fff',
              padding: '2px 5px',
              borderRadius: 3,
              fontSize: 10,
              whiteSpace: 'pre-line',
            }}
          >
            {tooltip.content}
          </div>
        </foreignObject>
      )}

      {/* 图例 */}
      <g transform={`translate(${width - 150}, ${margin.top})`}>
        <rect width={10} height={10} fill="#1f77b4" />
        <text x={15} y={9} fontSize="10" fill="#333">Actual</text>
        <rect y={15} width={10} height={2} fill="#ff7f0e" />
        <text x={15} y={20} fontSize="10" fill="#333">Ideal</text>
        <rect y={30} width={10} height={2} fill="#d62728" />
        <text x={15} y={35} fontSize="10" fill="#333">Projection</text>
      </g>

      {/* 轴标题 */}
      <text x={width / 2} y={height - 10} fontSize="12" textAnchor="middle" fill="#333">Date</text>
      <text transform={`rotate(-90)`} x={-height / 2} y={15} fontSize="12" textAnchor="middle" fill="#333">Remaining Work / Issues</text>
    </svg>
  );
};

export default SupersetPluginChartBurndown;
