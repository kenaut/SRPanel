# SRPanel

[English](README.md) · **简体中文**

> 开源服务器资源监控面板（Server Resource Panel）
> Python + Flask 后端 · 原生 HTML/CSS/JS 前端 · 实时 Dashboard

SRPanel 通过 [psutil](https://github.com/giampaolo/psutil) 采集服务器资源，
以 JSON API 对外提供数据，前端定时拉取并渲染为简洁现代的监控面板。
前后端分离，无需数据库，开箱即用。

## 功能特性

- **CPU**：总使用率、各逻辑核心使用率、核心数 / 线程数、频率、系统负载
- **内存**：总量 / 已用 / 可用、使用率；Swap 使用情况
- **磁盘**：所有挂载分区的容量、已用、剩余与使用率（自动跳过不可读挂载点）
- **网络**：实时发送 / 接收速率（字节/秒）、累计流量与包数
- **系统**：主机名、操作系统、内核、架构、运行时间（Uptime）与启动时间
- **实时刷新**：支持 1s / 2s / 5s / 10s 间隔切换，可暂停 / 继续
- **中英双语**：顶栏一键切换，自动按浏览器语言选择并记忆偏好（localStorage）
- **简约 UI**：纯色扁平设计，卡片式 Dashboard，自适应布局
- **跨平台**：Linux、macOS、Windows（依赖 psutil）
- **开放 API**：`GET /api/stats` 返回 JSON，已开启 CORS，方便二次开发

## 项目结构

```
SRPanel/
├── run.py                # 启动入口
├── requirements.txt      # Python 依赖
├── app/                  # 后端应用包
│   ├── __init__.py       # Flask 应用工厂
│   ├── api.py            # /api/stats JSON 接口（蓝图）
│   └── metrics.py        # psutil 指标采集器
├── templates/
│   └── index.html        # Dashboard 页面
└── static/
    ├── css/style.css     # 界面样式
    └── js/dashboard.js   # 前端轮询、渲染与双语逻辑
```

## 快速开始

### 1. 环境要求

- Python 3.9+

### 2. 安装依赖

建议使用虚拟环境：

```bash
cd SRPanel
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. 启动服务

```bash
python run.py
```

启动后访问：

- 监控面板：<http://localhost:5000/>
- 数据接口：<http://localhost:5000/api/stats>

### 4. 配置（可选）

通过环境变量调整启动参数：

| 环境变量       | 默认值    | 说明           |
| -------------- | --------- | --------------|
| `SRPANEL_HOST` | `0.0.0.0` | 监听地址       |
| `SRPANEL_PORT` | `5000`    | 监听端口       |
| `SRPANEL_DEBUG`| `1`       | 是否开启 debug |

示例：

```bash
SRPANEL_PORT=8080 SRPANEL_DEBUG=0 python run.py
```

生产环境推荐使用 gunicorn / waitress 等 WSGI 服务器：

```bash
pip install gunicorn
gunicorn -w 1 -b 0.0.0.0:5000 run:app
```

> 说明：指标采集器是有状态的单例（用于计算网络速率），worker 数请保持为 1。

## API 说明

### `GET /api/stats`

返回当前服务器资源快照：

```json
{
  "ok": true,
  "data": {
    "timestamp": 1791130000.12,
    "system": {
      "hostname": "web-server",
      "os": "Linux-6.1.0-x86_64-...",
      "kernel": "6.1.0",
      "machine": "x86_64",
      "python": "3.11.6",
      "boot_time": 1791000000.0,
      "uptime": 130000
    },
    "cpu": {
      "percent": 12.5,
      "per_cpu": [10.1, 14.9],
      "count_logical": 2,
      "count_physical": 1,
      "frequency_mhz": 2400.0,
      "load_avg": [0.5, 0.6, 0.7]
    },
    "memory": { "total": 8300000000, "used": 4200000000, "available": 4100000000, "percent": 50.6 },
    "swap":   { "total": 2100000000, "used": 0, "percent": 0.0 },
    "disks": [
      { "device": "/dev/sda1", "mountpoint": "/", "fstype": "ext4",
        "total": 50000000000, "used": 20000000000, "free": 30000000000, "percent": 40.0 }
    ],
    "network": {
      "bytes_sent": 1000000, "bytes_recv": 5000000,
      "send_rate": 1024.0, "recv_rate": 8192.0,
      "packets_sent": 1000, "packets_recv": 4000
    }
  }
}
```

容量字段单位均为 **字节**，速率单位为 **字节/秒**，`uptime` 单位为 **秒**。
出错时返回 HTTP 500：`{"ok": false, "error": "..."}`。

## 扩展指南

- **新增指标**：在 [app/metrics.py](app/metrics.py) 的 `MetricsCollector` 中增加采集方法并挂到 `collect()` 返回结构，前端新增对应卡片即可。
- **新增接口**：在 [app/api.py](app/api.py) 蓝图中注册新路由。
- **鉴权 / 多机监控 / 历史图表**：当前 MVP 聚焦单机实时面板，后续可在应用工厂中加入认证中间件、SQLite 持久化与图表库。

## License

MIT
