import requests
import pandas as pd
from typing import List, Dict, Any
import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import json
import argparse

# ===================================================
# 环境变量加载
# ===================================================
load_dotenv()
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
if not GITHUB_TOKEN:
    raise ValueError("❌ GITHUB_TOKEN not found in environment variables (.env)")

# --- 数据保存目录 ---
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# --- 数据转换函数 ---
def json_to_list_of_dicts(issues_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
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
        df = pd.json_normalize(issues_data, sep='_')
        cols_to_select = {k: v for k, v in CORE_COLUMNS.items() if k in df.columns}
        df = df.rename(columns=cols_to_select)[list(cols_to_select.values())]

        for col in [c for c in df.columns if 'at' in c]:
            df[col] = df[col].where(pd.notnull(df[col]), None)

        return df.to_dict('records')
    except Exception as e:
        print(f"⚠️ Error during data normalization: {e}")
        return []

# --- Issues 拉取逻辑 ---
def fetch_all_issues(owner: str, repo: str, token: str, days: int = 90) -> List[Dict[str, Any]]:
    github_api_url = f"https://api.github.com/repos/{owner}/{repo}/issues"
    all_issues = []
    page = 1

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    print(f"📡 Fetching Issues from {owner}/{repo}")
    print(f"   → Since: {since}")

    while True:
        params = {
            "state": "all",
            "per_page": 100,
            "page": page,
            "sort": "created",
            "direction": "desc",
            "since": since
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
        if not current_issues:
            break

        issues_only = [issue for issue in current_issues if "pull_request" not in issue]
        all_issues.extend(issues_only)

        if 'link' in response.headers and 'rel="next"' in response.headers['link']:
            page += 1
        else:
            break

    return all_issues

# --- 保存函数 ---
def save_issues_to_local(data: List[Dict[str, Any]], owner: str, repo: str) -> str:
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"github_issues_{owner}_{repo}_{timestamp}.json"
    filepath = os.path.join(DATA_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"💾 Issues data saved to {filepath}")
    return filepath

# --- 主函数 ---
def main():
    parser = argparse.ArgumentParser(description="Fetch GitHub Issues and save as JSON")
    parser.add_argument("--owner", required=True, help="GitHub repository owner")
    parser.add_argument("--repo", required=True, help="GitHub repository name")
    parser.add_argument("--days", type=int, default=90, help="Days of issue history to fetch")
    args = parser.parse_args()

    issues_json_data = fetch_all_issues(
        owner=args.owner,
        repo=args.repo,
        token=GITHUB_TOKEN,
        days=args.days
    )

    if not issues_json_data:
        print("⚠️ No issues fetched or API request failed.")
        return

    final_data_list = json_to_list_of_dicts(issues_json_data)
    save_issues_to_local(final_data_list, owner=args.owner, repo=args.repo)

    print(f"✅ Total issues processed: {len(final_data_list)}")

if __name__ == "__main__":
    main()

