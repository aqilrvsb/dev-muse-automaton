// Deno Deploy Edge Function - Message Debouncing with Deno KV (Shared State)
// This version uses Deno KV to share state across multiple isolates

interface Message {
  device_id: string;
  phone: string;
  name?: string;
  message: string;
  timestamp: number;
}

interface Session {
  messages: Message[];
  isProcessing: boolean;
  lastProcessedAt: number | null;
  lastMessageAt: number; // Track when last message was added
}

// Open Deno KV database (shared across all isolates)
const kv = await Deno.openKv();

// Configuration
const DEBOUNCE_DELAY = 8000; // 8 seconds
const PROCESSING_COOLDOWN = 30000; // 30 seconds
const BACKEND_URL = Deno.env.get("BACKEND_URL") || "https://chatbot-automation-production.up.railway.app";
const BACKEND_ENDPOINT = "/api/debounce/process";

// Logging helper
function log(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ timestamp, level, message, ...(data && { data }) }));
}

// Generate unique session key
function getSessionKey(deviceId: string, phone: string): string {
  return `${deviceId}:${phone}`;
}

// Check if session is in cooldown
function isInCooldown(session: Session): boolean {
  if (!session.lastProcessedAt) return false;
  return (Date.now() - session.lastProcessedAt) < PROCESSING_COOLDOWN;
}

// Get session from KV
async function getSession(sessionKey: string): Promise<Session | null> {
  const entry = await kv.get<Session>(["session", sessionKey]);
  return entry.value;
}

// Save session to KV
async function saveSession(sessionKey: string, session: Session): Promise<void> {
  await kv.set(["session", sessionKey], session);
}

// Delete session from KV
async function deleteSession(sessionKey: string): Promise<void> {
  await kv.delete(["session", sessionKey]);
}

// Process and send combined messages
async function processMessages(sessionKey: string) {
  // Use atomic check-and-set to prevent race conditions
  const entry = await kv.get<Session>(["session", sessionKey]);
  const session = entry.value;

  if (!session || session.messages.length === 0) {
    log("warn", "No messages to process", { sessionKey });
    return;
  }

  // Check if already processing
  if (session.isProcessing) {
    log("warn", "Already processing, skipping", { sessionKey });
    return;
  }

  // Atomic operation: only proceed if session hasn't changed
  session.isProcessing = true;
  const result = await kv.atomic()
    .check(entry) // Only commit if session hasn't changed
    .set(["session", sessionKey], session)
    .commit();

  if (!result.ok) {
    log("warn", "Another isolate is processing, skipping", { sessionKey });
    return;
  }

  const messages = session.messages.map((m: Message) => m.message);
  const firstMessage = session.messages[0];

  log("info", "Processing combined messages", {
    sessionKey,
    messageCount: messages.length,
    deviceId: firstMessage.device_id,
    phone: firstMessage.phone,
    debounceDelay: DEBOUNCE_DELAY,
  });

  try {
    const payload = {
      device_id: firstMessage.device_id,
      phone: firstMessage.phone,
      name: firstMessage.name || "",
      messages,
    };

    log("info", "Sending to backend", {
      url: BACKEND_URL + BACKEND_ENDPOINT,
      payload,
    });

    const response = await fetch(BACKEND_URL + BACKEND_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok) {
      log("success", "Backend processed successfully", {
        sessionKey,
        messageCount: messages.length,
        result,
      });

      // Update session: clear messages, mark as processed
      session.messages = [];
      session.isProcessing = false;
      session.lastProcessedAt = Date.now();
      await saveSession(sessionKey, session);

      // Schedule cleanup after cooldown
      setTimeout(async () => {
        await deleteSession(sessionKey);
        log("info", "Session cleaned up after cooldown", { sessionKey });
      }, PROCESSING_COOLDOWN);
    } else {
      log("error", "Backend returned error", {
        sessionKey,
        status: response.status,
        result,
      });
      session.isProcessing = false;
      await saveSession(sessionKey, session);
    }
  } catch (error) {
    log("error", "Failed to send to backend", {
      sessionKey,
      error: error.message,
    });
    session.isProcessing = false;
    await saveSession(sessionKey, session);
  }
}

