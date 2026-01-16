-- Add plan_type column to subscriptions table to support free tier
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_type TEXT NOT NULL DEFAULT 'pro';

-- Add vehicle_limit column based on plan
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS vehicle_limit INTEGER NOT NULL DEFAULT 999;

-- Create index for plan_type
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_type ON subscriptions(plan_type);

-- Comment: plan_type can be 'free' (1 vehicle) or 'pro' (unlimited)
-- For free tier: status='active', plan_type='free', vehicle_limit=1
-- For pro tier: status='active' or 'trialing', plan_type='pro', vehicle_limit=999
