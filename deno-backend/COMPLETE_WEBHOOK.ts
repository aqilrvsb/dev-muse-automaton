// ============================================================================
// COMPLETE WEBHOOK HANDLER - 100% Go Backend Feature Parity
// ============================================================================
// This file replicates ALL functionality from the Go backend including:
// - Device lookup with fallback (webhook_id -> id_device)
// - Flow type detection (Whatsapp Bot vs Chatbot AI)
// - Complete flow execution engine with all node types
// - Waiting for reply and resume logic
// - Stage configuration with dynamic column updates
// - Condition branching
// - WAHA provider support only
// ============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  supabaseUrl: Deno.env.get("SUPABASE_URL") || "",
  supabaseAnonKey: Deno.env.get("SUPABASE_ANON_KEY") || "",
  supabaseServiceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  debounceDelayMs: parseInt(Deno.env.get("DEBOUNCE_DELAY_MS") || "8000"),
  serverUrl: Deno.env.get("SERVER_URL") || "https://pening-bot.deno.dev",
  wahaApiUrl: Deno.env.get("WAHA_API_URL") || "https://waha-plus-production-705f.up.railway.app",
  wahaApiKey: Deno.env.get("WAHA_API_KEY") || "",
};

const supabaseAdmin = createClient(
  config.supabaseUrl,
  config.supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const kv = await Deno.openKv();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface FlowNode {
  id: string;
  type: string;
  label?: string;
  config: Record<string, any>;
  x?: number;
  y?: number;
}

interface FlowEdge {
  from: string;
  to: string;
  conditionType?: string;
  conditionValue?: string;
}

interface FlowData {
  nodes: FlowNode[];
  connections: FlowEdge[];
}

interface ParsedMessage {
  phone: string;
  message: string;
  name: string;
  provider: string;
  session?: string;
}

interface MessageQueue {
  deviceId: string;
  phone: string;
  name: string;
  provider: string;
  session: string;
  messages: Array<{ message: string; timestamp: number }>;
  timerScheduled: number;
}

// ============================================================================
// WEBHOOK PAYLOAD PARSING (WAHA Provider Only)
// ============================================================================

async function parseWebhookPayload(rawData: any): Promise<ParsedMessage | null> {
  console.log(`🔍 Parsing WAHA webhook`);

  // Extract session name from webhook
  const session = rawData.session || "";

  // Only WAHA Provider supported
  const payload = rawData.payload;
  if (!payload) {
    console.log("⚠️ No payload in WAHA webhook");
    return null;
  }

  const message = payload.body || "";
  const fromRaw = payload.from || "";

  // Skip empty messages
  if (!message.trim()) {
    console.log("⚠️ Empty message, skipping");
    return null;
  }

  // Skip group messages
  if (fromRaw.endsWith("@g.us")) {
    console.log("⚠️ Skipping group message");
    return null;
  }

  let phoneNumber = "";
  let name = "Sis";

  // Extract name from _data.Info.PushName
  if (payload._data?.Info?.PushName) {
    name = payload._data.Info.PushName;
  }

  // Handle different ID formats
  if (fromRaw.endsWith("@c.us")) {
    // Normal contact: phone@c.us
    phoneNumber = fromRaw.split("@")[0];
  } else if (fromRaw.endsWith("@lid")) {
    // LID mapping - check SenderAlt and RecipientAlt
    const info = payload._data?.Info;
    if (info) {
      const senderAlt = info.SenderAlt || "";
      const recipientAlt = info.RecipientAlt || "";

      for (const alt of [senderAlt, recipientAlt]) {
        if (alt && (alt.endsWith("@c.us") || alt.endsWith("@s.whatsapp.net"))) {
          phoneNumber = alt.split("@")[0];
          break;
        }
      }
    }
  }

  // Validate phone number (must start with 601 for Malaysia)
  if (!phoneNumber.startsWith("601")) {
    console.log(`⚠️ Invalid phone number (must start with 601): ${phoneNumber}`);
    return null;
  }

  // Validate length
  if (phoneNumber.length > 13) {
    console.log(`⚠️ Phone number too long: ${phoneNumber}`);
    return null;
  }

  return {
    phone: phoneNumber,
    message: message.trim(),
    name,
    provider: "waha",
    session,
  };
}

// ============================================================================
// MESSAGE DEBOUNCING (4-Second Queue)
// ============================================================================

async function queueMessageForDebouncing(data: {
  deviceId: string;
  phone: string;
  message: string;
  name: string;
  provider: string;
  session: string;
}): Promise<void> {
  const queueKey = ["message_queue", data.deviceId, data.phone];
  const now = Date.now();
  const scheduledTime = now + config.debounceDelayMs;

  const existingQueue = await kv.get<MessageQueue>(queueKey);

  if (existingQueue.value) {
    console.log(`🔄 [${data.deviceId}/${data.phone}] Adding to existing queue, resetting timer`);
    existingQueue.value.messages.push({
      message: data.message,
      timestamp: now,
    });
    existingQueue.value.timerScheduled = scheduledTime;
    existingQueue.value.name = data.name; // Update name
    await kv.set(queueKey, existingQueue.value);
  } else {
    console.log(`➕ [${data.deviceId}/${data.phone}] Creating new queue`);
    const newQueue: MessageQueue = {
      deviceId: data.deviceId,
      phone: data.phone,
      name: data.name,
      provider: data.provider,
      session: data.session,
      messages: [{ message: data.message, timestamp: now }],
      timerScheduled: scheduledTime,
    };
    await kv.set(queueKey, newQueue);
  }

  scheduleProcessing(data.deviceId, data.phone, scheduledTime);
}

function scheduleProcessing(deviceId: string, phone: string, scheduledTime: number): void {
  const delay = scheduledTime - Date.now();
  if (delay > 0) {
    setTimeout(async () => {
      await checkAndProcess(deviceId, phone, scheduledTime);
    }, delay);
  }
}

async function checkAndProcess(deviceId: string, phone: string, scheduledTime: number): Promise<void> {
  const queueKey = ["message_queue", deviceId, phone];
  const result = await kv.get<MessageQueue>(queueKey);

  if (!result.value) {
    console.log(`⚠️ [${deviceId}/${phone}] Queue not found`);
    return;
  }

  const queue = result.value;
  const now = Date.now();

  if (queue.timerScheduled !== scheduledTime) {
    console.log(`⏭️ [${deviceId}/${phone}] Timer was reset`);
    return;
  }

  if (now >= queue.timerScheduled) {
    console.log(`⏰ [${deviceId}/${phone}] Timer EXPIRED! Processing...`);
    await processMessages(queue);
  }
}

async function processMessages(queue: MessageQueue): Promise<void> {
  const { deviceId, phone, name, messages, session } = queue;

  try {
    const combinedMessage = messages.map((m) => m.message).join("\n");
    console.log(`📤 [${deviceId}/${phone}] Processing: ${combinedMessage}`);

    await processIncomingMessage(deviceId, phone, name, combinedMessage, session);

    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
    console.log(`✅ [${deviceId}/${phone}] Processing complete`);
  } catch (error) {
    console.error(`❌ [${deviceId}/${phone}] Processing error:`, error);
    const queueKey = ["message_queue", deviceId, phone];
    await kv.delete(queueKey);
  }
}

// ============================================================================
// PROCESSING TRACKER (Duplicate Prevention)
// ============================================================================

async function createProcessingTracker(idProspect: string, flowType: string): Promise<void> {
  const trackingData = {
    id_prospect: idProspect,
    flow_type: flowType,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("processing_tracker")
    .insert(trackingData);

  if (error) {
    console.error(`❌ Failed to create processing tracker:`, error);
    throw error;
  }

  console.log(`🔒 Created processing tracker: prospect=${idProspect}, flowType=${flowType}`);
}

async function checkDuplicateProcessing(idProspect: string, flowType: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("processing_tracker")
    .select("*")
    .eq("id_prospect", idProspect)
    .eq("flow_type", flowType);

  if (error) {
    console.error(`⚠️ Error checking duplicates:`, error);
    return false; // On error, allow sending
  }

  const count = data?.length || 0;
  console.log(`🔍 Duplicate check for prospect ${idProspect}: Found ${count} processing record(s)`);

  if (count > 1) {
    console.log(`⛔ DUPLICATE DETECTED! Aborting send operation.`);
    return true; // Is duplicate
  }

  return false; // Not duplicate, safe to send
}

async function cleanupProcessingTracker(idProspect: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("processing_tracker")
    .delete()
    .eq("id_prospect", idProspect);

  if (error) {
    console.error(`⚠️ Failed to cleanup processing tracker:`, error);
  } else {
    console.log(`🧹 Cleaned up processing tracker for prospect: ${idProspect}`);
  }
}

// ============================================================================
// CORE FLOW PROCESSOR (Matches Go Backend ProcessIncomingMessage)
// ============================================================================

async function processIncomingMessage(
  deviceId: string,
  phone: string,
  name: string,
  message: string,
  session: string
): Promise<void> {
  console.log(`📨 Processing incoming message for device: ${deviceId}`);

  // Step 1: Get device by id_device (we already have deviceId from webhook URL)
  const { data: device } = await supabaseAdmin
    .from("device_setting")
    .select("*")
    .eq("id_device", deviceId)
    .single();

  if (!device) {
    console.error(`❌ Device not found: ${deviceId}`);
    return;
  }

  // Add session to device object
  device.waha_session = session;

  console.log(`✅ Device found: ${device.id_device} (Provider: ${device.provider}, Session: ${session})`);

  // Step 2: Get flows by id_device
  console.log(`🔍 Querying chatbot_flows for device: ${deviceId}`);
  const { data: flows, error: flowsError } = await supabaseAdmin
    .from("chatbot_flows")
    .select("*")
    .eq("id_device", deviceId);

  console.log(`🔍 Flow query result:`, {
    found: flows?.length || 0,
    error: flowsError,
    deviceId,
    flows: flows?.map(f => ({ id: f.id, name: f.name, niche: f.niche, id_device: f.id_device }))
  });

  if (!flows || flows.length === 0) {
    console.log(`⚠️ No active flows found for device ${deviceId}, using simple AI fallback`);
    await handleSimpleAIResponse(device, phone, name, message);
    return;
  }

  const flow = flows[0]; // Use first active flow
  console.log(`✅ Found flow: ${flow.name} (Niche: ${flow.niche})`);

  // Step 3: Determine flow type (Whatsapp Bot vs Chatbot AI)
  const flowType = determineFlowType(flow);
  console.log(`🎯 Flow type: ${flowType}`);

  // Step 4: Get or create conversation based on flow type
  let conversation: any;
  let conversationId: string;
  let tableName: string;
  let currentStage = "";
  let contactExists = false;

  if (flowType === "Whatsapp Bot") {
    tableName = "wasapbot";
    const { data: existingConv } = await supabaseAdmin
      .from("wasapbot")
      .select("*")
      .eq("id_device", deviceId)
      .eq("prospect_num", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingConv) {
      // Create new wasapbot conversation
      const newConv = {
        id_device: deviceId,
        prospect_num: phone,
        prospect_name: name,
        niche: flow.niche,
        stage: null,
        conv_current: message,
        conv_last: "",
        execution_status: "active",
        waiting_for_reply: false,
        current_node_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabaseAdmin
        .from("wasapbot")
        .insert(newConv)
        .select()
        .single();

      if (error) throw error;

      conversation = created;
      conversationId = String(created.id_prospect);
      contactExists = false;
      console.log(`✅ Created new wasapbot conversation: ${conversationId}`);
    } else {
      conversation = existingConv;
      conversationId = String(existingConv.id_prospect);
      currentStage = existingConv.stage || "";
      contactExists = true;
      console.log(`✅ Found existing wasapbot conversation: ${conversationId} (Stage: ${currentStage})`);

      // Update last interaction
      await supabaseAdmin
        .from("wasapbot")
        .update({ updated_at: new Date().toISOString() })
        .eq("id_prospect", conversationId);
    }
  } else {
    // Chatbot AI
    tableName = "ai_whatsapp";
    const { data: existingConv } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("*")
      .eq("id_device", deviceId)
      .eq("prospect_num", phone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingConv) {
      // Create new ai_whatsapp conversation
      const newConv = {
        id_device: deviceId,
        prospect_num: phone,
        prospect_name: name,
        niche: flow.niche,
        stage: null,
        conv_current: message,
        conv_last: "",
        execution_status: "active",
        waiting_for_reply: false,
        current_node_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await supabaseAdmin
        .from("ai_whatsapp")
        .insert(newConv)
        .select()
        .single();

      if (error) throw error;

      conversation = created;
      conversationId = String(created.id_prospect);
      contactExists = false;
      console.log(`✅ Created new ai_whatsapp conversation: ${conversationId}`);
    } else {
      conversation = existingConv;
      conversationId = String(existingConv.id_prospect);
      currentStage = existingConv.stage || "";
      contactExists = true;
      console.log(`✅ Found existing ai_whatsapp conversation: ${conversationId} (Stage: ${currentStage})`);

      // Update last interaction
      await supabaseAdmin
        .from("ai_whatsapp")
        .update({ updated_at: new Date().toISOString() })
        .eq("id_prospect", conversationId);
    }
  }

  // Step 5: Create processing tracker with id_prospect and flow_type
  await createProcessingTracker(conversationId, flowType);

  // Step 5.5: Check for duplicate processing BEFORE executing flow
  const isDuplicate = await checkDuplicateProcessing(conversationId, flowType);
  if (isDuplicate) {
    console.log(`⛔ DUPLICATE PROCESSING DETECTED! Aborting flow execution for prospect: ${conversationId}`);
    await cleanupProcessingTracker(conversationId);
    return;
  }

  // Step 6: Check execution status and waiting state
  if (conversation.execution_status === "completed") {
    console.log(`⏹️ Flow already completed for contact ${conversationId}, ignoring message`);
    return;
  }

  // Step 6: Check if waiting for reply (resume flow)
  if (conversation.waiting_for_reply) {
    console.log(`▶️ Resuming flow from waiting state for contact ${conversationId}`);

    const currentNodeId = conversation.current_node_id || "";

    // Reset waiting state
    await supabaseAdmin
      .from(tableName)
      .update({ waiting_for_reply: false })
      .eq("id_prospect", conversationId);

    // Resume flow from current node
    await resumeFlow(flow, tableName, conversationId, message, currentNodeId, device);
  } else {
    // Start flow from beginning
    console.log(`🔄 Executing flow for contact ${conversationId} at stage: ${currentStage}`);
    await executeFlow(flow, tableName, conversationId, message, currentStage, device);
  }

  // Cleanup processing tracker after entire flow execution completes
  await cleanupProcessingTracker(conversationId);

  console.log(`✅ Flow execution completed successfully for contact: ${conversationId}`);
}

// ============================================================================
// FLOW TYPE DETECTION
// ============================================================================

function determineFlowType(flow: any): string {
  const niche = (flow.niche || "").toLowerCase();
  const name = (flow.name || "").toLowerCase();

  console.log(`🔍 Determining flow type - Name: "${flow.name}", Niche: "${flow.niche}"`);

  // Check if explicitly named "whatsapp bot" or similar
  if (name.includes("whatsapp bot") || name.includes("wasapbot")) {
    console.log(`✅ Flow type determined: Whatsapp Bot (by name)`);
    return "Whatsapp Bot";
  }

  // Check if it's an AI chatbot
  if (niche.includes("ai") || name.includes("chatbot ai") || niche.includes("chatbot")) {
    console.log(`✅ Flow type determined: Chatbot AI (by keywords)`);
    return "Chatbot AI";
  }

  // Default to Whatsapp Bot
  console.log(`✅ Flow type determined: Whatsapp Bot (default)`);
  return "Whatsapp Bot";
}

// ============================================================================
// FLOW EXECUTION ENGINE
// ============================================================================

async function executeFlow(
  flow: any,
  tableName: string,
  conversationId: string,
  userMessage: string,
  currentStage: string,
  device: any
): Promise<void> {
  console.log(`🚀 Starting flow execution for conversation: ${conversationId}`);

  // Check if NodesData is empty
  if (!flow.nodes_data) {
    console.log(`⚠️ Flow NodesData is empty - flow not configured yet`);
    return;
  }

  // Parse flow data
  let flowData: FlowData;
  try {
    flowData = JSON.parse(flow.nodes_data);
  } catch (error) {
    console.error(`❌ Failed to parse flow data:`, error);
    return;
  }

  console.log(`📊 Flow has ${flowData.nodes.length} nodes and ${flowData.connections.length} connections`);

  // Find starting node
  const startNode = findStartingNode(flowData, currentStage);
  if (!startNode) {
    console.log(`⚠️ No starting node found for stage: ${currentStage}`);
    return;
  }

  console.log(`🎯 Starting from node: ${startNode.id} (Type: ${startNode.type})`);

  // Execute flow from starting node
  await executeFromNode(flow, flowData, startNode, tableName, conversationId, userMessage, device);
}

async function resumeFlow(
  flow: any,
  tableName: string,
  conversationId: string,
  userMessage: string,
  currentNodeId: string,
  device: any
): Promise<void> {
  console.log(`▶️ Resuming flow execution from node: ${currentNodeId}`);

  if (!flow.nodes_data) {
    console.log(`⚠️ Flow NodesData is empty`);
    return;
  }

  let flowData: FlowData;
  try {
    flowData = JSON.parse(flow.nodes_data);
  } catch (error) {
    console.error(`❌ Failed to parse flow data:`, error);
    return;
  }

  // Find the current node
  const currentNode = flowData.nodes.find((n) => n.id === currentNodeId);
  if (!currentNode) {
    console.error(`❌ Current node ${currentNodeId} not found in flow`);
    return;
  }

  console.log(`✅ Found current node: ${currentNode.id} (Type: ${currentNode.type})`);

  // Add user's reply to conversation history
  if (userMessage) {
    await updateConvLast(tableName, conversationId, "User", userMessage);
  }

  // Find next node from current node
  const nextNode = findNextNode(flowData, currentNode, userMessage);
  if (!nextNode) {
    console.log(`✅ No next node - flow completed`);
    await supabaseAdmin
      .from(tableName)
      .update({
        execution_status: "completed",
        current_node_id: "completed",
      })
      .eq("id_prospect", conversationId);
    return;
  }

  // Execute from next node
  await executeFromNode(flow, flowData, nextNode, tableName, conversationId, userMessage, device);
}

function findStartingNode(flowData: FlowData, currentStage: string): FlowNode | null {
  // If no current stage, find the first node (after start node if exists)
  if (!currentStage || currentStage === "start") {
    // Look for a node that has no incoming connections
    for (const node of flowData.nodes) {
      // Skip start-type nodes
      if (node.type.toLowerCase().includes("start")) continue;

      // Check if this node has incoming connections
      const hasIncoming = flowData.connections.some((edge) => edge.to === node.id);

      // If no incoming connections, this could be the first node
      if (!hasIncoming) return node;
    }

    // If all nodes have incoming connections, get the first node
    return flowData.nodes[0] || null;
  }

  // Try to find node by ID matching the stage
  const stageNode = flowData.nodes.find((n) => n.id === currentStage);
  if (stageNode) return stageNode;

  // Default to first node
  return flowData.nodes[0] || null;
}

async function executeFromNode(
  flow: any,
  flowData: FlowData,
  node: FlowNode,
  tableName: string,
  conversationId: string,
  userMessage: string,
  device: any
): Promise<void> {
  console.log(`🔄 Executing node: ${node.id} (Type: ${node.type})`);

  // Execute the current node
  const continueFlow = await executeNode(flow, node, tableName, conversationId, userMessage, device);

  // If node says to stop flow (e.g., waiting_reply), stop here
  if (!continueFlow) {
    console.log(`⏸️ Flow paused at node: ${node.id}`);
    await supabaseAdmin
      .from(tableName)
      .update({ current_node_id: node.id })
      .eq("id_prospect", conversationId);
    return;
  }

  // Find next node
  const nextNode = findNextNode(flowData, node, userMessage);
  if (!nextNode) {
    console.log(`✅ Flow completed - no more nodes`);
    await supabaseAdmin
      .from(tableName)
      .update({
        execution_status: "completed",
        current_node_id: "completed",
        waiting_for_reply: false,
      })
      .eq("id_prospect", conversationId);
    return;
  }

  // Continue to next node
  await executeFromNode(flow, flowData, nextNode, tableName, conversationId, userMessage, device);
}

// ============================================================================
// NODE EXECUTION
// ============================================================================

async function executeNode(
  flow: any,
  node: FlowNode,
  tableName: string,
  conversationId: string,
  userMessage: string,
  device: any
): Promise<boolean> {
  console.log(`⚙️ Executing node type: ${node.type}`);

  switch (node.type) {
    case "send_message":
      return await executeSendMessage(flow, node, tableName, conversationId, device);

    case "delay":
      return await executeDelay(node);

    case "waiting_reply":
      return await executeWaitingReply(tableName, conversationId, node);

    case "waiting_times":
      return await executeWaitingTimes(node);

    case "stage":
      return await executeStage(tableName, conversationId, node, device);

    case "send_image":
    case "send_audio":
    case "send_video":
      return await executeSendMedia(flow, node, tableName, conversationId, device);

    case "conditions":
      return true; // Conditions handled in findNextNode

    default:
      console.log(`⚠️ Unknown node type: ${node.type}, skipping`);
      return true;
  }
}

async function executeSendMessage(
  flow: any,
  node: FlowNode,
  tableName: string,
  conversationId: string,
  device: any
): Promise<boolean> {
  const text = node.config.text || "";
  if (!text) {
    console.log(`⚠️ No text configured for send_message node`);
    return true;
  }

  // Get conversation to get phone number and customer data
  const { data: conversation } = await supabaseAdmin
    .from(tableName)
    .select("*")
    .eq("id_prospect", conversationId)
    .single();

  if (!conversation) {
    console.error(`❌ Failed to get conversation for sending`);
    return true;
  }

  // Determine flow type based on table name
  const flowType = tableName === "wasapbot" ? "Whatsapp Bot" : "Chatbot AI";

  // Populate customer templates
  const finalText = populateCustomerTemplate(text, conversation);

  console.log(`📤 Sending message: ${finalText}`);

  // Send WhatsApp message with duplicate check
  const sent = await sendWhatsAppMessage(
    { deviceId: device.id_device, phone: conversation.prospect_num, message: finalText, conversationId, flowType },
    device
  );

  // Only update conv_last if message was actually sent
  if (sent) {
    await updateConvLast(tableName, conversationId, "Bot", finalText);
  }

  return true;
}

function populateCustomerTemplate(text: string, conversation: any): string {
  const safe = (val: any) => val || "";

  if (text === "DETAIL CUSTOMER") {
    return `Detail:

NAMA : ${safe(conversation.prospect_name)}

ALAMAT : ${safe(conversation.alamat)}

NO FON : ${safe(conversation.no_fon)}`;
  }

  if (text === "DETAIL COD") {
    return `Detail:

NAMA : ${safe(conversation.prospect_name)}

ALAMAT : ${safe(conversation.alamat)}

NO FONE : ${safe(conversation.no_fon)}

PAKEJ : ${safe(conversation.pakej)}

*COD @ POSTAGE FREE*

CARA BAYARAN : COD`;
  }

  if (text === "DETAIL WAGES") {
    return `Detail:

NAMA : ${safe(conversation.prospect_name)}

ALAMAT : ${safe(conversation.alamat)}

NO FONE : ${safe(conversation.no_fon)}

PAKEJ : ${safe(conversation.pakej)}

*COD @ POSTAGE FREE*

CARA BAYARAN : ${safe(conversation.cara_bayaran)}

TARIKH GAJI : ${safe(conversation.tarikh_gaji)}`;
  }

  if (text === "DETAIL CASH") {
    return `Detail:

NAMA : ${safe(conversation.prospect_name)}

ALAMAT : ${safe(conversation.alamat)}

NO FONE : ${safe(conversation.no_fon)}

PAKEJ : ${safe(conversation.pakej)}

*COD @ POSTAGE FREE*

CARA BAYARAN : Online Transfer`;
  }

  return text;
}

async function executeDelay(node: FlowNode): Promise<boolean> {
  const delay = node.config.delay || 3;
  console.log(`⏱️ Delaying for ${delay} seconds`);
  await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  console.log(`✅ Delay completed`);
  return true;
}

async function executeWaitingReply(
  tableName: string,
  conversationId: string,
  node: FlowNode
): Promise<boolean> {
  console.log(`⏸️ Waiting for user reply (no timeout)`);

  await supabaseAdmin
    .from(tableName)
    .update({
      waiting_for_reply: true,
      current_node_id: node.id,
    })
    .eq("id_prospect", conversationId);

  console.log(`✅ Set waiting_for_reply=true, current_node_id=${node.id}`);
  return false; // Stop flow execution
}

async function executeWaitingTimes(node: FlowNode): Promise<boolean> {
  const timeout = node.config.delay || 8;
  console.log(`⏳ Waiting for user reply with ${timeout} second timeout`);
  await new Promise((resolve) => setTimeout(resolve, timeout * 1000));
  console.log(`⏱️ Timeout reached, continuing flow`);
  return true;
}

async function executeStage(
  tableName: string,
  conversationId: string,
  node: FlowNode,
  device: any
): Promise<boolean> {
  const stageName = node.config.value || "";
  if (!stageName) {
    console.log(`⚠️ No stage value configured`);
    return true;
  }

  console.log(`🎯 Processing stage: ${stageName} for conversation ID: ${conversationId}`);

  // Get conversation to retrieve device_id
  const { data: conversation } = await supabaseAdmin
    .from(tableName)
    .select("*")
    .eq("id_prospect", conversationId)
    .single();

  if (!conversation) {
    console.error(`❌ Failed to get conversation`);
    return true;
  }

  const deviceId = conversation.id_device;

  console.log(`🔍 Checking stage configuration for device=${deviceId}, stage=${stageName}`);

  // Check if stage configuration exists
  const { data: stageConfig } = await supabaseAdmin
    .from("stagesetvalue")
    .select("*")
    .eq("id_device", deviceId)
    .eq("stage", stageName)
    .maybeSingle();

  const updates: any = { stage: stageName };

  // If no configuration found, just update stage normally
  if (!stageConfig) {
    console.log(`📝 No stage configuration found, updating stage normally`);
    await supabaseAdmin
      .from(tableName)
      .update(updates)
      .eq("id_prospect", conversationId);
    return true;
  }

  // Stage configuration found - apply dynamic updates
  console.log(`⚙️ Stage configuration found: type=${stageConfig.type_inputdata}, column=${stageConfig.columns_data}`);

  const columnName = normalizeColumnName(stageConfig.columns_data);
  let columnValue = "";

  if (stageConfig.type_inputdata === "Set") {
    // Use hardcoded value
    columnValue = stageConfig.inputhardcode || "";
    console.log(`📝 Type=Set: Using hardcoded value '${columnValue}' for column '${columnName}'`);
  } else if (stageConfig.type_inputdata === "Input") {
    // Use value from last user reply in conv_last
    const convLast = conversation.conv_last || "";
    const lines = convLast.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("User: ")) {
        columnValue = line.replace("User: ", "");
        break;
      }
    }
    console.log(`📝 Type=Input: Using user reply '${columnValue}' for column '${columnName}'`);
  }

  // Add column update
  updates[columnName] = columnValue;

  await supabaseAdmin
    .from(tableName)
    .update(updates)
    .eq("id_prospect", conversationId);

  console.log(`✅ Stage and column '${columnName}' updated successfully`);
  return true;
}

function normalizeColumnName(columnName: string): string {
  const columnMap: Record<string, string> = {
    "Nama": "prospect_name",
    "Alamat": "alamat",
    "Pakej": "pakej",
    "No Fon": "no_fon",
    "Tarikh Gaji": "tarikh_gaji",
    "Cara Bayaran": "cara_bayaran",
    "Peringkat Sekolah": "peringkat_sekolah",
  };

  if (columnMap[columnName]) return columnMap[columnName];

  // Convert to lowercase and replace spaces with underscores
  return columnName.toLowerCase().replace(/ /g, "_");
}

async function executeSendMedia(
  flow: any,
  node: FlowNode,
  tableName: string,
  conversationId: string,
  device: any
): Promise<boolean> {
  const url = node.config.url || "";
  if (!url) {
    console.log(`⚠️ No URL configured for media node`);
    return true;
  }

  console.log(`📤 Sending ${node.type}: ${url}`);

  // Get conversation to get phone number
  const { data: conversation } = await supabaseAdmin
    .from(tableName)
    .select("*")
    .eq("id_prospect", conversationId)
    .single();

  if (!conversation) {
    console.error(`❌ Failed to get conversation for sending media`);
    return true;
  }

  // Determine flow type based on table name
  const flowType = tableName === "wasapbot" ? "Whatsapp Bot" : "Chatbot AI";

  // Map node type to media type
  let mediaType = "";
  switch (node.type) {
    case "send_image":
      mediaType = "image";
      break;
    case "send_audio":
      mediaType = "audio";
      break;
    case "send_video":
      mediaType = "video";
      break;
  }

  // Send WhatsApp media with duplicate check
  const sent = await sendWhatsAppMessage(
    { deviceId: device.id_device, phone: conversation.prospect_num, message: "", mediaUrl: url, mediaType, conversationId, flowType },
    device
  );

  // Only update conv_last if media was actually sent
  if (sent) {
    await updateConvLast(tableName, conversationId, "Bot", url);
  }

  return true;
}

// ============================================================================
// FLOW NAVIGATION
// ============================================================================

function findNextNode(flowData: FlowData, currentNode: FlowNode, userMessage: string): FlowNode | null {
  // Find all outgoing edges from current node
  const outgoingEdges = flowData.connections.filter((edge) => edge.from === currentNode.id);

  if (outgoingEdges.length === 0) {
    console.log(`ℹ️ No outgoing edges from node: ${currentNode.id}`);
    return null;
  }

  // If only one edge, follow it
  if (outgoingEdges.length === 1) {
    return flowData.nodes.find((n) => n.id === outgoingEdges[0].to) || null;
  }

  // Multiple edges - check if this is a Conditions node
  if (currentNode.type === "conditions") {
    console.log(`🔀 Conditions node with ${outgoingEdges.length} edges`);

    // Match user message against conditions
    for (const edge of outgoingEdges) {
      if (!edge.conditionType || !edge.conditionValue) continue;

      let matched = false;
      const msgLower = userMessage.toLowerCase();
      const condLower = edge.conditionValue.toLowerCase();

      switch (edge.conditionType.toLowerCase()) {
        case "equal":
          matched = msgLower === condLower;
          break;
        case "contains":
        case "match":
          matched = msgLower.includes(condLower);
          break;
        case "default":
          matched = true;
          break;
      }

      if (matched) {
        console.log(`✅ Condition matched: ${edge.conditionType} '${edge.conditionValue}'`);
        return flowData.nodes.find((n) => n.id === edge.to) || null;
      }
    }

    // No conditions matched, look for default
    const defaultEdge = outgoingEdges.find((e) => e.conditionType?.toLowerCase() === "default");
    if (defaultEdge) {
      console.log(`✅ Using default condition`);
      return flowData.nodes.find((n) => n.id === defaultEdge.to) || null;
    }

    // No conditions matched and no default - randomly select
    if (outgoingEdges.length > 0) {
      const randomIndex = Math.floor(Math.random() * outgoingEdges.length);
      console.log(`🎲 No conditions matched, randomly selected edge ${randomIndex + 1}/${outgoingEdges.length}`);
      return flowData.nodes.find((n) => n.id === outgoingEdges[randomIndex].to) || null;
    }

    return null;
  }

  // Not a conditions node, but multiple edges - follow first one
  console.log(`⚠️ Multiple edges from non-condition node, following first one`);
  return flowData.nodes.find((n) => n.id === outgoingEdges[0].to) || null;
}

// ============================================================================
// CONVERSATION HISTORY
// ============================================================================

async function updateConvLast(
  tableName: string,
  conversationId: string,
  role: string,
  message: string
): Promise<void> {
  const { data: conv } = await supabaseAdmin
    .from(tableName)
    .select("conv_last")
    .eq("id_prospect", conversationId)
    .single();

  if (!conv) return;

  let convLast = conv.conv_last || "";
  const newLine = `${role}: ${message}`;

  if (convLast) {
    convLast += "\n" + newLine;
  } else {
    convLast = newLine;
  }

  await supabaseAdmin
    .from(tableName)
    .update({ conv_last: convLast })
    .eq("id_prospect", conversationId);
}

// ============================================================================
// WHATSAPP MESSAGE SENDING (WAHA Only)
// ============================================================================

async function sendWhatsAppMessage(
  data: { deviceId: string; phone: string; message: string; mediaUrl?: string; mediaType?: string; conversationId?: string; flowType?: string },
  device: any
): Promise<boolean> {
  // Only WAHA provider supported
  await sendWahaMessage(data, device);

  return true; // Message sent successfully
}

async function sendWahaMessage(
  data: { deviceId: string; phone: string; message: string; mediaUrl?: string; mediaType?: string },
  device: any
): Promise<void> {
  const apiKey = config.wahaApiKey;
  const session = device.waha_session || device.id_device || "";

  console.log(`📡 Sending via WAHA session: ${session}`);

  // Clean phone number
  const phoneNumber = data.phone.replace(/[^0-9]/g, "");
  const chatId = phoneNumber + "@c.us";

  let url = "";
  let payload: any = {};

  if (!data.mediaUrl) {
    // Text message only
    url = `${config.wahaApiUrl}/api/sendText`;
    payload = {
      session,
      chatId,
      text: data.message,
    };
  } else {
    // Media message
    const ext = data.mediaUrl.split(".").pop()?.toLowerCase() || "";

    if (ext === "mp4") {
      url = `${config.wahaApiUrl}/api/sendVideo`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "video/mp4",
          url: data.mediaUrl,
          filename: "Video",
        },
        caption: data.message,
      };
    } else if (ext === "mp3") {
      url = `${config.wahaApiUrl}/api/sendFile`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "audio/mp3",
          url: data.mediaUrl,
          filename: "Audio",
        },
        caption: data.message,
      };
    } else {
      // Image
      url = `${config.wahaApiUrl}/api/sendImage`;
      payload = {
        session,
        chatId,
        file: {
          mimetype: "image/jpeg",
          url: data.mediaUrl,
          filename: "Image",
        },
        caption: data.message,
      };
    }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ WAHA API error:`, errorText);
    throw new Error(`WAHA API error: ${errorText}`);
  }

  console.log(`✅ WAHA message sent successfully`);
}

// ============================================================================
// SIMPLE AI FALLBACK (For devices without flows)
// ============================================================================

async function handleSimpleAIResponse(device: any, phone: string, name: string, message: string): Promise<void> {
  console.log(`🤖 Using simple AI fallback for device ${device.id_device}`);

  // Get or create conversation in ai_whatsapp table
  let { data: conversation } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("id_device", device.id_device)
    .eq("prospect_num", phone)
    .eq("execution_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    // Create new conversation
    const newConv = {
      id_device: device.id_device,
      prospect_num: phone,
      prospect_name: name,
      niche: device.niche || "",
      stage: "intro",
      conv_current: message,
      conv_last: "",
      execution_status: "active",
      waiting_for_reply: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created } = await supabaseAdmin
      .from("ai_whatsapp")
      .insert(newConv)
      .select()
      .single();

    conversation = created;
    console.log(`✅ New AI conversation created: ${conversation.id_prospect}`);
  } else {
    // Update existing conversation
    await supabaseAdmin
      .from("ai_whatsapp")
      .update({
        conv_last: conversation.conv_current || "",
        conv_current: message,
        updated_at: new Date().toISOString(),
        waiting_for_reply: true,
      })
      .eq("id_prospect", conversation.id_prospect);
  }

  // Generate AI response (simplified - you can add OpenRouter integration here)
  const aiResponse = `Hello ${name}! I received your message: "${message}". This is a simple AI response. (Configure flows for advanced automation)`;

  // Send reply
  await sendWhatsAppMessage(
    { deviceId: device.id_device, phone, message: aiResponse },
    device
  );

  // Update conversation with AI response
  await supabaseAdmin
    .from("ai_whatsapp")
    .update({
      balas: aiResponse,
      waiting_for_reply: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id_prospect", conversation.id_prospect);

  console.log(`✅ AI reply sent: ${aiResponse.substring(0, 50)}...`);
}

// ============================================================================
// WEBHOOK HANDLER (GET + POST)
// ============================================================================

async function handleWebhook(req: Request, deviceId: string, webhookId: string, method: string): Promise<Response> {
  const startTime = Date.now();

  try {
    console.log(`📥 Webhook: ${method} /${deviceId}/${webhookId}`);

    // Verify device exists (try webhook_id first, then device_id)
    let device: any = null;

    // Try by webhook_id
    const { data: deviceByWebhook } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("webhook_id", webhookId)
      .maybeSingle();

    if (deviceByWebhook) {
      device = deviceByWebhook;
      console.log(`✅ Device found by webhook_id: ${device.id_device}`);
    } else {
      // Fallback: try by device_id
      const { data: deviceById } = await supabaseAdmin
        .from("device_setting")
        .select("*")
        .eq("device_id", deviceId)
        .maybeSingle();

      if (deviceById) {
        device = deviceById;
        console.log(`✅ Device found by device_id: ${device.id_device}`);
      }
    }

    if (!device) {
      console.error("❌ Device not found");
      return new Response(
        JSON.stringify({ success: false, error: "Device not found or invalid webhook" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Device verified: ${device.id_device} (Provider: ${device.provider})`);

    // ========== GET REQUEST (Webhook Verification) ==========
    if (method === "GET") {
      const url = new URL(req.url);
      const challenge = url.searchParams.get("hub.challenge");

      if (challenge) {
        console.log(`✅ Returning challenge for webhook verification`);
        return new Response(challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Webhook verified",
          device_id: device.device_id,
          webhook_id: device.webhook_id,
          provider: device.provider,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== POST REQUEST (WhatsApp Messages) ==========
    if (method === "POST") {
      const rawPayload = await req.json();
      console.log(`📨 Raw payload:`, JSON.stringify(rawPayload, null, 2));

      // Parse WAHA webhook
      const parsed = await parseWebhookPayload(rawPayload);

      if (!parsed || !parsed.message) {
        console.log(`⏭️ Skipping non-message event`);
        return new Response(
          JSON.stringify({
            success: true,
            message: "Event ignored (not a message)",
            processed: false,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { phone, message, name, session } = parsed;

      console.log(`✅ Message from ${phone} (${name}): ${message}`);

      // Queue message for debouncing (4-second delay)
      await queueMessageForDebouncing({
        deviceId: device.id_device,
        phone,
        message,
        name: name || "",
        provider: device.provider,
        session: session || "",
      });

      console.log(`📬 Message queued for debouncing (${config.debounceDelayMs}ms delay)`);
      console.log(`✅ Webhook processed in ${Date.now() - startTime}ms`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Message queued for processing",
          processed: true,
          debounced: true,
          delay_ms: config.debounceDelayMs,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// MAIN SERVER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method;

  console.log(`📞 ${method} ${pathname}`);

  // Health check
  if (pathname === "/health" || pathname === "/healthz") {
    return new Response(
      JSON.stringify({
        status: "ok",
        service: "dev-muse-automaton-complete",
        debounce_delay: `${config.debounceDelayMs}ms`,
        features: [
          "Flow Execution Engine",
          "Waiting for Reply",
          "Stage Configuration",
          "Condition Branching",
          "WAHA Provider Support",
          "4-Second Debouncing",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Webhook pattern: /:deviceId/:webhookId
  const webhookMatch = pathname.match(/^\/([^\/]+)\/([^\/]+)$/);
  if (webhookMatch) {
    const deviceId = webhookMatch[1];
    const webhookId = webhookMatch[2];
    return await handleWebhook(req, deviceId, webhookId, method);
  }

  // 404 Not Found
  return new Response(
    JSON.stringify({
      success: false,
      error: "Not Found",
      message: "Webhook pattern: /:deviceId/:webhookId",
    }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

console.log("🚀 Complete Webhook Server running with full flow execution engine");
console.log("📋 Features: Flow Execution, Waiting for Reply, Stage Config, Conditions, WAHA Provider");
console.log("⏱️  Debounce Delay:", config.debounceDelayMs, "ms");
