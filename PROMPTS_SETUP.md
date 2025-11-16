# Prompts Feature Setup Guide

## Database Setup

To use the new Prompts feature, you need to create the `prompts` table in your Supabase database.

### Steps:

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL from `database/create_prompts_table.sql`
4. Click **Run** to execute the SQL

### What the SQL does:

- Creates the `prompts` table with all required fields
- Sets up indexes for better performance
- Adds unique constraint (one prompt per device)
- Enables Row Level Security (RLS)
- Creates security policies so users can only access their own prompts

## Features

### Add Prompt
- Click "Add Prompt" button
- Select from available devices (devices without prompts)
- Enter niche, prompt name, and prompt data
- Dates are automatically formatted as Y-m-d

### Edit Prompt
- Click "Edit" on any prompt card
- Device ID is read-only (cannot be changed)
- Update niche, prompt name, or prompt data
- Updated date is automatically set

### Delete Prompt
- Click "Delete" on any prompt card
- System checks if device is used in `ai_whatsapp` table
- If device is in use, deletion is blocked
- If not in use, deletion is allowed after confirmation

## Business Rules

1. **One Prompt Per Device**: Each device can only have one prompt assigned
2. **Available Devices Only**: When adding prompts, only devices without prompts are shown
3. **Delete Protection**: Prompts for devices in active use cannot be deleted
4. **User Isolation**: Users can only see and manage their own prompts
5. **Date Format**: Dates are stored in Y-m-d format (e.g., 2025-01-15)

## Navigation

The Prompts page is accessible from the sidebar:
- Dashboard
- Device Settings
- **Prompts** ← New!
- Profile
- Billings
- Chatbot AI
