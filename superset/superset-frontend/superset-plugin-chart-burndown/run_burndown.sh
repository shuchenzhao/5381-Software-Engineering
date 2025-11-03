#!/bin/bash
# set -ex
set -euo pipefail

# ------------------------------
# 配置
# ------------------------------
BASE_DIR=$(pwd)
DATA_DIR="$BASE_DIR/data"
OWNER="tensorflow"
REPO="tensorflow"
DAYS=90

# ------------------------------
# 激活虚拟环境
# ------------------------------
# source "$BASE_DIR/venv/bin/activate"
source ../../venv/bin/activate

echo "📡 Fetching latest GitHub issues..."

# 抓取 Issues 并获取生成的 JSON 文件（取最后一行输出，即文件路径）
LATEST_JSON=$(python3 "$BASE_DIR/backend/github_fetch_issues_since.py" \
    --owner "$OWNER" \
    --repo "$REPO" \
    --days "$DAYS" | tail -n1)

if [[ ! -f "$LATEST_JSON" ]]; then
    echo "❌ Failed to get latest JSON file."
    exit 1
fi

echo "✅ Latest JSON file: $LATEST_JSON"

# 转换成 Burndown 数据
echo "🔄 Converting to burndown data..."
python3 "$BASE_DIR/backend/github_issues_to_burndown.py" \
    --input "$LATEST_JSON" \
    --start 2025-08-04 \
    --output "$BASE_DIR/src/stories/burndown_data_generated.ts"

echo "💾 Burndown data saved to $BASE_DIR/src/stories/burndown_data_generated.ts"

# ------------------------------
# 启动 Storybook
# ------------------------------
PLUGIN_STORYBOOK=1 PLUGIN_NAME=superset-plugin-chart-burndown npm run storybook
