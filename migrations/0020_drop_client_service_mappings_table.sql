-- Drop the unused client_service_mappings table
-- We're using externalServiceName and externalServiceClientId columns in clients table instead
DROP TABLE IF EXISTS "client_service_mappings";
