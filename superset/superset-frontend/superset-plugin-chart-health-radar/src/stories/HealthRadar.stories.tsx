import React from 'react';
import SupersetPluginChartHealthRadar from '../SupersetPluginChartHealthRadar';

export default {
  title: 'Plugins/HealthRadar',
  component: SupersetPluginChartHealthRadar,
};

// 完整项目管理看板示例
export function ProjectManagementDashboard() {
  const metrics = [
    { name: 'progress', label: '项目进度', value: 75 },
    { name: 'quality', label: '代码质量', value: 88 },
    { name: 'performance', label: '系统性能', value: 62 },
    { name: 'security', label: '安全指数', value: 91 },
    { name: 'satisfaction', label: '团队满意度', value: 79 },
  ];

  const tasks = [
    { title: '前端页面优化', status: 'todo', priority: 'high', assignee: '张三' },
    { title: '数据库迁移', status: 'todo', priority: 'medium', assignee: '李四' },
    { title: '用户权限系统', status: 'inProgress', priority: 'high', assignee: '王五' },
    { title: 'API文档编写', status: 'inProgress', priority: 'low', assignee: '赵六' },
    { title: '单元测试覆盖', status: 'inProgress', priority: 'medium', assignee: '孙七' },
    { title: '登录模块开发', status: 'done', priority: 'high', assignee: '周八' },
    { title: '首页设计', status: 'done', priority: 'medium', assignee: '吴九' },
    { title: '环境配置', status: 'done', priority: 'low', assignee: '郑十' },
  ];

  return (
    <div style={{ width: '1200px', height: '1000px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={1000}
        width={1200}
        goodThreshold={80}
        warningThreshold={60}
        headerText="敏捷开发项目管理看板"
        boldText={true}
        headerFontSize="xl"
      />
    </div>
  );
}

// 健康项目示例
export function HealthyProject() {
  const metrics = [
    { name: 'progress', label: '项目进度', value: 95 },
    { name: 'quality', label: '代码质量', value: 92 },
    { name: 'performance', label: '系统性能', value: 88 },
    { name: 'security', label: '安全指数', value: 94 },
  ];

  const tasks = [
    { title: '性能监控', status: 'todo', priority: 'low', assignee: '张三' },
    { title: '代码审查', status: 'inProgress', priority: 'medium', assignee: '李四' },
    { title: '核心功能开发', status: 'done', priority: 'high', assignee: '王五' },
    { title: '测试用例编写', status: 'done', priority: 'high', assignee: '赵六' },
    { title: 'CI/CD配置', status: 'done', priority: 'medium', assignee: '孙七' },
  ];

  return (
    <div style={{ width: '1200px', height: '900px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={900}
        width={1200}
        headerText="✨ 高质量项目示例"
        headerFontSize="l"
      />
    </div>
  );
}

// 需要关注的项目
export function RiskyProject() {
  const metrics = [
    { name: 'progress', label: '项目进度', value: 45 },
    { name: 'quality', label: '代码质量', value: 52 },
    { name: 'performance', label: '系统性能', value: 38 },
    { name: 'security', label: '安全指数', value: 61 },
  ];

  const tasks = [
    { title: '紧急Bug修复', status: 'todo', priority: 'high', assignee: '张三' },
    { title: '性能优化', status: 'todo', priority: 'high', assignee: '李四' },
    { title: '安全漏洞修复', status: 'todo', priority: 'high', assignee: '王五' },
    { title: '代码重构', status: 'inProgress', priority: 'high', assignee: '赵六' },
    { title: '技术债务处理', status: 'inProgress', priority: 'medium', assignee: '孙七' },
    { title: '需求调研', status: 'done', priority: 'low', assignee: '周八' },
  ];

  return (
    <div style={{ width: '1200px', height: '900px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={900}
        width={1200}
        headerText="⚠️ 需要重点关注的项目"
        headerFontSize="l"
      />
    </div>
  );
}

// 启动阶段项目
export function StartupProject() {
  const metrics = [
    { name: 'progress', label: '项目进度', value: 15 },
    { name: 'quality', label: '代码质量', value: 85 },
    { name: 'performance', label: '系统性能', value: 0 },
    { name: 'security', label: '安全指数', value: 70 },
  ];

  const tasks = [
    { title: '需求分析', status: 'todo', priority: 'high', assignee: '张三' },
    { title: '技术选型', status: 'todo', priority: 'high', assignee: '李四' },
    { title: '架构设计', status: 'todo', priority: 'high', assignee: '王五' },
    { title: '原型设计', status: 'todo', priority: 'medium', assignee: '赵六' },
    { title: '数据库设计', status: 'inProgress', priority: 'high', assignee: '孙七' },
    { title: 'Git仓库初始化', status: 'done', priority: 'medium', assignee: '周八' },
    { title: '项目立项', status: 'done', priority: 'high', assignee: '吴九' },
  ];

  return (
    <div style={{ width: '1200px', height: '900px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={900}
        width={1200}
        headerText="🚀 项目启动阶段"
        headerFontSize="l"
      />
    </div>
  );
}

// 基础示例
export function BasicExample() {
  const metrics = [
    { name: 'metric1', label: '指标一', value: 75 },
    { name: 'metric2', label: '指标二', value: 82 },
    { name: 'metric3', label: '指标三', value: 68 },
  ];

  const tasks = [
    { title: '任务 A', status: 'todo', priority: 'high', assignee: '成员A' },
    { title: '任务 B', status: 'inProgress', priority: 'medium', assignee: '成员B' },
    { title: '任务 C', status: 'done', priority: 'low', assignee: '成员C' },
  ];

  return (
    <div style={{ width: '1000px', height: '800px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={800}
        width={1000}
        headerText="基础示例"
      />
    </div>
  );
}
