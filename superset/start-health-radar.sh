#!/bin/bash

# 🚀 Health Radar 插件快速启动脚本

echo "=========================================="
echo "🎨 Health Radar 插件 - Storybook 启动"
echo "=========================================="
echo ""

# 强制切换到正确的目录
cd "/Users/tangliam/Projects/5381-Software-Engineering/superset/superset-frontend" || {
    echo "❌ 错误: 无法进入目录"
    exit 1
}

echo "📍 当前目录: $(pwd)"
echo ""

# 检查 package.json
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 找不到 package.json"
    exit 1
fi

echo "✅ 环境检查通过"
echo ""

echo "=========================================="
echo "🚀 启动 Health Radar 插件 Storybook"
echo "=========================================="
echo ""
echo "⏰ 首次启动需要 2-5 分钟编译，请耐心等待..."
echo ""
echo "📊 你将看到以下示例："
echo "   - BasicExample: 基本示例（混合状态）"
echo "   - AllHealthy: 全部健康（绿色）"
echo "   - CriticalStatus: 危险状态（红色）"
echo "   - MixedStatus: 混合状态"
echo "   - CustomThresholds: 自定义阈值"
echo ""
echo "💡 功能特点："
echo "   ✓ 四个独立指标配置"
echo "   ✓ 颜色编码（绿/黄/红）"
echo "   ✓ 自定义阈值设置"
echo "   ✓ 响应式布局"
echo ""
echo "🌐 启动后访问: http://localhost:6006"
echo "📁 在左侧菜单找: Plugins → HealthRadar"
echo ""
echo "按 Ctrl+C 停止 Storybook"
echo ""
echo "开始启动..."
echo ""

# 设置环境变量并启动 Storybook
export PLUGIN_STORYBOOK=3
npm run storybook
