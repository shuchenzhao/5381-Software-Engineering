# Storybook 配置说明

本插件的 Storybook story 文件位于：

```
src/stories/CollaborationGraph.stories.jsx
```

要让主仓库的 Storybook 能自动加载插件的 story，需要在主 Storybook 配置文件 `.storybook/main.js` 的 `stories` 字段中加入如下 glob 匹配：

```
'../superset-plugin-chart-collab-forcedirected/src/stories/**/*.stories.@(js|jsx|ts|tsx)'
```

// 主 Storybook 配置文件 `.storybook/main.js`中，If PLUGIN_STORYBOOK=2 is set in the environment, only load this plugin's stories.
完整示例：

```js
module.exports = {
  stories: [
    '../src/@(components|common|filters|explore|views|dashboard|features)/**/*.stories.@(tsx|jsx)',
    '../packages/superset-ui-demo/storybook/stories/**/*.*.@(tsx|jsx)',
    // 插件 story 匹配（此处示例是当前插件）
    '../superset-plugin-chart-collab-forcedirected/src/stories/**/*.stories.@(js|jsx|ts|tsx)'
  ],
  // ...existing config...
};
```

这样，Storybook 启动后会自动加载插件的 story 文件。

## 步骤总结
1. 确认插件的 story 文件已放在 `src/stories/` 并以 `.stories.jsx`/`.stories.tsx` 结尾。
2. 编辑主仓库的 `.storybook/main.js`，在 `stories` 数组中加入插件的 glob 匹配。
3. 在主仓库根目录运行：

```bash
npm run storybook
```

4. 打开浏览器访问 http://localhost:6006，找到 `Plugins -> CollaborationGraph` story 进行预览。
