"""基于 psutil 的服务器资源指标采集。

所有返回字段均保证为稳定的数值类型（异常时回退 0.0），
避免前端因 None / NaN 而解析失败。
"""
from __future__ import annotations

import platform
import time
from typing import Any, Dict, List

import psutil


def _safe_float(value: Any, default: float = 0.0) -> float:
    """尽量转为保留两位小数的 float，失败时返回默认值。"""
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return default


class MetricsCollector:
    """采集 CPU / 内存 / 磁盘 / 网络 / 运行时间等指标。

    单例持有上一次网络计数器与采样时间，通过两次采样的差值
    计算实时收发速率（字节/秒）。
    """

    def __init__(self) -> None:
        # psutil 的 cpu_percent 首次调用返回 0.0，这里先预热
        psutil.cpu_percent(interval=None)
        psutil.cpu_percent(interval=None, percpu=True)

        self._last_net = psutil.net_io_counters()
        self._last_net_ts = time.time()
        self._boot_time = psutil.boot_time()

    def collect(self) -> Dict[str, Any]:
        now = time.time()
        return {
            "timestamp": now,
            "system": self._system(now),
            "cpu": self._cpu(),
            "memory": self._memory(),
            "swap": self._swap(),
            "disks": self._disks(),
            "network": self._network(now),
        }

    # ---- 各指标分区 ----------------------------------------------------

    def _system(self, now: float) -> Dict[str, Any]:
        uname = platform.uname()
        return {
            "hostname": uname.node,
            "os": platform.platform(),
            "kernel": uname.release,
            "machine": uname.machine,
            "python": platform.python_version(),
            "boot_time": self._boot_time,
            "uptime": max(0, int(now - self._boot_time)),
        }

    def _cpu(self) -> Dict[str, Any]:
        freq = psutil.cpu_freq()
        try:
            load_avg: List[float] | None = [round(x, 2) for x in psutil.getloadavg()]
        except (AttributeError, OSError):
            load_avg = None

        return {
            "percent": _safe_float(psutil.cpu_percent(interval=None)),
            "per_cpu": [
                _safe_float(x) for x in psutil.cpu_percent(interval=None, percpu=True)
            ],
            "count_logical": psutil.cpu_count(logical=True) or 0,
            "count_physical": psutil.cpu_count(logical=False) or 0,
            "frequency_mhz": _safe_float(freq.current) if freq else 0.0,
            "load_avg": load_avg,
        }

    def _memory(self) -> Dict[str, Any]:
        m = psutil.virtual_memory()
        return {
            "total": int(m.total),
            "used": int(m.used),
            "available": int(m.available),
            "percent": _safe_float(m.percent),
        }

    def _swap(self) -> Dict[str, Any]:
        s = psutil.swap_memory()
        return {
            "total": int(s.total),
            "used": int(s.used),
            "percent": _safe_float(s.percent),
        }

    def _disks(self) -> List[Dict[str, Any]]:
        disks: List[Dict[str, Any]] = []
        for part in psutil.disk_partitions(all=False):
            # 跳过光驱、无权限或不可读的挂载点（跨平台兼容）
            try:
                usage = psutil.disk_usage(part.mountpoint)
            except (PermissionError, OSError):
                continue
            disks.append(
                {
                    "device": part.device,
                    "mountpoint": part.mountpoint,
                    "fstype": part.fstype,
                    "total": int(usage.total),
                    "used": int(usage.used),
                    "free": int(usage.free),
                    "percent": _safe_float(usage.percent),
                }
            )
        return disks

    def _network(self, now: float) -> Dict[str, Any]:
        current = psutil.net_io_counters()
        elapsed = max(now - self._last_net_ts, 1e-6)

        send_rate = max(0.0, (current.bytes_sent - self._last_net.bytes_sent) / elapsed)
        recv_rate = max(0.0, (current.bytes_recv - self._last_net.bytes_recv) / elapsed)

        self._last_net = current
        self._last_net_ts = now

        return {
            "bytes_sent": int(current.bytes_sent),
            "bytes_recv": int(current.bytes_recv),
            "send_rate": round(send_rate, 2),
            "recv_rate": round(recv_rate, 2),
            "packets_sent": int(current.packets_sent),
            "packets_recv": int(current.packets_recv),
        }


# 模块级单例，供 API 蓝图直接使用
collector = MetricsCollector()
