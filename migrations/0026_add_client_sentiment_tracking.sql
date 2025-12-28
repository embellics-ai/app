-- Migration: Add Client Sentiment Tracking
-- Adds sentiment score, category, and trend to clients table
-- Creates client_sentiment_history table for tracking changes over time
-- Date: 2025-12-28

-- ============================================
-- ADD SENTIMENT FIELDS TO CLIENTS TABLE
-- ============================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment_score INTEGER DEFAULT 50;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment_category TEXT DEFAULT 'active';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment_trend TEXT DEFAULT 'stable';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sentiment_updated_at TIMESTAMP DEFAULT NOW();

-- Add check constraint for sentiment score (0-100)
ALTER TABLE clients ADD CONSTRAINT clients_sentiment_score_check 
  CHECK (sentiment_score >= 0 AND sentiment_score <= 100);

-- Add check constraint for sentiment category
ALTER TABLE clients ADD CONSTRAINT clients_sentiment_category_check 
  CHECK (sentiment_category IN ('champion', 'loyal', 'active', 'casual', 'inactive'));

-- Add check constraint for sentiment trend
ALTER TABLE clients ADD CONSTRAINT clients_sentiment_trend_check 
  CHECK (sentiment_trend IN ('improving', 'stable', 'declining'));

-- Create index for filtering by sentiment
CREATE INDEX IF NOT EXISTS idx_clients_sentiment_category ON clients(tenant_id, sentiment_category);
CREATE INDEX IF NOT EXISTS idx_clients_sentiment_score ON clients(tenant_id, sentiment_score DESC);

-- ============================================
-- CREATE CLIENT SENTIMENT HISTORY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS client_sentiment_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Sentiment data at this point in time
  sentiment_score INTEGER NOT NULL,
  sentiment_category TEXT NOT NULL,
  
  -- What triggered this calculation
  trigger_event TEXT NOT NULL, -- 'booking_created', 'booking_cancelled', 'booking_completed', 'manual_recalc'
  trigger_booking_id VARCHAR, -- Reference to the booking that triggered this (if applicable)
  
  -- Metrics snapshot at time of calculation
  total_bookings INTEGER,
  cancelled_bookings INTEGER,
  no_show_bookings INTEGER,
  total_spent DECIMAL(10, 2),
  avg_booking_value DECIMAL(10, 2),
  days_since_last_booking INTEGER,
  
  -- Timestamp
  recorded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT client_sentiment_history_score_check 
    CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  CONSTRAINT client_sentiment_history_category_check 
    CHECK (sentiment_category IN ('champion', 'loyal', 'active', 'casual', 'inactive'))
);

-- Indexes for client_sentiment_history
CREATE INDEX IF NOT EXISTS idx_sentiment_history_client ON client_sentiment_history(client_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_trigger ON client_sentiment_history(trigger_event, recorded_at DESC);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN clients.sentiment_score IS 'Customer sentiment score (0-100) based on booking behavior, spend, and reliability';
COMMENT ON COLUMN clients.sentiment_category IS 'Sentiment category: champion, loyal, active, casual, inactive';
COMMENT ON COLUMN clients.sentiment_trend IS 'Sentiment trend: improving, stable, declining';
COMMENT ON COLUMN clients.sentiment_updated_at IS 'Last time sentiment was calculated';

COMMENT ON TABLE client_sentiment_history IS 'Historical record of client sentiment scores over time';
COMMENT ON COLUMN client_sentiment_history.trigger_event IS 'Event that triggered sentiment recalculation';
COMMENT ON COLUMN client_sentiment_history.recorded_at IS 'When this sentiment snapshot was recorded';
