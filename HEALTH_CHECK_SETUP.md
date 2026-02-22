# Minecraftヘルスチェックサーバー セットアップ手順

## 概要

EC2インスタンス上でMinecraftサーバーのプロセス監視を行うHTTPヘルスチェックサーバーです。

## 前提条件

- EC2インスタンスへのSSHアクセス
- Python 3.6以上がインストール済み（Python 3.12推奨）
- sudo権限

## セットアップ手順

### 1. ファイルをEC2にアップロード

```bash
# ローカルマシンから実行
scp minecraft-health-server.py ubuntu@YOUR_EC2_HOST:/home/ubuntu/
scp minecraft-health.service ubuntu@YOUR_EC2_HOST:/home/ubuntu/
```

### 2. EC2インスタンスにSSH接続

```bash
ssh ubuntu@YOUR_EC2_HOST
```

### 3. スクリプトに実行権限を付与

```bash
chmod +x /home/ubuntu/minecraft-health-server.py
```

### 4. 動作確認（手動起動）

```bash
# テスト起動
python3 /home/ubuntu/minecraft-health-server.py

# 別のターミナルから確認
curl http://localhost:8080/health
```

期待される結果:
- Minecraftサーバーが起動中: `{"status":"ok","minecraft":"running"}` (HTTP 200)
- Minecraftサーバーが停止中: `{"status":"error","minecraft":"not_running"}` (HTTP 503)

### 5. systemdサービスとして登録

```bash
# サービスファイルを配置
sudo cp /home/ubuntu/minecraft-health.service /etc/systemd/system/

# systemdをリロード
sudo systemctl daemon-reload

# サービスを有効化（自動起動）
sudo systemctl enable minecraft-health.service

# サービスを開始
sudo systemctl start minecraft-health.service

# ステータス確認
sudo systemctl status minecraft-health.service
```

### 6. セキュリティグループの設定

AWS EC2コンソールで、インスタンスのセキュリティグループに以下のインバウンドルールを追加：

- タイプ: カスタムTCP
- ポート範囲: 8080
- ソース: あなたのNext.jsアプリケーションが動作するIPアドレス
  - 開発環境: `0.0.0.0/0` (テスト用、本番では推奨しない)
  - 本番環境: 特定のIPアドレスまたはVPC内のみ

### 7. Next.jsアプリケーションの設定

`.env`ファイルに以下を追加：

```bash
MINECRAFT_HEALTH_CHECK_URL=http://YOUR_EC2_HOST:8080/health
```

例:
```bash
MINECRAFT_HEALTH_CHECK_URL=http://ec2-34-212-65-131.us-west-2.compute.amazonaws.com:8080/health
```

## カスタマイズ

### ポート番号を変更する場合

`/etc/systemd/system/minecraft-health.service`を編集：

```ini
Environment="HEALTH_CHECK_PORT=9090"
```

変更後:
```bash
sudo systemctl daemon-reload
sudo systemctl restart minecraft-health.service
```

### Minecraftプロセス名を変更する場合

Bedrock Edition以外を使用している場合:

```ini
Environment="MINECRAFT_PROCESS_NAME=java"  # Java Edition の場合
```

## トラブルシューティング

### サービスが起動しない

```bash
# ログを確認
sudo journalctl -u minecraft-health.service -n 50

# サービスの詳細ステータス
sudo systemctl status minecraft-health.service
```

### ヘルスチェックが失敗する

```bash
# 手動でプロセスを確認
pgrep -f bedrock_server

# ヘルスチェックを手動実行
curl -v http://localhost:8080/health
```

### ファイアウォールの確認

```bash
# UFWが有効な場合
sudo ufw status
sudo ufw allow 8080/tcp
```

## サービス管理コマンド

```bash
# サービスを開始
sudo systemctl start minecraft-health.service

# サービスを停止
sudo systemctl stop minecraft-health.service

# サービスを再起動
sudo systemctl restart minecraft-health.service

# サービスのステータス確認
sudo systemctl status minecraft-health.service

# ログをリアルタイムで表示
sudo journalctl -u minecraft-health.service -f
```

## セキュリティ考慮事項

1. **ポート8080を外部に公開する場合**
   - 必要最小限のIPアドレスのみ許可する
   - 認証機能の追加を検討する

2. **本番環境では**
   - VPC内部通信のみに制限することを推奨
   - ALB/NLBを経由したヘルスチェックを検討

3. **ログ監視**
   - 定期的にログを確認し、異常なアクセスがないか監視

## 動作確認

すべてのセットアップが完了したら、Next.jsアプリケーションから確認：

1. EC2インスタンスを起動
2. Minecraftサーバーを起動
3. ダッシュボードで「マイクラ起動準備中」→「マイクラ起動中」に変わることを確認

ヘルスチェックは10秒ごとに実行されます。
