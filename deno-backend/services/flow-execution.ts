/**
 * Chatbot AI Execution Service
 *
 * Processes WhatsApp messages with AI-powered responses
 * Uses prompts from the prompts table
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
 * Process incoming message through AI chatbot
 */
export async function processFlowMessage(
  params: ProcessFlowMessageParams
): Promise<FlowExecutionResult> {
  const { deviceId, webhookId, phone, name, message } = params;

  try {
    console.log(`🔄 Processing AI chatbot message for ${deviceId}/${phone}`);

    // Get device configuration
    // Note: webhookId parameter corresponds to 'instance' field in device_setting
    const { data: device, error: deviceError } = await supabaseAdmin
      .from("device_setting")
      .select("*")
      .eq("device_id", deviceId)
      .eq("instance", webhookId)
      .single();

    if (deviceError || !device) {
      throw new Error("Device not found");
    }

    // Get prompt configuration for this device
    const { data: prompt } = await supabaseAdmin
      .from("prompts")
      .select("*")
      .eq("device_id", deviceId)
      .single();

    if (!prompt) {
      console.log(`⚠️ No prompt configured for device ${deviceId}`);
      throw new Error("No prompt configured for this device");
    }

    console.log(`✅ Found prompt: ${prompt.prompts_name}`);

    // Check for existing conversation
    let conversation = await getActiveConversation(deviceId, phone);

    if (!conversation) {
      // Create new conversation
      conversation = await createNewConversation(device, phone, name, message, prompt);
    } else {
      // Update existing conversation
      await updateConversation(conversation, message);
    }

    // Generate AI response using prompt
    const response = await generateAIResponse(device, phone, message, conversation, prompt);

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

      // Update conversation with bot response
      await updateConversationWithResponse(conversation, response);
    }

    console.log(`✅ AI chatbot processing complete for ${phone}`);

    return {
      success: true,
      responded: !!response,
    };
  } catch (error) {
    console.error("AI chatbot execution error:", error);
    return {
      success: false,
      responded: false,
      error: error.message,
    };
  }
}

/**
 * Get active conversation for this device and phone
 */
async function getActiveConversation(deviceId: string, phone: string): Promise<any> {
  const { data } = await supabaseAdmin
    .from("ai_whatsapp")
    .select("*")
    .eq("device_id", deviceId)
    .eq("prospect_num", phone)
    .order("date_insert", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

/**
 * Create new conversation
 */
async function createNewConversation(
  device: any,
  phone: string,
  name: string,
  message: string,
  prompt: any
): Promise<any> {
  const today = new Date().toISOString().split('T')[0]; // Y-m-d format

  const conversationData = {
    device_id: device.device_id,
    prospect_num: phone,
    prospect_name: name || "Unknown",
    niche: prompt.niche || "",
    intro: "",
    stage: "active",
    conv_current: message,
    conv_last: "",
    human: 0, // AI mode
    date_insert: today,
    user_id: device.user_id,
    detail: "",
  };

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
 * Update conversation with new user message
 * Save previous message to conv_last
 */
async function updateConversation(conversation: any, message: string): Promise<void> {
  await supabaseAdmin
    .from("ai_whatsapp")
    .update({
      conv_last: conversation.conv_current || "",
      conv_current: message,
    })
    .eq("id_prospect", conversation.id_prospect);

  console.log(`📝 Updated conversation ${conversation.id_prospect}: moved current to last, saved new message`);
}

/**
 * Update conversation with bot response
 * Store the bot's response in conv_last after sending
 */
async function updateConversationWithResponse(conversation: any, response: string): Promise<void> {
  await supabaseAdmin
    .from("ai_whatsapp")
    .update({
      conv_last: response,
    })
    .eq("id_prospect", conversation.id_prospect);

  console.log(`💬 Saved bot response to conv_last for conversation ${conversation.id_prospect}`);
}

/**
 * Generate AI response using dynamic prompt with stage tracking and detail capture
 */
async function generateAIResponse(
  device: any,
  phone: string,
  message: string,
  conversation: any,
  prompt: any
): Promise<string> {
  try {
    // Build conversation history from ai_whatsapp table
    const { data: history } = await supabaseAdmin
      .from("ai_whatsapp")
      .select("prospect_num, conv_last, stage, date_insert")
      .eq("device_id", device.device_id)
      .eq("prospect_num", phone)
      .order("date_insert", { ascending: false})
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

    // Use prompt_data from prompts table as the dynamic prompt
    const promptData = prompt.prompts_data || "You are a helpful assistant. Respond naturally to the user.";

    console.log(`🤖 Generating AI response with prompt: ${prompt.prompts_name}`);
    console.log(`📊 Current Stage: ${currentStage || 'First Stage'}`);

    // Generate AI response with dynamic prompt support
    const aiResponse = await generateFlowAIResponse(
      conversationHistoryText,
      message,
      promptData,
      device,
      currentStage,
      false // useOneMessage - can be made configurable
    );

    console.log(`✅ AI Response Generated:`);
    console.log(`   Stage: ${aiResponse.stage || 'None'}`);
    console.log(`   Has Details: ${aiResponse.hasDetails ? 'Yes' : 'No'}`);
    console.log(`   Content: ${aiResponse.cleanContent.substring(0, 100)}...`);

    // Update conversation with stage and details
    if (aiResponse.stage || aiResponse.details) {
      const updateData: any = {};

      if (aiResponse.stage) {
        updateData.stage = aiResponse.stage;
      }

      if (aiResponse.details) {
        updateData.detail = aiResponse.details;
      }

      await supabaseAdmin
        .from("ai_whatsapp")
        .update(updateData)
        .eq("id_prospect", conversation.id_prospect);

      console.log(`💾 Updated conversation with stage and details`);
    }

    // Warn if stage marker is missing
    if (!aiResponse.hasStageMarker) {
      console.warn(`⚠️ Warning: AI response missing !!Stage!! marker. Prompt may need adjustment.`);
    }

    return aiResponse.cleanContent;
  } catch (error) {
    console.error("AI response generation error:", error);
    return "Maaf, saya mengalami kendala teknis. Silakan coba lagi nanti.";
  }
}
