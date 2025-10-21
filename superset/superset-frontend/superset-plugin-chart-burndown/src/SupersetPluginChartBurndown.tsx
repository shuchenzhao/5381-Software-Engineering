// import React from 'react';
// import { ChartProps } from './types';

// const SupersetPluginChartBurndown: React.FC<ChartProps> = ({
//   data = [],
//   width = 600,
//   height = 400,
// }) => {
//   if (!data || data.length === 0) {
//     return <div>No data</div>;
//   }

//   // 数据预处理：日期和剩余任务量
//   const xs = data.map(d => new Date(d.ds).getTime());
//   const ys = data.map(d => Number(d.remaining ?? d.remaining_hours ?? 0));

//   const minX = Math.min(...xs);
//   const maxX = Math.max(...xs);
//   const minY = 0;
//   const maxY = Math.max(...ys);



//   // 坐标变换函数（带内边距）
//   const margin = { left: 50, right: 30, top: 50, bottom: 80 };
//   const xScale = (x: number) =>
//     margin.left + ((x - minX) / (maxX - minX || 1)) * (width - margin.left - margin.right);
//   const yScale = (y: number) =>
//     height -
//     margin.bottom -
//     ((y - minY) / (maxY - minY || 1)) * (height - margin.top - margin.bottom);

//   // 实际燃尽线
//   const actualPath = xs
//     .map((x, i) => `${i === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(ys[i])}`)
//     .join(' ');

//   // 理想燃尽线（从第一个点到最后一个点）
//   const idealPath = `M ${xScale(xs[0])} ${yScale(ys[0])} L ${xScale(xs[xs.length - 1])} ${yScale(0)}`;
  

//   // 计算延长线（倒数两点延长）
//   let projectionPath = '';
//   let projectedDateStr = '';
//   let xProjScaled = 0; // 延长线横坐标

//   if (ys.length >= 2) {
//     const x1 = xs[xs.length - 2];
//     const y1 = ys[xs.length - 2];
//     const x2 = xs[xs.length - 1];
//     const y2 = ys[xs.length - 1];

//     const k = (y2 - y1) / (x2 - x1);
//     if (k !== 0 && y2 > 0) {
//       // 延长到 y=0 的横坐标
//       const xProj = x2 - y2 / k;
//       xProjScaled = xScale(xProj); // SVG 坐标

//       // 延长线路径
//       projectionPath = `M ${xScale(x2)} ${yScale(y2)} L ${xProjScaled} ${yScale(0)}`;

//       // 进1法处理预计完成日期
//       const projDate = new Date(xProj);
//       projDate.setHours(0, 0, 0, 0);
//       if (xProj > projDate.getTime()) {
//         projDate.setDate(projDate.getDate() + 1);
//       }
//       projectedDateStr = `${projDate.getFullYear()}-${(projDate.getMonth() + 1)
//         .toString()
//         .padStart(2, '0')}-${projDate.getDate().toString().padStart(2, '0')}`;
//     }
//   }

  
//   // 坐标轴刻度
//   const yTicks = 5;
//   const yStep = maxY / yTicks;
//   const xTicks = xs.length;


//   const formatDate = (timestamp: number) => {
//     const d = new Date(timestamp);
//     const month = (d.getMonth() + 1).toString().padStart(2, '0');
//     const day = d.getDate().toString().padStart(2, '0');
//     return `${d.getFullYear()}-${month}-${day}`;
//   };

//   // 横轴延长到延长线交点
//   const xAxisEnd = projectionPath ? Math.max(width - margin.right, xProjScaled) : width - margin.right;

//   return (
//     <svg width={width} height={height} role="img" aria-label="Burndown chart">
//       {/* 背景 */}
//       <rect x={0} y={0} width={width} height={height} fill="#fff" />