// Background worker to check for expired timers
async function startTimerWorker() {
  while (true) {
    // Check all sessions every second
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const entries = kv.list<Session>({ prefix: ["session"] });
    for await (const entry of entries) {
      const session = entry.value;
      const sessionKey = entry.key[1] as string;

      if (session.isProcessing || isInCooldown(session)) {
        continue; // Skip if already processing or in cooldown
      }

      const timeSinceLastMessage = Date.now() - session.lastMessageAt;
      if (timeSinceLastMessage >= DEBOUNCE_DELAY && session.messages.length > 0) {
        // Timer expired, process messages
        processMessages(sessionKey);
      }
    }
  }
}

// Start background worker
startTimerWorker();

// Queue a message
async function queueMessage(msg: Message) {
  const sessionKey = getSessionKey(msg.device_id, msg.phone);
  let session = await getSession(sessionKey);

  // Create new session if doesn't exist
  if (!session) {
    session = {
      messages: [],
      isProcessing: false,
      lastProcessedAt: null,
      lastMessageAt: Date.now(),
    };
    log("info", "New session created", { sessionKey });
  }

  // Check if processing or in cooldown
  if (session.isProcessing) {
    log("warn", "Session is processing, message ignored to prevent duplicate", {
      sessionKey,
      ignoredMessage: msg.message.substring(0, 50) + "...",
    });
    return { queued: false, reason: "processing" };
  }

  if (isInCooldown(session)) {
    const cooldownRemaining = PROCESSING_COOLDOWN - (Date.now() - session.lastProcessedAt!);
    log("warn", "Session in cooldown, message ignored", {
      sessionKey,
      cooldownRemaining: Math.ceil(cooldownRemaining / 1000) + "s",
      ignoredMessage: msg.message.substring(0, 50) + "...",
    });
    return { queued: false, reason: "cooldown" };
  }

  // Add message to queue
  session.messages.push(msg);
  session.lastMessageAt = Date.now();
  await saveSession(sessionKey, session);

  log("info", "Message queued", {
    sessionKey,
    queueSize: session.messages.length,
    message: msg.message.substring(0, 50) + "...",
  });

  return { queued: true, queueSize: session.messages.length };
}

// HTTP handler
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // Health check endpoint
  if (url.pathname === "/health" && req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "healthy",
        config: {
          debounceDelay: DEBOUNCE_DELAY,
          processingCooldown: PROCESSING_COOLDOWN,
          backendUrl: BACKEND_URL,
        },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Status endpoint
  if (url.pathname === "/status" && req.method === "GET") {
    const sessions: any[] = [];
    const entries = kv.list<Session>({ prefix: ["session"] });
    for await (const entry of entries) {
      const sessionKey = entry.key[1] as string;
      const session = entry.value;
      sessions.push({
        sessionKey,
        messageCount: session.messages.length,
        isProcessing: session.isProcessing,
        inCooldown: isInCooldown(session),
        lastProcessedAt: session.lastProcessedAt,
        lastMessageAt: session.lastMessageAt,
      });
    }

    return new Response(
      JSON.stringify({
        activeSessions: sessions.length,
        sessions,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  // Queue endpoint
  if (url.pathname === "/queue" && req.method === "POST") {
    try {
      const data = await req.json();
      const msg: Message = {
        device_id: data.device_id,
        phone: data.phone,
        name: data.name || "",
        message: data.message,
        timestamp: Date.now(),
      };

      const result = await queueMessage(msg);
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      log("error", "Failed to queue message", { error: error.message });
      return new Response(
        JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  return new Response("Not Found", { status: 404 });
});

log("info", "Deno Deploy Debounce Service Started (KV-based)", {
  debounceDelay: DEBOUNCE_DELAY,
  processingCooldown: PROCESSING_COOLDOWN,
  backendUrl: BACKEND_URL,
});
