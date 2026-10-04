"""SRPanel Flask 应用工厂。"""
import os

from flask import Flask, render_template
from flask_cors import CORS

from .api import api_bp

# 项目根目录（app/ 的上一级），templates 与 static 位于根目录，便于前后端分离
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder=os.path.join(BASE_DIR, "static"),
        template_folder=os.path.join(BASE_DIR, "templates"),
    )

    # 前后端分离：允许跨域访问 /api/*
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(api_bp)

    @app.get("/")
    def index():
        return render_template("index.html")

    return app
