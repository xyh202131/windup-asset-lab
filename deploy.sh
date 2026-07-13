#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "=== Windup Asset Lab 部署 ==="

# 安装 Python 虚拟环境
if [ ! -d venv ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r server/requirements.txt -q

# 创建数据目录
mkdir -p generation-data/jobs generation-data/backups

# 启动/重启 PM2
pm2 delete windup-lab 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo "部署完成: https://windup.tracemuse.top/"
