# Supabase Database Setup

This directory contains the database schema migrations for the Minecraft Server Control application.

## Setup Instructions

### Option 1: Using Supabase CLI (Recommended)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Apply migrations:
   ```bash
   supabase db push
   ```

### Option 2: Manual Setup via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `migrations/20240222000000_initial_schema.sql`
4. Paste and run the SQL in the editor

## Database Schema

### Tables

#### users
- Stores registered users with their LINE account identifiers
- `line_sub` is unique and indexed for fast lookups
- Tracks creation and last login timestamps

#### sessions
- Stores active user sessions
- Foreign key relationship to users table
- Automatically cleaned up when user is deleted (CASCADE)
- Indexed on user_id and expires_at for efficient queries

#### invitation_codes
- Stores invitation codes for new user registration
- Tracks creation, expiration, and usage
- Indexed on code and expires_at for fast validation

### Security

All tables have Row Level Security (RLS) enabled and are configured to only allow access via the service role key. This ensures that:
- Client-side code cannot directly access the database
- All database operations must go through authenticated API routes
- The principle of least privilege is enforced

## Environment Variables

Make sure to set the following environment variables in your Vercel project:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important**: Never expose the service role key to client-side code. Only use it in API routes and server-side functions.
