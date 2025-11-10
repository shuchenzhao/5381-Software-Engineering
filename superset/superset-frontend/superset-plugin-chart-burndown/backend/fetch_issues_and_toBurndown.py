#!/usr/bin/env python3
import requests
import pandas as pd
from typing import List, Dict, Any
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import json
import argparse
from pathlib import Path
import re

# ===================================================
# Step 0: 环境变量加载
# ===================================================
# 使用 python-dotenv 加载 .env 文件中的环境变量
# 这里主要是 GitHub 访问 Token
load_dotenv()
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise ValueError("❌ GITHUB_TOKEN not found in environment variables (.env)")

# --- 数据保存目录 ---
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)  # 如果不存在则创建

# ===================================================
# Step 1: 拉取 GitHub Issues
# ===================================================
def fetch_all_issues(owner: str, repo: str, token: str, days: int = 90) -> List[Dict[str, Any]]:
    """
    拉取指定 GitHub 仓库的所有 Issue（不包含 Pull Request）
    只拉取最近 `days` 天内创建的 Issues
    """
    github_api_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    all_issues = []  # 保存所有拉取到的 issue
    page = 1  # 分页索引

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    # since 参数表示从多久以前开始拉取
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    print(f"📡 Fetching Issues from {owner}/{repo}")
    print(f"   → Since: {since}")

    while True:
        # 构造请求参数
        params = {
            "state": "all",         # 拉取所有状态的 issue
            "per_page": 100,        # 每页最多 100 条
            "page": page,           # 当前页码
            "sort": "created",      # 按创建时间排序
            "direction": "desc",    # 最新创建的 issue 在前
            "since": since          # 从指定日期开始拉取
        }

        response = requests.get(github_api_url, headers=headers, params=params)
        if response.status_code != 200:
            try:
                error_detail = response.json()
            except requests.exceptions.JSONDecodeError:
                error_detail = response.text or "No detailed response body."
            print(f"❌ GitHub API 请求失败。状态码: {response.status_code}. 响应: {error_detail}")
            return []

        current_issues = response.json()
        if not current_issues:  # 如果当前页没有数据，结束循环
            break

        # 筛选掉拉取请求 PR，只保留 issue
        issues_only = [issue for issue in current_issues if "pull_request" not in issue]
        all_issues.extend(issues_only)

        # 检查是否有下一页
        if 'link' in response.headers and 'rel="next"' in response.headers['link']:
            page += 1
        else:
            break

    return all_issues

