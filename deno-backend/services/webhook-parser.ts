/**
 * Webhook Parser Service
 *
 * Parses webhook payloads from different WhatsApp providers:
 * - WAHA
 * - Wablas
 * - WhatsApp Center (WhCenter)
 */

export interface ParsedWebhookMessage {
  phone: string;
  message: string;
  name?: string;
  messageType?: string;
}

/**
 * Parse webhook payload based on provider type
 */
export async function parseWebhookPayload(
  payload: any,
  provider: string
): Promise<ParsedWebhookMessage | null> {
  switch (provider.toLowerCase()) {
    case "waha":
      return parseWAHAWebhook(payload);
    case "wablas":
      return parseWablasWebhook(payload);
    case "whacenter":
      return parseWhaCenterWebhook(payload);
    default:
      console.warn(`⚠️  Unknown provider: ${provider}, attempting generic parse`);
      return parseGenericWebhook(payload);
  }
}

/**
 * Parse WAHA webhook
 *
 * Example WAHA payload:
 * {
 *   "event": "message",
 *   "session": "default",
 *   "payload": {
 *     "id": "...",
 *     "timestamp": 1234567890,
 *     "from": "6281234567890@c.us",
 *     "fromMe": false,
 *     "body": "Hello",
 *     "hasMedia": false,
 *     "_data": {
 *       "notifyName": "John Doe"
 *     }
 *   }
 * }
 */
function parseWAHAWebhook(payload: any): ParsedWebhookMessage | null {
  // Check if it's a message event
  const event = payload.event || payload.payload?.event;
  if (event !== "message" && event !== "messages.upsert") {
    return null;
  }

  // Extract from nested payload structure
  const data = payload.payload || payload;

  // Skip messages from self
  if (data.fromMe === true || data.payload?.fromMe === true) {
    return null;
  }

  // Extract fields
  const from = data.from || data.payload?.from || "";
  const body = data.body || data.message?.conversation || data.payload?.body || "";
  const notifyName = data._data?.notifyName || data.payload?._data?.notifyName || "";
  const hasMedia = data.hasMedia || data.payload?.hasMedia || false;

  // Skip media messages for now (text only)
  if (hasMedia) {
    return null;
  }

  // Clean phone number
  const phone = cleanPhoneNumber(from);

  return {
    phone,
    message: body,
    name: notifyName,
    messageType: "text"
  };
}

/**
 * Parse Wablas webhook
 *
 * Example Wablas payload:
 * {
 *   "phone": "6281234567890",
 *   "message": "Hello",
 *   "pushname": "John Doe",
 *   "device": "WhatsApp",
 *   "isGroup": false
 * }
 */
function parseWablasWebhook(payload: any): ParsedWebhookMessage | null {
  // Skip group messages
  if (payload.isGroup === true) {
    return null;
  }

  const phone = payload.phone || "";
  const message = payload.message || "";
  const pushname = payload.pushname || payload.sender_name || "";

  if (!phone || !message) {
    return null;
  }

  return {
    phone: cleanPhoneNumber(phone),
    message,
    name: pushname,
    messageType: "text"
  };
}

/**
 * Parse WhatsApp Center webhook
 *
 * Example WhCenter payload:
 * {
 *   "device_id": "...",
 *   "from": "6281234567890",
 *   "text": "Hello",
 *   "name": "John Doe",
 *   "type": "text"
 * }
 */
function parseWhaCenterWebhook(payload: any): ParsedWebhookMessage | null {
  const from = payload.from || payload.sender || "";
  const text = payload.text || payload.message || payload.body || "";
  const name = payload.name || payload.pushname || "";
  const type = payload.type || "text";

  // Only process text messages
  if (type !== "text" && type !== "chat") {
    return null;
  }

  if (!from || !text) {
    return null;
  }

  return {
    phone: cleanPhoneNumber(from),
    message: text,
    name,
    messageType: type
  };
}

/**
 * Generic webhook parser (fallback)
 * Tries to extract common fields
 */
function parseGenericWebhook(payload: any): ParsedWebhookMessage | null {
  // Try common field names
  const phone = payload.phone || payload.from || payload.sender || payload.wa_id || "";
  const message = payload.message || payload.body || payload.text || payload.msg || "";
  const name = payload.name || payload.pushname || payload.sender_name || payload.notifyName || "";

  if (!phone || !message) {
    return null;
  }

  return {
    phone: cleanPhoneNumber(phone),
    message,
    name,
    messageType: "text"
  };
}

/**
 * Clean phone number
 * Removes @c.us, @s.whatsapp.net, spaces, dashes, etc.
 */
function cleanPhoneNumber(phone: string): string {
  return phone
    .replace(/@c\.us/g, "")
    .replace(/@s\.whatsapp\.net/g, "")
    .replace(/@g\.us/g, "") // group
    .replace(/\s/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/\+/g, "");
}
