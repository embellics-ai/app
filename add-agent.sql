-- Check if agent exists
SELECT * FROM human_agents WHERE email = 'hisloveforwords@gmail.com';

-- Get user info
SELECT id, tenant_id, email, first_name, last_name FROM client_users WHERE email = 'hisloveforwords@gmail.com';
