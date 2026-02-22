-- Create operation_locks table for concurrency control
-- Requirements: 4.5, 5.5, 10.1, 10.2, 10.3
CREATE TABLE operation_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lock_id VARCHAR(255) UNIQUE NOT NULL,
  operation_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for performance on lock queries
CREATE INDEX idx_operation_locks_operation_type ON operation_locks(operation_type);
CREATE INDEX idx_operation_locks_expires_at ON operation_locks(expires_at);

-- Enable Row Level Security
ALTER TABLE operation_locks ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policy
-- Only allow service role to manage operation locks (no direct client access)
CREATE POLICY "Service role can manage operation locks"
  ON operation_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
