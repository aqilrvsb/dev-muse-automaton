/**
 * Flow Execution Service
 *
 * Processes messages through conversation flows
 * Executes flow nodes based on user inputs
 */

import { supabaseAdmin } from "../main.ts";
import { sendWhatsAppMessage } from "./whatsapp-provider.ts";
import { generateFlowAIResponse } from "./ai.ts";

export interface ProcessFlowMessageParams {
  deviceId: string;
  webhookId: string;
  phone: string;
  name: string;
  message: string;
  provider: string;
}

export interface FlowExecutionResult {
  success: boolean;
  responded: boolean;
  error?: string;
}

/**
 * Process incoming message through flow execution engine
 */
export async function processFlowMessage(
  params: ProcessFlowMessageParams
): Promise<FlowExecutionResult> {
  const { deviceId, webhookId, phone, name, message } = params;

  try {
    console.log(`🔄 Processing flow message for ${deviceId}/${phone}`);

    // Get device configuration
    const { data: device } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("webhook_id", webhookId)
      .single();

    if (!device) {
      throw new Error("Device not found");
    }

    // Check for active conversation in ai_whatsapp or wasapbot
    let conversation = await getActiveConversation(deviceId, phone);

    if (!conversation) {
      // Create new conversation
      conversation = await createNewConversation(device, phone, name, message);
    } else {
      // Update existing conversation
      await updateConversation(conversation, message);
    }

    // Get associated flow
    const flow = await getFlow(conversation.flow_id);

    if (!flow) {
      // No flow configured, use simple AI response
      return await handleSimpleAIResponse(device, phone, message, conversation);
    }

    // Execute flow logic
    const response = await executeFlowNode(flow, conversation, message, device);

    // Send response via WhatsApp
    if (response) {
      await sendWhatsAppMessage(
        {
          deviceId: device.device_id,
          phone,
          message: response,
        },
        device
      );

      // Update conversation with response
      await updateConversationResponse(conversation, response);
    }

    console.log(`✅ Flow processing complete for ${phone}`);

    return {
      success: true,
      responded: !!response,
    };
  } catch (error) {
    console.error("Flow execution error:", error);
    return {
      success: false,
      responded: false,
      error: error.message,
    };
  }
}

/**
 * Get active conversation
 */
