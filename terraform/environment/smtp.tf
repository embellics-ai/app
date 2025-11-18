resource "vercel_project_environment_variable" "smtp_host" {
  project_id = vercel_project.this.id
  key        = "SMTP_HOST"
  value      = var.smtp_host
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "smtp_port" {
  project_id = vercel_project.this.id
  key        = "SMTP_PORT"
  value      = var.smtp_port
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "smtp_secure" {
  project_id = vercel_project.this.id
  key        = "SMTP_SECURE"
  value      = var.smtp_secure
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "smtp_user" {
  project_id = vercel_project.this.id
  key        = "SMTP_USER"
  value      = var.smtp_user
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "smtp_pass" {
  project_id = vercel_project.this.id
  key        = "SMTP_PASS"
  value      = var.smtp_pass
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "smtp_from_email" {
  project_id = vercel_project.this.id
  key        = "SMTP_FROM_EMAIL"
  value      = var.smtp_from_email
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "skip_email" {
  project_id = vercel_project.this.id
  key        = "SKIP_EMAIL"
  value      = var.skip_email
  target     = ["production", "preview", "development"]
}
