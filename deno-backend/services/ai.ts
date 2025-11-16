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
 * Extract stage names from prompt
 * Finds all !!Stage [name]!! markers
 */
export function extractStagesFromPrompt(promptData: string): string[] {
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
export function extractDetailsFromResponse(response: string): string | null {
  const detailRegex = /%%([\s\S]*?)%%/;
  const match = response.match(detailRegex);
  return match ? match[1].trim() : null;
}

/**
 * Extract stage from response using !!Stage!! markers
 */
export function extractStageFromResponse(response: string): string | null {
  const stageRegex = /!!Stage\s+([^!]+)!!/;
  const match = response.match(stageRegex);
  return match ? match[1].trim() : null;
}

/**
 * Build dynamic system prompt with stage tracking and detail capture
 */
export function buildDynamicSystemPrompt(
  promptData: string,
  conversationHistory: string,
  currentStage: string | null,
  useOneMessage: boolean = false
): string {
  const stages = extractStagesFromPrompt(promptData);

  return `⚠️⚠️⚠️ CRITICAL SYSTEM INSTRUCTIONS - FAILURE TO FOLLOW WILL BREAK THE SYSTEM ⚠️⚠️⚠️

YOU MUST FOLLOW THESE RULES IN EVERY SINGLE RESPONSE WITHOUT EXCEPTION:

1. 🚨 MANDATORY STAGE MARKER 🚨
   - EVERY response MUST start with: !!Stage [stage name]!!
   - NO EXCEPTIONS - include this in EVERY response
   - The stage name must match EXACTLY one of the stages defined by the user
   - The marker is invisible to the customer - it's for backend tracking
   - If you forget the marker, the system will break

   Available stages (use EXACTLY these names):
${stages.map(s => `   - !!Stage ${s}!!`).join('\n')}

2. 📝 DETAILS CAPTURE:
   - When collecting customer information, wrap ALL details in %% markers
   - IMPORTANT: Use opening %% and closing %% to wrap all details
   - Format (dynamically adapt fields based on what's being collected):
     %%[FIELD1]: [value1]
     [FIELD2]: [value2]
     [FIELD3]: [value3]%%

   - Common fields to capture (adapt as needed):
     * NAMA / NAME
     * ALAMAT / ADDRESS
     * NO FONE / PHONE / NO TEL
     * PAKEJ / PACKAGE / PRODUCT
     * HARGA / PRICE
     * CARA BAYARAN / PAYMENT METHOD
     * Any other fields defined in the prompt

   - The details between %% will be saved to the database automatically
   - Extract and save ANY field that appears between %% markers

3. 🎯 STAGE PROGRESSION:
   - Current stage: ${currentStage || stages[0]}
   - Always detect current stage from context
   - Advance to the appropriate next stage based on user response
   - Use !!Stage [name]!! to mark ALL responses
   - Follow the stage flow defined in the user's prompt

4. 🔄 DYNAMIC STAGE DETECTION:
   - Analyze the user's prompt to understand the stage flow
   - Identify keywords or patterns that indicate stage transitions
   - Match user input to the appropriate stage in the flow
   - Default to the FIRST stage if current stage is null/undefined

5. 📊 VARIABLE REPLACEMENT:
   - Replace placeholders dynamically:
     * {{name}} - Customer name
     * {{target}} - Target (anak/diri sendiri/etc)
     * {{phone}} or {{wa_no}} - Phone number
     * {{product}} - Product name
     * {{info}} - Additional info
     * Any other {{variable}} defined in the prompt
   - Extract values from conversation context

❗ REMINDER:
- Start EVERY response with !!Stage [name]!!
- Wrap ALL collected customer details in %% markers
- Use EXACT stage names as defined by the user

---

Previous Conversation:
${conversationHistory}

---

NOW FOLLOW THE USER'S CUSTOM PROMPT BELOW:

${promptData}

---

${useOneMessage ? 'IMPORTANT: This response should be formatted as a single message (onemessage format).\n' : ''}

RESPOND TO THE USER'S MESSAGE FOLLOWING ALL RULES ABOVE.`;
}

/**
 * Parse AI response and extract structured data
 */
export interface ParsedAIResponse {
  stage: string | null;
  details: string | null;
  cleanContent: string;
  hasStageMarker: boolean;
  hasDetails: boolean;
}

export function parseAIResponse(response: string): ParsedAIResponse {
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

/**
 * Generate AI response for conversation flow with dynamic prompt support
 * Uses device-specific AI configuration and prompts from database
 */
export async function generateFlowAIResponse(
  conversationHistory: string,
  userMessage: string,
  promptData: string,
  device: any,
  currentStage: string | null = null,
  useOneMessage: boolean = false
): Promise<ParsedAIResponse> {
  try {
    // Get AI configuration from device
    const aiModel = device.api_key_option || "openai/gpt-4-turbo";
    const apiKey = device.api_key || "";

    if (!apiKey) {
      throw new Error("AI API key not configured for device");
    }

    // Build dynamic system prompt
    const systemPrompt = buildDynamicSystemPrompt(
      promptData,
      conversationHistory,
      currentStage,
      useOneMessage
    );

    console.log(`🎯 Current Stage: ${currentStage || 'First Stage'}`);

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
        maxTokens: 2000,
      },
      apiKey
    );

    if (!result.success) {
      throw new Error(result.error || "AI generation failed");
    }

    // Parse the response
    const parsed = parseAIResponse(result.content);

    console.log(`📊 Extracted Stage: ${parsed.stage || 'None'}`);
    console.log(`📝 Has Details: ${parsed.hasDetails ? 'Yes' : 'No'}`);

    if (!parsed.hasStageMarker) {
      console.warn('⚠️ Warning: Response missing stage marker!');
    }

    return parsed;
  } catch (error) {
    console.error("Flow AI response error:", error);
    throw error;
  }
}
