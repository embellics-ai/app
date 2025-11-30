-- Update all widget configurations to use simple "Hi" greeting
UPDATE widget_configs 
SET greeting = 'Hi' 
WHERE greeting = 'Hi! How can I help you today?';
