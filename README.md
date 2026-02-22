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

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

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
