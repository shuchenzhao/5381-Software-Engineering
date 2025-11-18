/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { styled } from '@superset-ui/core';
import { SupersetPluginChartHealthRadarProps, ProjectTask } from './types';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: white;
  overflow-y: auto;
`;

const Header = styled.div<{ fontSize: string; bold: boolean }>`
  font-size: ${props => props.fontSize === 'xl' ? '32px' : props.fontSize === 'l' ? '28px' : props.fontSize === 'm' ? '24px' : '20px'};
  font-weight: ${props => props.bold ? 'bold' : '600'};
  margin-bottom: 24px;
  color: white;
  text-align: center;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
`;

const RadarSection = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const RadarTitle = styled.h3`
  color: #333;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
  text-align: center;
`;

const RadarContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  position: relative;
`;

const RadarCanvas = styled.svg`
  width: 100%;
  max-width: 400px;
  height: 300px;
`;

const MetricsSection = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const MetricCard = styled.div<{ color: string }>`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border-left: 4px solid ${props => props.color};
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  }
`;

const CardLabel = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
`;

const CardValue = styled.div<{ color: string }>`
  font-size: 36px;
  font-weight: bold;
  color: ${props => props.color};
  margin-bottom: 4px;
`;

const CardStatus = styled.div<{ color: string }>`
  font-size: 12px;
  color: ${props => props.color};
  font-weight: 600;
  text-transform: uppercase;
`;

const KanbanSection = styled.div`
  background: rgba(255, 255, 255, 0.95);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
`;

const KanbanTitle = styled.h3`
  color: #333;
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 20px 0;
`;

const KanbanBoard = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const KanbanColumn = styled.div<{ bgColor: string }>`
  background: ${props => props.bgColor};
  border-radius: 8px;
  padding: 16px;
  min-height: 200px;
