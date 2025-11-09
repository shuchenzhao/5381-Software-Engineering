import githubDataJson from '../data/github_issues.json';
import { convertGitHubToBurndown } from '../utils/github_issues_convert';

const burndownData = convertGitHubToBurndown(githubDataJson);

type GitHubIssue = {
  issue_number: number;
  issue_state: 'open' | 'closed';
  created_at: string;
  closed_at: string | null;
  creator_login: string;
  milestone_title?: string | null;
  title: string;
};

type GitHubResponse = {
  status: string;
  source_url: string;
  total_issues: number;
  data: GitHubIssue[];
};

type BurndownData = {
  ds: string;       // 日期 YYYY-MM-DD
  remaining: number; // 剩余任务数
};

function convertGitHubToBurndown(json: GitHubResponse): BurndownData[] {
  const issues = json.data;

  if (!issues || issues.length === 0) return [];

  // 找到时间范围
  const startDate = new Date(
    Math.min(...issues.map(i => new Date(i.created_at).getTime()))
  );
  const endDate = new Date(
    Math.max(
      ...issues.map(i =>
        i.closed_at ? new Date(i.closed_at).getTime() : new Date().getTime()
      )
    )
  );

  const burndown: BurndownData[] = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10); // YYYY-MM-DD

    // 剩余 Issue 数 = 在当天之前创建的 Issue - 已关闭的 Issue
    const remaining = issues.filter(issue => {
      const created = new Date(issue.created_at) <= d;
      const closed = issue.closed_at ? new Date(issue.closed_at) <= d : false;
      return created && !closed;
    }).length;

    burndown.push({ ds: dayStr, remaining });
  }

  return burndown;
}

// 示例用法：
/*
const githubData: GitHubResponse = ...; // 从 API 获取的 JSON
const burndownData = convertGitHubToBurndown(githubData);

<SupersetPluginChartBurndown data={burndownData} width={600} height={300} />
*/
