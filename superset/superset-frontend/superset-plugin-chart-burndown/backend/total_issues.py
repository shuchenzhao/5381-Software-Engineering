import json
from datetime import datetime, timedelta

def generate_burndown(issues_json_path, start_date_str):
    """
    生成 Burndown 数据，避免未来函数。
    
    Args:
        issues_json_path (str): GitHub issues JSON 文件路径
        start_date_str (str): 项目开始日期，格式 'YYYY-MM-DD'
        
    Returns:
        List[Dict]: [{ds: 'YYYY-MM-DD', remaining: int}, ...]
    """
    # 1. 读取 JSON 文件
    with open(issues_json_path, 'r', encoding='utf-8') as f:
        issues = json.load(f)
    
    # 2. 转换日期字符串为 datetime
    for issue in issues:
        issue['created_at'] = datetime.strptime(issue['created_at'][:10], '%Y-%m-%d')
        if issue['closed_at']:
            issue['closed_at'] = datetime.strptime(issue['closed_at'][:10], '%Y-%m-%d')
    
    # 3. 确定日期区间：从 start_date 到今天
    start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    end_date = datetime.today()
    
    burndown_data = []
    current_date = start_date
    while current_date <= end_date:
        # 筛选 <= 当天创建的 issue
        created_count = sum(1 for issue in issues if issue['created_at'] <= current_date)
        # 筛选 <= 当天关闭的 issue
        closed_count = sum(1 for issue in issues if issue['closed_at'] and issue['closed_at'] <= current_date)
        remaining = created_count - closed_count
        
        burndown_data.append({
            'ds': current_date.strftime('%Y-%m-%d'),
            'remaining': remaining
        })
        current_date += timedelta(days=1)
    
    return burndown_data

# --------------------------
# 示例用法
# --------------------------
if __name__ == '__main__':
    burndown = generate_burndown(
        issues_json_path='data/github_issues_pallets_flask_2025-11-02_224740.json',
        start_date_str='2025-09-01'
    )
    
    # 打印前 10 天的数据
    # for row in burndown[:20]:
    #     print(row)
    print(burndown)
