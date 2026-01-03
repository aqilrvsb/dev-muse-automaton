// Deno Deploy Message Debouncer
// Purpose:
// 1. Receive webhook messages from WhatsApp
// 2. Queue messages with 4-second debouncing
// 3. When timer expires, send combined messages to Go backend
// 4. Go backend handles: device config, AI processing, WhatsApp sending

// Environment variables
const DEBOUNCE_DELAY_MS = 4000; // 4 seconds
const GO_BACKEND_URL = Deno.env.get("GO_BACKEND_URL") || "https://chatbot-automation-production.up.railway.app";

// Open Deno KV database
const kv = await Deno.openKv();

// Message queue structure
interface QueuedMessage {
  phone: string;
  deviceId: string;
  name?: string;
  messages: Array<{
    message: string;
    timestamp: number;
  }>;
  lastMessageTime: number;
  timerScheduled: number;
}

// Main HTTP handler
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check
  if (url.pathname === "/health") {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "deno-message-debouncer",
        debounceDelay: `${DEBOUNCE_DELAY_MS}ms`,
        goBackend: GO_BACKEND_URL,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Webhook endpoint - receives messages from WhatsApp
  if (url.pathname === "/webhook" && req.method === "POST") {
    try {
      const payload = await req.json();
      await handleIncomingMessage(payload);

      return new Response(
        JSON.stringify({ success: true, message: "Message queued for debouncing" }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("❌ Webhook error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Not Found", { status: 404 });
});

// Handle incoming message
async function handleIncomingMessage(payload: any) {
  const { phone, deviceId, message, name } = payload;

  if (!phone || !deviceId || !message) {
    throw new Error("Missing required fields: phone, deviceId, message");
  }

  const queueKey = ["message_queue", deviceId, phone];
  const now = Date.now();

  // Get existing queue
  const result = await kv.get<QueuedMessage>(queueKey);
  let queue: QueuedMessage;

  if (result.value) {
    // Add to existing queue and RESET timer
    queue = result.value;
    queue.messages.push({ message, timestamp: now });
    queue.lastMessageTime = now;
    queue.timerScheduled = now + DEBOUNCE_DELAY_MS; // Reset timer to 4s from now

    console.log(
      `📩 [${deviceId}/${phone}] Message ${queue.messages.length} added. Timer RESET to 4s.`
    );
  } else {
    // Create new queue
    queue = {
      phone,
      deviceId,
      name: name || "",
      messages: [{ message, timestamp: now }],
      lastMessageTime: now,
      timerScheduled: now + DEBOUNCE_DELAY_MS,
    };

    console.log(`🆕 [${deviceId}/${phone}] New queue created. Timer started (4s).`);
  }

  // Save queue
  await kv.set(queueKey, queue);

  // Schedule processing
  scheduleProcessing(phone, deviceId, queue.timerScheduled);
}

// Schedule message processing
function scheduleProcessing(phone: string, deviceId: string, scheduledTime: number) {
  const delay = scheduledTime - Date.now();

  if (delay > 0) {
    setTimeout(async () => {
      await checkAndProcess(phone, deviceId, scheduledTime);
    }, delay);
  }
}

// Check timer and process if expired
async function checkAndProcess(
  phone: string,
  deviceId: string,
  scheduledTime: number
) {
  const queueKey = ["message_queue", deviceId, phone];
  const result = await kv.get<QueuedMessage>(queueKey);

  if (!result.value) {
    console.log(`⚠️ [${deviceId}/${phone}] Queue not found - already processed`);
    return;
  }

  const queue = result.value;
  const now = Date.now();

  // Check if timer was reset by new message
  if (queue.timerScheduled !== scheduledTime) {
    console.log(`⏭️ [${deviceId}/${phone}] Timer was reset - skipping this check`);
    return;
  }

  // Check if time expired
  if (now >= queue.timerScheduled) {
    console.log(
      `⏰ [${deviceId}/${phone}] Timer EXPIRED! Processing ${queue.messages.length} messages...`
    );
    await processMessages(queue);
  }
}

// Process messages by sending to Go backend
async function processMessages(queue: QueuedMessage) {
  const { phone, deviceId, name, messages } = queue;

  try {
    // Extract just the message strings
    const messageTexts = messages.map((m) => m.message);

    console.log(`📤 [${deviceId}/${phone}] Sending ${messageTexts.length} messages to Go backend...`);

    // Call Go backend API
    const response = await fetch(`${GO_BACKEND_URL}/api/debounce/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        device_id: deviceId,
        phone: phone,
        name: name || "",
        messages: messageTexts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Go backend error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [${deviceId}/${phone}] Go backend response:`, result);

    // Delete queue after successful processing
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`🗑️ [${deviceId}/${phone}] Queue cleared`);
  } catch (error) {
    console.error(`❌ [${deviceId}/${phone}] Processing error:`, error);

    // Optionally: Keep queue for retry or delete it
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`🗑️ [${deviceId}/${phone}] Queue cleared after error`);
  }
}

// Cleanup old queues
async function cleanupOldQueues() {
  const entries = kv.list<QueuedMessage>({ prefix: ["message_queue"] });
  const now = Date.now();
  let cleaned = 0;

  for await (const entry of entries) {
    const queue = entry.value;
    const age = now - queue.lastMessageTime;

    // Delete queues older than 10 minutes (stuck/failed)
    if (age > 600000) {
      await kv.delete(entry.key);
      cleaned++;
      console.log(`🧹 Cleaned old queue: ${queue.deviceId}/${queue.phone} (age: ${Math.round(age/1000)}s)`);
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleanup: ${cleaned} old queues removed`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldQueues, 600000);

console.log("🚀 Deno Message Debouncer Started!");
console.log(`⏱️  Debounce delay: ${DEBOUNCE_DELAY_MS}ms (4 seconds)`);
console.log(`🔗 Go backend: ${GO_BACKEND_URL}`);
console.log(`📝 Endpoint: POST /webhook`);
console.log(`💚 Health check: GET /health`);
