// Deno backend proxy for WhatsApp Center API
// Deploy this to Deno Deploy or any serverless platform

const WHACENTER_API_BASE = 'https://api.whacenter.com';
const WHACENTER_API_KEY = 'abebe840-156c-441c-8252-da0342c5a07c';

// CORS headers to allow frontend requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Change to your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

Deno.serve(async (req) => {
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  try {
    // Route: /addDevice?name=xxx&number=xxx
    if (path === '/addDevice') {
      const name = url.searchParams.get('name');
      const number = url.searchParams.get('number') || '';

      const whacenterUrl = `${WHACENTER_API_BASE}/api/addDevice?api_key=${encodeURIComponent(WHACENTER_API_KEY)}&name=${encodeURIComponent(name || '')}&number=${encodeURIComponent(number)}`;

      const response = await fetch(whacenterUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /setWebhook?device_id=xxx&webhook=xxx
    if (path === '/setWebhook') {
      const deviceId = url.searchParams.get('device_id');
      const webhook = url.searchParams.get('webhook');

      const whacenterUrl = `${WHACENTER_API_BASE}/api/setWebhook?device_id=${encodeURIComponent(deviceId || '')}&webhook=${encodeURIComponent(webhook || '')}`;

      const response = await fetch(whacenterUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /statusDevice?device_id=xxx
    if (path === '/statusDevice') {
      const deviceId = url.searchParams.get('device_id');

      const whacenterUrl = `${WHACENTER_API_BASE}/api/statusDevice?device_id=${encodeURIComponent(deviceId || '')}`;

      const response = await fetch(whacenterUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /qr?device_id=xxx
    if (path === '/qr') {
      const deviceId = url.searchParams.get('device_id');

      const whacenterUrl = `${WHACENTER_API_BASE}/api/qr?device_id=${encodeURIComponent(deviceId || '')}`;

      const response = await fetch(whacenterUrl);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
