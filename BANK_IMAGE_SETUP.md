# Bank Image Feature Setup

## ✅ Completed Steps
- [x] Installed `@vercel/blob` package
- [x] Created BankImage page component
- [x] Added Bank Image to sidebar navigation
- [x] Added route for `/bank-image`
- [x] Created `.env` file with Vercel Blob token
- [x] Created SQL migration file

## 📋 Final Setup Steps

### 1. Create Database Table in Supabase

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy the entire contents of `supabase/migrations/create_bank_images.sql`
4. Paste and **Run** the SQL query
5. Verify the table was created in **Table Editor**

### 2. Add Environment Variables to Vercel

**Important:** For production deployment, add BOTH tokens to Vercel:

1. Go to **Vercel Dashboard** → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Add **TWO** variables:

   **Variable 1 (Client-side for uploads):**
   - **Name:** `VITE_BLOB_READ_WRITE_TOKEN`
   - **Value:** `vercel_blob_rw_Cq4lFGmFNPojbgtJ_oKFQ7ZzbQJitu6bivnVLB54Oox80gP`
   - **Environment:** Production, Preview, Development (select all)

   **Variable 2 (Server-side for deletions):**
   - **Name:** `BLOB_READ_WRITE_TOKEN`
   - **Value:** `vercel_blob_rw_Cq4lFGmFNPojbgtJ_oKFQ7ZzbQJitu6bivnVLB54Oox80gP`
   - **Environment:** Production, Preview, Development (select all)

4. Click **Save** for both
5. Redeploy your application for changes to take effect

**Why Two Variables?**
- `VITE_BLOB_READ_WRITE_TOKEN` - Used by client-side code for uploads
- `BLOB_READ_WRITE_TOKEN` - Used by server-side API for deletions (avoids CORS issues)

### 3. Test the Feature

1. Start your development server: `npm run dev`
2. Navigate to **Bank Image** section in sidebar
3. Test uploading an image (max 300KB):
   - Enter image name
   - Select an image file
   - Preview should appear
   - Click **Upload**
4. Test other operations:
   - **View:** Click on thumbnail to view full image
   - **Update:** Change image name
   - **Delete:** Remove image (deletes from both Vercel Blob and database)
   - **Export CSV:** Export list to CSV file
   - **Search:** Filter images by name
   - **Pagination:** Navigate through pages

## 🎯 Features

### Upload
- Image size limit: **300KB**
- Supported formats: All image types (jpg, png, gif, webp, etc.)
- Live preview before upload
- Automatic upload to Vercel Blob Storage
- URL saved to Supabase database

### CRUD Operations
- **Create:** Upload new images with custom names
- **Read:** View all images in table format with thumbnails
- **Update:** Edit image names OR replace images (uploads new, deletes old from Blob)
- **Delete:** Remove images from both Vercel Blob Storage AND database (with confirmation)

### Additional Features
- **Search:** Real-time search by image name
- **Pagination:** Configurable entries per page (5, 10, 25, 50, 100)
- **Export:** Download image list as CSV
- **View Modal:** Full-size image preview with metadata
- **Responsive Design:** Works on all screen sizes

## 📊 Database Schema

```sql
bank_images
├── id (uuid, primary key)
├── user_id (uuid, foreign key → user.id)
├── name (varchar, required)
├── image_url (text, required)
├── blob_url (text, nullable)
├── created_at (timestamp with time zone)
└── updated_at (timestamp with time zone)
```

## 🔒 Security

- **Row Level Security (RLS)** enabled
- Users can only view/edit their own images
- Automatic cleanup when user is deleted (CASCADE)
- Token stored in `.env` (gitignored)
- **Server-side deletion API** prevents CORS issues and enhances security

## 🏗️ Architecture

### Upload Flow (Client-Side)
1. User selects image → Auto-compressed to <300KB
2. Client uploads to Vercel Blob using `VITE_BLOB_READ_WRITE_TOKEN`
3. Blob URL saved to Supabase database

### Delete Flow (Server-Side API)
1. Client calls `/api/delete-blob` endpoint
2. Server-side function deletes from Vercel Blob using `BLOB_READ_WRITE_TOKEN`
3. Client deletes record from Supabase database

**Why server-side delete?** Vercel Blob's delete API blocks client-side CORS requests for security. Upload works client-side, but delete requires server execution.

## 💰 Vercel Blob Storage Limits

**Free Tier:**
- Storage: 1 GB
- Bandwidth: 100 GB/month
- Perfect for SaaS applications with image uploads

**Store Details:**
- Store ID: `store_Cq4lFGmFNPojbgtJ`
- Base URL: `https://cq4lfgmfnpojbgtj.public.blob.vercel-storage.com`

## 🚀 Ready to Use!

Once you complete steps 1-2 above, the Bank Image feature will be fully functional and ready for your users!
