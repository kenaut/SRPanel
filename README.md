# SRPanel

**English** · [简体中文](README.zh-CN.md)

> Server Resource Panel — an open-source server monitoring dashboard.
> Python + Flask backend · Vanilla HTML/CSS/JS frontend · Real-time dashboard

SRPanel collects server resources with [psutil](https://github.com/giampaolo/psutil),
exposes them through a JSON API, and renders a clean, modern dashboard that
polls the API on a timer. Frontend and backend are separated, no database is
required — it works out of the box.

## Features

- **CPU**: overall usage, per-logical-core usage, core/thread counts, frequency, load average
- **Memory**: total / used / available and usage percentage; swap usage
- **Disk**: capacity, used, free and percentage for every mounted partition (unreadable mounts are skipped automatically)
- **Network**: real-time send/receive rate (bytes per second), cumulative traffic and packet counts
- **System**: hostname, OS, kernel, architecture, uptime and boot time
- **Live refresh**: switchable interval (1s / 2s / 5s / 10s), pause/resume supported
- **Bilingual UI (EN / 中文)**: one-click toggle in the top bar; language is auto-detected from the browser and persisted in localStorage
- **Minimal UI**: flat, solid-color design; card-based responsive dashboard
- **Cross-platform**: Linux, macOS and Windows (powered by psutil)
- **Open API**: `GET /api/stats` returns JSON with CORS enabled, ready for integration

## Project Structure

```
SRPanel/
├── run.py                # Entry point
├── requirements.txt      # Python dependencies
├── app/                  # Backend package
│   ├── __init__.py       # Flask application factory
│   ├── api.py            # /api/stats JSON endpoint (blueprint)
│   └── metrics.py        # psutil-based metrics collector
├── templates/
│   └── index.html        # Dashboard page
└── static/
    ├── css/style.css     # Dashboard styles
    └── js/dashboard.js   # Frontend polling, rendering and i18n
```

## Quick Start

### 1. Requirements

- Python 3.9+

### 2. Install dependencies

A virtual environment is recommended:

```bash
cd SRPanel
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run

```bash
python run.py
```

Then open:

- Dashboard: <http://localhost:5000/>
- API endpoint: <http://localhost:5000/api/stats>

### 4. Configuration (optional)

Startup options are controlled via environment variables:

| Variable       | Default   | Description          |
| -------------- | --------- | -------------------- |
| `SRPANEL_HOST` | `0.0.0.0` | Bind address         |
| `SRPANEL_PORT` | `5000`    | Listen port          |
| `SRPANEL_DEBUG`| `1`       | Enable Flask debug   |

Example:

```bash
SRPANEL_PORT=8080 SRPANEL_DEBUG=0 python run.py
```

For production, use a WSGI server such as gunicorn or waitress:

```bash
pip install gunicorn
gunicorn -w 1 -b 0.0.0.0:5000 run:app
```

> Note: the metrics collector is a stateful singleton (the previous sample is
> used to calculate network rates), so keep the worker count at 1.

## API

### `GET /api/stats`

Returns a snapshot of the current server resources:

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

Capacity fields are in **bytes**, rates are in **bytes/second**, and `uptime`
is in **seconds**. On error the API responds with HTTP 500:
`{"ok": false, "error": "..."}`.

## Extending

- **New metrics**: add a collector method to `MetricsCollector` in [app/metrics.py](app/metrics.py) and include its result in the `collect()` payload, then add a card on the frontend.
- **New endpoints**: register routes on the blueprint in [app/api.py](app/api.py).
- **Auth / multi-host / history charts**: the MVP focuses on a single-host real-time panel; authentication middleware, SQLite persistence and charting libraries can be added later in the application factory.

## License

MIT
