import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Environment variables
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JWT_SECRET = Deno.env.get("JWT_SECRET")!;
const DEBOUNCE_DELAY_MS = parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "8000");
const WHACENTER_API_URL = Deno.env.get("WHACENTER_API_URL") || "https://api.whacenter.com";
const WHACENTER_API_KEY = Deno.env.get("WHACENTER_API_KEY") || "abebe840-156c-441c-8252-da0342c5a07c";

// Initialize Supabase clients
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Initialize Deno KV for message queue
const kv = await Deno.openKv();

// Queue cleanup function - Remove old orphaned entries
async function cleanupOldQueueEntries() {
  console.log("🧹 Starting queue cleanup...");
  const now = Date.now();
  const ONE_HOUR = 3600000; // 1 hour in milliseconds
  let cleanedQueueCount = 0;
  let cleanedRateLimitCount = 0;

  try {
    // Cleanup message queue entries older than 1 hour
    const queueEntries = kv.list({ prefix: ["message_queue"] });

    for await (const entry of queueEntries) {
      const queueData = entry.value as QueuedMessage;

      // Check if the oldest message in the queue is older than 1 hour
      if (queueData.messages && queueData.messages.length > 0) {
        const oldestMessage = queueData.messages[0];

        if (now - oldestMessage.timestamp > ONE_HOUR) {
          // Delete old entry
          await kv.delete(entry.key);
          cleanedQueueCount++;
          console.log(`🗑️  Deleted old queue entry for device ${queueData.deviceId}, phone ${oldestMessage.phone}`);
        }
      }
    }

    // Cleanup rate limit entries older than 1 hour (they should auto-expire, but cleanup orphans)
    const rateLimitEntries = kv.list({ prefix: ["rate_limit"] });

    for await (const entry of rateLimitEntries) {
      const rateLimitData = entry.value as { count: number; timestamp: number };

      if (rateLimitData && now - rateLimitData.timestamp > ONE_HOUR) {
        await kv.delete(entry.key);
        cleanedRateLimitCount++;
      }
    }

    console.log(`✅ Queue cleanup completed: ${cleanedQueueCount} queue entries, ${cleanedRateLimitCount} rate limit entries removed`);
  } catch (error) {
    console.error("❌ Queue cleanup error:", error);
  }
}

// Run cleanup on startup
cleanupOldQueueEntries();

// Schedule periodic cleanup every 30 minutes
setInterval(() => {
  cleanupOldQueueEntries();
}, 1800000); // 30 minutes

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Types
interface QueuedMessage {
  messages: Array<{
    phone: string;
    message: string;
    name: string;
    timestamp: number;
  }>;
  timer?: number;
  deviceId: string;
  webhookId: string;
  provider: string;
}

// WhatsApp Center webhook payload
interface WhaCenterWebhookPayload {
  message?: string;
  from?: string;
  phone?: string;
  pushName?: string;
  deviceId?: string;
  to?: string;
  isGroup?: boolean;
  isFromMe?: boolean;
  ad_reply?: {
    source_id?: string;
  };
}

// ============================================================================
// DEBOUNCE SERVICE
// ============================================================================

// Store timers in memory (not in KV since timers can't be serialized)
const messageTimers = new Map<string, number>();

async function queueMessageForDebouncing(params: {
  deviceId: string;
  webhookId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
}): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;

  // Get current queue for this device + phone combination
  const queueKey = ["message_queue", deviceId, phone];
  const timerKey = `${deviceId}:${phone}`;

  const result = await kv.get<QueuedMessage>(queueKey);
  const existingQueue = result.value;

  // Cancel existing timer if it exists
  const existingTimer = messageTimers.get(timerKey);
  if (existingTimer) {
    clearTimeout(existingTimer);
    messageTimers.delete(timerKey);
    console.log(`⏱️  Existing timer cancelled, restarting debounce...`);
  }

  // Add new message to queue
  const updatedMessages = [
    ...(existingQueue?.messages || []),
    {
      phone,
      message,
      name,
      timestamp: Date.now(),
    },
  ];

  console.log(
    `📬 Message queued for debouncing (${DEBOUNCE_DELAY_MS}ms delay). Total messages in queue: ${updatedMessages.length}`
  );

  // Set new timer
  const timer = setTimeout(async () => {
    console.log(`⏰ Timer EXPIRED! Processing ${updatedMessages.length} messages...`);

    // Combine all messages
    const combinedMessage = updatedMessages.map((m) => m.message).join("\n");
    console.log(`📝 Combined message:\n${combinedMessage}`);

    // Execute flow
    await executePromptBasedFlow({
      deviceId,
      webhookId,
      phone,
      message: combinedMessage,
      name: updatedMessages[0].name,
      provider,
    });

    // Clear queue and timer
    await kv.delete(queueKey);
    messageTimers.delete(timerKey);
  }, DEBOUNCE_DELAY_MS);

  // Store timer in memory map
  messageTimers.set(timerKey, timer);

  // Save updated queue (without timer - just data)
  await kv.set(queueKey, {
    messages: updatedMessages,
    deviceId,
    webhookId,
    provider,
  });
}

// ============================================================================
// SEQUENCE ENROLLMENT
// ============================================================================

/**
 * Check if current stage matches any active sequence trigger and enroll prospect
 * Implements smart re-enrollment logic:
 * - If sequence_stage is null: Enroll in new sequence
 * - If sequence_stage equals current stage: Skip (already enrolled)
 * - If sequence_stage is different: Delete old scheduled messages and re-enroll
 */
