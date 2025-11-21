# WhatsApp Center API Proxy

This PHP proxy solves CORS (Cross-Origin Resource Sharing) issues when calling the WhatsApp Center API from your React frontend.

## Why Do We Need This?

**The Problem:**
- Your React app runs in the browser
- Browser security (CORS) blocks direct calls from your domain to `api.whacenter.com`
- You get "Failed to fetch" errors

**The Solution:**
- PHP runs on your server (not in browser)
- No CORS restrictions on server-to-server requests
- Your React app calls this PHP proxy (same origin = no CORS)
- PHP proxy forwards requests to WhatsApp Center API

```
React App → PHP Proxy (✅ No CORS) → WhatsApp Center API (✅ No CORS)
```

## Installation

### 1. Deploy to Your Web Server

Copy `whacenter-proxy.php` to your web server's public directory:

```bash
# Example: Copy to public_html/proxy/
cp proxy/whacenter-proxy.php /path/to/your/public_html/proxy/
```

### 2. Verify PHP Proxy URL

Make sure your React app can access it at:
```
https://yourdomain.com/proxy/whacenter-proxy.php
```

### 3. Update React App (if needed)

The code is already configured to use `/proxy/whacenter-proxy.php`. If your proxy is at a different path, update it in `src/pages/DeviceSettings.tsx`:

```typescript
const apiBase = '/proxy/whacenter-proxy.php'  // Update this if needed
```

## API Endpoints

The proxy supports these endpoints:

| Endpoint | Purpose | Parameters |
|----------|---------|------------|
| `addDevice` | Register new WhatsApp device | `name`, `number` |
| `setWebhook` | Set webhook URL for device | `device_id`, `webhook` |
| `statusDevice` | Check device connection status | `device_id` |
| `qr` | Get QR code for device pairing | `device_id` |
| `deleteDevice` | Remove device from WhatsApp Center | `device_id` |

## Example Usage

### From React App:

```typescript
// Add a device
const response = await fetch(
  '/proxy/whacenter-proxy.php?endpoint=addDevice&name=MyDevice&number=60123456789'
)
const data = await response.json()

// Get QR code
const response = await fetch(
  '/proxy/whacenter-proxy.php?endpoint=qr&device_id=abc123'
)
const data = await response.json()
```

## Security

### Production Recommendations:

1. **Restrict CORS to your domain only:**

   Edit `whacenter-proxy.php` line 2:
   ```php
   // Change from:
   header('Access-Control-Allow-Origin: *');

   // To:
   header('Access-Control-Allow-Origin: https://yourdomain.com');
   ```

2. **Add rate limiting** to prevent abuse

3. **Consider adding API authentication** if your app is public

## Troubleshooting

### Error: "404 Not Found"
- Check that `whacenter-proxy.php` is in the correct directory
- Verify the URL path matches your configuration

### Error: "Endpoint not found"
- Check the `endpoint` parameter in your request
- Valid endpoints: `addDevice`, `setWebhook`, `statusDevice`, `qr`, `deleteDevice`

### Still getting CORS errors?
- Verify the PHP file has CORS headers at the top
- Check browser console for the exact error
- Ensure your web server allows `.htaccess` or equivalent CORS configuration

## Alternative: Deno Deploy (Optional)

If you prefer serverless deployment, use `whacenter-proxy.ts` with Deno Deploy:

```bash
deno run --allow-net whacenter-proxy.ts
# Or deploy to: https://deno.com/deploy
```

## Support

For issues related to:
- **Proxy configuration**: Check this README
- **WhatsApp Center API**: Visit https://api.whacenter.com
- **React app**: See main project README
