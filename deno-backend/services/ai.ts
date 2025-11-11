/**
 * AI Service
 *
 * Handles AI completions from multiple providers:
 * - OpenAI (GPT-4, GPT-3.5, etc.)
 * - Google (Gemini)
 * Uses OpenRouter API for unified access
 */

export interface AICompletionRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResponse {
  success: boolean;
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

/**
 * Generate AI completion
 * Uses OpenRouter for unified API access to multiple AI providers
 */
export async function generateAICompletion(
  request: AICompletionRequest,
  apiKey: string
): Promise<AICompletionResponse> {
  try {
    // Prepare messages
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt if provided
    if (request.systemPrompt) {
      messages.push({
        role: "system",
        content: request.systemPrompt,
      });
    }

    // Add conversation messages
    messages.push(...request.messages);

    // Build request payload for OpenRouter
    const payload = {
      model: request.model,
      messages,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 1000,
    };

    console.log(`🤖 AI Request: ${request.model}`);

    // Call OpenRouter API (unified interface for OpenAI, Google, Anthropic, etc.)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://dev-muse-automaton.deno.dev",
        "X-Title": "Dev Muse Automaton",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    // Extract content
    const content = result.choices?.[0]?.message?.content || "";

    // Extract usage
    const usage = result.usage ? {
      promptTokens: result.usage.prompt_tokens || 0,
      completionTokens: result.usage.completion_tokens || 0,
      totalTokens: result.usage.total_tokens || 0,
    } : undefined;

    console.log(`✅ AI Response: ${content.substring(0, 100)}...`);

    return {
      success: true,
      content,
      usage,
    };
  } catch (error) {
    console.error(`❌ AI generation error:`, error);
    return {
      success: false,
      content: "",
      error: error.message,
    };
  }
}

/**
 * Generate AI response for conversation flow
 * Uses device-specific AI configuration
 */
export async function generateFlowAIResponse(
  conversationHistory: string,
  userMessage: string,
  flowContext: string,
  device: any
): Promise<string> {
  try {
    // Get AI configuration from device
    const aiModel = device.api_key_option || "openai/gpt-4.1";
    const apiKey = device.api_key || "";

    if (!apiKey) {
      throw new Error("AI API key not configured for device");
    }

    // Build system prompt
    const systemPrompt = `You are a helpful AI assistant in a WhatsApp conversation.

Flow Context: ${flowContext}

Your role is to:
1. Respond naturally based on the conversation context
2. Follow any instructions provided in the flow context
3. Keep responses concise and appropriate for WhatsApp (avoid very long messages)
4. Be friendly and professional

Previous Conversation:
${conversationHistory}
`;

    // Generate completion
    const result = await generateAICompletion(
      {
        model: aiModel,
        messages: [
          {
            role: "user",
            content: userMessage,
          },
        ],
        systemPrompt,
        temperature: 0.7,
        maxTokens: 500,
      },
      apiKey
    );

    if (!result.success) {
      throw new Error(result.error || "AI generation failed");
    }

    return result.content;
  } catch (error) {
    console.error("Flow AI response error:", error);
    throw error;
  }
}
