#!/usr/bin/env python3
"""
Minecraft Server Health Check HTTP Server (Docker Version)

Docker内で動作するMinecraftサーバーの状態を確認するHTTPサーバー。
Dockerコンテナの状態をチェックして、サーバーが起動しているか判定します。

使用方法:
  sudo python3 minecraft-health-server-docker.py

要件:
  - Python 3.6以上
  - Docker がインストール済み
  - ヘルスチェックサーバーを実行するユーザーがdockerグループに所属
"""

import http.server
import socketserver
import subprocess
import os
import sys
import json
from typing import Optional, Dict, Any

# 設定
PORT = int(os.environ.get('HEALTH_CHECK_PORT', '8080'))
DOCKER_CONTAINER_NAME = os.environ.get('DOCKER_CONTAINER_NAME', 'paper')

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
        Dockerコンテナが実行中かチェック
        
        Returns:
            bool: コンテナが実行中ならTrue
        """
        try:
            # docker ps でコンテナの状態を確認
            result = subprocess.run(
                ['docker', 'ps', '--filter', f'name={DOCKER_CONTAINER_NAME}', '--format', '{{.Status}}'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode != 0:
                print(f"Error: docker ps failed: {result.stderr}", file=sys.stderr)
                return False
            
            # 出力があり、"Up"で始まっていればコンテナは起動中
            status = result.stdout.strip()
            return status.startswith('Up')
            
        except subprocess.TimeoutExpired:
            print(f"Warning: Docker check timed out", file=sys.stderr)
            return False
        except FileNotFoundError:
            print(f"Error: docker command not found", file=sys.stderr)
            return False
        except Exception as e:
            print(f"Error checking Docker container: {e}", file=sys.stderr)
            return False
    
    def get_debug_info(self) -> str:
        """
        デバッグ情報を取得
        
        Returns:
            str: JSON形式のデバッグ情報
        """
        debug_data = {
            'container_name': DOCKER_CONTAINER_NAME,
            'is_running': self.is_minecraft_running(),
            'docker_info': {}
        }
        
        # すべてのコンテナを検索
        try:
            result = subprocess.run(
                ['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.Status}}\t{{.Image}}'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                containers = []
                for line in result.stdout.strip().split('\n'):
                    if line:
                        parts = line.split('\t')
                        if len(parts) >= 3:
                            containers.append({
                                'name': parts[0],
                                'status': parts[1],
                                'image': parts[2]
                            })
                debug_data['docker_info']['all_containers'] = containers
            else:
                debug_data['docker_info']['error'] = result.stderr
                
        except Exception as e:
            debug_data['docker_info']['error'] = str(e)
        
        # 指定されたコンテナの詳細情報
        try:
            result = subprocess.run(
                ['docker', 'inspect', DOCKER_CONTAINER_NAME],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                container_info = json.loads(result.stdout)
                if container_info:
                    debug_data['docker_info']['target_container'] = {
                        'state': container_info[0].get('State', {}),
                        'name': container_info[0].get('Name', ''),
                    }
            else:
                debug_data['docker_info']['target_container'] = 'not_found'
                
        except Exception as e:
            debug_data['docker_info']['target_container_error'] = str(e)
        
        return json.dumps(debug_data, indent=2)
    
    def log_message(self, format, *args):
        """ログメッセージをカスタマイズ（簡潔に）"""
        sys.stdout.write(f"{self.address_string()} - {format % args}\n")

def main():
    """メイン処理"""
    print(f"Starting Minecraft Health Check Server (Docker Mode)")
    print(f"Port: {PORT}")
    print(f"Monitoring Docker container: {DOCKER_CONTAINER_NAME}")
    print(f"Health check endpoint: http://localhost:{PORT}/health")
    print(f"Debug endpoint: http://localhost:{PORT}/debug")
    
    # Docker が使えるか確認
    try:
        result = subprocess.run(
            ['docker', '--version'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"Docker version: {result.stdout.strip()}")
        else:
            print(f"Warning: Docker command failed", file=sys.stderr)
    except FileNotFoundError:
        print(f"Error: Docker is not installed or not in PATH", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Warning: Could not check Docker version: {e}", file=sys.stderr)
    
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
