variable "vercel_token" { description = "Vercel API token" type = string sensitive = true }
variable "database_url" { description = "Database connection string" type = string sensitive = true }
variable "pgdatabase" { description = "Postgres database name" type = string sensitive = true }
variable "pghost" { description = "Postgres host" type = string sensitive = true }
variable "pgport" { description = "Postgres port" type = string sensitive = true }
variable "pguser" { description = "Postgres user" type = string sensitive = true }
variable "pgpassword" { description = "Postgres password" type = string sensitive = true }
variable "port" { description = "App port" type = string sensitive = true }
variable "app_url" { description = "App URL" type = string sensitive = true }
variable "ai_integrations_openai_base_url" { description = "OpenAI base URL" type = string sensitive = true }
variable "ai_integrations_openai_api_key" { description = "OpenAI API key" type = string sensitive = true }
variable "smtp_host" { description = "SMTP host" type = string sensitive = true }
variable "smtp_port" { description = "SMTP port" type = string sensitive = true }
variable "smtp_secure" { description = "SMTP secure flag" type = string sensitive = true }
variable "smtp_user" { description = "SMTP user" type = string sensitive = true }
variable "smtp_pass" { description = "SMTP password" type = string sensitive = true }
variable "smtp_from_email" { description = "SMTP from email" type = string sensitive = true }
variable "skip_email" { description = "Skip email flag" type = string default = "false" }
variable "session_secret" { description = "Session secret" type = string sensitive = true }
variable "encryption_key" { description = "Encryption key" type = string sensitive = true }
variable "retell_api_key" { description = "Retell API key" type = string sensitive = true }
