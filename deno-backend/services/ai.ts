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
 * Build UNIFIED system prompt with JSON format + dynamic stage tracking + detail capture
 * This supports images, videos, audio, and text responses
 */
export function buildDynamicSystemPrompt(
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
    {"type": "video", "content": "https://example.com/video.mp4"},
    {"type": "audio", "content": "https://example.com/audio.mp3"},
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

4. **RESPONSE ARRAY** (SUPPORTS ALL MEDIA):
   - Divide long messages into multiple short "text" entries
   - Images: {"type": "image", "content": "URL"}
   - Videos: {"type": "video", "content": "URL"}
   - Audio: {"type": "audio", "content": "URL"}
   - Text: {"type": "text", "content": "message"}
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
    {"type": "video", "content": "https://automation.erprolevision.com/public/videos/demo.mp4"},
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
 * NOW SUPPORTS JSON FORMAT (images, videos, audio)
 */
export interface ParsedAIResponse {
  stage: string | null;
  details: string | null;
  cleanContent: string;
  hasStageMarker: boolean;
  hasDetails: boolean;
  jsonResponse?: any; // NEW: Store full JSON response for media support
}

export function parseAIResponse(response: string): ParsedAIResponse {
  // Try to parse as JSON first (NEW FORMAT - supports images/videos/audio)
  try {
    const jsonResponse = JSON.parse(response);

    // Extract details from "Detail" field if present
    const details = jsonResponse.Detail ? extractDetailsFromResponse(jsonResponse.Detail) : null;

    // Extract stage
    const stage = jsonResponse.Stage || null;

    // Build clean content from Response array (for text-only responses)
    let cleanContent = "";
    if (jsonResponse.Response && Array.isArray(jsonResponse.Response)) {
      cleanContent = jsonResponse.Response
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.content)
        .join("\n");
    }

    return {
      stage,
      details,
      cleanContent: cleanContent.trim() || response,
      hasStageMarker: stage !== null,
      hasDetails: details !== null,
      jsonResponse, // Return full JSON for media handling
    };
  } catch (error) {
    // FALLBACK: Old text format with !!Stage!! markers
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
