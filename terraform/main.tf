terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = ">= 1.0.0"
    }
  }
}

variable "vercel_token" {
  description = "Vercel API token"
  type        = string
  sensitive   = true
}

provider "vercel" {
  api_token = var.vercel_token
}

resource "vercel_project" "this" {
  name      = "embellics-app"
  framework = "vite"
}

# Example: Set environment variables
resource "vercel_project_environment_variable" "db_url" {
  project_id = vercel_project.this.id
  key        = "DATABASE_URL"
  value      = "your_database_url"
  target     = ["production", "preview", "development"]
}
