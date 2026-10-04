"""SRPanel 启动入口。

用法:
    python run.py

环境变量:
    SRPANEL_HOST   监听地址，默认 0.0.0.0
    SRPANEL_PORT   监听端口，默认 5000
    SRPANEL_DEBUG  是否开启 debug，默认 1
"""
import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(
        host=os.environ.get("SRPANEL_HOST", "0.0.0.0"),
        port=int(os.environ.get("SRPANEL_PORT", "5000")),
        debug=os.environ.get("SRPANEL_DEBUG", "1") == "1",
    )
