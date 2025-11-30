-- Calculate duration for existing voice analytics records where duration is null
-- Duration is calculated as the difference between end_timestamp and start_timestamp in seconds

UPDATE voice_analytics
SET duration = EXTRACT(EPOCH FROM (end_timestamp - start_timestamp))::INTEGER
WHERE duration IS NULL
  AND start_timestamp IS NOT NULL
  AND end_timestamp IS NOT NULL
  AND end_timestamp > start_timestamp;

-- Log how many records were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % voice analytics records with calculated duration', updated_count;
END $$;
