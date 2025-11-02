from flask import Flask, request, jsonify
import requests
import pandas as pd
from typing import List, Dict, Any
import os
from datetime import datetime
from dotenv import load_dotenv
import json

# ===================================================
# 环境变量加载：程序启动时从 .env 文件加载 GITHUB_TOKEN
# ===================================================
load_dotenv()

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")

app = Flask(__name__)

# --- 数据保存目录 ---
DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

# --- 数据转换函数 ---
def json_to_list_of_dicts(issues_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    使用 pandas 将 Issues JSON 列表转换为扁平化的结构，并返回 Python 字典列表。
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
        df = pd.json_normalize(issues_data, sep='_')
        cols_to_select = {k: v for k, v in CORE_COLUMNS.items() if k in df.columns}
        df = df.rename(columns=cols_to_select)[list(cols_to_select.values())]

        for col in [c for c in df.columns if 'at' in c]:
            df[col] = df[col].where(pd.notnull(df[col]), None)

        return df.to_dict('records')
    except Exception as e:
        print(f"Error during data normalization: {e}")
        return []


# --- Issues 拉取逻辑 ---
def fetch_all_issues(github_api_url: str, token: str) -> List[Dict[str, Any]]:
    if not github_api_url:
        print("错误：GitHub API URL 缺失。")
        return []

    all_issues = []
    page = 1

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }

    print(f"Fetching from: {github_api_url}")
    print(f"Token loaded successfully: {token[:5]}...")

    while True:
        params = {
            "state": "all",
            "per_page": 100,
            "page": page,
            "sort": "created",
            "direction": "desc"
        }

        response = requests.get(github_api_url, headers=headers, params=params)
        if response.status_code != 200:
            try:
                error_detail = response.json()
            except requests.exceptions.JSONDecodeError:
                error_detail = response.text or "No detailed response body."
            print(f"GitHub API 请求失败。状态码: {response.status_code}. 响应: {error_detail}")
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
def save_issues_to_local(data: List[Dict[str, Any]], repo_name: str = "unknown_repo"):
    """
    将获取到的 issue 数据保存到本地 JSON 文件中
    """
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"github_issues_{repo_name}_{timestamp}.json"
    filepath = os.path.join(DATA_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Issues data saved to {filepath}")
    return filepath


# --- Flask 路由 ---
@app.route('/api/github/issues', methods=['GET'])
def get_issues_data():
    if not GITHUB_TOKEN:
        return jsonify({
            'message': 'Server configuration error: GITHUB_TOKEN is not set in environment variables (check your .env file).'
        }), 500

    github_url = request.args.get('github_url')
    if not github_url:
        return jsonify({'message': 'Missing required query parameter: github_url. Example: github_url=https://api.github.com/repos/OWNER/REPO/issues'}), 400

    issues_json_data = fetch_all_issues(github_api_url=github_url, token=GITHUB_TOKEN)

    if not issues_json_data:
        return jsonify({'message': 'Failed to fetch issues from the provided GitHub URL.'}), 502

    final_data_list = json_to_list_of_dicts(issues_json_data)

    # 从 URL 提取仓库名称，用于保存文件
    try:
        repo_name = github_url.split("repos/")[1].replace("/issues", "").replace("/", "_")
    except Exception:
        repo_name = "unknown_repo"

    # 保存数据到本地文件
    file_path = save_issues_to_local(final_data_list, repo_name=repo_name)

    return jsonify({
        'status': 'success',
        'source_url': github_url,
        'total_issues': len(final_data_list),
        'saved_file': file_path,
        'data': final_data_list
    })


if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
