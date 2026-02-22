# Docker版 Minecraftヘルスチェックサーバー セットアップ手順

MinecraftサーバーがDocker内で動作している場合の設定方法です。

## 前提条件

- EC2インスタンスへのSSHアクセス
- Python 3.6以上（Python 3.12推奨）
- Docker がインストール済み
- sudo権限

## セットアップ手順

### 1. Dockerコンテナ名を確認

```bash
# 実行中のコンテナを確認
docker ps

# すべてのコンテナを確認（停止中も含む）
docker ps -a
```

出力例：
```
CONTAINER ID   IMAGE                    NAMES
abc123def456   itzg/minecraft-bedrock   minecraft
```

この例では、コンテナ名は `minecraft` です。

### 2. ファイルをEC2にアップロード

```bash
# ローカルマシンから実行
scp minecraft-health-server-docker.py ubuntu@YOUR_EC2_HOST:/home/ubuntu/
scp minecraft-health-docker.service ubuntu@YOUR_EC2_HOST:/home/ubuntu/
```

### 3. EC2インスタンスにSSH接続

```bash
ssh ubuntu@YOUR_EC2_HOST
```

### 4. スクリプトに実行権限を付与

```bash
chmod +x /home/ubuntu/minecraft-health-server-docker.py
```

### 5. ubuntuユーザーをdockerグループに追加

ヘルスチェックサーバーがDockerコマンドを実行できるようにします：

```bash
# dockerグループに追加
sudo usermod -aG docker ubuntu

# 確認
groups ubuntu

# 変更を反映（再ログインまたは）
newgrp docker
```

### 6. 動作確認（手動起動）

```bash
# テスト起動
python3.12 /home/ubuntu/minecraft-health-server-docker.py

# 別のターミナルから確認
curl http://localhost:8080/health

# デバッグ情報を確認
curl http://localhost:8080/debug
```

期待される結果:
- Dockerコンテナが起動中: `{"status":"ok","minecraft":"running"}` (HTTP 200)
- Dockerコンテナが停止中: `{"status":"error","minecraft":"not_running"}` (HTTP 503)

### 7. コンテナ名を設定

`minecraft-health-docker.service`を編集して、実際のコンテナ名を設定：

```bash
nano /home/ubuntu/minecraft-health-docker.service
```

`Environment="DOCKER_CONTAINER_NAME=minecraft"` の部分を、手順1で確認したコンテナ名に変更します。

例：
```ini
Environment="DOCKER_CONTAINER_NAME=bedrock-server"
```

### 8. systemdサービスとして登録

```bash
# サービスファイルを配置
sudo cp /home/ubuntu/minecraft-health-docker.service /etc/systemd/system/

# systemdをリロード
sudo systemctl daemon-reload

# サービスを有効化（自動起動）
sudo systemctl enable minecraft-health-docker.service

# サービスを開始
sudo systemctl start minecraft-health-docker.service

# ステータス確認
sudo systemctl status minecraft-health-docker.service
```

### 9. セキュリティグループの設定

AWS EC2コンソールで、インスタンスのセキュリティグループに以下のインバウンドルールを追加：

- タイプ: カスタムTCP
- ポート範囲: 8080
- ソース: あなたのNext.jsアプリケーションが動作するIPアドレス

### 10. Next.jsアプリケーションの設定

`.env`ファイルに以下を追加：

```bash
MINECRAFT_HEALTH_CHECK_URL=http://YOUR_EC2_HOST:8080/health
```

## トラブルシューティング

### Docker権限エラー

```bash
# エラー: permission denied while trying to connect to the Docker daemon socket
sudo usermod -aG docker ubuntu
newgrp docker

# サービスを再起動
sudo systemctl restart minecraft-health-docker.service
```

### コンテナ名が見つからない

```bash
# デバッグエンドポイントで確認
curl http://localhost:8080/debug

# すべてのコンテナを確認
docker ps -a --format '{{.Names}}'
```

デバッグ出力の`all_containers`セクションで、実際のコンテナ名を確認してください。

### サービスが起動しない

```bash
# ログを確認
sudo journalctl -u minecraft-health-docker.service -n 50

# 手動で実行してエラーを確認
python3.12 /home/ubuntu/minecraft-health-server-docker.py
```

## Docker Composeを使用している場合

Docker Composeでコンテナ名が自動生成される場合：

```bash
# コンテナ名を確認
docker-compose ps

# 例: プロジェクト名が "minecraft" でサービス名が "server" の場合
# コンテナ名は "minecraft_server_1" または "minecraft-server-1" になる
```

serviceファイルで正確なコンテナ名を指定してください。

## 複数のMinecraftコンテナがある場合

特定のコンテナを指定するには、コンテナ名を正確に設定：

```ini
# 例: Bedrock Edition
Environment="DOCKER_CONTAINER_NAME=minecraft-bedrock"

# 例: Java Edition
Environment="DOCKER_CONTAINER_NAME=minecraft-java"
```

## サービス管理コマンド

```bash
# サービスを開始
sudo systemctl start minecraft-health-docker.service

# サービスを停止
sudo systemctl stop minecraft-health-docker.service

# サービスを再起動
sudo systemctl restart minecraft-health-docker.service

# サービスのステータス確認
sudo systemctl status minecraft-health-docker.service

# ログをリアルタイムで表示
sudo journalctl -u minecraft-health-docker.service -f
```

## 動作確認

すべてのセットアップが完了したら：

1. EC2インスタンスを起動
2. Dockerコンテナ（Minecraftサーバー）を起動
3. ヘルスチェックを確認: `curl http://localhost:8080/health`
4. Next.jsアプリのダッシュボードで「マイクラ起動準備中」→「マイクラ起動中」に変わることを確認
