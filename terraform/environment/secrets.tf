resource "vercel_project_environment_variable" "session_secret" {
  project_id = vercel_project.this.id
  key        = "SESSION_SECRET"
  value      = var.session_secret
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "encryption_key" {
  project_id = vercel_project.this.id
  key        = "ENCRYPTION_KEY"
  value      = var.encryption_key
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "retell_api_key" {
  project_id = vercel_project.this.id
  key        = "RETELL_API_KEY"
  value      = var.retell_api_key
  target     = ["production", "preview", "development"]
}
