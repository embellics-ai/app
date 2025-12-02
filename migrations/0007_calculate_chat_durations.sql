-- Calculate duration for existing chat analytics records where duration is null
-- Duration is calculated as the difference between end_timestamp and start_timestamp in seconds

-- Only run if chat_analytics table exists
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_analytics') THEN
        UPDATE chat_analytics
        SET duration = EXTRACT(EPOCH FROM (end_timestamp - start_timestamp))::INTEGER
        WHERE duration IS NULL
          AND start_timestamp IS NOT NULL
          AND end_timestamp IS NOT NULL
          AND end_timestamp > start_timestamp;
        
        GET DIAGNOSTICS updated_count = ROW_COUNT;
        RAISE NOTICE 'Updated % chat analytics records with calculated duration', updated_count;
    ELSE
        RAISE NOTICE 'chat_analytics table does not exist, skipping duration calculation';
    END IF;
END $$;
