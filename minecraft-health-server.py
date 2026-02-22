#!/usr/bin/env python3
"""
Minecraft Server Health Check HTTP Server

EC2インスタンス上で動作し、Minecraftサーバープロセスの状態を確認するシンプルなHTTPサーバー。
ポート8080でリクエストを受け付け、Minecraftプロセスが起動していればHTTP 200を返します。

使用方法:
  sudo python3 minecraft-health-server.py

要件:
  - Python 3.6以上
  - Minecraftサーバーのプロセス名を環境変数で指定可能
"""

import http.server
import socketserver
import subprocess
import os
import sys
from typing import Optional

# 設定
PORT = int(os.environ.get('HEALTH_CHECK_PORT', '8080'))
MINECRAFT_PROCESS_NAME = os.environ.get('MINECRAFT_PROCESS_NAME', 'bedrock_server')

class HealthCheckHandler(http.server.BaseHTTPRequestHandler):
    """ヘルスチェックリクエストを処理するハンドラー"""
    
    def do_GET(self):
        """GETリクエストの処理"""
        if self.path == '/health':
            if self.is_minecraft_running():
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"ok","minecraft":"running"}')
            else:
                self.send_response(503)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(b'{"status":"error","minecraft":"not_running"}')
        elif self.path == '/debug':
            # デバッグ情報を返す
            debug_info = self.get_debug_info()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(debug_info.encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def is_minecraft_running(self) -> bool:
        """
        Minecraftサーバープロセスが実行中かチェック
        
        Returns:
            bool: プロセスが実行中ならTrue
        """
        try:
            # pgrep コマンドでプロセスを検索
            result = subprocess.run(
                ['pgrep', '-f', MINECRAFT_PROCESS_NAME],
                capture_output=True,
                text=True,
                timeout=5
            )
            # pgrep は見つかった場合は0、見つからない場合は1を返す
            return result.returncode == 0
        except subprocess.TimeoutExpired:
            print(f"Warning: Process check timed out", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Error checking process: {e}", file=sys.stderr)
            return False
    
    def get_debug_info(self) -> str:
        """
        デバッグ情報を取得
        
        Returns:
            str: JSON形式のデバッグ情報
        """
        import json
        
        debug_data = {
            'process_name': MINECRAFT_PROCESS_NAME,
            'is_running': self.is_minecraft_running(),
            'search_results': {}
        }
        
        # 複数のパターンで検索
        patterns = ['bedrock_server', 'bedrock', 'minecraft', 'LD_LIBRARY_PATH']
        for pattern in patterns:
            try:
                result = subprocess.run(
                    ['pgrep', '-f', pattern],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                debug_data['search_results'][pattern] = {
                    'found': result.returncode == 0,
                    'pids': result.stdout.strip().split('\n') if result.returncode == 0 else []
                }
            except Exception as e:
                debug_data['search_results'][pattern] = {
                    'error': str(e)
                }
        
        return json.dumps(debug_data, indent=2)
    
    def log_message(self, format, *args):
        """ログメッセージをカスタマイズ（簡潔に）"""
        sys.stdout.write(f"{self.address_string()} - {format % args}\n")

def main():
    """メイン処理"""
    print(f"Starting Minecraft Health Check Server on port {PORT}")
    print(f"Monitoring process: {MINECRAFT_PROCESS_NAME}")
    print(f"Health check endpoint: http://localhost:{PORT}/health")
    
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
