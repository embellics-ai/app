SELECT 
  id,
  tenant_id,
  chat_id,
  agent_id,
  start_timestamp,
  end_timestamp,
  created_at
FROM chat_analytics
ORDER BY created_at DESC
LIMIT 5;
