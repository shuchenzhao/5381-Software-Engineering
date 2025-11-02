import json
import argparse
from datetime import datetime, timedelta
from pathlib import Path
import re


def load_issues(json_file):
    """读取 GitHub issues JSON 文件"""
    with open(json_file, "r", encoding="utf-8") as f:
        return json.load(f)


def compute_remaining(issues, project_start_date):
    """
    计算每天剩余 issue 数，返回列表:
    [{"ds": "2025-10-01", "remaining": 100}, ...]
    """
    # 转换日期字符串为 datetime
    for issue in issues:
        issue["created_at_dt"] = datetime.strptime(issue["created_at"][:10], "%Y-%m-%d")
        issue["closed_at_dt"] = None
        if issue.get("closed_at"):
            issue["closed_at_dt"] = datetime.strptime(issue["closed_at"][:10], "%Y-%m-%d")

    # 全局时间范围
    min_date = min(issue["created_at_dt"] for issue in issues)
    max_date = datetime.today()
    # max_date = datetime.today() if project_end_date is None else datetime.strptime(project_end_date, "%Y-%m-%d")

    # 构建每日 remaining
    remaining_data = []
    current_date = min_date
    while current_date <= max_date:
        created_count = sum(1 for issue in issues if issue["created_at_dt"] <= current_date)
        closed_count = sum(1 for issue in issues if issue["closed_at_dt"] and issue["closed_at_dt"] <= current_date)
        remaining_data.append({
            "ds": current_date.strftime("%Y-%m-%d"),
            "remaining": created_count - closed_count
        })
        current_date += timedelta(days=1)

    # 截取项目时间段
    start_dt = datetime.strptime(project_start_date, "%Y-%m-%d")
    remaining_data = [d for d in remaining_data if d["ds"] >= start_dt.strftime("%Y-%m-%d")]

    return remaining_data


def save_ts(remaining_data, output_file):
    """生成独立 TS 文件"""
    ts_content = "// 生成于 {}\n".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    ts_content += "export const burndownData = [\n"
    for d in remaining_data:
        ts_content += f"  {{ ds: '{d['ds']}', remaining: {d['remaining']} }},\n"

    ts_content += "];\n"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(ts_content)


def update_burndown_stories(stories_file: str, remaining_data: list):
    """
    替换 Burndown.stories.tsx 中的 const data = [...] 内容
    """
    path = Path(stories_file)
    content = path.read_text(encoding="utf-8")

    # 生成 TS 数据字符串
    ts_data_str = "\n".join(
        f"  {{ ds: '{d['ds']}', remaining: {d['remaining']} }}," for d in remaining_data
    )

    # 使用正则替换 const data = [...] 块
    pattern = re.compile(r"(const\s+data\s*=\s*\[)(.*?)(\];)", re.DOTALL)
    new_content, count = pattern.subn(r"\1\n" + ts_data_str + r"\n\3", content)

    if count == 0:
        raise ValueError("未找到 const data = [...] 代码块，请检查 Burndown.stories.tsx 文件格式。")

    path.write_text(new_content, encoding="utf-8")
    print(f"Burndown.stories.tsx 已更新，替换 {count} 个 data 块")


def main():
    parser = argparse.ArgumentParser(description="Convert GitHub issues JSON to burndown data")
    parser.add_argument("--input", required=True, help="Path to input JSON file")
    parser.add_argument("--start", required=True, help="Project start date, e.g. 2025-10-01")
    parser.add_argument("--output", required=True, help="Path to output TS file")
    args = parser.parse_args()

    issues = load_issues(args.input)
    remaining_data = compute_remaining(issues, args.start)

    # 生成单独 TS 文件
    save_ts(remaining_data, args.output)
    print(f"Burndown data saved to {args.output}")

    # 更新 Burndown.stories.tsx
    stories_file = "../src/stories/Burndown.stories.tsx"
    update_burndown_stories(stories_file, remaining_data)


if __name__ == "__main__":
    main()

