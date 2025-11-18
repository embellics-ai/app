output "vercel_project_id" {
  value = vercel_project.this.id
}
output "vercel_project_url" {
  value = "https://vercel.com/${vercel_project.this.name}"
}
