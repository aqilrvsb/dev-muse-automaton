import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_BASE = 'https://api.whacenter.com'
const API_KEY = 'abebe840-156c-441c-8252-da0342c5a07c'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { endpoint, device_id, name, number, webhook } = req.query

  try {
    // Handle QR endpoint separately (returns raw PNG)
    if (endpoint === 'qr') {
      const url = `${API_BASE}/api/qr?device_id=${encodeURIComponent(device_id as string)}`

      console.log('Fetching QR URL:', url)

      const qrResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow'
      })

      console.log('QR Response status:', qrResponse.status)

      const qrBuffer = await qrResponse.arrayBuffer()
      const qrBase64 = Buffer.from(qrBuffer).toString('base64')

      // Check if it's a valid PNG (base64 of PNG starts with 'iVBOR')
      if (qrBase64.startsWith('iVBOR')) {
        return res.status(200).json({
          success: true,
          data: {
            image: qrBase64
          }
        })
      } else {
        return res.status(200).json({
          success: false,
          error: 'Failed to generate QR code',
          raw: qrBase64.substring(0, 100)
        })
      }
    }

    // Handle all other endpoints (return JSON)
    let url = ''

    switch (endpoint) {
      case 'addDevice':
        url = `${API_BASE}/api/addDevice?api_key=${encodeURIComponent(API_KEY)}&name=${encodeURIComponent(name as string)}&number=${encodeURIComponent(number as string)}`
        break

      case 'setWebhook':
        url = `${API_BASE}/api/setWebhook?device_id=${encodeURIComponent(device_id as string)}&webhook=${encodeURIComponent(webhook as string)}`
        break

      case 'statusDevice':
        url = `${API_BASE}/api/statusDevice?device_id=${encodeURIComponent(device_id as string)}`
        break

      case 'deleteDevice':
        url = `${API_BASE}/api/deleteDevice?api_key=${encodeURIComponent(API_KEY)}&device_id=${encodeURIComponent(device_id as string)}`
        break

      default:
        return res.status(404).json({ error: 'Endpoint not found' })
    }

    console.log('Fetching URL:', url)

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    })

    console.log('Response status:', response.status)

    const text = await response.text()
    console.log('Response body:', text)

    // Try to parse as JSON
    let data
    try {
      data = JSON.parse(text)
    } catch (e) {
      console.error('Failed to parse JSON:', e)
      return res.status(200).json({
        success: false,
        error: 'Invalid JSON response',
        raw: text
      })
    }

    return res.status(200).json(data)

  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    })
  }
}
