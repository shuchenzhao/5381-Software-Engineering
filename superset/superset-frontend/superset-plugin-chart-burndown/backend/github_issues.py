from flask import Flask, request, jsonify
import requests
import pandas as pd
from typing import List, Dict, Any
import os
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


# --- 4. 启动服务 ---
if __name__ == '__main__':
    # 生产环境中请勿使用 debug=True
    app.run(debug=True, host='127.0.0.1', port=5000)