//       {/* 网格线 + Y 轴标签 */}
//       {Array.from({ length: yTicks + 1 }).map((_, i) => {
//         const yVal = yStep * i;
//         const yPos = yScale(yVal);
//         return (
//           <g key={`y-grid-${i}`}>
//             <line
//               x1={margin.left}
//               y1={yPos}
//               // x2={width - margin.right}
//               x2={xAxisEnd}       // 延长到交点
//               y2={yPos}
//               stroke="#eee"
//               strokeWidth={1}
//             />
//             <text
//               x={margin.left - 8}
//               y={yPos + 4}
//               fontSize="10"
//               textAnchor="end"
//               fill="#555"
//             >
//               {Math.round(yVal)}
//             </text>
//           </g>
//         );
//       })}

//       {xs.map((x, i) => (
//         <g key={`x-grid-${i}`}>
//           {/* 垂直网格线 */}
//           <line
//             x1={xScale(x)}
//             y1={yScale(minY)}
//             x2={xScale(x)}
//             y2={margin.top}
//             stroke="#f3f3f3"
//             strokeWidth={1}
//           />
//           {/* 日期标签 */}
//           <text
//             x={xScale(x)}
//             y={height - margin.bottom + 15}
//             fontSize="10"
//             textAnchor="end" // 旋转后用 end 对齐
//             transform={`rotate(-45, ${xScale(x)}, ${height - margin.bottom + 15})`}
//             fill="#555"
//           >
//             {formatDate(x)}
//           </text>
//         </g>
//       ))}

//       {/* 坐标轴 */}
      
//       <line
//         x1={margin.left}
//         y1={yScale(minY)}
//         // x2={width - margin.right}
//         x2={xAxisEnd}       // 延长到交点
//         y2={yScale(minY)}
//         stroke="#000"
//         strokeWidth={1.2}
//       />
//       <line
//         x1={margin.left}
//         y1={yScale(minY)}
//         x2={margin.left}
//         y2={margin.top}
//         stroke="#000"
//         strokeWidth={1.2}
//       />

//       {/* 理想燃尽线 */}
//       <path d={idealPath} stroke="#ff7f0e" strokeWidth={2} strokeDasharray="5,5" fill="none" />

//       {/* 实际燃尽线 */}
//       <path d={actualPath} stroke="#1f77b4" strokeWidth={2} fill="none" />

//       {/* 延长线 */}
//       {projectionPath && (
//         <g>
//           <path
//             d={projectionPath}
//             stroke="#1f77b4"       // 和实际线同色
//             strokeWidth={2}
//             strokeDasharray="4,4"  // 可选虚线
//             fill="none"
//           />
//           {/* 在横轴上标注预计完成日期 */}
//           <text
//             x={xScale(xs[xs.length - 1] - 0 + (xScale(xs[xs.length - 1]) - xScale(xs[xs.length - 2])))} // 近似位置
//             y={height - 35}
//             fontSize="10"
//             fontWeight="bold"
//             transform={`rotate(-45, ${xScale(xs[xs.length - 1] - 0 + (xScale(xs[xs.length - 1]) - xScale(xs[xs.length - 2])))} , ${height - 35})`}
//             textAnchor="middle"
//             fill="#ff0000"
//           >
//             {projectedDateStr}
//           </text>
//         </g>
//       )}

    

//       {/* 数据点 */}
//       {xs.map((x, i) => (
//         <circle key={i} cx={xScale(x)} cy={yScale(ys[i])} r={3} fill="#1f77b4" />
//       ))}

//       {/* 图例 */}
//       <g transform={`translate(${width - 150}, ${margin.top})`}>
//         <rect width={10} height={10} fill="#1f77b4" />
//         <text x={15} y={9} fontSize="10" fill="#333">
//           Actual
//         </text>
//         <rect y={15} width={10} height={2} fill="#ff7f0e" />
//         <text x={15} y={20} fontSize="10" fill="#333">
//           Ideal
//         </text>

//         <rect y={30} width={10} height={2} fill="#d62728" />
//         <text x={15} y={35} fontSize="10" fill="#333">Projection</text>
//       </g>

