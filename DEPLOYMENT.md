# Vercelデプロイガイド

このガイドでは、Minecraft Server ControlアプリケーションをVercelにデプロイする手順を説明します。

## 前提条件

- GitHubアカウント
- Vercelアカウント（GitHubアカウントで連携可能）
- 設定済みのSupabaseプロジェクト
- 設定済みのAWS EC2インスタンス
- LINE Developersアカウントとチャネル

## デプロイ手順

### 1. GitHubにリポジトリをプッシュ

```bash
# Gitリポジトリを初期化（まだの場合）
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: Minecraft Server Control application"

# GitHubでリポジトリを作成後、リモートを追加
git remote add origin https://github.com/あなたのユーザー名/リポジトリ名.git

# メインブランチにプッシュ
git branch -M main
git push -u origin main
```

### 2. Vercelでプロジェクトをインポート

1. [Vercel Dashboard](https://vercel.com/dashboard)にアクセス
2. 「Add New...」→「Project」をクリック
3. GitHubリポジトリを選択してインポート
4. プロジェクト設定：
   - Framework Preset: Next.js（自動検出されます）
   - Root Directory: `./`（デフォルト）
   - Build Command: `npm run build`（デフォルト）
   - Output Directory: `.next`（デフォルト）

### 3. 環境変数の設定

Vercelのプロジェクト設定で、以下の環境変数を設定します：

#### 必須の環境変数

```bash
# LINE Login Configuration
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CALLBACK_URL=https://your-app.vercel.app/auth/callback

# Public LINE Configuration
NEXT_PUBLIC_LINE_CHANNEL_ID=your_line_channel_id
NEXT_PUBLIC_LINE_CALLBACK_URL=https://your-app.vercel.app/auth/callback

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AWS Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_EC2_INSTANCE_ID=your_ec2_instance_id

# Minecraft Server Configuration
MINECRAFT_SERVER_HOST=your-ec2-public-dns.compute.amazonaws.com
MINECRAFT_SERVER_PORT=19132
MINECRAFT_HEALTH_CHECK_URL=http://your-ec2-public-dns.compute.amazonaws.com:8080/health
MINECRAFT_STARTUP_DELAY_SECONDS=180

# Session Configuration
SESSION_SECRET=your_random_session_secret_min_32_chars_長いランダム文字列を生成してください
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

### 4. LINE Developersの設定を更新

1. [LINE Developers Console](https://developers.line.biz/console/)にアクセス
2. あなたのチャネルを選択
3. "LINE Login" → "LINE Login settings"
4. Callback URLを更新：
   ```
   https://your-app.vercel.app/auth/callback
   ```

### 5. デプロイ

「Deploy」ボタンをクリックしてデプロイを開始します。

デプロイが完了すると、Vercelが自動的にURLを生成します（例：`https://your-app.vercel.app`）。

## デプロイ後の確認

### 1. 動作確認

1. デプロイされたURLにアクセス
2. LINE Loginが正常に動作するか確認
3. サーバーステータスが表示されるか確認
4. サーバーの起動/停止が正常に動作するか確認

### 2. セキュリティ確認

```bash
# セキュリティヘッダーの確認
curl -I https://your-app.vercel.app

# 以下のヘッダーが含まれていることを確認：
# - Content-Security-Policy
# - X-Frame-Options: DENY
# - X-Content-Type-Options: nosniff
# - Strict-Transport-Security
```

### 3. ログの確認

Vercel Dashboardの「Logs」タブでアプリケーションログを確認できます。

## トラブルシューティング

### ビルドエラー

```bash
# ローカルでビルドをテスト
npm run build

# TypeScriptエラーがないか確認
npm run lint
```

### 環境変数エラー

- Vercelの環境変数設定を再確認
- 環境変数名のスペルミスがないか確認
- 必須の環境変数がすべて設定されているか確認

### LINE Loginエラー

- LINE DevelopersのCallback URLが正しく設定されているか確認
- `LINE_CALLBACK_URL`と`NEXT_PUBLIC_LINE_CALLBACK_URL`が一致しているか確認
- HTTPSを使用しているか確認（Vercelは自動的にHTTPSを提供）

### AWS接続エラー

- AWS認証情報が正しいか確認
- IAMユーザーに必要な権限があるか確認
- EC2インスタンスIDが正しいか確認
- リージョンが正しいか確認

## 継続的デプロイ

GitHubリポジトリにプッシュすると、Vercelが自動的に以下を実行します：

- **mainブランチ**: 本番環境に自動デプロイ
- **その他のブランチ**: プレビュー環境を自動生成

## カスタムドメインの設定（オプション）

1. Vercel Dashboard →「Settings」→「Domains」
2. カスタムドメインを追加
3. DNSレコードを設定（Vercelが指示を表示）
4. 環境変数を更新：
   ```bash
   NEXT_PUBLIC_APP_URL=https://your-custom-domain.com
   ALLOWED_ORIGINS=https://your-custom-domain.com
   LINE_CALLBACK_URL=https://your-custom-domain.com/auth/callback
   NEXT_PUBLIC_LINE_CALLBACK_URL=https://your-custom-domain.com/auth/callback
   ```
5. LINE DevelopersのCallback URLも更新

## セキュリティのベストプラクティス

1. **環境変数の管理**
   - 本番環境とプレビュー環境で異なる環境変数を使用
   - 機密情報は絶対にGitHubにコミットしない

2. **アクセス制御**
   - Vercelプロジェクトへのアクセスを制限
   - 必要な人だけに環境変数へのアクセスを許可

3. **監視**
   - Vercel Analyticsを有効化
   - エラーログを定期的に確認

4. **更新**
   - 依存関係を定期的に更新
   - セキュリティアップデートを適用

## 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [LINE Login Documentation](https://developers.line.biz/ja/docs/line-login/)
- [Supabase Documentation](https://supabase.com/docs)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
