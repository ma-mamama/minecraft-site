# Minecraft Server Control

A web application for controlling a Minecraft server running on AWS EC2 with LINE authentication.

## Features

- LINE Login authentication
- Invitation-code based user registration
- One-tap server start/stop controls
- Real-time server status monitoring
- Secure session management

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase PostgreSQL
- **Authentication**: LINE Login (OpenID Connect)
- **Cloud**: AWS EC2, Vercel

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- LINE Developer account
- Supabase account
- AWS account with EC2 instance

詳細なローカル開発環境のセットアップ手順は [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) を参照してください。

### Quick Start

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. ローカル開発用の環境変数を設定：

```bash
# ローカル開発用（開発モード有効）
cp .env.local.example .env.local

# または本番環境と同じ設定でテスト
cp .env.example .env
```

4. `.env.local`または`.env`ファイルに必要な認証情報を入力

5. 開発サーバーを起動：

```bash
npm run dev
```

6. ブラウザで [http://localhost:3000](http://localhost:3000) を開く

### 開発モード（ローカルテスト用）

ローカル環境でLINE認証とSupabaseなしでテストする場合は、`.env.local`ファイルを使用します：

**セットアップ手順:**

1. `.env.local.example`を`.env.local`にコピー（既に存在する場合はスキップ）：
```bash
cp .env.local.example .env.local
```

2. `.env.local`で開発モードを有効化（デフォルトで有効）：
```bash
DEV_MODE_SKIP_AUTH=true
```

3. 開発サーバーを起動：
```bash
npm run dev
```

4. ログインページに「🔧 開発モードでログイン」ボタンが表示されます

**開発モードの特徴:**
- LINE認証が不要（認証をスキップ）
- Supabase設定が不要（インメモリストレージを使用）
- データベース接続不要（すべてメモリ内で管理）
- サーバー再起動でデータはリセットされます

**環境ファイルの優先順位:**
- `.env.local` > `.env` の順で読み込まれます
- `.env.local`はGitにコミットされないため、個人の開発環境設定に最適です
- `.env`は本番環境の設定テンプレートとして使用できます

**⚠️ セキュリティ上の注意:**
- 開発モードは`NODE_ENV=production`では**絶対に**有効になりません
- `.env.local`はGitにコミットされません（`.gitignore`で除外済み）
- 本番環境では`DEV_MODE_SKIP_AUTH`を設定しないか、`false`に設定してください

## Environment Variables

See `.env.example` for all required environment variables.

For detailed security configuration, see [docs/SECURITY.md](docs/SECURITY.md).

## Security Features

This application implements comprehensive security measures:

- **Authentication**: LINE Login with ID token verification
- **Authorization**: Invitation-code based whitelist system
- **Session Management**: Secure HttpOnly cookies with SameSite protection
- **Rate Limiting**: Protection against brute force and DoS attacks
- **Input Validation**: Zod schemas and sanitization for all inputs
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **Least Privilege**: AWS IAM with minimal required permissions
- **Database Security**: Row Level Security and server-side only access

For complete security setup instructions, see [docs/SECURITY.md](docs/SECURITY.md).

## Project Structure

```
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/          # React components
├── lib/                 # Utility functions and services
├── types/               # TypeScript type definitions
└── .env.example         # Environment variables template
```

## Development

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run tests
```

## Deployment

This application is designed to be deployed on Vercel. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/あなたのユーザー名/リポジトリ名)

After deployment, make sure to:
1. Configure all environment variables in Vercel Dashboard
2. Update LINE Login callback URL in LINE Developers Console
3. Verify security headers are properly set

## License

ISC
