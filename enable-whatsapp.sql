-- Enable WhatsApp for SWC tenant
-- Run this in DBeaver or your PostgreSQL client

-- First, check if tenant_integrations exists for this tenant
SELECT * FROM tenant_integrations WHERE tenant_id = 'c607afcf-e20b-462d-8e2c-3561c9e6bbb3';

-- If no record exists, create one
INSERT INTO tenant_integrations (
  tenant_id,
  whatsapp_enabled,
  whatsapp_config
)
VALUES (
  'c607afcf-e20b-462d-8e2c-3561c9e6bbb3',
  true,
  '{"phoneNumber": "+1234567890", "phoneNumberId": "test123", "businessAccountId": "test456", "accessToken": "test_token", "webhookVerifyToken": "test_verify"}'::jsonb
)
ON CONFLICT (tenant_id) 
DO UPDATE SET
  whatsapp_enabled = true,
  whatsapp_config = '{"phoneNumber": "+1234567890", "phoneNumberId": "test123", "businessAccountId": "test456", "accessToken": "test_token", "webhookVerifyToken": "test_verify"}'::jsonb,
  updated_at = NOW();

-- Verify the update
SELECT 
  id,
  tenant_id,
  whatsapp_enabled,
  whatsapp_config,
  updated_at
FROM tenant_integrations 
WHERE tenant_id = 'c607afcf-e20b-462d-8e2c-3561c9e6bbb3';
