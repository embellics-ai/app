# Infrastructure as Code (Terraform)

This directory manages all Vercel project configuration and environment variables using Terraform.

## Usage

1. Copy `secrets.auto.tfvars.example` to `secrets.auto.tfvars` and fill in your secrets (never commit this file).
2. Initialize Terraform:
   ```sh
   terraform init
   ```
3. Preview changes:
   ```sh
   terraform plan
   ```
4. Apply changes:
   ```sh
   terraform apply
   ```

## Structure

- `main.tf` – Provider and Vercel project resource
- `variables.tf` – All variable definitions
- `outputs.tf` – Useful outputs (project ID, URL)
- `environment/` – Logical grouping of environment variable resources

**Note:** All sensitive values should be managed in your local `secrets.auto.tfvars` file and never committed to git.
