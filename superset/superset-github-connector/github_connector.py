from flask import Flask, request, jsonify
import requests
import pandas as pd
from typing import List, Dict, Any
import os
import json
from datetime import datetime
# 导入 python-dotenv 库，用于加载 .env 文件中的环境变量
from dotenv import load_dotenv

# ===================================================
# 环境变量加载：程序启动时从 .env 文件加载 GITHUB_TOKEN
# ===================================================
load_dotenv()

# --- 配置参数 ---
# 从环境变量中获取 GITHUB_TOKEN。如果使用 load_dotenv()，它会首先检查 .env 文件。
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

app = Flask(__name__)


# -----------------------------
# Helper functions for events
# -----------------------------
def _split_repo_string(repo_string: str):
    """Split a repo string like 'owner/repo' into (owner, repo)."""
    if not repo_string or '/' not in repo_string:
        return None, None
    owner, repo = repo_string.split('/', 1)
    return owner.strip(), repo.strip()


def _api_get(url: str, token: str, params: dict = None):
    """Tiny wrapper around requests.get to return (json, headers) or (None, headers) on error."""
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }
    try:
        resp = requests.get(url, headers=headers, params=params)
    except Exception as e:
        print(f"Network error when requesting {url}: {e}")
        return None, {}

    if resp.status_code >= 400:
        # print a helpful debug message
        try:
            body = resp.json()
        except Exception:
            body = resp.text
        print(f"GitHub API error {resp.status_code} for {url} -> {body}")
        return None, resp.headers

    try:
        return resp.json(), resp.headers
    except Exception as e:
        print(f"Failed to parse JSON from {url}: {e}")
        return None, resp.headers


def fetch_commits_events(owner: str, repo: str, token: str, limit: int = 30):
    """Fetch recent commits and convert to event-like dicts.

    Note: fetching per-commit details (to get files/stats) requires one API call per commit.
    We limit to `limit` commits to avoid exhausting rate limits.
    """
    events = []
    if not owner or not repo:
        return events

    commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    params = {"per_page": min(limit, 100)}
    commits, _ = _api_get(commits_url, token, params=params)
    if not commits:
        return events

    for c in commits[:limit]:
        sha = c.get('sha')
        # attempt to enrich with files and stats
        files = []
        lines_added = 0
        lines_deleted = 0
        if sha:
            detail_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
            detail, _ = _api_get(detail_url, token)
            if detail:
                for f in detail.get('files', []):
                    files.append(f.get('filename'))
                    lines_added += f.get('additions', 0) or 0
                    lines_deleted += f.get('deletions', 0) or 0

        actor = None
        if c.get('author') and isinstance(c.get('author'), dict):
            actor = c['author'].get('login')
        if not actor:
            # fallback to commit author name
            actor = c.get('commit', {}).get('author', {}).get('name')

        timestamp = c.get('commit', {}).get('author', {}).get('date')
        message = c.get('commit', {}).get('message')

        events.append({
            'id': f"c-{sha[:7]}" if sha else f"c-{datetime.utcnow().timestamp()}",
            'type': 'commit',
            'actor': actor,
            'repo': f"{owner}/{repo}",
            'timestamp': timestamp,
            'files': files,
            'lines_added': lines_added,
            'lines_deleted': lines_deleted,
            'message': message,
        })

    return events


