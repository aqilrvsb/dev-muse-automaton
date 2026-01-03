/**
 * WhatsApp Provider Service
 *
 * Supports multiple WhatsApp providers:
 * - WAHA (WhatsApp HTTP API)
 * - Wablas
 * - WhatsApp Center (WhCenter)
 */

export interface SendMessageRequest {
  deviceId: string;
  phone: string;
  message: string;
  mediaType?: string;
  mediaUrl?: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SessionStatusResponse {
  status: string;
  qrCode?: string;
}

/**
 * Send WhatsApp message through appropriate provider
 */
export async function sendWhatsAppMessage(
  request: SendMessageRequest,
  device: any
): Promise<SendMessageResponse> {
  const provider = device.provider?.toLowerCase() || "waha";

  switch (provider) {
    case "waha":
      return await sendViaWAHA(request, device);
    case "wablas":
      return await sendViaWablas(request, device);
    case "whacenter":
      return await sendViaWhCenter(request, device);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get session status from provider
 */
export async function getSessionStatus(device: any): Promise<SessionStatusResponse> {
  const provider = device.provider?.toLowerCase() || "waha";

  switch (provider) {
    case "waha":
      return await getWAHAStatus(device);
    case "wablas":
      return await getWablasStatus(device);
    case "whacenter":
      return await getWhaCenterStatus(device);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================================
// WAHA Provider
// ============================================================================

async function sendViaWAHA(request: SendMessageRequest, device: any): Promise<SendMessageResponse> {
  const { phone, message, mediaType, mediaUrl } = request;
  const baseUrl = device.api_key; // WAHA stores base URL in api_key field
  const session = device.instance || "default";

  try {
    let endpoint = `${baseUrl}/api/sendText`;
    let body: any = {
      session,
      chatId: `${phone}@c.us`,
      text: message,
    };

    // If media is provided, use appropriate endpoint
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        endpoint = `${baseUrl}/api/sendImage`;
        body = {
          session,
          chatId: `${phone}@c.us`,
          url: mediaUrl,
          caption: message,
        };
      } else if (mediaType === "file") {
        endpoint = `${baseUrl}/api/sendFile`;
        body = {
          session,
          chatId: `${phone}@c.us`,
          url: mediaUrl,
          filename: "file",
          caption: message,
        };
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WAHA error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ WAHA message sent to ${phone}`);

    return {
      success: true,
      messageId: result.id || result.messageId,
    };
  } catch (error) {
    console.error(`❌ WAHA send error:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getWAHAStatus(device: any): Promise<SessionStatusResponse> {
  const baseUrl = device.api_key;
  const session = device.instance || "default";

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${session}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`WAHA status error: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status || "unknown",
      qrCode: result.qr || undefined,
    };
  } catch (error) {
    console.error(`❌ WAHA status error:`, error);
    return { status: "error" };
  }
}

// ============================================================================
// Wablas Provider
// ============================================================================

async function sendViaWablas(request: SendMessageRequest, device: any): Promise<SendMessageResponse> {
  const { phone, message, mediaType, mediaUrl } = request;
  const apiKey = device.api_key;
  const baseUrl = device.instance || "https://api.wablas.com";

  try {
    let endpoint = `${baseUrl}/api/send-message`;
    let body: any = {
      phone,
      message,
    };

    // If media is provided
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        endpoint = `${baseUrl}/api/send-image`;
        body = {
          phone,
          image: mediaUrl,
          caption: message,
        };
      } else if (mediaType === "file") {
        endpoint = `${baseUrl}/api/send-document`;
        body = {
          phone,
          document: mediaUrl,
          caption: message,
        };
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wablas error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Wablas message sent to ${phone}`);

    return {
      success: true,
      messageId: result.data?.id || result.id,
    };
  } catch (error) {
    console.error(`❌ Wablas send error:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getWablasStatus(device: any): Promise<SessionStatusResponse> {
  const apiKey = device.api_key;
  const baseUrl = device.instance || "https://api.wablas.com";

  try {
    const response = await fetch(`${baseUrl}/api/device/status`, {
      method: "GET",
      headers: {
        "Authorization": apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Wablas status error: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status || "unknown",
    };
  } catch (error) {
    console.error(`❌ Wablas status error:`, error);
    return { status: "error" };
  }
}

// ============================================================================
// WhatsApp Center Provider
// ============================================================================

async function sendViaWhCenter(request: SendMessageRequest, device: any): Promise<SendMessageResponse> {
  const { phone, message, mediaType, mediaUrl } = request;
  const baseUrl = device.api_key; // WhCenter stores base URL in api_key
  const deviceId = device.device_id;

  try {
    let endpoint = `${baseUrl}/send-message`;
    let body: any = {
      device_id: deviceId,
      number: phone,
      message,
    };

    // If media is provided
    if (mediaType && mediaUrl) {
      if (mediaType === "image") {
        body.type = "image";
        body.url = mediaUrl;
      } else if (mediaType === "file") {
        body.type = "file";
        body.url = mediaUrl;
      }
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhCenter error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ WhCenter message sent to ${phone}`);

    return {
      success: true,
      messageId: result.message_id,
    };
  } catch (error) {
    console.error(`❌ WhCenter send error:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getWhaCenterStatus(device: any): Promise<SessionStatusResponse> {
  const baseUrl = device.api_key;
  const deviceId = device.device_id;

  try {
    const response = await fetch(`${baseUrl}/device-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (!response.ok) {
      throw new Error(`WhCenter status error: ${response.status}`);
    }

    const result = await response.json();
    return {
      status: result.status || "unknown",
    };
  } catch (error) {
    console.error(`❌ WhCenter status error:`, error);
    return { status: "error" };
  }
}
