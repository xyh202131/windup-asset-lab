// Windup Asset Lab - PM2 生产环境配置
module.exports = {
  apps: [{
    name: 'windup-lab',
    script: 'server/app.py',
    interpreter: 'venv/bin/python3',
    cwd: '/opt/windup-asset-lab',
    args: '--port 4174',
    env: {
      PYTHONPATH: '/opt/windup-asset-lab/server',
      WINDUP_DEMO: '1'
    },
    max_memory_restart: '300M',
    restart_delay: 3000,
    error_file: '/root/.pm2/logs/windup-lab-error.log',
    out_file: '/root/.pm2/logs/windup-lab-out.log'
  }]
};
