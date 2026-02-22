# セキュリティ設定ガイド

このドキュメントでは、Minecraft Server Controlアプリケーションのセキュリティ設定について説明します。

## 目次

1. [環境変数の設定](#環境変数の設定)
2. [Supabaseのセキュリティ設定](#supabaseのセキュリティ設定)
3. [AWSのセキュリティ設定](#awsのセキュリティ設定)
4. [レート制限](#レート制限)
5. [セキュリティヘッダー](#セキュリティヘッダー)
6. [入力検証とサニタイゼーション](#入力検証とサニタイゼーション)

## 環境変数の設定

### Vercelでの環境変数設定

**要件: 7.4, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4**

1. Vercelダッシュボードにログイン
2. プロジェクトを選択
3. Settings > Environment Variables に移動
4. 以下の環境変数を設定：

#### 必須の環境変数

```bash
# LINE認証
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_CALLBACK_URL=https://yourdomain.com/api/auth/line/callback

# Supabase（サーバーサイドのみ）
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AWS認証情報（最小権限）
AWS_REGION=ap-northeast-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_EC2_INSTANCE_ID=i-xxxxxxxxxxxxxxxxx

# セッション管理
SESSION_SECRET=your_random_session_secret_min_32_chars
SESSION_EXPIRY_DAYS=7

# アプリケーション設定
NEXT_PUBLIC_APP_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### セキュリティのベストプラクティス

- **シークレットの生成**: `SESSION_SECRET`は最低32文字のランダムな文字列を使用
  ```bash
  openssl rand -base64 32
  ```
- **環境ごとの分離**: 開発、ステージング、本番環境で異なる認証情報を使用
- **定期的なローテーション**: 認証情報を定期的に更新（推奨：90日ごと）
- **アクセス制限**: Vercelプロジェクトへのアクセスを必要最小限のメンバーに制限

## Supabaseのセキュリティ設定

**要件: 8.1, 8.2**

### 1. 匿名アクセスの無効化

1. Supabaseダッシュボードにログイン
2. Authentication > Settings に移動
3. "Enable anonymous sign-ins" を **OFF** に設定

### 2. Row Level Security (RLS) の有効化

すべてのテーブルでRLSを有効化し、適切なポリシーを設定：

```sql
-- usersテーブル
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- sessionsテーブル
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

-- invitation_codesテーブル
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access invitation codes"
  ON invitation_codes FOR ALL
  USING (false);
```

### 3. APIキーの管理

- **anon key**: クライアントサイドでは使用しない
- **service_role key**: サーバーサイドのみで使用、環境変数に保存
- **公開しない**: GitHubなどのバージョン管理システムにコミットしない

## AWSのセキュリティ設定

**要件: 9.1, 9.2, 9.3, 9.4**

### 1. IAMユーザーの作成

最小権限の原則に従ったIAMポリシーを作成：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "MinecraftServerControl",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances"
      ],
      "Resource": "arn:aws:ec2:ap-northeast-1:123456789012:instance/i-xxxxxxxxxxxxxxxxx",
      "Condition": {
        "StringEquals": {
          "ec2:ResourceTag/Application": "MinecraftServer"
        }
      }
    }
  ]
}
```

### 2. IAMユーザーの設定手順

1. AWS IAM コンソールにログイン
2. Users > Add users
3. ユーザー名: `minecraft-server-control`
4. Access type: Programmatic access
5. 上記のポリシーをアタッチ
6. アクセスキーとシークレットキーを安全に保存

### 3. EC2インスタンスの設定

- インスタンスに `Application: MinecraftServer` タグを追加
- セキュリティグループで必要なポートのみ開放
- CloudTrailでAPI呼び出しをログ記録

### 4. 認証情報の保護

- アクセスキーをコードにハードコーディングしない
- 環境変数またはシークレット管理サービスを使用
- 定期的にキーをローテーション

## レート制限

**要件: 7.4, 8.1**

### 実装されているレート制限

#### 認証エンドポイント
- **制限**: 10リクエスト/分/IP
- **対象**: `/api/auth/line/callback`
- **目的**: ブルートフォース攻撃の防止

#### 一般APIエンドポイント
- **制限**: 100リクエスト/分/IP（設定可能）
- **対象**: すべてのAPIルート
- **目的**: DoS攻撃の防止

### レート制限の設定

環境変数で調整可能：

```bash
RATE_LIMIT_AUTH_MAX_REQUESTS=10
RATE_LIMIT_AUTH_WINDOW_SECONDS=60
RATE_LIMIT_API_MAX_REQUESTS=100
RATE_LIMIT_API_WINDOW_SECONDS=60
```

### レート制限の監視

レート制限に達した場合、以下のレスポンスが返されます：

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later."
  }
}
```

レスポンスヘッダー：
- `X-RateLimit-Remaining`: 残りリクエスト数
- `X-RateLimit-Reset`: リセットまでの秒数
- `Retry-After`: 再試行までの秒数

## セキュリティヘッダー

**要件: 8.3**

### 実装されているヘッダー

#### Content Security Policy (CSP)
```
default-src 'self';
script-src 'self' 'unsafe-eval' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https://access.line.me https://*.supabase.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

#### その他のセキュリティヘッダー
- `X-Frame-Options: DENY` - クリックジャッキング防止
- `X-Content-Type-Options: nosniff` - MIMEタイプスニッフィング防止
- `X-XSS-Protection: 1; mode=block` - XSS保護
- `Referrer-Policy: strict-origin-when-cross-origin` - リファラー制御
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` - HTTPS強制

#### CORS設定
- `Access-Control-Allow-Origin`: 設定されたドメインのみ許可
- `Access-Control-Allow-Credentials: true` - 認証情報を含むリクエストを許可
- `Access-Control-Allow-Methods: GET, POST, OPTIONS` - 許可されたHTTPメソッド

### ヘッダーの検証

デプロイ後、以下のコマンドでヘッダーを確認：

```bash
curl -I https://yourdomain.com
```

## 入力検証とサニタイゼーション

**要件: 8.4**

### 実装されている検証

#### 1. スキーマ検証（Zod）
すべてのAPIエンドポイントで入力スキーマを定義：

```typescript
const schema = z.object({
  code: z.string().min(1, 'Code is required'),
  invitationCode: z.string().optional(),
});
```

#### 2. 入力サニタイゼーション
- 制御文字の除去
- ホワイトスペースの正規化
- 長さ制限の適用
- 危険な文字パターンの検出

#### 3. SQLインジェクション対策
- パラメータ化クエリの使用（Supabase経由）
- 入力値の検証
- エスケープ処理

### サニタイゼーション関数

```typescript
import { sanitizeString, sanitizeAlphanumeric } from '@/lib/utils/sanitize';

// 一般的な文字列のサニタイゼーション
const clean = sanitizeString(userInput);

// 英数字のみ許可
const code = sanitizeAlphanumeric(invitationCode);
```

## セキュリティチェックリスト

デプロイ前に以下を確認：

### 環境変数
- [ ] すべての必須環境変数が設定されている
- [ ] シークレットが十分にランダムで強力
- [ ] 本番環境の認証情報が開発環境と異なる
- [ ] 環境変数がバージョン管理にコミットされていない

### Supabase
- [ ] 匿名アクセスが無効化されている
- [ ] Row Level Securityが有効化されている
- [ ] 適切なRLSポリシーが設定されている
- [ ] service_role keyがサーバーサイドのみで使用されている

### AWS
- [ ] IAMユーザーが最小権限で作成されている
- [ ] EC2インスタンスIDが正しく設定されている
- [ ] CloudTrailが有効化されている
- [ ] アクセスキーが安全に保管されている

### アプリケーション
- [ ] レート制限が有効化されている
- [ ] セキュリティヘッダーが設定されている
- [ ] 入力検証が実装されている
- [ ] エラーメッセージが内部情報を漏らさない
- [ ] HTTPSが有効化されている（本番環境）

## インシデント対応

セキュリティインシデントが発生した場合：

1. **即座の対応**
   - 影響を受けた認証情報をローテーション
   - 疑わしいセッションを無効化
   - アクセスログを確認

2. **調査**
   - Vercelのログを確認
   - Supabaseの監査ログを確認
   - AWS CloudTrailを確認

3. **復旧**
   - 脆弱性を修正
   - セキュリティパッチを適用
   - 影響を受けたユーザーに通知

4. **事後対応**
   - インシデントレポートを作成
   - セキュリティ対策を強化
   - 再発防止策を実施

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
