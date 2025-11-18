terraform {
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = ">= 1.0.0"
    }
  }
}

provider "vercel" {
  api_token = var.vercel_token
}

resource "vercel_project" "this" {
  name      = "embellics-app"
  framework = "vite"
}