`;

const ColumnHeader = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TaskCount = styled.span`
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
`;

const TaskCard = styled.div`
  background: white;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateX(4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const TaskTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 6px;
`;

const TaskMeta = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #666;
`;

const TaskPriority = styled.span<{ priority: string }>`
  padding: 2px 6px;
  border-radius: 4px;
  background: ${props => 
    props.priority === 'high' ? '#fee' : 
    props.priority === 'medium' ? '#ffeaa7' : '#e0f7fa'};
  color: ${props => 
    props.priority === 'high' ? '#c00' : 
    props.priority === 'medium' ? '#d63031' : '#00695c'};
  font-weight: 600;
`;

function getHealthColor(value: number, goodThreshold: number, warningThreshold: number): string {
  if (value >= goodThreshold) return '#52c41a';
  if (value >= warningThreshold) return '#faad14';
  return '#f5222d';
}

function getHealthStatus(value: number, goodThreshold: number, warningThreshold: number): string {
  if (value >= goodThreshold) return 'Healthy';
  if (value >= warningThreshold) return 'Warning';
  return 'Risk';
}

function RadarChart({ data, goodThreshold, warningThreshold }: any) {
  const center = { x: 200, y: 150 };
  const maxRadius = 120;
  const levels = 5;

  const points = useMemo(() => {
    return data.map((metric: any, i: number) => {
      const angle = (Math.PI * 2 * i) / data.length - Math.PI / 2;
      const radius = (metric.value / 100) * maxRadius;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
        angle,
        label: metric.label,
        value: metric.value,
      };
    });
  }, [data]);

  const polygonPath = points.map((p: any, i: number) => 
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ') + ' Z';

  const gridLevels = Array.from({ length: levels }, (_, i) => {
    const radius = maxRadius * ((i + 1) / levels);
    const gridPoints = data.map((_: any, j: number) => {
      const angle = (Math.PI * 2 * j) / data.length - Math.PI / 2;
      return {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
    const path = gridPoints.map((p, idx) => 
      `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ') + ' Z';
    return path;
  });

  return (
    <RadarCanvas>
      {gridLevels.map((path, i) => (
        <path key={i} d={path} fill="none" stroke="#e0e0e0" strokeWidth="1" />
      ))}
      {points.map((p: any, i: number) => (
        <line
          key={`axis-${i}`}
          x1={center.x}
          y1={center.y}
          x2={center.x + maxRadius * Math.cos(p.angle)}
          y2={center.y + maxRadius * Math.sin(p.angle)}
          stroke="#ccc"
          strokeWidth="1"
        />
      ))}
      <path
        d={polygonPath}
        fill="rgba(102, 126, 234, 0.3)"
        stroke="#667eea"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {points.map((p: any, i: number) => {
        const color = getHealthColor(p.value, goodThreshold, warningThreshold);
        return (
          <g key={`point-${i}`}>
            <circle cx={p.x} cy={p.y} r="6" fill={color} stroke="white" strokeWidth="2" />
            <text
              x={center.x + (maxRadius + 30) * Math.cos(p.angle)}
              y={center.y + (maxRadius + 30) * Math.sin(p.angle)}
              textAnchor="middle"
              fontSize="12"
              fill="#333"
              fontWeight="600"
            >
              {p.label}
            </text>
            <text
              x={center.x + (maxRadius + 30) * Math.cos(p.angle)}
              y={center.y + (maxRadius + 30) * Math.sin(p.angle) + 14}
              textAnchor="middle"
              fontSize="11"
              fill={color}
              fontWeight="bold"
            >
              {p.value}%
            </text>
          </g>
        );
      })}
    </RadarCanvas>
  );
}

export default function SupersetPluginChartHealthRadar(props: SupersetPluginChartHealthRadarProps) {
  const {
    data,
    height,
    width,
    goodThreshold = 80,
    warningThreshold = 60,
    headerText = 'Project Management Dashboard',
    boldText = true,
    headerFontSize = 'xl',
    tasks = [],
  } = props;

  // Load real GitHub data from fetch.json
  const [githubTasks, setGithubTasks] = useState<ProjectTask[]>([]);

  useEffect(() => {
    // Try to load fetch.json - support multiple paths
    const fetchPaths = [
      // Relative paths (for production)
      './data/fetch.json',
      '../data/fetch.json',
      // Absolute path (for Storybook)
      '/superset-plugin-chart-health-radar/src/data/fetch.json',
    ];

    console.log('🔍 [HealthRadar] Starting to load GitHub data...');

    const tryFetchData = async () => {
      for (const path of fetchPaths) {
        try {
          console.log(`🔍 [HealthRadar] Trying path: ${path}`);
          const response = await fetch(path);
          console.log(`🔍 [HealthRadar] Response status for ${path}: ${response.status}`);
          
          if (!response.ok) continue;
          
          const events = await response.json();
          console.log(`🔍 [HealthRadar] Loaded ${events.length} total events`);
          
          // Convert GitHub events to task format
          const issueEvents = events.filter((e: any) => e.type === 'issue');
          console.log(`🔍 [HealthRadar] Found ${issueEvents.length} issue events`);
          
          const convertedTasks: ProjectTask[] = issueEvents.map((issue: any) => {
            // Check if there are related comments (indicates active discussion)
            const hasComments = events.some((e: any) => 
              e.type === 'comment' && e.issue_id === issue.issue_id
            );
            
            let status: 'todo' | 'inProgress' | 'done' = 'todo';
            
            // Determine status based on title and activity
            const title = issue.title?.toLowerCase() || '';
            const body = issue.body?.toLowerCase() || '';
            
            // Check if completed
            if (title.includes('close') || title.includes('resolved') || 
                title.includes('fixed') || title.includes('done') ||
                body.includes('fix:') || body.includes('resolved')) {
              status = 'done';
            }
            // Check if in progress
            else if (hasComments || title.includes('wip') || title.includes('progress')) {
              status = 'inProgress';
            }
            
            // Determine priority based on title keywords
            let priority: 'high' | 'medium' | 'low' = 'medium';
            if (title.includes('critical') || title.includes('urgent') || 
                title.includes('bug') || title.includes('security') ||
                title.includes('crash')) {
              priority = 'high';
            } else if (title.includes('enhance') || title.includes('docs') || 
                       title.includes('refactor') || title.includes('test')) {
              priority = 'low';
            }

            const task = {
              id: issue.id,
              title: issue.title || 'Untitled Issue',
              status,
              priority,
              assignee: issue.actor || 'Unassigned',
              timestamp: issue.timestamp,
            };
            
            console.log(`🔍 [HealthRadar] Converted issue "${task.title}" -> status: ${status}, priority: ${priority}`);
            return task;
          });

          console.log(`✅ [HealthRadar] Successfully loaded ${convertedTasks.length} GitHub issues from ${path}`);
          console.log('📊 [HealthRadar] Task breakdown:', {
            todo: convertedTasks.filter(t => t.status === 'todo').length,
            inProgress: convertedTasks.filter(t => t.status === 'inProgress').length,
            done: convertedTasks.filter(t => t.status === 'done').length,
          });
          setGithubTasks(convertedTasks);
          return; // Exit after successful load
        } catch (error) {
          console.warn(`❌ [HealthRadar] Failed to load from ${path}:`, error);
          continue;
        }
      }
      console.error('❌ [HealthRadar] Failed to load GitHub data from any path, using provided tasks');
    };

    tryFetchData();
  }, []);

  // Prioritize GitHub-loaded tasks, fallback to provided tasks
  const allTasks = githubTasks.length > 0 ? githubTasks : tasks;

  const overallHealth = data.length > 0
    ? Math.round(data.reduce((sum, item) => sum + item.value, 0) / data.length)
    : 0;

  const tasksByStatus = useMemo(() => {
    const grouped = {
      todo: allTasks.filter((t: ProjectTask) => t.status === 'todo'),
      inProgress: allTasks.filter((t: ProjectTask) => t.status === 'inProgress'),
      done: allTasks.filter((t: ProjectTask) => t.status === 'done'),
    };
    return grouped;
  }, [allTasks]);

  return (
    <Wrapper style={{ height, width }}>
      {headerText && (
        <Header fontSize={headerFontSize} bold={boldText}>
          {headerText}
        </Header>
      )}

      <RadarSection>
        <RadarTitle>📊 Project Health Overview (Overall: {overallHealth}%)</RadarTitle>
        <RadarContainer>
          <RadarChart 
            data={data} 
            goodThreshold={goodThreshold} 
            warningThreshold={warningThreshold}
          />
        </RadarContainer>
      </RadarSection>

      <MetricsSection>
        {data.map((metric, index) => {
          const color = getHealthColor(metric.value, goodThreshold, warningThreshold);
          const status = getHealthStatus(metric.value, goodThreshold, warningThreshold);
          return (
            <MetricCard key={metric.name || index} color={color}>
              <CardLabel>{metric.label || metric.name}</CardLabel>
              <CardValue color={color}>{metric.value}%</CardValue>
              <CardStatus color={color}>{status}</CardStatus>
            </MetricCard>
          );
        })}
      </MetricsSection>

      <KanbanSection>
        <KanbanTitle>📋 Task Tracking Board</KanbanTitle>
        <KanbanBoard>
          <KanbanColumn bgColor="#fff3e0">
            <ColumnHeader>
              📝 To Do <TaskCount>{tasksByStatus.todo.length}</TaskCount>
            </ColumnHeader>
            {tasksByStatus.todo.map((task: ProjectTask, i: number) => (
              <TaskCard key={i}>
                <TaskTitle>{task.title}</TaskTitle>
                <TaskMeta>
                  <TaskPriority priority={task.priority}>{task.priority}</TaskPriority>
                  <span>{task.assignee}</span>
                </TaskMeta>
              </TaskCard>
            ))}
          </KanbanColumn>

          <KanbanColumn bgColor="#e3f2fd">
            <ColumnHeader>
              🚀 In Progress <TaskCount>{tasksByStatus.inProgress.length}</TaskCount>
            </ColumnHeader>
            {tasksByStatus.inProgress.map((task: ProjectTask, i: number) => (
              <TaskCard key={i}>
                <TaskTitle>{task.title}</TaskTitle>
                <TaskMeta>
                  <TaskPriority priority={task.priority}>{task.priority}</TaskPriority>
                  <span>{task.assignee}</span>
                </TaskMeta>
              </TaskCard>
            ))}
          </KanbanColumn>

          <KanbanColumn bgColor="#e8f5e9">
            <ColumnHeader>
              ✅ Done <TaskCount>{tasksByStatus.done.length}</TaskCount>
            </ColumnHeader>
            {tasksByStatus.done.map((task: ProjectTask, i: number) => (
              <TaskCard key={i}>
                <TaskTitle>{task.title}</TaskTitle>
                <TaskMeta>
                  <TaskPriority priority={task.priority}>{task.priority}</TaskPriority>
                  <span>{task.assignee}</span>
                </TaskMeta>
              </TaskCard>
            ))}
          </KanbanColumn>
        </KanbanBoard>
      </KanbanSection>
    </Wrapper>
  );
}
