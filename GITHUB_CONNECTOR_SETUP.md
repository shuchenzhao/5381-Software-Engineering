# GitHub Connector 插件配置指南

## 问题诊断

你同学开发的插件包含两个部分：
1. **后端服务**: `superset-github-connector` - GitHub API 数据获取服务
2. **前端插件**: `superset-plugin-chart-collaboration-graph` - 协作关系图可视化插件

### 发现的问题：

✅ **前端插件已正确配置**
- 插件代码位于: `superset-frontend/superset-plugin-chart-collaboration-graph/`
- 已在 `MainPreset.js` 中注册为 `ext-collaboration-graph`
- 已在 `package.json` 中添加依赖

❌ **后端服务未启动**
- GitHub Connector 是独立的 Flask 服务，需要单独运行
- `docker-compose.yml` 中没有配置这个服务
- 缺少 `GITHUB_TOKEN` 环境变量

## 解决步骤

### 1. 设置 GitHub Token

编辑 `docker/.env` 文件，将 `your_github_token_here` 替换为你的实际 GitHub Token：

```bash
GITHUB_TOKEN=ghp_your_actual_token_here
```

如何获取 GitHub Token：
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 选择所需的权限（至少需要 `repo` 权限）
4. 生成并复制 token

### 2. 启动 GitHub Connector 服务

已经在 `docker-compose.yml` 中添加了 `github-connector` 服务，并创建了 `Dockerfile.github-connector`。

### 3. 重新构建和启动服务

```bash
# 进入 superset 目录
cd /Users/tangliam/Projects/5381-Software-Engineering/superset

# 停止现有服务
docker-compose down

# 重新构建并启动所有服务
docker-compose up -d --build

# 查看 GitHub Connector 日志
docker-compose logs -f github-connector

# 查看 Superset 主服务日志
docker-compose logs -f superset
```

### 4. 测试 GitHub Connector

服务启动后，可以通过以下方式测试：

```bash
# 测试健康检查端点
curl http://localhost:5000/api/health

# 测试获取事件数据（示例）
curl "http://localhost:5000/api/fetch-events?repo=apache/superset&max_pages=1"
```

成功后，数据会保存到 `superset-frontend/superset-plugin-chart-collaboration-graph/src/data/fetch.json`

### 5. 在 Superset 中使用插件

1. 访问 Superset: http://localhost:8088
2. 登录（默认用户名/密码：admin/admin）
3. 创建新图表
4. 在图表类型中搜索 "Collaboration Graph" 或 "ext-collaboration-graph"
5. 选择该图表类型并配置数据源

**注意**: 如果看不到插件，可能需要：
- 等待前端构建完成（5-10分钟）
- 刷新浏览器并清除缓存（Cmd+Shift+R）

## 使用流程

1. 启动所有服务后，GitHub Connector 运行在 `http://localhost:5000`
2. 使用 API 获取 GitHub 仓库的协作数据：
   ```bash
   curl "http://localhost:5000/api/fetch-events?repo=owner/repo&max_pages=2"
   ```
3. 数据会保存到 `superset-frontend/superset-plugin-chart-collaboration-graph/src/data/fetch.json`
4. 在 Superset 中创建图表时选择 "Collaboration Graph" 插件
5. 插件会自动读取 `fetch.json` 中的数据进行可视化

### 获取数据的完整示例

```bash
# 获取 apache/superset 仓库的协作数据
curl -X GET "http://localhost:5000/api/fetch-events?repo=apache/superset&max_pages=2"

# 响应会包含：
# - status: 成功状态
# - repo: 仓库名称
# - total_events: 事件总数
# - data: 事件详细数据
# - saved_to: 数据保存路径
```

## 故障排查

### GitHub Connector 无法启动
- 检查 GITHUB_TOKEN 是否正确设置
- 查看日志：`docker-compose logs github-connector`

### 插件在界面中不显示
- 确认前端构建完成：`docker-compose logs superset-node`
- 检查浏览器控制台是否有错误
- 尝试清除浏览器缓存并重新加载

### API 调用失败
- 确认 GitHub Token 有足够的权限
- 检查网络连接
- 查看 GitHub API 限流情况

## 架构说明

```
┌─────────────────┐
│  GitHub API     │
└────────┬────────┘
         │
         ↓
┌─────────────────────┐      ┌──────────────────────┐
│ GitHub Connector    │─────→│  fetch.json          │
│ (Flask:5000)        │      │  (数据文件)           │
└─────────────────────┘      └──────────┬───────────┘
                                        │
                                        ↓
                             ┌──────────────────────┐
                             │ Superset Frontend    │
                             │ Collaboration Graph  │
                             │ Plugin               │
                             └──────────────────────┘
```

## 注意事项

1. 不要将 GitHub Token 提交到版本控制系统
2. 在生产环境中使用更安全的密钥管理方案
3. GitHub API 有速率限制，注意控制请求频率
4. 数据文件 `fetch.json` 会被覆盖，需要时记得备份
