# 📊 Health Radar Plugin - GitHub 数据集成

## 🎯 功能说明

这个插件现在可以自动从 GitHub 爬取的真实数据中加载 Issues，并在看板中显示！

## 🚀 使用步骤

### 1. 启动 GitHub 爬虫后端

```bash
cd /Users/tangliam/Projects/5381-Software-Engineering/superset/superset-github-connector
python github_connector.py
```

服务会在 `http://127.0.0.1:5000` 启动

### 2. 爬取 GitHub 数据

选择一个你感兴趣的仓库，执行爬取命令：

```bash
# 示例：爬取 Flask 仓库的数据
curl "http://127.0.0.1:5000/api/github/events?repo=pallets/flask&commits=2&prs=3&issues=10"

# 示例：爬取 Requests 仓库的数据
curl "http://127.0.0.1:5000/api/github/events?repo=requests/requests&commits=3&prs=3&issues=15"

# 示例：爬取 FastAPI 仓库的数据
curl "http://127.0.0.1:5000/api/github/events?repo=tiangolo/fastapi&commits=2&prs=2&issues=8"
```

数据会自动保存到：
```
superset-frontend/superset-plugin-chart-health-radar/src/data/fetch.json
```

### 3. 在 Storybook 中查看

```bash
cd /Users/tangliam/Projects/5381-Software-Engineering/superset/superset-frontend
PLUGIN_STORYBOOK=3 npm run storybook
```

打开浏览器访问 Storybook，找到：
- **Plugins/HealthRadar** → **GitHub Data Example**

这个 Story 会自动从 `fetch.json` 加载真实的 GitHub Issues 数据！

## 📋 数据映射规则

插件会智能地将 GitHub Issues 转换为看板任务：

### 状态映射 (Status)

| GitHub Issue 特征 | 看板状态 |
|------------------|---------|
| 标题包含 "close", "resolved", "fixed", "done" | ✅ 已完成 |
| 有评论讨论 / 包含 "wip", "progress" | 🚀 进行中 |
| 其他情况 | 📝 待办 |

### 优先级映射 (Priority)

| GitHub Issue 特征 | 优先级 |
|------------------|--------|
| 包含 "critical", "urgent", "bug", "security", "crash" | 🔴 High |
| 包含 "enhance", "docs", "refactor", "test" | 🟢 Low |
| 其他情况 | 🟡 Medium |

### 字段映射

- **标题**: Issue title
- **负责人**: Issue creator (actor)
- **时间戳**: Issue created_at

## 🔄 更新数据

只需重新运行爬虫命令，数据会自动更新到 `fetch.json`，刷新 Storybook 即可看到最新数据！

## 🎨 自定义 Stories

你可以在 `src/stories/HealthRadar.stories.tsx` 中找到 `GitHubDataExample`，它展示了如何使用真实 GitHub 数据。

```tsx
export function GitHubDataExample() {
  const metrics = [
    { name: 'issues', label: 'Issues 活跃度', value: 85 },
    { name: 'prs', label: 'PR 合并率', value: 78 },
    { name: 'commits', label: '代码提交', value: 92 },
    { name: 'comments', label: '协作讨论', value: 73 },
  ];

  return (
    <SupersetPluginChartHealthRadar
      data={metrics}
      tasks={[]}  // 留空，自动从 GitHub 数据加载
      height={1000}
      width={1200}
      headerText="📊 GitHub 仓库实时数据看板"
    />
  );
}
```

## 📝 注意事项

1. **GitHub Token**: 确保在 `superset-github-connector/.env` 中配置了 `GITHUB_TOKEN`
2. **数据路径**: 组件会自动尝试多个路径加载数据
3. **后备机制**: 如果无法加载 GitHub 数据，会使用传入的 `tasks` prop
4. **刷新**: 修改 `fetch.json` 后需要刷新浏览器才能看到更新

## 🐛 调试

打开浏览器开发者工具（F12），查看 Console 输出：
- ✅ 成功：`Successfully loaded X GitHub issues from ...`
- ⚠️ 失败：`Failed to load GitHub data from any path`

## 🎉 推荐的测试仓库

这些仓库数据量适中，很适合测试：

```bash
# Flask - Python Web 框架
curl "http://127.0.0.1:5000/api/github/events?repo=pallets/flask&issues=10"

# Rich - 终端美化库
curl "http://127.0.0.1:5000/api/github/events?repo=Textualize/rich&issues=8"

# Httpx - HTTP 客户端
curl "http://127.0.0.1:5000/api/github/events?repo=encode/httpx&issues=8"
```