async function getActiveConversation(deviceId: string, phone: string): Promise<any> {
  // Try ai_whatsapp first
  const { data: aiConv } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("id_device", deviceId)
    .eq("prospect_num", phone)
    .eq("execution_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (aiConv) return aiConv;

  // Try wasapbot
  const { data: wasapConv } = await supabaseAdmin
    .from("wasapbot")
    .select("*")
    .eq("id_device", deviceId)
    .eq("prospect_num", phone)
    .eq("execution_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return wasapConv || null;
}

/**
 * Create new conversation
 */
async function createNewConversation(device: any, phone: string, name: string, message: string): Promise<any> {
  const now = new Date().toISOString();

  // Get default flow for device's niche (if any)
  const { data: flow } = await supabaseAdmin
    .from("chatbot_flows")
    .select("id")
    .eq("id_device", device.id_device)
    .limit(1)
    .single();

  const conversationData = {
    id_device: device.id_device,
    prospect_num: phone,
    prospect_name: name || "Unknown",
    niche: device.niche || "",
    flow_id: flow?.id || null,
    stage: "intro",
    conv_current: message,
    conv_last: "",
    execution_status: "active",
    waiting_for_reply: true,
    created_at: now,
    updated_at: now,
  };

  // Insert into ai_whatsapp
  const { data, error } = await supabaseAdmin
    .from("ai_whatsapp")
    .insert(conversationData)
    .select()
    .single();

  if (error) {
    console.error("Failed to create conversation:", error);
    throw error;
  }

  console.log(`✅ New conversation created: ${data.id_prospect}`);
  return data;
}

/**
 * Update conversation with new message
 */
async function updateConversation(conversation: any, message: string): Promise<void> {
  const tableName = conversation.id_prospect ? "ai_whatsapp" : "wasapbot";
  const idField = conversation.id_prospect ? "id_prospect" : "id_prospect";

  await supabaseAdmin
    .from(tableName)
    .update({
      conv_last: conversation.conv_current || "",
      conv_current: message,
      updated_at: new Date().toISOString(),
      waiting_for_reply: true,
    })
    .eq(idField, conversation[idField]);
}

/**
 * Update conversation with bot response
 */
async function updateConversationResponse(conversation: any, response: string): Promise<void> {
  const tableName = conversation.id_prospect ? "ai_whatsapp" : "wasapbot";
  const idField = conversation.id_prospect ? "id_prospect" : "id_prospect";

  await supabaseAdmin
    .from(tableName)
    .update({
      balas: response,
      waiting_for_reply: false,
      updated_at: new Date().toISOString(),
    })
    .eq(idField, conversation[idField]);
}

/**
 * Get flow by ID
 */
async function getFlow(flowId: string | null): Promise<any> {
  if (!flowId) return null;

  const { data } = await supabaseAdmin
    .from("chatbot_flows")
    .select("*")
    .eq("id", flowId)
    .single();

  return data;
}

/**
 * Execute flow node logic
 */
async function executeFlowNode(
  flow: any,
  conversation: any,
  userMessage: string,
  device: any
): Promise<string | null> {
  try {
    // Parse flow nodes
    const nodes = typeof flow.nodes === "string" ? JSON.parse(flow.nodes) : flow.nodes;
    const edges = typeof flow.edges === "string" ? JSON.parse(flow.edges) : flow.edges;

    // Get current node
    const currentNodeId = conversation.current_node_id;
    let currentNode;

    if (!currentNodeId) {
      // Start from first node (find start node)
      currentNode = nodes.find((n: any) => n.type === "start" || n.data?.type === "start");
    } else {
      currentNode = nodes.find((n: any) => n.id === currentNodeId);
    }

    if (!currentNode) {
      console.warn("No valid node found, using AI fallback");
      return await handleSimpleAIResponse(device, conversation.prospect_num, userMessage, conversation);
    }

    // Execute node based on type
    const nodeType = currentNode.type || currentNode.data?.type;

    switch (nodeType) {
      case "message":
      case "text":
        // Send predefined message
        const messageText = currentNode.data?.message || currentNode.data?.text || "Hello!";

        // Find next node
        const nextNode = findNextNode(currentNode.id, edges, nodes);
        if (nextNode) {
          await updateCurrentNode(conversation, nextNode.id);
        }

        return messageText;

      case "ai":
      case "aiNode":
        // Generate AI response
        const conversationHistory = `Previous: ${conversation.conv_last || ""}\nCurrent: ${userMessage}`;
        const aiResponse = await generateFlowAIResponse(
          conversationHistory,
          userMessage,
          currentNode.data?.prompt || "Respond to the user",
          device
        );

        const nextAINode = findNextNode(currentNode.id, edges, nodes);
        if (nextAINode) {
          await updateCurrentNode(conversation, nextAINode.id);
        }

        return aiResponse;

      case "condition":
      case "conditional":
        // Evaluate condition and route
        const conditionResult = evaluateCondition(userMessage, currentNode.data);
        const nextCondNode = findNextNodeByCondition(currentNode.id, edges, nodes, conditionResult);
        if (nextCondNode) {
          await updateCurrentNode(conversation, nextCondNode.id);
          // Continue to next node
          return await executeFlowNode(flow, { ...conversation, current_node_id: nextCondNode.id }, userMessage, device);
        }
        return null;

      default:
        // Unknown node type, move to next
        const defaultNext = findNextNode(currentNode.id, edges, nodes);
        if (defaultNext) {
          await updateCurrentNode(conversation, defaultNext.id);
          return await executeFlowNode(flow, { ...conversation, current_node_id: defaultNext.id }, userMessage, device);
        }
        return null;
    }
  } catch (error) {
    console.error("Flow node execution error:", error);
    return await handleSimpleAIResponse(device, conversation.prospect_num, userMessage, conversation);
  }
}

/**
 * Find next node in flow
 */
function findNextNode(currentNodeId: string, edges: any[], nodes: any[]): any {
  const edge = edges.find((e: any) => e.source === currentNodeId);
  if (!edge) return null;
  return nodes.find((n: any) => n.id === edge.target);
}

/**
 * Find next node based on condition result
 */
function findNextNodeByCondition(currentNodeId: string, edges: any[], nodes: any[], conditionResult: boolean): any {
  const edge = edges.find((e: any) =>
    e.source === currentNodeId &&
    (conditionResult ? e.sourceHandle === "true" : e.sourceHandle === "false")
  );
  if (!edge) return null;
  return nodes.find((n: any) => n.id === edge.target);
}

/**
 * Evaluate condition
 */
function evaluateCondition(userMessage: string, conditionData: any): boolean {
  const condition = conditionData?.condition || "";
  const value = conditionData?.value || "";

  // Simple keyword matching
  return userMessage.toLowerCase().includes(value.toLowerCase());
}

/**
 * Update current node in conversation
 */
async function updateCurrentNode(conversation: any, nodeId: string): Promise<void> {
  const tableName = conversation.id_prospect ? "ai_whatsapp" : "wasapbot";
  const idField = conversation.id_prospect ? "id_prospect" : "id_prospect";

  await supabaseAdmin
    .from(tableName)
    .update({
      last_node_id: conversation.current_node_id,
      current_node_id: nodeId,
    })
    .eq(idField, conversation[idField]);
}

/**
 * Handle simple AI response (fallback when no flow)
 */
async function handleSimpleAIResponse(
  device: any,
  phone: string,
  message: string,
  conversation: any
): Promise<string | null> {
  try {
    const conversationHistory = `Previous: ${conversation?.conv_last || ""}\n`;
    const response = await generateFlowAIResponse(
      conversationHistory,
      message,
      "You are a helpful assistant. Respond naturally to the user.",
      device
    );
    return response;
  } catch (error) {
    console.error("Simple AI response error:", error);
    return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
  }
}