async function checkAndEnrollSequences(params: {
  deviceId: string;
  prospectNum: string;
  currentStage: string | null;
  idProspect: string;
  instance: string;
}): Promise<void> {
  const { deviceId, prospectNum, currentStage, idProspect, instance } = params;

  if (!currentStage) {
    console.log(`⚠️  No current stage, skipping sequence check`);
    return;
  }

  console.log(`📋 Checking sequences for stage: ${currentStage}`);

  try {
    // Step 1: Find active sequences matching the current stage trigger
    const { data: matchingSequences, error: sequenceError } = await supabaseAdmin
      .from("sequences")
      .select("*, sequence_flows(*)")
      .eq("trigger", currentStage)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (sequenceError) {
      console.error("❌ Error fetching sequences:", sequenceError);
      return;
    }

    if (!matchingSequences || matchingSequences.length === 0) {
      console.log(`ℹ️  No active sequences found for trigger: ${currentStage}`);
      return;
    }

    console.log(`✅ Found ${matchingSequences.length} active sequence(s) for trigger: ${currentStage}`);

    // Step 2: Get current sequence_stage from ai_whatsapp
    const { data: leadData, error: leadError } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("sequence_stage")
      .eq("id_prospect", idProspect)
      .single();

    if (leadError) {
      console.error("❌ Error fetching lead data:", leadError);
      return;
    }

    const sequenceStage = leadData?.sequence_stage;

    console.log(`📊 Current sequence_stage: ${sequenceStage || 'null'}`);

    // Step 3: Implement enrollment logic
    if (sequenceStage === currentStage) {
      console.log(`⏭️  Already enrolled in sequence for stage "${currentStage}", skipping`);
      return;
    }

    // Step 4: If sequence_stage is different (past sequence), delete old scheduled messages
    if (sequenceStage && sequenceStage !== currentStage) {
      console.log(`🗑️  Different sequence detected (old: "${sequenceStage}", new: "${currentStage}")`);
      console.log(`🗑️  Deleting old scheduled messages...`);

      // Get all scheduled messages for this prospect
      const { data: scheduledMessages, error: scheduledError } = await supabaseAdmin
        .from("sequence_scheduled_messages")
        .select("whacenter_message_id")
        .eq("prospect_num", prospectNum)
        .eq("device_id", deviceId)
        .eq("status", "scheduled");

      if (scheduledError) {
        console.error("❌ Error fetching scheduled messages:", scheduledError);
      } else if (scheduledMessages && scheduledMessages.length > 0) {
        console.log(`📋 Found ${scheduledMessages.length} scheduled messages to delete`);

        // Delete from WhatsApp Center API
        for (const msg of scheduledMessages) {
          if (msg.whacenter_message_id) {
            try {
              // Build URL with query parameters for GET request
              const deleteUrl = `${WHACENTER_API_URL}/api/deleteMessage?device_id=${encodeURIComponent(instance)}&id=${encodeURIComponent(msg.whacenter_message_id)}`;

              const deleteResponse = await fetch(deleteUrl, {
                method: 'GET',
              });

              if (deleteResponse.ok) {
                console.log(`✅ Deleted scheduled message: ${msg.whacenter_message_id}`);
              } else {
                console.error(`❌ Failed to delete message: ${await deleteResponse.text()}`);
              }
            } catch (deleteError) {
              console.error(`❌ Error deleting message from API:`, deleteError);
            }
          }
        }

        // Update status in database to 'cancelled'
        const { error: updateError } = await supabaseAdmin
          .from("sequence_scheduled_messages")
          .update({ status: "cancelled" })
          .eq("prospect_num", prospectNum)
          .eq("device_id", deviceId)
          .eq("status", "scheduled");

        if (updateError) {
          console.error("❌ Error updating scheduled messages status:", updateError);
        } else {
          console.log(`✅ Updated ${scheduledMessages.length} messages to cancelled status`);
        }
      }

      // Delete old enrollment record
      const { error: deleteEnrollmentError } = await supabaseAdmin
        .from("sequence_enrollments")
        .delete()
        .eq("prospect_num", prospectNum);

      if (deleteEnrollmentError) {
        console.error("❌ Error deleting old enrollment:", deleteEnrollmentError);
      }
    }

    // Step 5: Enroll in new sequence (using the first matching sequence)
    const sequence = matchingSequences[0];
    console.log(`🎯 Enrolling in sequence: ${sequence.name}`);

    // Get sequence flows ordered by flow_number
    const { data: flows, error: flowsError } = await supabaseAdmin
      .from("sequence_flows")
      .select("*")
      .eq("sequence_id", sequence.id)
      .order("flow_number", { ascending: true });

    if (flowsError || !flows || flows.length === 0) {
      console.error("❌ No flows found for sequence:", flowsError);
      return;
    }

    console.log(`📨 Found ${flows.length} flow(s) to schedule`);

    // Create enrollment record
    // Calculate Malaysia timezone (UTC+8) for schedule_message column
    // Indonesia timezone is UTC+7, add 1 hour to get Malaysia timezone
    const malaysiaTime = new Date(new Date().getTime() + (8 * 60 * 60 * 1000) + (1 * 60 * 60 * 1000));

    const { data: enrollment, error: enrollmentError } = await supabaseAdmin
      .from("sequence_enrollments")
      .insert({
        sequence_id: sequence.id,
        prospect_num: prospectNum,
        enrolled_at: new Date().toISOString(),
        schedule_message: malaysiaTime.toISOString(),
        status: "active",
      })
      .select()
      .single();

    if (enrollmentError || !enrollment) {
      console.error("❌ Error creating enrollment:", enrollmentError);
      return;
    }

    console.log(`✅ Created enrollment: ${enrollment.id}`);

    // Step 6: Schedule all flow messages with cumulative delays
    const now = new Date();
    let cumulativeDelayHours = 0;

    for (const flow of flows) {
      cumulativeDelayHours += flow.delay_hours;

      // Calculate scheduled time: current time + cumulative delay + 7 hours (Indonesia timezone offset from UTC)
      // WhatsApp Center API expects time in Indonesia timezone format (UTC+7)
      const scheduledTime = new Date(now.getTime() + (cumulativeDelayHours * 60 * 60 * 1000) + (7 * 60 * 60 * 1000));

      // Format: YYYY-MM-DD HH:MM:SS
      // This will be in Indonesia timezone when interpreted by WhatsApp Center
      const scheduleString = scheduledTime.toISOString()
        .replace('T', ' ')
        .substring(0, 19);

      console.log(`📅 Scheduling flow ${flow.flow_number}: ${scheduleString} (delay: ${cumulativeDelayHours}h, Indonesia UTC+7)`);

      try {
        // Send scheduled message to WhatsApp Center API
        const sendUrl = `${WHACENTER_API_URL}/api/send`;
        const formData = new URLSearchParams();
        formData.append('device_id', instance);
        formData.append('number', prospectNum);
        formData.append('message', flow.message);
        formData.append('schedule', scheduleString);

        // Add image if present
        if (flow.image_url) {
          formData.append('file', flow.image_url);
        }

        const sendResponse = await fetch(sendUrl, {
          method: 'POST',
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });

        if (!sendResponse.ok) {
          const errorText = await sendResponse.text();
          console.error(`❌ WhatsApp API error response: ${errorText}`);
          throw new Error(`WhatsApp API error: ${errorText}`);
        }

        const responseData = await sendResponse.json();

        // Log the full API response to understand the format
        console.log(`📦 WhatsApp Center API Response:`, JSON.stringify(responseData, null, 2));

        // Extract message ID from response (WhatsApp Center returns it in responseData.data.id)
        const whacenterMessageId = responseData?.data?.id || responseData?.id || responseData?.message_id || null;

        console.log(`✅ Scheduled message via API, ID: ${whacenterMessageId || 'unknown (check response above)'}`);

        // Save to sequence_scheduled_messages table
        const { data: savedMessage, error: saveError } = await supabaseAdmin
          .from("sequence_scheduled_messages")
          .insert({
            enrollment_id: enrollment.id,
            sequence_id: sequence.id,
            flow_number: flow.flow_number,
            prospect_num: prospectNum,
            device_id: deviceId,
            whacenter_message_id: String(whacenterMessageId),
            message: flow.message,
            image_url: flow.image_url,
            scheduled_time: scheduledTime.toISOString(),
            status: "scheduled",
          })
          .select()
          .single();

        if (saveError) {
          console.error(`❌ Error saving scheduled message to database:`, saveError);
        } else {
          console.log(`💾 Saved scheduled message to database (DB ID: ${savedMessage.id}, WhatsApp ID: ${whacenterMessageId})`);
        }

      } catch (scheduleError) {
        console.error(`❌ Error scheduling flow ${flow.flow_number}:`, scheduleError);
      }
    }

    // Step 7: Update sequence_stage in ai_whatsapp
    const { error: updateStageError } = await supabaseAdmin
      .from("ai_whatsapp")
      .update({ sequence_stage: currentStage })
      .eq("id_prospect", idProspect);

    if (updateStageError) {
      console.error("❌ Error updating sequence_stage:", updateStageError);
    } else {
      console.log(`✅ Updated sequence_stage to: ${currentStage}`);
    }

    console.log(`🎉 Successfully enrolled in sequence: ${sequence.name}`);

  } catch (error) {
    console.error("❌ Sequence enrollment error:", error);
  }
}

