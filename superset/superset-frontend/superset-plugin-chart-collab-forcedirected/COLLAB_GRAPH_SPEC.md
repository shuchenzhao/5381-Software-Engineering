# 协作图谱可视化方案 (Collaboration Graph Spec)

版本: 0.1
日期: 2025-10-21
作者: （由插件开发者维护）

## 目的
将 Git 相关活动（commits、code reviews、pull requests、issues、comments）转换为“人-人”协作网络，并在已有的力导向图插件中直观展示协作类型与强度。

## 总体设计概述
- 节点（Nodes）代表开发者（GitHub username 或稳定 ID）。
- 边（Links）代表两位开发者之间的协作关系。边为“聚合边”——默认合并多种交互类型与事件；在 hover 或点击时可视化为多条不同类型的子边以展示细节。
- 交互类型包括：共同修改（commits）、代码评审（reviews/PR）、任务指派（issues/PR assignees）、讨论互动（comments）。
- 支持时间窗口（时间分段）、类型筛选、权重调整（controlPanel 可配置）。

## 数据模型（transformProps 输出）
- nodes: Array<{
  id: string; // 开发者 ID
  size?: number; // 活跃度数值（用于节点半径）
  color?: string; // 团队或角色映射
  is_bot?: boolean; // 可选，用于过滤
  metadata?: object; // 额外信息（邮箱、fullname 等）
}> 

- links: Array<{
  source: string; // node id
  target: string; // node id
  weight: number; // 综合权重（用于边粗细）
  types: {
    commits?: number;
    reviews?: number;
    pullRequests?: number;
    assigns?: number;
    discussion?: number;
  };
  first?: number; // 时间戳 ms
  last?: number; // 时间戳 ms
  sample_events?: any[]; // 可选：示例事件用于侧栏展示
}> 

> 说明：links 可选择为无向聚合（默认）或在 controlPanel 指定下返回有向关系（例如 reviewer -> author）。

## 节点可视化映射
- size: 总事件数或加权活跃度（示例：commits*1 + prs*3 + reviews*2）
- color: 团队/角色或用户属性
- tooltip: 显示用户名、活跃度摘要、所属团队、最近活动时间

## 边的视觉编码（建议）
- 聚合边（默认视图）
  - 颜色：中性灰或按主导类型着色（可选）
  - 粗细：由 `weight` 控制
- 子边（展开视图，hover/click）
  - commits: 绿色 实线
  - reviews: 蓝色 实线（较粗）
  - pullRequests: 蓝色/橙色（与 reviews 合并或分开显示）
  - assigns: 橙色 虚线
  - discussion: 灰色 细线
- 有向关系（可选）：在子边或侧栏显示箭头

## 后端/ETL 数据处理建议
1. 共同修改（Commits）
   - 建表或计算：file -> set(author)
   - 对每个文件，对作者集合中的任意对 (a,b) 累加共同修改计数
   - 可选权重：按文件的重要性、被修改行数或时间衰减

2. 代码评审（PR Reviews）
   - 对每个 PR：author 与 reviewers 建立关系
   - 计数：reviews 次数 + reviewer 的评论数量

3. 指派（Issues/PR assignees）
   - 对每个 Issue/PR：creator 与 assignee 建立关系，计数为指派次数

4. 讨论互动（Comments）
   - 在同一 Issue/PR 下共同出现（或直接 reply）则建立关系，计数为互动次数

5. 合并与输出
   - 对每对 (a,b) 输出 `types` 结构和时间窗统计
   - 计算 `weight = sum(types[type] * factor[type])`（factor 可在 controlPanel 配置）
   - 在后端就做时间窗口过滤与阈值过滤，避免把太多低频边发给前端

## 前端（插件）实现要点
1. `transformProps.ts`
   - 接受后端 rows 或已聚合的 links
   - 产出 `nodes` 与 `links`（参照上方数据模型）
   - 使用 controlPanel 中的权重/类型开关来调整 `weight` 或过滤

2. `CollabForcedirected.tsx`
   - 默认使用聚合边绘图（single link per pair）以保持视觉清晰
   - Hover / Click 交互：
     - 在 hover 时创建一个 overlay group（不加入 force simulation）绘制子边（types 分解），淡化非相关元素（降低 opacity）
     - 鼠标移出时移除 overlay，恢复不透明度
     - 在侧栏显示样本事件列表（sample_events），并允许查看更详细的记录
   - 避免在交互时修改 simulation 的节点坐标，避免布局抖动
   - 使用箭头 markers 或渐变来表示方向（如果有向）

3. Control Panel
   - 类型开关（Commits/Reviews/Assigns/Discussion）
   - 权重滑块（为每种类型配置权重 factor）
   - 最小权重阈值（过滤低频边）
   - 时间窗口选择（最近 N 天 / 自定义区间）
   - 显示最大节点数 / 排序依据（按活跃度、度数等）

## 聚合边展开交互（交互细化）
- 默认绘制聚合边，hover 时：
  - 计算子边的路径（使用相同 source/target 坐标）并绘制（颜色/样式按类型）
  - 子边不参与物理模拟，仅作可视化层
  - 淡化所有非源-目标节点和非子边
  - 可选：在子边上显示小标签或 tooltip，展示类型计数与最活跃事件示例

## 性能与可伸缩性策略
- 后端优先聚合并按阈值/时间窗裁剪数据
- 对大图切换到 Canvas 或 WebGL 渲染（或只在 SVG 上做交互层）
- 提供分级展示（只显示 top-N 节点或社区聚合）
- 防止 bots：后端标记并可选过滤 `is_bot` 节点

## 隐私与注意事项
- 私有仓库数据应遵守权限策略，前端不应泄露敏感信息
- 对于用户合并（别名/邮箱变更），建议在后端做 ID 归一化

## 开发与迭代计划（下一步）
1. 在后端实现聚合并输出符合数据模型的 `links`（含 types）——同时实现时间窗与阈值参数
2. 修改 `transformProps.ts` 来消费新数据模型并在本地 mock 数据上验证
3. 修改 `CollabForcedirected.tsx`，实现 overlay 子边的 hover 展开（不改动 simulation）
4. 添加 controlPanel 控件并把参数传给 transformProps/后端
5. 性能测试与可视化微调

---

请将对方案的任何修改或决定直接写入本文件，我会在实现代码时同步更新此文档。