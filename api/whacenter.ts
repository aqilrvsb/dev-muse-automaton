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

      case 'qr':
        url = `${API_BASE}/api/qr?device_id=${encodeURIComponent(device_id as string)}`
        break

      case 'deleteDevice':
        url = `${API_BASE}/api/deleteDevice?api_key=${encodeURIComponent(API_KEY)}&device_id=${encodeURIComponent(device_id as string)}`
        break

      default:
        return res.status(404).json({ error: 'Endpoint not found' })
    }

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    })

    const data = await response.json()
    return res.status(200).json(data)

  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
