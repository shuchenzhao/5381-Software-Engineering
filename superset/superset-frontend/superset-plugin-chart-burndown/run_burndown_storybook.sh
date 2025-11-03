#!/bin/bash
set -ex
# set -euo pipefail

# ------------------------------
# 配置
# ------------------------------
BASE_DIR=$(pwd)
# VENV_DIR="$BASE_DIR/../venv"
OWNER="tensorflow"
REPO="tensorflow"
DAYS=90
START_DATE="2025-09-01"
OUTPUT_TS="$BASE_DIR/src/stories/burndown_data_generated.ts"

# ------------------------------
# 抓取 Issues 并生成 Burndown 数据
# ------------------------------
cd "$BASE_DIR/backend"
python3 "$BASE_DIR/backend/fetch_issues_and_toBurndown.py" \
    --owner "$OWNER" \
    --repo "$REPO" \
    --days "$DAYS" \
    --start "$START_DATE" \
    --output "$OUTPUT_TS"


# ------------------------------
# 启动 Storybook
# ------------------------------
echo "🚀 Starting Storybook..."
cd "$BASE_DIR"
PLUGIN_STORYBOOK=1 PLUGIN_NAME=superset-plugin-chart-burndown npm run storybook

# ------------------------------
# 整个过程可能需要2至3分钟完成
# ------------------------------