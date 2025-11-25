-- Add widget theme customization columns
ALTER TABLE "widget_configs" ADD COLUMN "primary_color" text DEFAULT '#9b7ddd';
ALTER TABLE "widget_configs" ADD COLUMN "text_color" text DEFAULT '#ffffff';
ALTER TABLE "widget_configs" ADD COLUMN "border_radius" text DEFAULT '12px';