# ===================================================
# Step 1b: 数据格式化函数
# ===================================================
def json_to_list_of_dicts(issues_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    将原始 GitHub Issues JSON 数据转换为扁平化字典列表
    只保留指定核心字段
    """
    if not issues_data:
        return []

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
        df = pd.json_normalize(issues_data, sep='_')  # 扁平化 JSON
        cols_to_select = {k: v for k, v in CORE_COLUMNS.items() if k in df.columns}
        df = df.rename(columns=cols_to_select)[list(cols_to_select.values())]

        # 将 NaN 替换为 None，避免 Pandas 默认填充
        for col in [c for c in df.columns if 'at' in c]:
            df[col] = df[col].where(pd.notnull(df[col]), None)

        return df.to_dict('records')
    except Exception as e:
        print(f"⚠️ Error during data normalization: {e}")
        return []

# ===================================================
# Step 1c: 保存到本地 JSON
# ===================================================
def save_issues_to_local(data: List[Dict[str, Any]], owner: str, repo: str) -> str:
    """
    保存 Issues 数据到本地 JSON 文件
    文件名包含 owner、repo 和时间戳
    """
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"github_issues_{owner}_{repo}_{timestamp}.json"
    filepath = os.path.join(DATA_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Issues data saved to {filepath}")
    return filepath

# ===================================================
# Step 2: 转换为燃尽图数据
# ===================================================
def load_issues(json_file):
    """读取本地 JSON 文件"""
    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)

def compute_remaining(issues, project_start_date):
    """
    计算每天剩余 Issue 数，用于绘制燃尽图
    返回列表：
    [{"ds": "2025-10-01", "remaining": 100}, ...]
    """
    # 1️⃣ 将字符串日期转换为 datetime 对象
    for issue in issues:
        issue["created_at_dt"] = datetime.strptime(issue["created_at"][:10], "%Y-%m-%d")
        issue["closed_at_dt"] = None
        if issue.get("closed_at"):
            issue["closed_at_dt"] = datetime.strptime(issue["closed_at"][:10], "%Y-%m-%d")

    # 2️⃣ 时间范围：从最早创建的 issue 到今天
    min_date = min(issue["created_at_dt"] for issue in issues)
    max_date = datetime.today()

    # 3️⃣ 构建每日剩余任务列表
    remaining_data = []
    current_date = min_date
    while current_date <= max_date:
        # 已创建的 issue 数
        created_count = sum(1 for issue in issues if issue["created_at_dt"] <= current_date)
        # 已关闭的 issue 数
        closed_count = sum(1 for issue in issues if issue["closed_at_dt"] and issue["closed_at_dt"] <= current_date)
        # 剩余未完成的 issue
        remaining_data.append({
            "ds": current_date.strftime("%Y-%m-%d"),
            "remaining": created_count - closed_count
        })
        current_date += timedelta(days=1)

    # 4️⃣ 截取项目开始日期后的数据
    start_dt = datetime.strptime(project_start_date, "%Y-%m-%d")
    remaining_data = [d for d in remaining_data if d["ds"] >= start_dt.strftime("%Y-%m-%d")]

    return remaining_data

def save_ts(remaining_data, output_file):
    """
    保存燃尽图数据到独立 TS 文件
    格式：
    export const burndownData = [{ ds: '2025-10-01', remaining: 100 }, ...]
    """
    ts_content = "// 生成于 {}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    ts_content += "export const burndownData = [\n"
    for d in remaining_data:
        ts_content += f"  {{ ds: '{d['ds']}', remaining: {d['remaining']} }},\n"
    ts_content += "];\n"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(ts_content)

# ===================================================
# Step 3: 更新 Burndown.stories.tsx 示例
# ===================================================
def update_burndown_stories(stories_file: str, remaining_data: list):
    """
    替换 Burndown.stories.tsx 中的 const data = [...] 内容
    """
    path = Path(stories_file)
    content = path.read_text(encoding="utf-8")

    ts_data_str = "\n".join(
        f"  {{ ds: '{d['ds']}', remaining: {d['remaining']} }}," for d in remaining_data
    )

    # 使用正则匹配并替换原有 data 块
    pattern = re.compile(r"(const\s+data\s*=\s*\[)(.*?)(\];)", re.DOTALL)
    new_content, count = pattern.subn(r"\1\n" + ts_data_str + r"\n\3", content)

    if count == 0:
        raise ValueError("未找到 const data = [...] 代码块，请检查 Burndown.stories.tsx 文件格式。")

    path.write_text(new_content, encoding="utf-8")
    print(f"Burndown.stories.tsx 已更新，替换 {count} 个 data 块")

# ===================================================
# 主函数
# ===================================================
def main():
    parser = argparse.ArgumentParser(description="Fetch GitHub issues and generate burndown data")
    parser.add_argument("--owner", required=True, help="GitHub repository owner")
    parser.add_argument("--repo", required=True, help="GitHub repository name")
    parser.add_argument("--days", type=int, default=90, help="Days of issue history to fetch")
    parser.add_argument("--start", required=True, help="Project start date, e.g. 2025-10-01")
    parser.add_argument("--output", required=True, help="Path to output TS file")
    args = parser.parse_args()

    # Step 1: Fetch issues
    issues_json_data = fetch_all_issues(
        owner=args.owner,
        repo=args.repo,
        token=GITHUB_TOKEN,
        days=args.days
    )
    if not issues_json_data:
        print("⚠️ No issues fetched or API request failed.")
        return

    # 格式化字段
    final_data_list = json_to_list_of_dicts(issues_json_data)
    # 保存最新 JSON 文件
    latest_json_file = save_issues_to_local(final_data_list, owner=args.owner, repo=args.repo)
    print(f"✅ Latest JSON file: {latest_json_file}")
    print(f"✅ Total issues processed: {len(final_data_list)}")

    # Step 2: Generate burndown
    issues = load_issues(latest_json_file)
    remaining_data = compute_remaining(issues, args.start)
    save_ts(remaining_data, args.output)
    print(f"💾 Burndown data saved to {args.output}")

    # Step 3: Update stories
    stories_file = "../src/stories/Burndown.stories.tsx"
    update_burndown_stories(stories_file, remaining_data)

if __name__ == "__main__":
    main()
