#!/usr/bin/env python3
"""
Minecraft Server Health Check HTTP Server (Polling Version)

バックグラウンドで定期的にMinecraftプロセスをチェックし、
結果をキャッシュする方式。リクエスト時は即座にキャッシュを返す。

メリット:
- リクエスト時のレスポンスが高速
- プロセスチェックの頻度を制御できる

デメリット:
- 常時CPUを少し使用する
- 最大でチェック間隔分の遅延がある
"""

import http.server
import socketserver
import subprocess
import os
import sys
import threading
import time
from typing import Optional

# 設定
PORT = int(os.environ.get('HEALTH_CHECK_PORT', '8080'))
MINECRAFT_PROCESS_NAME = os.environ.get('MINECRAFT_PROCESS_NAME', 'bedrock_server')
CHECK_INTERVAL = int(os.environ.get('CHECK_INTERVAL_SECONDS', '5'))  # チェック間隔（秒）

# グローバル状態
minecraft_status = {
    'is_running': False,
    'last_check': None,
}
status_lock = threading.Lock()

def check_minecraft_process() -> bool:
    """Minecraftプロセスが実行中かチェック"""
    try:
        result = subprocess.run(
            ['pgrep', '-f', MINECRAFT_PROCESS_NAME],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error checking process: {e}", file=sys.stderr)
        return False

def background_checker():
    """バックグラウンドでMinecraftプロセスを定期チェック"""
    print(f"Background checker started (interval: {CHECK_INTERVAL}s)")
    
    while True:
        is_running = check_minecraft_process()
        
        with status_lock:
            minecraft_status['is_running'] = is_running
            minecraft_status['last_check'] = time.time()
        
        time.sleep(CHECK_INTERVAL)

class HealthCheckHandler(http.server.BaseHTTPRequestHandler):
    """ヘルスチェックリクエストを処理するハンドラー"""
    
    def do_GET(self):
        """GETリクエストの処理"""
        if self.path == '/health':
            with status_lock:
                is_running = minecraft_status['is_running']
                last_check = minecraft_status['last_check']
            
            if is_running:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    'status': 'ok',
                    'minecraft': 'running',
                    'last_check': last_check,
                }
                self.wfile.write(str(response).encode())
            else:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                response = {
                    'status': 'error',
                    'minecraft': 'not_running',
                    'last_check': last_check,
                }
                self.wfile.write(str(response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        """ログメッセージをカスタマイズ"""
        sys.stdout.write(f"{self.address_string()} - {format % args}\n")

def main():
    """メイン処理"""
    print(f"Starting Minecraft Health Check Server (Polling Mode)")
    print(f"Port: {PORT}")
    print(f"Monitoring process: {MINECRAFT_PROCESS_NAME}")
    print(f"Check interval: {CHECK_INTERVAL}s")
    
    # バックグラウンドチェッカーを起動
    checker_thread = threading.Thread(target=background_checker, daemon=True)
    checker_thread.start()
    
    # 初回チェックを待つ
    time.sleep(1)
    
    try:
        with socketserver.TCPServer(("", PORT), HealthCheckHandler) as httpd:
            print(f"Server is running. Press Ctrl+C to stop.")
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    except PermissionError:
        print(f"Error: Permission denied. Port {PORT} may require sudo.", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