//       {/* 轴标题 */}
//       <text
//         x={width / 2}
//         y={height - 10}
//         fontSize="12"
//         textAnchor="middle"
//         fill="#333"
//       >
//         Date
//       </text>
//       <text
//         transform={`rotate(-90)`}
//         x={-height / 2}
//         y={15}
//         fontSize="12"
//         textAnchor="middle"
//         fill="#333"
//       >
//         Remaining Work
//       </text>
//     </svg>
//   );

// };

// export default SupersetPluginChartBurndown;





import React from 'react';
import { ChartProps } from './types';

const SupersetPluginChartBurndown: React.FC<ChartProps> = ({
  data = [],
  width = 600,
  height = 400,
}) => {
  if (!data || data.length === 0) {
    return <div>No data</div>;
  }

  // 数据预处理
  const xs = data.map(d => new Date(d.ds).getTime());
  const ys = data.map(d => Number(d.remaining ?? d.remaining_hours ?? 0));

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = 0;
  const maxY = Math.max(...ys);

  const margin = { left: 50, right: 50, top: 50, bottom: 80 }; // 扩大右、底边距

  // 计算延长线（倒数两点延长）
  let projectionPath = '';
  let projectedDateStr = '';
  let xProj = 0; // 延长线真实横坐标
  let xProjScaled = 0; // SVG 坐标

  if (ys.length >= 2) {
    const x1 = xs[xs.length - 2];
    const y1 = ys[xs.length - 2];
    const x2 = xs[xs.length - 1];
    const y2 = ys[xs.length - 1];
    const k = (y2 - y1) / (x2 - x1);
    if (k !== 0 && y2 > 0) {
      xProj = x2 - y2 / k;

      // 延长线路径
      xProjScaled = margin.left + ((xProj - minX) / (Math.max(maxX, xProj) - minX || 1)) * (width - margin.left - margin.right);
      projectionPath = `M ${margin.left + ((x2 - minX) / (Math.max(maxX, xProj) - minX || 1)) * (width - margin.left - margin.right)} ${height - margin.bottom - ((y2 - minY) / (maxY - minY || 1)) * (height - margin.top - margin.bottom)} L ${xProjScaled} ${height - margin.bottom}`;

      // 预计完成日期（进1法）
      const projDate = new Date(xProj);
      projDate.setHours(0, 0, 0, 0);
      if (xProj > projDate.getTime()) {
        projDate.setDate(projDate.getDate() + 1);
      }
      projectedDateStr = `${projDate.getFullYear()}-${(projDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${projDate.getDate().toString().padStart(2, '0')}`;
    }
  }

  // 横轴扩展到延长线
  const rightmostX = projectionPath ? Math.max(maxX, xProj) : maxX;
  const xScale = (x: number) =>
    margin.left + ((x - minX) / (rightmostX - minX || 1)) * (width - margin.left - margin.right);
  const yScale = (y: number) =>
    height - margin.bottom - ((y - minY) / (maxY - minY || 1)) * (height - margin.top - margin.bottom);

  const xAxisEnd = xScale(rightmostX);

  // 横轴最后一天到预计完成日期之间的额外日期
  const extraDates: number[] = [];
  if (projectionPath) {
    let d = new Date(xs[xs.length - 1]);
    d.setHours(0, 0, 0, 0);
    const projDate = new Date(xProj);
    projDate.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    while (d.getTime() <= projDate.getTime()) {
      extraDates.push(d.getTime());
      d.setDate(d.getDate() + 1);
    }
  }

  // 实际燃尽线
  const actualPath = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(ys[i])}`)
    .join(' ');

  // 理想燃尽线
  const idealPath = `M ${xScale(xs[0])} ${yScale(ys[0])} L ${xScale(xs[xs.length - 1])} ${yScale(0)}`;

  // 坐标轴刻度
  const yTicks = 5;
  const yStep = maxY / yTicks;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  return (
    <svg width={width} height={height} role="img" aria-label="Burndown chart">
      {/* 背景 */}
      <rect x={0} y={0} width={width} height={height} fill="#fff" />

      {/* 网格线 + Y 轴标签 */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yVal = yStep * i;
        const yPos = yScale(yVal);
        return (
          <g key={`y-grid-${i}`}>
            <line
              x1={margin.left}
              y1={yPos}
              x2={xAxisEnd}
              y2={yPos}
              stroke="#eee"
              strokeWidth={1}
            />
            <text
              x={margin.left - 8}
              y={yPos + 4}
              fontSize="10"
              textAnchor="end"
              fill="#555"
            >
              {Math.round(yVal)}
            </text>
          </g>
        );
      })}

      {/* 横轴日期 */}
      {xs.map((x, i) => (
        <g key={`x-grid-${i}`}>
          <line
            x1={xScale(x)}
            y1={yScale(minY)}
            x2={xScale(x)}
            y2={margin.top}
            stroke="#f3f3f3"
            strokeWidth={1}
          />
          <text
            x={xScale(x)}
            y={height - margin.bottom + 15}
            fontSize="10"
            textAnchor="end"
            transform={`rotate(-45, ${xScale(x)}, ${height - margin.bottom + 15})`}
            fill="#555"
          >
            {formatDate(x)}
          </text>
        </g>
      ))}

      {/* 额外日期 */}
      {extraDates.map((x, i) => (
        <g key={`x-grid-extra-${i}`}>
          <line
            x1={xScale(x)}
            y1={yScale(minY)}
            x2={xScale(x)}
            y2={margin.top}
            stroke="#f3f3f3"
            strokeWidth={1}
          />
          <text
            x={xScale(x)}
            y={height - margin.bottom + 15}
            fontSize="10"
            textAnchor="end"
            transform={`rotate(-45, ${xScale(x)}, ${height - margin.bottom + 15})`}
            fill="#555"
          >
            {formatDate(x)}
          </text>
        </g>
      ))}

      {/* 坐标轴 */}
      <line
        x1={margin.left}
        y1={yScale(minY)}
        x2={xAxisEnd}
        y2={yScale(minY)}
        stroke="#000"
        strokeWidth={1.2}
      />
      <line
        x1={margin.left}
        y1={yScale(minY)}
        x2={margin.left}
        y2={margin.top}
        stroke="#000"
        strokeWidth={1.2}
      />

      {/* 理想燃尽线 */}
      <path d={idealPath} stroke="#ff7f0e" strokeWidth={2} strokeDasharray="5,5" fill="none" />

      {/* 实际燃尽线 */}
      <path d={actualPath} stroke="#1f77b4" strokeWidth={2} fill="none" />

      {/* 延长线 */}
      {projectionPath && (
        <g>
          <path
            d={projectionPath}
            stroke="#1f77b4"
            strokeWidth={2}
            strokeDasharray="4,4"
            fill="none"
          />
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

      {/* 图例 */}
      <g transform={`translate(${width - 150}, ${margin.top})`}>
        <rect width={10} height={10} fill="#1f77b4" />
        <text x={15} y={9} fontSize="10" fill="#333">
          Actual
        </text>
        <rect y={15} width={10} height={2} fill="#ff7f0e" />
        <text x={15} y={20} fontSize="10" fill="#333">
          Ideal
        </text>
        <rect y={30} width={10} height={2} fill="#d62728" />
        <text x={15} y={35} fontSize="10" fill="#333">
          Projection
        </text>
      </g>

      {/* 轴标题 */}
      <text x={width / 2} y={height - 10} fontSize="12" textAnchor="middle" fill="#333">
        Date
      </text>
      <text transform={`rotate(-90)`} x={-height / 2} y={15} fontSize="12" textAnchor="middle" fill="#333">
        Remaining Work
      </text>
    </svg>
  );
};

export default SupersetPluginChartBurndown;
