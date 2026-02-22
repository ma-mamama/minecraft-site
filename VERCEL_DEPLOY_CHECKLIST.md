# Vercelデプロイチェックリスト

## ✅ 完了した準備

- [x] コードのビルド確認（`npm run build`）
- [x] GitHubへのプッシュ
- [x] ヘルスチェック認証トークン機能の実装

## 📋 Vercelデプロイ手順

### 1. Vercelにプロジェクトをインポート

1. [Vercel Dashboard](https://vercel.com/dashboard) にアクセス
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリ `minecraft-site` を選択
4. 「Import」をクリック

### 2. プロジェクト設定（自動検出されます）

- Framework Preset: Next.js
- Root Directory: `./`
- Build Command: `npm run build`
- Output Directory: `.next`

そのまま「Deploy」は押さず、先に環境変数を設定します。

### 3. 環境変数の設定

「Environment Variables」セクションで以下を設定：

#### 必須の環境変数

```bash
# LINE Login Configuration
LINE_CHANNEL_ID=（LINE Developersから取得）
LINE_CHANNEL_SECRET=（LINE Developersから取得）
LINE_CALLBACK_URL=https://your-app.vercel.app/auth/callback

# Public LINE Configuration
NEXT_PUBLIC_LINE_CHANNEL_ID=（LINE_CHANNEL_IDと同じ）
NEXT_PUBLIC_LINE_CALLBACK_URL=https://your-app.vercel.app/auth/callback

# Supabase Configuration
SUPABASE_URL=（Supabaseプロジェクトから取得）
SUPABASE_SERVICE_ROLE_KEY=（Supabaseプロジェクトから取得）

# AWS Configuration
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=（AWSから取得）
AWS_SECRET_ACCESS_KEY=（AWSから取得）
AWS_EC2_INSTANCE_ID=（EC2インスタンスID）

# Minecraft Server Configuration
MINECRAFT_SERVER_HOST=（EC2のパブリックDNS）
MINECRAFT_SERVER_PORT=19132
MINECRAFT_HEALTH_CHECK_URL=http://（EC2のパブリックDNS）:8080/health
MINECRAFT_STARTUP_DELAY_SECONDS=180

# Health Check Token（重要！）
HEALTH_CHECK_TOKEN=（後で生成します）

# Session Configuration
SESSION_SECRET=（後で生成します）
SESSION_EXPIRY_DAYS=7

# Application Configuration
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Security Configuration
ALLOWED_ORIGINS=https://your-app.vercel.app

# Rate Limiting Configuration
RATE_LIMIT_AUTH_MAX_REQUESTS=10
RATE_LIMIT_AUTH_WINDOW_SECONDS=60
RATE_LIMIT_API_MAX_REQUESTS=100
RATE_LIMIT_API_WINDOW_SECONDS=60
```

### 4. セキュリティトークンの生成

ローカルで以下のコマンドを実行してトークンを生成：

```bash
# SESSION_SECRET用
openssl rand -hex 32

# HEALTH_CHECK_TOKEN用
openssl rand -hex 32
```

生成された文字列をVercelの環境変数に設定してください。

### 5. デプロイ実行

「Deploy」ボタンをクリックしてデプロイを開始します。

### 6. デプロイ後の設定

#### 6.1 VercelのURLを確認

デプロイが完了したら、VercelのダッシュボードでURLを確認します。
例: `https://minecraft-site-xxx.vercel.app`

#### 6.2 環境変数のURLを更新

Vercelの「Settings」→「Environment Variables」で以下を更新：

```bash
LINE_CALLBACK_URL=https://（実際のVercel URL）/auth/callback
NEXT_PUBLIC_LINE_CALLBACK_URL=https://（実際のVercel URL）/auth/callback
NEXT_PUBLIC_APP_URL=https://（実際のVercel URL）
ALLOWED_ORIGINS=https://（実際のVercel URL）
```

更新後、「Redeploy」をクリックして再デプロイします。

#### 6.3 LINE Developersの設定を更新

1. [LINE Developers Console](https://developers.line.biz/console/) にアクセス
2. チャネルを選択
3. 「LINE Login」→「LINE Login settings」
4. Callback URLを更新：
   ```
   https://（実際のVercel URL）/auth/callback
   ```

### 7. EC2側のヘルスチェックサーバー設定

#### 7.1 ヘルスチェックサーバーをEC2にアップロード

```bash
# ローカルから実行
scp minecraft-health-server.py ubuntu@（EC2ホスト）:/home/ubuntu/
```

#### 7.2 EC2にSSH接続して設定

```bash
ssh ubuntu@（EC2ホスト）

# 実行権限を付与
chmod +x /home/ubuntu/minecraft-health-server.py

# serviceファイルを編集
sudo nano /etc/systemd/system/minecraft-health.service
```

以下の内容に更新（HEALTH_CHECK_TOKENを追加）：

```ini
[Unit]
Description=Minecraft Server Health Check HTTP Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu
ExecStart=/usr/bin/python3 /home/ubuntu/minecraft-health-server.py
Restart=always
RestartSec=10
Environment="HEALTH_CHECK_PORT=8080"
Environment="MINECRAFT_PROCESS_NAME=bedrock_server"
Environment="HEALTH_CHECK_TOKEN=（Vercelと同じトークン）"

[Install]
WantedBy=multi-user.target
```

#### 7.3 サービスを再起動

```bash
sudo systemctl daemon-reload
sudo systemctl restart minecraft-health.service
sudo systemctl status minecraft-health.service
```

#### 7.4 動作確認

```bash
# トークンなし（失敗するはず）
curl http://localhost:8080/health

# トークンあり（成功するはず）
curl -H "Authorization: Bearer （トークン）" http://localhost:8080/health
```

### 8. セキュリティグループの設定

AWS EC2コンソールで、セキュリティグループに以下を追加：

- タイプ: カスタムTCP
- ポート範囲: 8080
- ソース: `0.0.0.0/0`
- 説明: Health check endpoint with token authentication

### 9. 動作確認

1. Vercelのデプロイ完了を確認
2. VercelのURLにアクセス
3. LINE Loginが動作するか確認
4. ダッシュボードでサーバーステータスが表示されるか確認
5. サーバーの起動/停止が動作するか確認

## 🔍 トラブルシューティング

### ビルドエラー

```bash
# ローカルでビルドをテスト
npm run build
```

### 環境変数エラー

- Vercelの環境変数設定を再確認
- スペルミスがないか確認
- 必須の環境変数がすべて設定されているか確認

### LINE Loginエラー

- LINE DevelopersのCallback URLが正しいか確認
- `LINE_CALLBACK_URL`と`NEXT_PUBLIC_LINE_CALLBACK_URL`が一致しているか確認

### ヘルスチェックエラー

- EC2のヘルスチェックサーバーが起動しているか確認
- トークンがVercelとEC2で一致しているか確認
- セキュリティグループで8080が開放されているか確認

## 📚 参考ドキュメント

- [DEPLOYMENT.md](./DEPLOYMENT.md) - 詳細なデプロイガイド
- [VERCEL_HEALTH_CHECK_SECURITY.md](./VERCEL_HEALTH_CHECK_SECURITY.md) - セキュリティ設定
- [HEALTH_CHECK_SETUP.md](./HEALTH_CHECK_SETUP.md) - ヘルスチェックサーバーのセットアップ

## ✅ デプロイ完了後のチェックリスト

- [ ] Vercelデプロイが成功
- [ ] LINE Loginが動作
- [ ] サーバーステータスが表示される
- [ ] サーバーの起動/停止が動作
- [ ] ヘルスチェックが正常に動作
- [ ] セキュリティヘッダーが設定されている
- [ ] 環境変数がすべて設定されている