// ============================================================================
// PROMPT-BASED FLOW EXECUTION
// ============================================================================

async function executePromptBasedFlow(params: {
  deviceId: string;
  webhookId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
}): Promise<void> {
  const { deviceId, webhookId, phone, message, name, provider } = params;

  console.log(`\n🚀 === PROMPT-BASED FLOW EXECUTION START ===`);
  console.log(`📱 Device ID: ${deviceId}`);
  console.log(`📞 Phone: ${phone}`);
  console.log(`💬 Message: ${message}`);

  // Step 1: Get device details
  const { data: device, error: deviceError } = await supabaseAdmin
    .from("device_setting")
    .select("*")
    .eq("device_id", deviceId)
    .eq("instance", webhookId)  // ✅ FIXED: Changed from webhook_id to instance
    .single();

  if (deviceError || !device) {
    console.error("❌ Device not found:", deviceError);
    return;
  }

  console.log(`✅ Device found: ${device.device_id}`);

  // Step 1.5: Check if user's subscription is expired
  if (device.user_id) {
    const { data: userData } = await supabaseAdmin
      .from("user")
      .select("role, subscription_end")
      .eq("id", device.user_id)
      .single();

    if (userData) {
      // Admin users never expire
      const isAdmin = userData.role === 'admin';

      if (!isAdmin && userData.subscription_end) {
        // Check if subscription_end > NOW()
        const endDate = new Date(userData.subscription_end);
        const now = new Date();

        const isExpired = now > endDate;

        if (isExpired) {
          console.log(`⚠️  Subscription expired for user ${device.user_id}. Deleting device from WhatsApp Center...`);

          // Delete device from WhatsApp Center API (one-time action)
          try {
            const deleteUrl = `${WHACENTER_API_URL}/api/${WHACENTER_API_KEY}/deleteDevice/${device.instance}`;
            console.log(`🗑️  Calling delete API: ${deleteUrl}`);

            const deleteResponse = await fetch(deleteUrl, {
              method: 'DELETE',
            });

            if (deleteResponse.ok) {
              console.log(`✅ Device ${device.instance} deleted from WhatsApp Center`);
            } else {
              console.error(`❌ Failed to delete device: ${await deleteResponse.text()}`);
            }
          } catch (deleteError) {
            console.error(`❌ Error deleting device from WhatsApp Center:`, deleteError);
          }

          console.log(`🚫 Subscription expired - stopping message processing`);
          return; // Stop processing
        }
      }
    }
  }

  // Step 2: Get prompt from prompts table
  const { data: prompt, error: promptError } = await supabaseAdmin
    .from("prompts")
    .select("*")
    .eq("device_id", deviceId)
    .single();

  if (promptError || !prompt) {
    console.error("❌ No prompt configured for this device");
    return;
  }

  console.log(`✅ Found prompt: ${prompt.prompts_name}`);

  // Step 3: Check if conversation exists
  const { data: existingConversation } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("device_id", device.device_id)
    .eq("prospect_num", phone)
    .single();

  let conversation = existingConversation;

  // Step 4: Create or update conversation
  if (!conversation) {
    // Create new conversation
    const today = new Date().toISOString().split("T")[0]; // Y-m-d format

    const conversationData = {
      device_id: device.device_id,
      prospect_num: phone,
      prospect_name: name || "Unknown",
      niche: prompt.niche || "",  // ✅ Get niche from prompts table
      intro: "",
      stage: null,  // ✅ FIXED: Default to null instead of "active"
      conv_current: message,
      conv_last: "",
      human: null,  // ✅ FIXED: Default to null (AI mode) for consistency with commands
      date_insert: today,
      user_id: device.user_id,
      detail: "",
    };

    const { data: newConversation, error: createError } = await supabaseAdmin
      .from("ai_whatsapp")
      .insert(conversationData)
      .select()
      .single();

    if (createError) {
      console.error("❌ Failed to create conversation:", createError);
      return;
    }

    conversation = newConversation;
    console.log(`✅ New conversation created: ${conversation.id_prospect}`);
  } else {
    // Update existing conversation - just update conv_current
    // DON'T touch conv_last here - it will be updated later with proper User:/Bot: format
    await supabaseAdmin
      .from("ai_whatsapp")
      .update({
        conv_current: message,
      })
      .eq("id_prospect", conversation.id_prospect);

    console.log(`✅ Conversation updated: ${conversation.id_prospect}`);

    // Refresh conversation data
    const { data: updatedConv } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("id_prospect", conversation.id_prospect)
      .single();

    conversation = updatedConv || conversation;
  }

  // Step 4.5: Check if human mode is active
  if (conversation.human === 1) {
    console.log(`⚠️  Human mode active for ${phone}, skipping AI processing`);
    return;
  }

  // Step 4.6: Check processing lock and insert
  const { data: existingProcess } = await supabaseAdmin
    .from("processing_tracker")
    .select("*")
    .eq("id_prospect", conversation.id_prospect)
    .eq("flow_type", "Chatbot AI")
    .single();

  if (existingProcess) {
    console.log(`⚠️  Process already running for id_prospect: ${conversation.id_prospect}, skipping execution`);
    return;
  }

  console.log(`✅ No existing process, proceeding with execution`);

  // Insert processing lock record
  const { error: insertLockError } = await supabaseAdmin
    .from("processing_tracker")
    .insert({
      id_prospect: conversation.id_prospect,
      flow_type: "Chatbot AI",
      created_at: new Date().toISOString(),
    });

  if (insertLockError) {
    console.error("❌ Failed to insert processing lock:", insertLockError);
    return;
  }

  console.log(`🔒 Processing lock created for id_prospect: ${conversation.id_prospect}`);

  // Wrap everything in try/finally to ensure lock is released
  try {
    // Step 5: Build conversation history from ai_whatsapp table
    const { data: history } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("prospect_num, conv_last, stage, date_insert")
      .eq("device_id", device.device_id)
      .eq("prospect_num", phone)
      .order("date_insert", { ascending: false })
      .limit(10);

    let conversationHistoryText = "";
    let currentStage: string | null = null;

    if (history && history.length > 0) {
      // Get current stage from most recent conversation
      currentStage = history[0].stage || null;

      // Build conversation history text
      conversationHistoryText = history
        .reverse()
        .map(h => `[${h.date_insert}] Customer: ${h.conv_last}`)
        .join("\n");
    }

    // Step 6: Generate AI response with UNIFIED prompt system
    console.log(`🤖 Generating AI response with prompt: ${prompt.prompts_name}`);
    console.log(`📊 Current Stage: ${currentStage || 'First Stage'}`);

    // Use unified prompt builder (JSON format + dynamic stages + details)
    const promptData = prompt.prompts_data || "You are a helpful assistant.";

    // Extract stages from prompt for fallback responses
    const stages = extractStagesFromPrompt(promptData);

    const systemContent = buildDynamicSystemPrompt(
      promptData,
      conversationHistoryText,
      currentStage,
      false // useOneMessage - can be made configurable
    );

    const currentText = message;

    // Use OpenRouter API key and model from device settings
    let aiResponseRaw: string = "";
    let retryCount = 0;
    const MAX_RETRIES = 2;

    // Retry logic for AI API failures
    while (retryCount <= MAX_RETRIES) {
      try {
        aiResponseRaw = await generateAIResponse(
          systemContent,
          currentText,
          device.api_key,
          device.api_key_option || "openai/gpt-4o-mini"
        );

        console.log(`✅ AI Response Raw (attempt ${retryCount + 1}):`, aiResponseRaw);
        break; // Success, exit retry loop

      } catch (error) {
        retryCount++;
        console.error(`❌ AI API failed (attempt ${retryCount}/${MAX_RETRIES + 1}):`, error);

        if (retryCount > MAX_RETRIES) {
          // Final fallback: Use simple error response
          console.error(`❌ All AI API retries failed, using fallback response`);
          aiResponseRaw = JSON.stringify({
            Stage: currentStage || stages[0] || "Unknown",
            Detail: "",
            Response: [
              { type: "text", content: "Maaf, sistem sedang mengalami gangguan. Sila cuba sebentar lagi. 🙏" }
            ]
          });
        } else {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // Parse JSON response
    let aiResponse;
    let extractedDetails: string | null = null;

    try {
      aiResponse = JSON.parse(aiResponseRaw!);
      console.log(`✅ AI Response Parsed (JSON):`, JSON.stringify(aiResponse, null, 2));

      // Validate response structure
      if (!aiResponse.Response || !Array.isArray(aiResponse.Response)) {
        throw new Error("Invalid response structure: missing Response array");
      }

      // Extract details from "Detail" field if present
      if (aiResponse.Detail) {
        extractedDetails = extractDetailsFromResponse(aiResponse.Detail);
        if (extractedDetails) {
          console.log(`📝 Extracted Details: ${extractedDetails.substring(0, 100)}...`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to parse AI response as JSON:`, error);

      // Fallback: treat as plain text or use error message
      const fallbackMessage = typeof aiResponseRaw === 'string' && aiResponseRaw.length > 0
        ? aiResponseRaw.substring(0, 500) // Limit length
        : "Maaf, terdapat masalah dengan respons AI. Sila cuba lagi.";

      aiResponse = {
        Stage: currentStage || stages[0] || "Unknown",
        Detail: "",
        Response: [
          { type: "text", content: fallbackMessage }
        ]
      };
    }

    // Step 6: Process and send responses
    const responses = aiResponse.Response || [];
    let allSentMessages: string[] = [];
    const MESSAGE_DELAY_MS = 5000; // 5 seconds delay between messages

    for (let i = 0; i < responses.length; i++) {
      const item = responses[i];

      if (item.type === "text") {
        // Replace auto-variables in message content
        const messageContent = replaceAutoVariables(item.content, conversation, device);

        // Send text message
        console.log(`📤 Sending message ${i + 1}/${responses.length} (text)`);
        await sendWhatsAppMessage({
          provider,
          device,
          phone,
          message: messageContent,
        });
        allSentMessages.push(`Bot: ${messageContent}`);

      } else if (item.type === "image" && item.content) {
        // Send image
        console.log(`📤 Sending message ${i + 1}/${responses.length} (image)`);
        await sendWhatsAppMedia({
          provider,
          device,
          phone,
          mediaUrl: item.content,
          mediaType: "image",
          caption: "",
        });
        allSentMessages.push(`Bot: ${item.content}`);

      } else if (item.type === "video" && item.content) {
        // Send video
        console.log(`📤 Sending message ${i + 1}/${responses.length} (video)`);
        await sendWhatsAppMedia({
          provider,
          device,
          phone,
          mediaUrl: item.content,
          mediaType: "video",
          caption: "",
        });
        allSentMessages.push(`Bot: ${item.content}`);
      }

      // Add delay between messages (except after the last message)
      if (i < responses.length - 1) {
        console.log(`⏱️  Waiting ${MESSAGE_DELAY_MS}ms (${MESSAGE_DELAY_MS / 1000}s) before next message...`);
        await new Promise(resolve => setTimeout(resolve, MESSAGE_DELAY_MS));
      }
    }

    // Update conv_last - Append to existing conversation history
    const { data: currentConv } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("conv_last")
      .eq("id_prospect", conversation.id_prospect)
      .single();

    let convLast = currentConv?.conv_last || "";

    // Add user messages - split multi-line messages and add User: prefix to each line
    const userMessages = message.split("\n").filter(line => line.trim() !== "");
    for (const userMsg of userMessages) {
      const userLine = `User: ${userMsg}`;
      if (convLast) {
        convLast += "\n" + userLine;
      } else {
        convLast = userLine;
      }
    }

    // Add all bot responses
    for (const botMsg of allSentMessages) {
      convLast += "\n" + botMsg;
    }

    // Prepare update data with stage and details
    const updateData: any = {
      conv_last: convLast,
      stage: aiResponse.Stage || null,  // ✅ Update stage from AI response
      conv_current: null,  // ✅ Clear conv_current after processing
    };

    // Save extracted details if present
    if (extractedDetails) {
      updateData.detail = extractedDetails;
      console.log(`📝 Saving customer details: ${extractedDetails.substring(0, 100)}...`);
    }

    // Update conversation with conv_last, stage, details, and clear conv_current
    await supabaseAdmin
      .from("ai_whatsapp")
      .update(updateData)
      .eq("id_prospect", conversation.id_prospect);

    console.log(`✅ Updated conversation:`);
    console.log(`   - Stage: ${aiResponse.Stage}`);
    console.log(`   - Has Details: ${extractedDetails ? 'Yes' : 'No'}`);
    console.log(`   - Cleared conv_current`);

    // Step 7: Check and enroll in sequences (if stage matches)
    console.log(`🔄 Checking for sequence enrollment...`);
    await checkAndEnrollSequences({
      deviceId: device.device_id,
      prospectNum: phone,
      currentStage: aiResponse.Stage || null,
      idProspect: conversation.id_prospect,
      instance: device.instance,
    });

    console.log(`✅ === PROMPT-BASED FLOW EXECUTION COMPLETE ===\n`);
  } catch (error) {
    console.error("❌ Flow execution error:", error);

    // Clear conv_current even on error to prevent stuck messages
    try {
      await supabaseAdmin
        .from("ai_whatsapp")
        .update({ conv_current: null })
        .eq("id_prospect", conversation.id_prospect);
      console.log(`✅ Cleared conv_current after error`);
    } catch (clearError) {
      console.error("❌ Failed to clear conv_current:", clearError);
    }
  } finally {
    // Step 8: Delete processing lock record (always execute, even on error)
    const { error: deleteLockError } = await supabaseAdmin
      .from("processing_tracker")
      .delete()
      .eq("id_prospect", conversation.id_prospect)
      .eq("flow_type", "Chatbot AI");

    if (deleteLockError) {
      console.error("❌ Failed to delete processing lock:", deleteLockError);
    } else {
      console.log(`🔓 Processing lock released for id_prospect: ${conversation.id_prospect}`);
    }
  }
}

// ============================================================================
// DYNAMIC PROMPT SYSTEM - STAGE & DETAIL EXTRACTION
// ============================================================================
//
// This system allows users to define custom chatbot behaviors with:
// - Dynamic stage tracking using !!Stage [name]!! markers
// - Customer detail capture using %% markers
// - Automatic variable replacement ({{name}}, {{phone}}, etc.)
// - Works with ANY user-defined stage names and field structures
//
// Key Features:
// 1. Auto-extracts all stages from user's prompt
// 2. Captures ANY fields wrapped in %% markers
// 3. Tracks conversation stage in database
// 4. Supports backward compatibility with JSON format
//
// See DYNAMIC_PROMPT_SYSTEM.md for detailed documentation
// ============================================================================

/**
 * Extract stage names from prompt
 * Finds all !!Stage [name]!! markers
 */
function extractStagesFromPrompt(promptData: string): string[] {
  const stageRegex = /!!Stage\s+([^!]+)!!/g;
  const stages: string[] = [];
  let match;

  while ((match = stageRegex.exec(promptData)) !== null) {
    const stageName = match[1].trim();
    if (!stages.includes(stageName)) {
      stages.push(stageName);
    }
  }

  // If no stages found, return default
  if (stages.length === 0) {
    return ['Welcome Message', 'Conversation', 'Closing'];
  }

  return stages;
}

/**
 * Extract details from response using %% markers
 */
function extractDetailsFromResponse(response: string): string | null {
  const detailRegex = /%%([\s\S]*?)%%/;
  const match = response.match(detailRegex);
  return match ? match[1].trim() : null;
}

/**
 * Extract stage from response using !!Stage!! markers
 */
function extractStageFromResponse(response: string): string | null {
  const stageRegex = /!!Stage\s+([^!]+)!!/;
  const match = response.match(stageRegex);
  return match ? match[1].trim() : null;
}

/**
 * Replace auto-variables in message content
 * Supports: {{name}}, {{phone}}, {{product}}
 */
function replaceAutoVariables(content: string, conversation: any, device: any): string {
  let replaced = content;

  // Replace {{name}} with prospect name
  if (conversation.prospect_name) {
    replaced = replaced.replace(/\{\{name\}\}/g, conversation.prospect_name);
  }

  // Replace {{phone}} with prospect phone number
  if (conversation.prospect_num) {
    replaced = replaced.replace(/\{\{phone\}\}/g, conversation.prospect_num);
  }

  // Replace {{product}} with niche/product
  if (conversation.niche) {
    replaced = replaced.replace(/\{\{product\}\}/g, conversation.niche);
  }

  return replaced;
}

/**
 * Build UNIFIED system prompt with JSON format + dynamic stage tracking + detail capture
 * This replaces both the old JSON-only and dynamic text-only prompts
 */
function buildDynamicSystemPrompt(
  promptData: string,
  conversationHistory: string,
  currentStage: string | null,
  useOneMessage: boolean = false
): string {
  const stages = extractStagesFromPrompt(promptData);

  return `${promptData}

---

⚠️⚠️⚠️ CRITICAL SYSTEM INSTRUCTIONS - YOU MUST FOLLOW EXACTLY ⚠️⚠️⚠️

### CURRENT CONTEXT:
- Current Stage: ${currentStage || stages[0] || 'First Stage'}
- Available Stages: ${stages.map((s, i) => `${i + 1}. ${s}`).join(', ')}
- Previous Conversation:
${conversationHistory || 'No previous conversation - this is the FIRST message'}

${!currentStage ? `
🚨🚨🚨 CRITICAL: THIS IS THE FIRST MESSAGE FROM CUSTOMER 🚨🚨🚨

MANDATORY RULES FOR FIRST MESSAGE:
1. You MUST ALWAYS use "Stage": "${stages[0] || 'Welcome Message'}" for first contact
2. NEVER skip to other stages like "Create Urgency", "Promotions", or "Collect Details"
3. Even if customer says "hai", "hello", "nak tanye" - still use first stage ONLY
4. ONLY skip first stage if customer EXPLICITLY asks about pricing/packages in their FIRST message (e.g., "Berapa harga?", "Ada pakej apa?")
5. General greetings like "Hai", "Nak tanye blh?", "Hello" = USE FIRST STAGE "${stages[0] || 'Welcome Message'}"

⛔ FORBIDDEN for first message:
- "Create Urgency with Promotions" ❌
- "Dapat Detail" ❌
- "Collect Details" ❌
- Any stage OTHER than "${stages[0] || 'Welcome Message'}" ❌
` : `
📍 Continue from stage: "${currentStage}"
- Progress to next stage only if customer's response indicates they're ready
- Follow the stage flow sequentially
- Don't skip stages unless customer explicitly requests specific information
`}

### RESPONSE FORMAT (MANDATORY JSON):
You MUST respond ONLY with valid JSON in this exact format:

{
  "Stage": "[exact stage name from available stages]",
  "Detail": "%%[FIELD]: [value]\\n[FIELD2]: [value2]%%" (optional, only when collecting customer info),
  "Response": [
    {"type": "text", "content": "Your message here"},
    {"type": "image", "content": "https://example.com/image.jpg"},
    {"type": "text", "content": "Next message"}
  ]
}

### RULES:

1. **JSON FORMAT ONLY**:
   - Response MUST be valid JSON
   - NO plain text outside JSON
   - NO markdown formatting outside JSON

2. **STAGE FIELD** (MANDATORY):
   - "Stage" field MUST match EXACTLY one of: ${stages.map(s => `"${s}"`).join(', ')}
   - ⚠️ FIRST MESSAGE RULE: If this is customer's FIRST message (no previous conversation), you MUST use "${stages[0] || 'Welcome Message'}" unless they explicitly ask about pricing/packages
   - General greetings ("Hai", "Hello", "Nak tanye") on FIRST contact = ALWAYS use first stage
   - For ongoing conversations: Progress to next stage based on customer's response
   - Follow sequential stage flow

3. **DETAIL FIELD** (OPTIONAL):
   - Include "Detail" field ONLY when you collect customer information
   - Format: "%%NAMA: John\\nALAMAT: 123 Street\\nNO FONE: 0123%%"
   - Capture ANY relevant fields (name, address, phone, package, price, etc.)
   - Leave empty if no details collected
   - ⚠️ IMPORTANT: When confirming details with customer, you MUST display the captured details in the Response array (not just in Detail field)
   - Show details clearly formatted for customer to verify

4. **RESPONSE ARRAY**:
   - Divide long messages into multiple short "text" entries
   - Images: {"type": "image", "content": "URL"}
   - Text: {"type": "text", "content": "message"}
   - Video: {"type": "video", "content": "URL"}
   - Add "Jenis": "onemessage" to text items if needed for formatting

5. **VARIABLE REPLACEMENT**:
   - Replace {{name}}, {{phone}}, {{target}}, etc. from conversation context
   - Extract from previous messages

6. **DO NOT REPEAT**:
   - Don't repeat same sentences from conversation history
   - Keep responses fresh and contextual

### EXAMPLE RESPONSE:

{
  "Stage": "Create Urgency with Promotions",
  "Detail": "",
  "Response": [
    {"type": "text", "content": "Hai kak! PROMO JIMAT BERGANDA hari ni untuk 50 orang terawal."},
    {"type": "image", "content": "https://automation.erprolevision.com/public/images/promo1.jpg"},
    {"type": "image", "content": "https://automation.erprolevision.com/public/images/promo2.jpg"},
    {"type": "text", "content": "Kalau booking hari ni, dapat FREE postage & masuk cabutan bertuah!"}
  ]
}

### EXAMPLE WITH DETAILS (CAPTURING):

{
  "Stage": "Collect Details",
  "Detail": "%%NAMA: Ali bin Abu\\nALAMAT: 123 Jalan Sultan\\nNO FONE: 0123456789\\nPAKEJ: 3 Botol%%",
  "Response": [
    {"type": "text", "content": "Terima kasih! Kami akan proses pesanan untuk 3 botol."}
  ]
}

### EXAMPLE WITH DETAILS (CONFIRMING):

{
  "Stage": "Confirm Details",
  "Detail": "%%NAMA: Ali bin Abu\\nALAMAT: 123 Jalan Sultan\\nNO FONE: 0123456789\\nPAKEJ: 3 Botol\\nHARGA: RM120%%",
  "Response": [
    {"type": "text", "content": "Terima kasih! Sila semak detail tempahan:"},
    {"type": "text", "content": "NAMA: Ali bin Abu\\nALAMAT: 123 Jalan Sultan\\nNO FONE: 0123456789\\nPAKEJ: 3 Botol\\nHARGA: RM120"},
    {"type": "text", "content": "Semua detail dah betul kan? Kalau ada apa-apa nak ubah, boleh beritahu sekarang."}
  ]
}

NOW RESPOND TO THE USER'S MESSAGE IN VALID JSON FORMAT ONLY:`;
}

/**
 * Parse AI response and extract structured data
 */
interface ParsedAIResponse {
  stage: string | null;
  details: string | null;
  cleanContent: string;
  hasStageMarker: boolean;
  hasDetails: boolean;
}

function parseAIResponse(response: string): ParsedAIResponse {
  const stage = extractStageFromResponse(response);
  const details = extractDetailsFromResponse(response);

  // Remove stage markers and detail blocks from visible content
  let cleanContent = response;

  // Remove !!Stage!! markers
  cleanContent = cleanContent.replace(/!!Stage\s+[^!]+!!\n?/g, '');

  // Remove %% detail blocks
  cleanContent = cleanContent.replace(/%%[\s\S]*?%%\n?/g, '');

  cleanContent = cleanContent.trim();

  return {
    stage,
    details,
    cleanContent,
    hasStageMarker: stage !== null,
    hasDetails: details !== null,
  };
}

// ============================================================================
// AI RESPONSE GENERATION
// ============================================================================

async function generateAIResponse(
  systemContent: string,
  currentText: string,
  openrouterApiKey: string,
  aiModel: string
): Promise<string> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: aiModel,
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: currentText,
          },
        ],
        temperature: 0.3,  // Lower temperature for more consistent instruction following
        top_p: 1,
        repetition_penalty: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error("❌ AI generation error:", error);
    return "Sorry, I encountered an error processing your message.";
  }
}

// ============================================================================
// WHATSAPP MESSAGE SENDING
// ============================================================================

async function sendWhatsAppMessage(params: {
  provider: string;
  device: any;
  phone: string;
  message: string;
}): Promise<void> {
  const { provider, device, phone, message } = params;

  if (provider !== "whacenter") {
    console.error(`❌ Unsupported provider: ${provider}`);
    return;
  }

  try {
    const url = `${WHACENTER_API_URL}/api/send`;

    // Create form data
    const formData = new URLSearchParams();
    formData.append('device_id', device.instance);
    formData.append('number', phone);
    formData.append('message', message);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Center API error: ${response.statusText}`);
    }

    console.log(`✅ WhatsApp Center text message sent to ${phone}`);
  } catch (error) {
    console.error("❌ Failed to send WhatsApp message:", error);
  }
}

async function sendWhatsAppMedia(params: {
  provider: string;
  device: any;
  phone: string;
  mediaUrl: string;
  mediaType: string;
  caption: string;
}): Promise<void> {
  const { provider, device, phone, mediaUrl, mediaType, caption } = params;

  if (provider !== "whacenter") {
    console.error(`❌ Unsupported provider: ${provider}`);
    return;
  }

  try {
    const url = `${WHACENTER_API_URL}/api/send`;

    // Determine media type by extension
    const ext = mediaUrl.split(".").pop()?.toLowerCase() || "";

    // Create form data
    const formData = new URLSearchParams();
    formData.append('device_id', device.instance);
    formData.append('number', phone);
    formData.append('message', caption || '');
    formData.append('file', mediaUrl);

    // Set type based on extension
    if (ext === "mp4" || mediaType === "video") {
      formData.append('type', 'video');
    } else if (ext === "mp3" || ext === "wav" || mediaType === "audio") {
      formData.append('type', 'audio');
    }
    // For images, don't set type parameter (default behavior)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Center API error: ${response.statusText}`);
    }

    console.log(`✅ WhatsApp Center ${mediaType} sent to ${phone}`);
  } catch (error) {
    console.error(`❌ Failed to send WhatsApp ${mediaType}:`, error);
  }
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

async function handleWebhook(request: Request): Promise<Response> {
  // Extract device_id and instance from URL path
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter((p) => p);

  if (pathParts.length < 2) {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid webhook URL format" }),
      { status: 400, headers: corsHeaders }
    );
  }

  const deviceId = pathParts[0];
  const webhookId = pathParts[1];

  console.log(`\n📥 Webhook: POST /${deviceId}/${webhookId}`);

  try {
    // Parse webhook payload (WhatsApp Center format)
    const payload: WhaCenterWebhookPayload = await request.json();

    console.log(`📦 Payload:`, JSON.stringify(payload, null, 2));

    // Skip group messages
    if (payload.isGroup === true) {
      console.log("⚠️  Group message, ignoring");
      return new Response(
        JSON.stringify({ success: true, message: "Group message ignored" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get device from database
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("instance", webhookId)
      .single();

    if (deviceError || !device) {
      console.error("❌ Device not found:", deviceError);
      return new Response(
        JSON.stringify({ success: false, error: "Device not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ Device found: ${device.device_id} (Provider: ${device.provider})`);

    // Extract message details from WhatsApp Center payload
    const phone = payload.from || payload.phone || "";
    const message = payload.message?.trim() || "";
    const name = payload.pushName || "Unknown";

    if (!message) {
      console.log("⚠️  Empty message, ignoring");
      return new Response(
        JSON.stringify({ success: true, message: "Empty message ignored" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Handle special commands for messages from self
    if (payload.isFromMe === true) {
      const firstChar = message.charAt(0);

      // Command 'cmd' - Set human mode to 1
      if (message === 'cmd') {
        await supabaseAdmin
          .from("ai_whatsapp")
          .update({ human: 1 })
          .eq("device_id", device.device_id)
          .eq("prospect_num", phone);

        console.log(`✅ Set human mode to 1 for ${phone}`);
        return new Response(
          JSON.stringify({ success: true, message: "Human mode activated" }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Command 'dmc' - Set human mode to null (disable)
      if (message === 'dmc') {
        await supabaseAdmin
          .from("ai_whatsapp")
          .update({ human: null })
          .eq("device_id", device.device_id)
          .eq("prospect_num", phone);

        console.log(`✅ Set human mode to null for ${phone}`);
        return new Response(
          JSON.stringify({ success: true, message: "Human mode deactivated" }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Skip other isFromMe messages unless they start with '%' or '#'
      if (firstChar !== '%' && firstChar !== '#') {
        console.log("⚠️  Message from self (not special command), ignoring");
        return new Response(
          JSON.stringify({ success: true, message: "Self message ignored" }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    console.log(`📱 From: ${name} (${phone})`);
    console.log(`💬 Message: ${message}`);

    // Handle DELETE command - Delete conversation, scheduled messages, and enrollments
    if (message === 'DELETE') {
      console.log(`🗑️  DELETE command received from ${phone}`);

      try {
        // Step 1: Delete all scheduled messages for this prospect from WhatsApp Center API
        const { data: scheduledMessages } = await supabaseAdmin
          .from("sequence_scheduled_messages")
          .select("whacenter_message_id")
          .eq("prospect_num", phone)
          .eq("device_id", device.device_id)
          .eq("status", "scheduled");

        if (scheduledMessages && scheduledMessages.length > 0) {
          console.log(`📋 Deleting ${scheduledMessages.length} scheduled messages from WhatsApp Center...`);

          for (const msg of scheduledMessages) {
            if (msg.whacenter_message_id) {
              try {
                // Build URL with query parameters for GET request
                const deleteUrl = `${WHACENTER_API_URL}/api/deleteMessage?device_id=${encodeURIComponent(device.instance)}&id=${encodeURIComponent(msg.whacenter_message_id)}`;

                const deleteResponse = await fetch(deleteUrl, {
                  method: 'GET',
                });

                if (deleteResponse.ok) {
                  console.log(`✅ Deleted scheduled message: ${msg.whacenter_message_id}`);
                } else {
                  console.error(`❌ Failed to delete message: ${await deleteResponse.text()}`);
                }
              } catch (deleteError) {
                console.error(`❌ Error deleting message from API:`, deleteError);
              }
            }
          }

          // Update database records to 'cancelled'
          await supabaseAdmin
            .from("sequence_scheduled_messages")
            .update({ status: "cancelled" })
            .eq("prospect_num", phone)
            .eq("device_id", device.device_id)
            .eq("status", "scheduled");

          console.log(`✅ Updated ${scheduledMessages.length} scheduled messages to cancelled`);
        }

        // Step 2: Delete enrollment records
        const { error: enrollmentDeleteError } = await supabaseAdmin
          .from("sequence_enrollments")
          .delete()
          .eq("prospect_num", phone);

        if (enrollmentDeleteError) {
          console.error(`❌ Error deleting enrollments:`, enrollmentDeleteError);
        } else {
          console.log(`✅ Deleted enrollment records for ${phone}`);
        }

        // Step 3: Delete conversation from ai_whatsapp
        const { error: deleteError } = await supabaseAdmin
          .from("ai_whatsapp")
          .delete()
          .eq("device_id", device.device_id)
          .eq("prospect_num", phone);

        if (!deleteError) {
          console.log(`✅ Deleted conversation for ${phone}`);

          // Send confirmation message
          const formData = new URLSearchParams();
          formData.append('device_id', device.instance);
          formData.append('number', phone);
          formData.append('message', 'Sudah Delete Data Anda (termasuk jadwal mesej yang dijadualkan)');

          await fetch(`${WHACENTER_API_URL}/api/send`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          });
        }

        return new Response(
          JSON.stringify({ success: true, message: "All data deleted (conversation, enrollments, and scheduled messages)" }),
          { status: 200, headers: corsHeaders }
        );
      } catch (error) {
        console.error(`❌ Error during DELETE operation:`, error);
        return new Response(
          JSON.stringify({ success: false, error: String(error) }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Handle special character commands
    const firstChar = message.charAt(0);

    // Command '/' - Set human mode to 1 (extract phone from message)
    if (firstChar === '/') {
      const targetPhone = message.substring(1).trim();

      await supabaseAdmin
        .from("ai_whatsapp")
        .update({ human: 1 })
        .eq("device_id", device.device_id)
        .eq("prospect_num", targetPhone);

      console.log(`✅ Set human mode to 1 for ${targetPhone} via / command`);

      return new Response(
        JSON.stringify({ success: true, message: "Human mode activated" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Command '?' - Set human mode to null (extract phone from message)
    if (firstChar === '?') {
      const targetPhone = message.substring(1).trim();

      await supabaseAdmin
        .from("ai_whatsapp")
        .update({ human: null })
        .eq("device_id", device.device_id)
        .eq("prospect_num", targetPhone);

      console.log(`✅ Set human mode to null for ${targetPhone} via ? command`);

      return new Response(
        JSON.stringify({ success: true, message: "Human mode deactivated" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Command '!' - Cancel/delete all scheduled sequence messages for a phone number
    if (firstChar === '!') {
      const targetPhone = message.substring(1).trim();

      console.log(`🛑 Cancelling all scheduled messages for ${targetPhone} via ! command`);

      try {
        // Get all scheduled messages for this prospect
        const { data: scheduledMessages, error: scheduledError } = await supabaseAdmin
          .from("sequence_scheduled_messages")
          .select("whacenter_message_id")
          .eq("prospect_num", targetPhone)
          .eq("device_id", device.device_id)
          .eq("status", "scheduled");

        if (scheduledError) {
          console.error("❌ Error fetching scheduled messages:", scheduledError);
        } else if (scheduledMessages && scheduledMessages.length > 0) {
          console.log(`📋 Found ${scheduledMessages.length} scheduled messages to cancel`);

          // Delete from WhatsApp Center API
          for (const msg of scheduledMessages) {
            if (msg.whacenter_message_id) {
              try {
                // Build URL with query parameters for GET request
                const deleteUrl = `${WHACENTER_API_URL}/api/deleteMessage?device_id=${encodeURIComponent(device.instance)}&id=${encodeURIComponent(msg.whacenter_message_id)}`;

                const deleteResponse = await fetch(deleteUrl, {
                  method: 'GET',
                });

                if (deleteResponse.ok) {
                  console.log(`✅ Deleted scheduled message: ${msg.whacenter_message_id}`);
                } else {
                  console.error(`❌ Failed to delete message: ${await deleteResponse.text()}`);
                }
              } catch (deleteError) {
                console.error(`❌ Error deleting message from API:`, deleteError);
              }
            }
          }

          // Update status in database to 'cancelled'
          const { error: updateError } = await supabaseAdmin
            .from("sequence_scheduled_messages")
            .update({ status: "cancelled" })
            .eq("prospect_num", targetPhone)
            .eq("device_id", device.device_id)
            .eq("status", "scheduled");

          if (updateError) {
            console.error("❌ Error updating scheduled messages status:", updateError);
          } else {
            console.log(`✅ Cancelled ${scheduledMessages.length} scheduled messages`);
          }

          // Delete enrollment records
          const { error: enrollmentDeleteError } = await supabaseAdmin
            .from("sequence_enrollments")
            .delete()
            .eq("prospect_num", targetPhone);

          if (enrollmentDeleteError) {
            console.error(`❌ Error deleting enrollments:`, enrollmentDeleteError);
          } else {
            console.log(`✅ Deleted enrollment records for ${targetPhone}`);
          }

          // Clear sequence_stage in ai_whatsapp
          await supabaseAdmin
            .from("ai_whatsapp")
            .update({ sequence_stage: null })
            .eq("device_id", device.device_id)
            .eq("prospect_num", targetPhone);

          console.log(`✅ Cleared sequence_stage for ${targetPhone}`);

          return new Response(
            JSON.stringify({
              success: true,
              message: `Cancelled ${scheduledMessages.length} scheduled messages and deleted enrollments for ${targetPhone}`
            }),
            { status: 200, headers: corsHeaders }
          );
        } else {
          console.log(`ℹ️  No scheduled messages found for ${targetPhone}`);
          return new Response(
            JSON.stringify({
              success: true,
              message: `No scheduled messages found for ${targetPhone}`
            }),
            { status: 200, headers: corsHeaders }
          );
        }
      } catch (error) {
        console.error(`❌ Error cancelling scheduled messages:`, error);
        return new Response(
          JSON.stringify({ success: false, error: String(error) }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Command '#' - Trigger manual message with specified phone number
    if (firstChar === '#') {
      const targetPhone = message.substring(1).trim();

      // Update to process with special handling (similar to '%')
      await queueMessageForDebouncing({
        deviceId: device.device_id,
        webhookId: device.instance,
        phone: targetPhone,
        message: 'Teruskan',  // Default continuation message
        name: 'Manual',
        provider: device.provider,
      });

      console.log(`✅ Manual trigger for ${targetPhone} via # command`);

      return new Response(
        JSON.stringify({ success: true, message: "Manual message queued" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Rate limiting: 10 messages per minute per phone number
    const rateLimitKey = ["rate_limit", device.device_id, phone];
    const rateLimitData = await kv.get(rateLimitKey);
    const now = Date.now();
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    const RATE_LIMIT_MAX = 10; // 10 messages per minute

    if (rateLimitData.value) {
      const { count, timestamp } = rateLimitData.value as { count: number; timestamp: number };

      if (now - timestamp < RATE_LIMIT_WINDOW) {
        if (count >= RATE_LIMIT_MAX) {
          console.log(`⚠️ Rate limit exceeded for ${phone} (${count} messages in last minute)`);
          return new Response(
            JSON.stringify({ success: false, message: "Rate limit exceeded. Please wait before sending more messages." }),
            { status: 429, headers: corsHeaders }
          );
        }
        // Increment count within same window
        await kv.set(rateLimitKey, { count: count + 1, timestamp }, { expireIn: RATE_LIMIT_WINDOW });
      } else {
        // New window, reset count
        await kv.set(rateLimitKey, { count: 1, timestamp: now }, { expireIn: RATE_LIMIT_WINDOW });
      }
    } else {
      // First message, initialize counter
      await kv.set(rateLimitKey, { count: 1, timestamp: now }, { expireIn: RATE_LIMIT_WINDOW });
    }

    console.log(`✅ Rate limit check passed for ${phone}`);

    // Queue message for debouncing
    await queueMessageForDebouncing({
      deviceId: device.device_id,
      webhookId: device.instance,
      phone,
      message,
      name: name || "",
      provider: device.provider,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message queued for processing",
        device_id: device.device_id,
        instance: device.instance,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// AUTH HANDLERS
// ============================================================================

async function handleLogin(request: Request): Promise<Response> {
  try {
    const { email, password } = await request.json();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        user: data.user,
        session: data.session,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 401, headers: corsHeaders }
    );
  }
}

async function handleRegister(request: Request): Promise<Response> {
  try {
    const { email, password, full_name, username } = await request.json();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) throw authError;

    if (!authData.user) {
      throw new Error("User creation failed");
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from("user").insert({
      id: authData.user.id,
      email,
      full_name,
      username,
      role: "user",
      is_active: true,
    });

    if (profileError) throw profileError;

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        session: authData.session,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 400, headers: corsHeaders }
    );
  }
}

async function handleGetUser(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      console.log("⚠️  /user endpoint called without Authorization header (expected for unauthenticated requests)");
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.log("⚠️  Invalid or expired token in /user request");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("user")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      console.log("⚠️  User profile not found for authenticated user");
      return new Response(
        JSON.stringify({ success: false, error: "Profile not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    console.log(`✅ User profile retrieved: ${data.user.id}`);
    return new Response(
      JSON.stringify({ success: true, user: profile }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Unexpected error in /user endpoint:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// CONVERSATIONS API HANDLERS
// ============================================================================

async function handleGetAllConversations(request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Get all conversations for this user from ai_whatsapp table
    const { data: conversations, error: convError } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("date_insert", { ascending: false });

    if (convError) {
      console.error("❌ Error fetching conversations:", convError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch conversations" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Map field names to match frontend expectations
    const mappedConversations = conversations.map(conv => ({
      ...conv,
      id_device: conv.device_id,  // Map device_id to id_device for frontend
    }));

    console.log(`✅ Fetched ${conversations.length} conversations for user ${userData.user.id}`);

    return new Response(
      JSON.stringify({ success: true, conversations: mappedConversations }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Get conversations error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleDeleteConversation(request: Request, prospectNum: string): Promise<Response> {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Delete conversation from ai_whatsapp table
    const { error: deleteError } = await supabaseAdmin
      .from("ai_whatsapp")
      .delete()
      .eq("prospect_num", prospectNum)
      .eq("user_id", userData.user.id);

    if (deleteError) {
      console.error("❌ Error deleting conversation:", deleteError);
      return new Response(
        JSON.stringify({ success: false, message: "Failed to delete conversation" }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log(`✅ Deleted conversation for prospect: ${prospectNum}`);

    return new Response(
      JSON.stringify({ success: true, message: "Conversation deleted successfully" }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Delete conversation error:", error);
    return new Response(
      JSON.stringify({ success: false, message: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (request: Request) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(`${method} ${path}`);

  try {
    // Health check
    if (path === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "dev-muse-automaton-deno" }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Auth endpoints
    if (path === "/auth/login" && method === "POST") {
      return await handleLogin(request);
    }

    if (path === "/auth/register" && method === "POST") {
      return await handleRegister(request);
    }

    if (path === "/auth/user" && method === "GET") {
      return await handleGetUser(request);
    }

    if (path === "/api/auth/profile" && method === "GET") {
      return await handleGetUser(request);  // Same as /auth/user
    }

    // Conversations endpoints
    if (path === "/api/conversations/all" && method === "GET") {
      return await handleGetAllConversations(request);
    }

    if (path.startsWith("/api/conversations/") && method === "DELETE") {
      const prospectNum = path.split("/api/conversations/")[1];
      return await handleDeleteConversation(request, prospectNum);
    }

    // Webhook endpoint - matches pattern /:device_id/:instance
    if (method === "POST" && path.split("/").filter((p) => p).length >= 2) {
      return await handleWebhook(request);
    }

    // 404 for unknown routes
    return new Response(
      JSON.stringify({ success: false, error: "Not found" }),
      { status: 404, headers: corsHeaders }
    );
  } catch (error) {
    console.error("❌ Server error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: corsHeaders }
    );
  }
});

console.log("✅ Debounce service initialized");
console.log(`🚀 Dev Muse Automaton Deno Backend Started!`);
console.log(`📍 Supabase URL: ${SUPABASE_URL}`);
console.log(`⏱️  Debounce delay: ${DEBOUNCE_DELAY_MS}ms`);
console.log(`📱 WhatsApp Provider: WhatsApp Center`);
console.log(`🔗 WhatsApp Center API: ${WHACENTER_API_URL}`);
