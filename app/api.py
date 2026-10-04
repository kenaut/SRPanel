"""SRPanel JSON API 蓝图。"""
from flask import Blueprint, jsonify

from .metrics import collector

api_bp = Blueprint("api", __name__, url_prefix="/api")


@api_bp.get("/stats")
def get_stats():
    """返回当前服务器资源指标。

    响应:
        成功: {"ok": true, "data": {...}}
        失败: {"ok": false, "error": "..."}  HTTP 500
    """
    try:
        return jsonify({"ok": True, "data": collector.collect()})
    except Exception as exc:  # 出错时返回 JSON 而非 HTML 错误页，不打断前端轮询
        return jsonify({"ok": False, "error": str(exc)}), 500
