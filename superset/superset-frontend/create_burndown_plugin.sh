#!/usr/bin/env bash
set -euo pipefail

# create_burndown_plugin.sh
# Usage: ./create_burndown_plugin.sh [--force]
# Creates superset-plugin-chart-burndown plugin files under superset-frontend/

FORCE=false
if [ "${1-}" = "--force" ]; then
  FORCE=true
fi

BASE_DIR="$(pwd)/superset-frontend"
TARGET_DIR="$BASE_DIR/superset-plugin-chart-burndown"

echo "Base dir: $BASE_DIR"

mkdir -p "$TARGET_DIR/src/stories"
mkdir -p "$TARGET_DIR/plugin"

create_file_if_missing() {
  local path="$1"
  local content="$2"
  if [ -f "$path" ] && [ "$FORCE" != "true" ]; then
    echo "Skipping existing file: $path"
  else
    echo "Writing $path"
    cat > "$path" <<'EOF'
${content}
EOF
  fi
}

# Helper to write using here-documents (we can't pass multi-line easily through helper, so write with inline cat)
write_file() {
  local path="$1"
  shift
  echo "Writing $path"
  cat > "$path" <<'EOF'
$@
EOF
}

# If user runs script from repository root, BASE_DIR will be correct. Otherwise try to locate.
if [ ! -d "$BASE_DIR" ]; then
  echo "Error: expected directory $BASE_DIR does not exist. Run this script from repository root where superset-frontend exists." >&2
  exit 2
fi

# Files content

# src/SupersetPluginChartBurndown.tsx
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/src/SupersetPluginChartBurndown.tsx" ]; then
cat > "$TARGET_DIR/src/SupersetPluginChartBurndown.tsx" <<'EOF'
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
EOF
else
  echo "Skipping: $TARGET_DIR/src/SupersetPluginChartBurndown.tsx (exists)"
fi

# src/index.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/src/index.ts" ]; then
cat > "$TARGET_DIR/src/index.ts" <<'EOF'
export { default as SupersetPluginChartBurndown } from './SupersetPluginChartBurndown';
export { default as transformProps } from './plugin/transformProps';
export { default as buildQuery } from './plugin/buildQuery';
export { default as controlPanel } from './plugin/controlPanel';
export * from './types';
EOF
else
  echo "Skipping: $TARGET_DIR/src/index.ts (exists)"
fi

# src/types.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/src/types.ts" ]; then
cat > "$TARGET_DIR/src/types.ts" <<'EOF'
export type DataRecord = {
  ds: string | number | Date;
  remaining: number;
};

export interface ChartProps {
  width: number;
  height: number;
  data: DataRecord[];
  formData?: any;
}
EOF
else
  echo "Skipping: $TARGET_DIR/src/types.ts (exists)"
fi

# plugin/transformProps.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/plugin/transformProps.ts" ]; then
cat > "$TARGET_DIR/plugin/transformProps.ts" <<'EOF'
import { ChartProps } from '../src/types';

export default function transformProps(chartProps: any) {
  const { width, height, formData, queriesData } = chartProps;
  // Expect queriesData[0].data to be array of rows with ds and remaining
  const data = (queriesData && queriesData[0] && queriesData[0].data) || [];
  return { width, height, formData, data } as ChartProps;
}
EOF
else
  echo "Skipping: $TARGET_DIR/plugin/transformProps.ts (exists)"
fi

# plugin/buildQuery.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/plugin/buildQuery.ts" ]; then
cat > "$TARGET_DIR/plugin/buildQuery.ts" <<'EOF'
import { QueryFormData } from '@superset-ui/core';

export default function buildQuery(formData: QueryFormData) {
  // Minimal example: select ds and remaining columns
  const metrics = formData.metrics || [];
  return {
    columns: ['ds', 'remaining'],
    // other necessary query fields can be added by integrator
  };
}
EOF
else
  echo "Skipping: $TARGET_DIR/plugin/buildQuery.ts (exists)"
fi

# plugin/controlPanel.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/plugin/controlPanel.ts" ]; then
cat > "$TARGET_DIR/plugin/controlPanel.ts" <<'EOF'
import { ControlPanelConfig } from '@superset-ui/core';

const controlPanel: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: 'Query',
      expanded: true,
      controlSetRows: [
        ['metric'],
        ['adhoc_filters'],
      ],
    },
    {
      label: 'Chart Options',
      expanded: true,
      controlSetRows: [
        ['row_limit'],
      ],
    },
  ],
};

export default controlPanel;
EOF
else
  echo "Skipping: $TARGET_DIR/plugin/controlPanel.ts (exists)"
fi

# plugin/index.ts
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/plugin/index.ts" ]; then
cat > "$TARGET_DIR/plugin/index.ts" <<'EOF'
import { ChartMetadata, registerChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import SupersetPluginChartBurndown from '../src/SupersetPluginChartBurndown';

const metadata = new ChartMetadata({
  name: 'Burndown',
  description: 'A simple burndown chart',
  thumbnail: undefined,
});

export default function install() {
  registerChartPlugin({
    metadata,
    transformProps,
    buildQuery,
    controlPanel,
    Chart: SupersetPluginChartBurndown,
  });
}
EOF
else
  echo "Skipping: $TARGET_DIR/plugin/index.ts (exists)"
fi

# story file
if [ "$FORCE" = "true" ] || [ ! -f "$TARGET_DIR/src/stories/Burndown.stories.tsx" ]; then
cat > "$TARGET_DIR/src/stories/Burndown.stories.tsx" <<'EOF'
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
EOF
else
  echo "Skipping: $TARGET_DIR/src/stories/Burndown.stories.tsx (exists)"
fi

# README - create only if missing
if [ ! -f "$TARGET_DIR/README.md" ]; then
cat > "$TARGET_DIR/README.md" <<'EOF'
# Superset Burndown Chart Plugin

This plugin provides a simple burndown chart for Superset. It's a small example plugin.

Data expectations:
- x column: `ds` (date)
- y column: `remaining` (remaining work)
EOF
else
  echo "README exists, skipping"
fi

# Show summary
echo
echo "Created/updated files under: $TARGET_DIR"
ls -la "$TARGET_DIR"

echo
echo "Tip: run the script with --force to overwrite existing files: ./create_burndown_plugin.sh --force"

echo "Done."

exit 0
