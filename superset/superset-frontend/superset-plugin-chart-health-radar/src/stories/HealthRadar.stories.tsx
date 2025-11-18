import React from 'react';
import SupersetPluginChartHealthRadar from '../SupersetPluginChartHealthRadar';
import fetchData from '../data/fetch.json';

export default {
  title: 'Plugins/HealthRadar',
  component: SupersetPluginChartHealthRadar,
};

// GitHub Real Data Example - Loads from fetch.json
export function GitHubDataExample() {
  // Filter issues from fetch.json
  const issues = fetchData.filter((e: any) => e.type === 'issue');
  
  // Convert GitHub issues to tasks
  const tasks = issues.map((issue: any) => {
    const title = issue.title?.toLowerCase() || '';
    const hasComments = fetchData.some((e: any) => 
      e.type === 'comment' && e.issue_id === issue.issue_id
    );
    
    // Determine status based on title and comments
    let status: 'todo' | 'inProgress' | 'done' = 'todo';
    if (title.includes('close') || title.includes('resolved') || title.includes('fixed')) {
      status = 'done';
    } else if (hasComments || title.includes('wip') || title.includes('progress')) {
      status = 'inProgress';
    }
    
    // Determine priority based on keywords
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (title.includes('critical') || title.includes('urgent') || title.includes('bug')) {
      priority = 'high';
    } else if (title.includes('test') || title.includes('docs') || title.includes('enhance')) {
      priority = 'low';
    }
    
    return {
      title: issue.title,
      status,
      priority,
      assignee: issue.actor,
    };
  });

  const metrics = [
    { name: 'issues', label: 'Issues Activity', value: 85 },
    { name: 'prs', label: 'PR Merge Rate', value: 78 },
    { name: 'commits', label: 'Code Commits', value: 92 },
    { name: 'comments', label: 'Collaboration', value: 73 },
  ];

  return (
    <div style={{ width: '1200px', height: '1000px' }}>
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}  // Pass converted GitHub issues as tasks
        height={1000}
        width={1200}
        headerText="📊 GitHub Repository Dashboard"
        boldText={true}
        headerFontSize="xl"
      />
    </div>
  );
}
