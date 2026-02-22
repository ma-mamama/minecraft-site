# ローカル開発環境のセットアップ

このドキュメントでは、ローカル環境でMinecraft Server Controlアプリケーションを開発する方法を説明します。

## 前提条件

- Node.js 18以上
- npm
- Supabaseアカウント（データベース用）
- （オプション）AWSアカウント（EC2操作をテストする場合）

## セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd mc_bedrock_site
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. 環境変数の設定

ローカル開発用の環境ファイルを作成します：

```bash
cp .env.local.example .env.local
```

`.env.local`ファイルには最小限の設定のみが必要です：

```bash
# 開発モード（デフォルトで有効）
DEV_MODE_SKIP_AUTH=true
DEV_MODE_TEST_USER_LINE_SUB=dev_test_user_12345

# セッション設定
SESSION_SECRET=local_dev_secret_at_least_32_characters_long
SESSION_EXPIRY_DAYS=7

# アプリケーションURL
NEXT_PUBLIC_APP_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000
```

**重要:** 開発モード(`DEV_MODE_SKIP_AUTH=true`)では、以下は不要です：
- Supabase設定（インメモリストレージを使用）
- LINE認証設定（認証をスキップ）
- AWS設定（UI確認のみの場合）

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

## 開発モードの仕組み

開発モード(`DEV_MODE_SKIP_AUTH=true`)が有効な場合：

1. **認証のスキップ**: LINE認証が不要になり、「開発モードでログイン」ボタンが表示されます
2. **インメモリストレージ**: Supabaseの代わりにメモリ内でユーザーとセッションを管理
3. **テストユーザー**: 自動的にテストユーザーが作成されます
4. **データベース不要**: 外部データベースへの接続が不要

### データの永続性について

開発モードでは、すべてのデータはメモリ内に保存されます：
- サーバーを再起動するとデータは消去されます
- テストユーザーは初回アクセス時に自動作成されます
- セッションもメモリ内で管理されます

## 実際のサービスを使用したテスト

開発モードを無効にして、実際のLINE認証やSupabaseを使用することもできます。

### Supabaseを使用する場合

1. `.env.local`で開発モードを無効化：
```bash
DEV_MODE_SKIP_AUTH=false
```

2. Supabase設定を追加：
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. データベースのセットアップ：

```bash
# Supabase CLIをインストール
npm install -g supabase

# ログイン
supabase login

# プロジェクトにリンク
supabase link --project-ref your-project-ref

# マイグレーションを実行
supabase db push
```

### LINE認証を使用する場合

1. LINE Developers Consoleでチャネルを作成
2. コールバックURLに`http://localhost:3000/auth/callback`を追加
3. `.env.local`に設定を追加：

```bash
# 開発モードを無効化
DEV_MODE_SKIP_AUTH=false

# LINE認証設定
LINE_CHANNEL_ID=your_channel_id
LINE_CHANNEL_SECRET=your_channel_secret
LINE_CALLBACK_URL=http://localhost:3000/auth/callback

NEXT_PUBLIC_LINE_CHANNEL_ID=your_channel_id
NEXT_PUBLIC_LINE_CALLBACK_URL=http://localhost:3000/auth/callback

# Supabase設定も必要
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## AWS EC2操作のテスト

実際のEC2インスタンスを操作する場合：

1. IAMユーザーを作成し、必要な権限を付与（`docs/SECURITY.md`参照）
2. `.env.local`に認証情報を追加：

```bash
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_EC2_INSTANCE_ID=i-xxxxxxxxxxxxxxxxx
```

EC2操作をテストしない場合は、ダミー値を設定しても動作確認は可能です。

## テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモードでテスト
npm run test:watch
```

## よくある問題

### 開発モードボタンが表示されない

- `.env.local`で`DEV_MODE_SKIP_AUTH=true`が設定されているか確認
- 開発サーバーを再起動してみる
- ブラウザのキャッシュをクリア

### 「Missing environment variable: SUPABASE_URL」エラー

- `.env.local`で`DEV_MODE_SKIP_AUTH=true`が設定されているか確認
- 開発モードが有効な場合、Supabase設定は不要です
- 開発モードを無効にする場合は、Supabase設定を追加してください

### セッションエラー

- `SESSION_SECRET`が32文字以上あるか確認
- ブラウザのCookieをクリア

## 環境ファイルの優先順位

Next.jsは以下の順序で環境ファイルを読み込みます（後のものが優先）：

1. `.env` - すべての環境で読み込まれる
2. `.env.local` - すべての環境で読み込まれる（Gitにコミットされない）
3. `.env.development` - 開発環境のみ
4. `.env.development.local` - 開発環境のみ（Gitにコミットされない）

ローカル開発では`.env.local`を使用することを推奨します。

## セキュリティに関する注意

- `.env.local`はGitにコミットされません（`.gitignore`で除外済み）
- 本番環境の認証情報をローカル環境ファイルに含めないでください
- 開発モードは`NODE_ENV=production`では自動的に無効化されます
- テスト用のAWS認証情報は最小限の権限のみを付与してください

## 次のステップ

- [セキュリティガイド](SECURITY.md)を確認
- [デプロイメントガイド](../DEPLOYMENT.md)を確認
- [UIデザインガイド](UI_DESIGN.md)を確認
