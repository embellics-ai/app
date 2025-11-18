resource "vercel_project_environment_variable" "db_url" {
  project_id = vercel_project.this.id
  key        = "DATABASE_URL"
  value      = var.database_url
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "pgdatabase" {
  project_id = vercel_project.this.id
  key        = "PGDATABASE"
  value      = var.pgdatabase
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "pghost" {
  project_id = vercel_project.this.id
  key        = "PGHOST"
  value      = var.pghost
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "pgport" {
  project_id = vercel_project.this.id
  key        = "PGPORT"
  value      = var.pgport
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "pguser" {
  project_id = vercel_project.this.id
  key        = "PGUSER"
  value      = var.pguser
  target     = ["production", "preview", "development"]
}
resource "vercel_project_environment_variable" "pgpassword" {
  project_id = vercel_project.this.id
  key        = "PGPASSWORD"
  value      = var.pgpassword
  target     = ["production", "preview", "development"]
}
