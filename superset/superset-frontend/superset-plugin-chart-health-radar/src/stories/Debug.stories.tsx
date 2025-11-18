import React from 'react';
import SupersetPluginChartHealthRadar from '../SupersetPluginChartHealthRadar';
import fetchData from '../data/fetch.json';

export default {
  title: 'Plugins/HealthRadar/Debug',
  component: SupersetPluginChartHealthRadar,
};

// Debug: Direct import and use of fetch.json data
export function DebugWithRealData() {
  console.log('🔍 [Debug Story] Loaded fetch.json:', fetchData);
  
  // Filter out issues
  const issues = fetchData.filter((e: any) => e.type === 'issue');
  console.log('🔍 [Debug Story] Found issues:', issues);
  
  // Convert to tasks
  const tasks = issues.map((issue: any) => {
    const title = issue.title?.toLowerCase() || '';
    const hasComments = fetchData.some((e: any) => 
      e.type === 'comment' && e.issue_id === issue.issue_id
    );
    
    let status: 'todo' | 'inProgress' | 'done' = 'todo';
    if (hasComments) {
      status = 'inProgress';
    }
    
    let priority: 'high' | 'medium' | 'low' = 'medium';
    if (title.includes('test')) {
      priority = 'low';
    }
    
    return {
      title: issue.title,
      status,
      priority,
      assignee: issue.actor,
    };
  });
  
  console.log('🔍 [Debug Story] Converted tasks:', tasks);
  console.log('📊 [Debug Story] Task counts:', {
    total: tasks.length,
    todo: tasks.filter((t: any) => t.status === 'todo').length,
    inProgress: tasks.filter((t: any) => t.status === 'inProgress').length,
    done: tasks.filter((t: any) => t.status === 'done').length,
  });

  const metrics = [
    { name: 'issues', label: 'Issues Activity', value: 85 },
    { name: 'prs', label: 'PR Merge Rate', value: 78 },
    { name: 'commits', label: 'Code Commits', value: 92 },
    { name: 'comments', label: 'Collaboration', value: 73 },
  ];

  return (
    <div style={{ width: '1200px', height: '1000px', background: '#f5f5f5', padding: '20px' }}>
      <div style={{ background: 'white', padding: '10px', marginBottom: '10px', borderRadius: '8px' }}>
        <h2>🐛 Debug Info</h2>
        <p>Total events in fetch.json: <strong>{fetchData.length}</strong></p>
        <p>Issues found: <strong>{issues.length}</strong></p>
        <p>Tasks converted: <strong>{tasks.length}</strong></p>
        <ul>
          {issues.map((issue: any, i: number) => (
            <li key={i}>
              <strong>{issue.title}</strong> by {issue.actor} 
              {' '}({fetchData.filter((e: any) => e.type === 'comment' && e.issue_id === issue.issue_id).length} comments)
            </li>
          ))}
        </ul>
      </div>
      
      <SupersetPluginChartHealthRadar
        data={metrics}
        tasks={tasks}
        height={900}
        width={1200}
        headerText="🐛 Debug: Real GitHub Data"
        boldText={true}
        headerFontSize="xl"
      />
    </div>
  );
}