def fetch_pulls_and_reviews(owner: str, repo: str, token: str, pr_limit: int = 30):
    """Fetch pull requests and reviews and return pull and review events."""
    events = []
    pulls_url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    params = {"state": "all", "per_page": min(pr_limit, 100)}
    pulls, _ = _api_get(pulls_url, token, params=params)
    if not pulls:
        return events

    for p in pulls[:pr_limit]:
        number = p.get('number')
        pr_id = f"PR-{number}" if number is not None else None
        actor = p.get('user', {}).get('login')
        title = p.get('title')
        created_at = p.get('created_at')

        # fetch files changed in PR (may be paginated; we fetch first page)
        files = []
        if number is not None:
            files_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files"
            pr_files, _ = _api_get(files_url, token, params={"per_page": 100})
            if pr_files:
                files = [f.get('filename') for f in pr_files]

        events.append({
            'id': f"pr-{number}" if number is not None else f"pr-{datetime.utcnow().timestamp()}",
            'type': 'pull_request',
            'actor': actor,
            'repo': f"{owner}/{repo}",
            'pr_id': pr_id,
            'timestamp': created_at,
            'title': title,
            'files': files,
        })

        # fetch reviews for this PR and convert to review events
        if number is not None:
            reviews_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/reviews"
            reviews, _ = _api_get(reviews_url, token)
            if reviews:
                for r in reviews:
                    events.append({
                        'id': f"r-{r.get('id')}",
                        'type': 'review',
                        'actor': r.get('user', {}).get('login'),
                        'target': actor,
                        'repo': f"{owner}/{repo}",
                        'pr_id': pr_id,
                        'timestamp': r.get('submitted_at'),
                        'state': r.get('state'),
                        'comments': 0,
                        'body': r.get('body'),
                    })

    return events


def fetch_issues_comments_events(owner: str, repo: str, token: str, issue_limit: int = 50):
    """Fetch issues, comments and issue events (assignments, etc.) and convert to simplified events."""
    events = []
    issues_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    params = {"state": "all", "per_page": min(issue_limit, 100)}
    issues, _ = _api_get(issues_url, token, params=params)
    if not issues:
        return events

    for it in issues[:issue_limit]:
        # skip pull requests (they also appear in issues endpoint)
        if 'pull_request' in it:
            continue

        number = it.get('number')
        issue_id = it.get('title') and f"ISSUE-{number}"
        actor = it.get('user', {}).get('login')
        timestamp = it.get('created_at')
        title = it.get('title')

        events.append({
            'id': f"i-{number}",
            'type': 'issue',
            'actor': actor,
            'repo': f"{owner}/{repo}",
            'issue_id': issue_id,
            'timestamp': timestamp,
            'title': title,
            'body': it.get('body'),
        })

        # comments
        if number is not None:
            comments_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}/comments"
            comments, _ = _api_get(comments_url, token, params={"per_page": 100})
            if comments:
                for c in comments:
                    events.append({
                        'id': f"cmt-{c.get('id')}",
                        'type': 'comment',
                        'actor': c.get('user', {}).get('login'),
                        'target': actor,
                        'repo': f"{owner}/{repo}",
                        'issue_id': issue_id,
                        'comment_id': c.get('id'),
                        'timestamp': c.get('created_at'),
                        'body': c.get('body'),
                    })

            # issue timeline events (assign, unassign, etc.)
            events_url = f"https://api.github.com/repos/{owner}/{repo}/issues/{number}/events"
            ievents, _ = _api_get(events_url, token, params={"per_page": 100})
            if ievents:
                for e in ievents:
                    ev_type = e.get('event')
                    if ev_type == 'assigned':
                        events.append({
                            'id': f"ie-{e.get('id')}",
                            'type': 'assign',
                            'actor': e.get('actor', {}).get('login'),
                            'target': e.get('assignee', {}).get('login'),
                            'repo': f"{owner}/{repo}",
                            'issue_id': issue_id,
                            'timestamp': e.get('created_at'),
                            'body': e.get('commit_id') or None,
                        })

    return events


