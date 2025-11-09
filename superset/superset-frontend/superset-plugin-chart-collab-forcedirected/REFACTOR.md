# CollabForcedirected 重构进度

## 重构目标
将 1400+ 行的单文件组件拆分成可维护、可测试的模块结构。

## 已完成 ✅

### 1. 创建 utils/ 目录
- ✅ `types.ts` - 所有类型定义
- ✅ `constants.ts` - 常量配置
- ✅ `linkHelpers.ts` - 链接处理函数
- ✅ `domHelpers.ts` - 坐标转换
- ✅ `timeUtils.ts` - 时间处理
- ✅ `d3Utils.ts` - D3 force simulation 封装
- ✅ `index.ts` - 统一导出

### 2. 创建 components/ 目录
- ✅ `Tooltip.tsx` - 工具提示组件
- ✅ `Controls.tsx` - 控制面板组件
- ✅ `RecordsTable.tsx` - 记录表格组件
- ✅ `index.ts` - 统一导出

### 3. 主文件重构（进行中）
- ✅ 更新导入语句
- ✅ 移除本地类型定义
- ✅ 使用 constants 替换硬编码值
- ✅ 替换第一个 useEffect（初始化 simulation）
- ⏳ 替换 windowRange useEffect（过滤+重建 simulation）
- ⏳ 替换 distanceScale/clusterDistance useEffect
- ⏳ 替换 screenToGraph 使用
- ⏳ 替换拖拽逻辑使用 fixNodePosition/releaseNodePosition
- ⏳ 替换 getLinkId 使用
- ⏳ 替换时间 bucket 构建逻辑
- ⏳ 替换 UI：tooltip、controls、records table

## 下一步（当前工作）

### 需要完成的代码替换：

1. **时间 bucket useEffect** - 使用 `extractTimestampsFromLinks` 和 `buildTimeBuckets`
2. **windowRange useEffect** - 简化过滤逻辑，使用 `buildSimulation` 替换手动创建
3. **distanceScale/clusterDistance useEffects** - 使用 `updateLinkDistance` 和 `updateClusterStrength`
4. **屏幕坐标转换** - 使用 `screenToGraph` from utils
5. **拖拽逻辑** - 使用 `fixNodePosition` 和 `releaseNodePosition`
6. **链接 ID 函数** - 使用 `getLinkId` from utils
7. **视图动画** - 使用 `VIEW_ANIMATION_DURATION_MS` 常量
8. **缩放** - 使用 `WHEEL_ZOOM_SENSITIVITY` 常量
9. **UI 组件替换** - 用 `<Tooltip />`, `<Controls />`, `<RecordsTable />` 替换内联 JSX

### 待修复的类型错误：

```typescript
// Line 447-451: key 类型应该是 string | undefined，而不是 null
let key: string | undefined = undefined;
```

## 剩余待办

- [ ] 添加单元测试（d3Utils, linkHelpers, timeUtils）
- [ ] 运行构建检查
- [ ] 补充文档和使用说明
- [ ] 提交 PR

## 预期成果

- **主文件行数**: 从 ~1480 行减少到 ~500 行
- **可测试性**: 所有纯函数都可独立测试
- **可维护性**: 职责清晰分离
- **可复用性**: utils 和 components 可在其他地方使用
