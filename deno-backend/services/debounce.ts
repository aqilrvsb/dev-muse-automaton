/**
 * Message Debouncing Service
 *
 * Queues incoming WhatsApp messages and waits 4 seconds before processing.
 * If new messages arrive within 4 seconds, timer resets.
 * This prevents duplicate responses when users send multiple messages quickly.
 */

import { config } from "../main.ts";

// Open Deno KV database for queue storage
const kv = await Deno.openKv();

interface QueuedMessage {
  deviceId: string;
  webhookId: string;
  phone: string;
  name: string;
  provider: string;
  messages: Array<{
    message: string;
    timestamp: number;
  }>;
  lastMessageTime: number;
  timerScheduled: number;
}

interface QueueMessageParams {
  deviceId: string;
  webhookId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
}

/**
 * Queue message for debouncing
 */
export async function queueMessageForDebouncing(params: QueueMessageParams): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;
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
    queue.timerScheduled = now + config.debounceDelayMs; // Reset timer to 4s from now

    console.log(
      `📩 [${deviceId}/${phone}] Message ${queue.messages.length} added. Timer RESET to ${config.debounceDelayMs}ms.`
    );
  } else {
    // Create new queue
    queue = {
      deviceId,
      webhookId,
      phone,
      name: name || "",
      provider,
      messages: [{ message, timestamp: now }],
      lastMessageTime: now,
      timerScheduled: now + config.debounceDelayMs,
    };

    console.log(`🆕 [${deviceId}/${phone}] New queue created. Timer started (${config.debounceDelayMs}ms).`);
  }

  // Save queue
  await kv.set(queueKey, queue);

  // Schedule processing
  scheduleProcessing(deviceId, phone, queue.timerScheduled);
}

/**
 * Schedule message processing
 */
function scheduleProcessing(deviceId: string, phone: string, scheduledTime: number): void {
  const delay = scheduledTime - Date.now();

  if (delay > 0) {
    setTimeout(async () => {
      await checkAndProcess(deviceId, phone, scheduledTime);
    }, delay);
  }
}

/**
 * Check timer and process if expired
 */
async function checkAndProcess(
  deviceId: string,
  phone: string,
  scheduledTime: number
): Promise<void> {
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

/**
 * Process queued messages
 */
async function processMessages(queue: QueuedMessage): Promise<void> {
  const { deviceId, webhookId, phone, name, messages, provider } = queue;

  try {
    // Combine all messages
    const combinedMessage = messages.map(m => m.message).join("\n");

    console.log(`📤 [${deviceId}/${phone}] Processing combined message: ${combinedMessage}`);

    // Import flow execution service
    const { processFlowMessage } = await import("./flow-execution.ts");

    // Process through flow execution engine
    const result = await processFlowMessage({
      deviceId,
      webhookId,
      phone,
      name,
      message: combinedMessage,
      provider,
    });

    console.log(`✅ [${deviceId}/${phone}] Flow processing complete:`, result);

    // Delete queue after successful processing
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`🗑️ [${deviceId}/${phone}] Queue cleared`);

  } catch (error) {
    console.error(`❌ [${deviceId}/${phone}] Processing error:`, error);

    // Delete queue even on error (avoid infinite loops)
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`🗑️ [${deviceId}/${phone}] Queue cleared after error`);
  }
}

/**
 * Cleanup old queues (run periodically)
 * Removes queues older than 10 minutes (stuck/failed)
 */
export async function cleanupOldQueues(): Promise<void> {
  const entries = kv.list<QueuedMessage>({ prefix: ["message_queue"] });
  const now = Date.now();
  let cleaned = 0;

  for await (const entry of entries) {
    const queue = entry.value;
    const age = now - queue.lastMessageTime;

    // Delete queues older than 10 minutes
    if (age > 600000) {
      await kv.delete(entry.key);
      cleaned++;
      console.log(
        `🧹 Cleaned old queue: ${queue.deviceId}/${queue.phone} (age: ${Math.round(age / 1000)}s)`
      );
    }
  }

  if (cleaned > 0) {
    console.log(`🧹 Cleanup: ${cleaned} old queues removed`);
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldQueues, 600000);

console.log("✅ Debounce service initialized");
