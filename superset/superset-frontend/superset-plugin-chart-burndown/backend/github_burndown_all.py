#!/usr/bin/env python3
import subprocess
import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description="整合 GitHub Issues -> Burndown -> Storybook")
    parser.add_argument("--owner", required=True, help="GitHub 仓库 owner")
    parser.add_argument("--repo", required=True, help="GitHub 仓库名")
    parser.add_argument("--start", help="项目开始日期, e.g. 2025-10-01")
    parser.add_argument("--end", help="项目结束日期, e.g. 2025-11-02")
    parser.add_argument("--output-json", default="backend/data/github_issues.json", help="保存 issues 的 JSON 文件路径")
    parser.add_argument("--output-ts", default="src/stories/burndown_data_generated.ts", help="生成 TS 文件路径")
    parser.add_argument("--stories-file", default="src/stories/Burndown.stories.tsx", help="Burndown.stories.tsx 文件路径")
    args = parser.parse_args()

    # 1️⃣ 调用 github_issues_save_since.py 拉取数据
    print("==> 拉取 GitHub Issues 数据")
    subprocess.run([
        "python3", "github_issues_save_since.py",
        "--owner", args.owner,
        "--repo", args.repo,
        "--output", args.output_json
    ], check=True)

    # 2️⃣ 调用 github_issues_to_burndown.py 生成燃尽图数据
    print("==> 生成燃尽图 TS 数据并更新 stories")
    cmd_burndown = [
        "python3", "github_issues_to_burndown.py",
        "--input", args.output_json,
        "--output", args.output_ts,
    ]
    if args.start:
        cmd_burndown += ["--start", args.start]
    # if args.end:
    #     cmd_burndown += ["--end", args.end]
    subprocess.run(cmd_burndown, check=True)

    # 3️⃣ 启动 Storybook
    print("==> 启动 Storybook")
    subprocess.run([
        "bash", "-c", "PLUGIN_STORYBOOK=1 PLUGIN_NAME=superset-plugin-chart-burndown npm run storybook"
    ], check=True)

if __name__ == "__main__":
    main()