# --- 数据转换函数 ---
def json_to_list_of_dicts(issues_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    使用 pandas 将 Issues JSON 列表转换为扁平化的结构，并返回 Python 字典列表。
    """
    if not issues_data:
        return []

    # 定义需要提取的核心字段及其在输出中的新名称
    CORE_COLUMNS = {
        'number': 'issue_number',
        'state': 'issue_state',
        'created_at': 'created_at',
        'closed_at': 'closed_at',
        'user_login': 'creator_login',
        'milestone_title': 'milestone_title',
        'title': 'title'
    }

    try:
        df = pd.json_normalize(issues_data, sep='_')

        # 1. 筛选和重命名需要的列
        cols_to_select = {k: v for k, v in CORE_COLUMNS.items() if k in df.columns}
        df = df.rename(columns=cols_to_select)[list(cols_to_select.values())]

        # 2. 修复方法：通过迭代，明确地将 NaN 替换为 None
        date_cols = [col for col in df.columns if 'at' in col]

        # 遍历需要处理的日期列，并单独应用 fillna(value=None)
        # 这保证了 Pandas 不会混淆填充值或方法，并且成功将 dtype 转换为 'object'
        for col in date_cols:
            if col in df.columns:
                df[col] = df[col].where(pd.notnull(df[col]), None)

        # 3. 转换回字典列表并返回
        return df.to_dict('records')

    except Exception as e:
        # 为了调试，这里应该重新打印原始的异常 e，而不是一个泛化的字符串
        print(f"Error during data normalization: {e}")
        return []


# --- 核心 Issues 拉取逻辑 (已移除 since_date 参数) ---

def fetch_all_issues(github_api_url: str, token: str) -> List[Dict[str, Any]]:
    """
    获取 GitHub 仓库的所有 Issues，默认按创建时间降序 (最新的在前)。
    """
    # **注意：这里不再重复读取 os.environ，直接使用传入的 token 参数**

    if not github_api_url:
        print("错误：GitHub API URL 缺失。")
        return []

    all_issues: List[Dict[str, Any]] = []
    page = 1

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    print(f"Fetching from: {github_api_url}")
    # 打印 Token 前缀以确认是否加载成功 (仅用于调试)
    print(f"Token loaded successfully: {token[:5]}...")

    while True:
        # 构造查询参数
        params = {
            "state": "all",
            "per_page": 100,
            "page": page,
            # 核心修改：明确指定按创建时间降序排序，以获取最新 Issues
            "sort": "created",
            "direction": "desc"
        }

        response = requests.get(github_api_url, headers=headers, params=params)

        if response.status_code != 200:
            # 打印详细错误信息，帮助用户定位是 401 (Token错) 还是 404 (URL错)
            try:
                error_detail = response.json()
            except requests.exceptions.JSONDecodeError:
                error_detail = response.text or "No detailed response body."

            print(
                f"GitHub API 请求失败。状态码: {response.status_code}. 响应: {error_detail}")
            return []

        current_issues = response.json()
        if not current_issues:
            break

        # 筛选掉拉取请求 (Pull Requests)
        issues_only = [issue for issue in current_issues if "pull_request" not in issue]
        all_issues.extend(issues_only)

        # 处理分页
        if 'link' in response.headers and 'rel="next"' in response.headers['link']:
            page += 1
        else:
            break

    return all_issues


# --- Flask REST API 路由 ---

@app.route('/api/github/issues', methods=['GET'])
def get_issues_data():
    # 1a. 检查 GITHUB_TOKEN 配置
    if not GITHUB_TOKEN:
        return jsonify({
            'message': 'Server configuration error: GITHUB_TOKEN is not set in environment variables (check your .env file).'
        }), 500

    # 1b. 接收 Postman 传递的 GitHub URL
    github_url = request.args.get('github_url')

    if not github_url:
        # 如果没有提供目标 URL，返回 400 Bad Request
        return jsonify({
                           'message': 'Missing required query parameter: github_url. Example: github_url=https://api.github.com/repos/OWNER/REPO/issues'}), 400

    # 2. 调用核心逻辑 (不再需要 since_date)
    issues_json_data = fetch_all_issues(
        github_api_url=github_url,
        token=GITHUB_TOKEN
    )

    if not issues_json_data:
        # 如果获取失败，返回 502 (Bad Gateway) 或 401/404 等，这里统一使用 502 作为上游错误
        return jsonify(
            {
                'message': 'Failed to fetch issues from the provided GitHub URL. Check server logs for HTTP status code (e.g., 401/404).'}), 502

    # 3. 转换并返回 JSON 响应
    final_data_list = json_to_list_of_dicts(issues_json_data)

    return jsonify({
        'status': 'success',
        'source_url': github_url,
        'total_issues': len(final_data_list),
        # ⭐️ 移除 since 字段
        'data': final_data_list
    })


@app.route('/api/github/events', methods=['GET'])
def get_events_data():
    """Aggregate events (commits, pulls, reviews, issues, comments, assignments) for a repository.

    Query params:
      repo=owner/repo  (required)
      commits (int) optional limit for commits
      prs (int) optional limit for PRs
      issues (int) optional limit for issues
    """
    if not GITHUB_TOKEN:
        return jsonify({'message': 'Server configuration error: GITHUB_TOKEN is not set.'}), 500

    repo_query = request.args.get('repo') or request.args.get('github_repo')
    if not repo_query:
        return jsonify({'message': "Missing required query parameter: repo (format 'owner/repo')"}), 400

    owner, repo = _split_repo_string(repo_query)
    if not owner or not repo:
        return jsonify({'message': "Invalid repo format. Expected 'owner/repo'"}), 400

    # parse limits
    try:
        commits_limit = int(request.args.get('commits', 30))
    except Exception:
        commits_limit = 30
    try:
        prs_limit = int(request.args.get('prs', 30))
    except Exception:
        prs_limit = 30
    try:
        issues_limit = int(request.args.get('issues', 50))
    except Exception:
        issues_limit = 50

    all_events = []

    # fetch commits
    try:
        all_events.extend(fetch_commits_events(owner, repo, GITHUB_TOKEN, limit=commits_limit))
    except Exception as e:
        print(f"Error fetching commits: {e}")

    # fetch pulls + reviews
    try:
        all_events.extend(fetch_pulls_and_reviews(owner, repo, GITHUB_TOKEN, pr_limit=prs_limit))
    except Exception as e:
        print(f"Error fetching pulls/reviews: {e}")

    # fetch issues, comments, issue events
    try:
        all_events.extend(fetch_issues_comments_events(owner, repo, GITHUB_TOKEN, issue_limit=issues_limit))
    except Exception as e:
        print(f"Error fetching issues/comments: {e}")

    # normalize / sort by timestamp descending (most recent first)
    def _get_ts(ev):
        for k in ('timestamp', 'created_at', 'submitted_at'):
            v = ev.get(k)
            if v:
                try:
                    return datetime.fromisoformat(v.replace('Z', '+00:00'))
                except Exception:
                    try:
                        return datetime.fromtimestamp(float(v))
                    except Exception:
                        continue
        return datetime.fromtimestamp(0)

    all_events.sort(key=_get_ts, reverse=True)

    # Persist fetched events to fetch.json in the same directory as this file
    try:
        base_dir = os.path.dirname(__file__)
        # Compute plugin data directory relative to this connector package.
        # base_dir is expected to be .../superset/superset-github-connector
        # plugin data dir is .../superset/superset-frontend/superset-plugin-chart-collab-forcedirected/src/data
        plugin_data_dir = os.path.abspath(os.path.join(base_dir, '..', 'superset-frontend', 'superset-plugin-chart-collab-forcedirected', 'src', 'data'))
        try:
            os.makedirs(plugin_data_dir, exist_ok=True)
        except Exception as e:
            print(f"Failed to create plugin data directory {plugin_data_dir}: {e}")
        out_path = os.path.join(plugin_data_dir, 'fetch.json')
        print(f"Writing fetch.json to: {out_path}")
        with open(out_path, 'w', encoding='utf-8') as fh:
            json.dump(all_events, fh, ensure_ascii=False, indent=2)
        saved_to = out_path
    except Exception as e:
        print(f"Failed to write fetch.json: {e}")
        saved_to = None

    resp = {'status': 'success', 'repo': f"{owner}/{repo}", 'total_events': len(all_events), 'data': all_events}
    if saved_to:
        resp['saved_to'] = saved_to

    return jsonify(resp)


# --- 4. 启动服务 ---
if __name__ == '__main__':
    # 生产环境中请勿使用 debug=True
    app.run(debug=True, host='127.0.0.1', port=5000)