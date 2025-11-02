# 🐛 调试指南：查看 GitHub Issues 在看板中的显示

## 问题排查步骤

### 1. 验证数据文件存在 ✅
```bash
ls -lh /Users/tangliam/Projects/5381-Software-Engineering/superset/superset-frontend/superset-plugin-chart-health-radar/src/data/fetch.json
```

### 2. 检查数据内容
```bash
# 查看有多少个 issue
cat superset-plugin-chart-health-radar/src/data/fetch.json | jq '[.[] | select(.type == "issue")] | length'

# 查看 issue 列表
cat superset-plugin-chart-health-radar/src/data/fetch.json | jq '[.[] | select(.type == "issue")] | map({title, actor, has_comments: false})'
```

### 3. 启动 Storybook
```bash
cd /Users/tangliam/Projects/5381-Software-Engineering/superset/superset-frontend
PLUGIN_STORYBOOK=3 npm run storybook
```

### 4. 在浏览器中查看

打开浏览器访问：`http://localhost:6006`

然后导航到：
- **Plugins** → **HealthRadar** → **Debug** → **Debug With Real Data**

这个 story 会：
1. 直接导入 `fetch.json` 文件
2. 在页面顶部显示调试信息（有多少个 events、多少个 issues）
3. 列出所有找到的 issues
4. 显示转换后的看板

### 5. 查看浏览器控制台

按 **F12** 打开开发者工具，在 Console 标签中查看：
- `🔍 [Debug Story] Loaded fetch.json:` - 原始数据
- `🔍 [Debug Story] Found issues:` - 过滤出的 issues
- `🔍 [Debug Story] Converted tasks:` - 转换后的任务
- `📊 [Debug Story] Task counts:` - 各状态的任务数量

### 6. 如果还看不到数据

#### 方案 A: 刷新数据
```bash
# 重新爬取数据
curl "http://127.0.0.1:5000/api/github/events?repo=pallets/flask&issues=10"

# 确认数据已更新
ls -lh superset-plugin-chart-health-radar/src/data/fetch.json
```

#### 方案 B: 手动传入测试数据

在 `Debug.stories.tsx` 中，tasks 数组已经手动转换了数据，即使 fetch 失败也能看到。

#### 方案 C: 使用 GitHubDataExample Story

另一个 story `GitHubDataExample` 使用 `useEffect` + `fetch()` 动态加载数据，查看控制台输出：
```
🔍 [HealthRadar] Starting to load GitHub data...
🔍 [HealthRadar] Trying path: ./data/fetch.json
🔍 [HealthRadar] Response status for ./data/fetch.json: 200
🔍 [HealthRadar] Loaded X total events
🔍 [HealthRadar] Found Y issue events
```

## 当前数据状态

根据最新的 fetch.json：
- **Total events**: ~9-13 个
- **Issues**: 2 个
  1. "Really, I can't close connection???" by serbinskis (有4条评论 → **进行中**)
  2. "Test failures with click 8.3.1" by dotlambda (没有评论 → **待办**)

### 预期看板显示

📝 **待办 (1)**
- Test failures with click 8.3.1 - dotlambda - [low priority]

🚀 **进行中 (1)**
- Really, I can't close connection??? - serbinskis - [medium priority]

✅ **已完成 (0)**
- (空)

## 快速测试命令

```bash
# 1. 确保 GitHub 爬虫在运行
lsof -i :5000

# 2. 爬取新数据（推荐小仓库）
curl "http://127.0.0.1:5000/api/github/events?repo=encode/httpx&issues=5"

# 3. 确认数据保存位置
cat superset-plugin-chart-health-radar/src/data/fetch.json | jq '.[] | select(.type=="issue") | .title'

# 4. 启动 Storybook
cd /Users/tangliam/Projects/5381-Software-Engineering/superset/superset-frontend
PLUGIN_STORYBOOK=3 npm run storybook

# 5. 打开浏览器到 Debug story
# http://localhost:6006/?path=/story/plugins-healthradar-debug--debug-with-real-data
```

## 如果仍然有问题

请截图或复制以下信息：
1. 浏览器控制台的完整输出（包括所有 🔍 开头的日志）
2. Debug story 页面顶部显示的数字（Total events, Issues found, Tasks converted）
3. 看板中三列分别显示的任务数量

这样我们就能准确定位问题所在！
