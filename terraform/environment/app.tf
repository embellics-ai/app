resource "vercel_project_environment_variable" "port" {
  project_id = vercel_project.this.id
  key        = "PORT"
  value      = var.port
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "app_url" {
  project_id = vercel_project.this.id
  key        = "APP_URL"
  value      = var.app_url
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "ai_integrations_openai_base_url" {
  project_id = vercel_project.this.id
  key        = "AI_INTEGRATIONS_OPENAI_BASE_URL"
  value      = var.ai_integrations_openai_base_url
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "ai_integrations_openai_api_key" {
  project_id = vercel_project.this.id
  key        = "AI_INTEGRATIONS_OPENAI_API_KEY"
  value      = var.ai_integrations_openai_api_key
  target     = ["production", "preview", "development"]
}
