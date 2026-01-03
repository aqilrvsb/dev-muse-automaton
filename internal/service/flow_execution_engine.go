package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
)

// FlowExecutionEngine handles the execution of flow nodes
type FlowExecutionEngine struct {
	deviceRepo *repository.DeviceRepository
	convRepo   *repository.ConversationRepository
}

// FlowNode represents a node in the flow
type FlowNode struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"`
	Label  string                 `json:"label"`
	Config map[string]interface{} `json:"config"`
	X      float64                `json:"x"`
	Y      float64                `json:"y"`
}

// FlowEdge represents a connection between nodes
type FlowEdge struct {
	From          string `json:"from"`
	To            string `json:"to"`
	ConditionType string `json:"conditionType,omitempty"`
	ConditionValue string `json:"conditionValue,omitempty"`
}

// FlowData represents the complete flow structure
type FlowData struct {
	Nodes       []FlowNode `json:"nodes"`
	Connections []FlowEdge `json:"connections"`
}

// AIResponsePart represents a single part of AI response (text or image)
type AIResponsePart struct {
	Type    string `json:"type"`
	Jenis   string `json:"Jenis,omitempty"`
	Content string `json:"content"`
}

// AIResponse represents the parsed AI response
type AIResponse struct {
	Stage    string           `json:"Stage"`
	Response []AIResponsePart `json:"Response"`
}

// ExecuteFlow processes the flow starting from a specific node
func (s *FlowProcessorService) ExecuteFlow(
	ctx context.Context,
	flow *models.ChatbotFlow,
	conversationID string,
	userMessage string,
	currentStage string,
) error {
	log.Printf("🚀 Starting flow execution for conversation: %s", conversationID)

	// Check if NodesData is empty
	if flow.NodesData == "" {
		log.Printf("⚠️  Flow NodesData is empty - flow not configured yet")
		return fmt.Errorf("flow has no nodes configured")
	}

	// Parse flow data
	var flowData FlowData
	if err := json.Unmarshal([]byte(flow.NodesData), &flowData); err != nil {
		log.Printf("❌ Failed to parse flow data: %v", err)
		log.Printf("📝 NodesData content: %s", flow.NodesData)
		return fmt.Errorf("failed to parse flow data: %w", err)
	}

	log.Printf("📊 Flow has %d nodes and %d connections", len(flowData.Nodes), len(flowData.Connections))

	// Find starting node
	startNode := s.findStartingNode(flowData, currentStage)
	if startNode == nil {
		log.Printf("⚠️  No starting node found for stage: %s", currentStage)
		return fmt.Errorf("no starting node found")
	}

	log.Printf("🎯 Starting from node: %s (Type: %s)", startNode.ID, startNode.Type)

	// Execute flow from starting node
	return s.executeFromNode(ctx, flow, &flowData, startNode, conversationID, userMessage, currentStage)
}

// ResumeFlow resumes flow execution from a specific node (used after waiting_reply)
func (s *FlowProcessorService) ResumeFlow(
	ctx context.Context,
	flow *models.ChatbotFlow,
	conversationID string,
	userMessage string,
	currentNodeID string,
) error {
	log.Printf("▶️  Resuming flow execution from node: %s", currentNodeID)

	// Check if NodesData is empty
	if flow.NodesData == "" {
		log.Printf("⚠️  Flow NodesData is empty - flow not configured yet")
		return fmt.Errorf("flow has no nodes configured")
	}

	// Parse flow data
	var flowData FlowData
	if err := json.Unmarshal([]byte(flow.NodesData), &flowData); err != nil {
		log.Printf("❌ Failed to parse flow data: %v", err)
		return fmt.Errorf("failed to parse flow data: %w", err)
	}

	// Find the current node
	var currentNode *FlowNode
	for i := range flowData.Nodes {
		if flowData.Nodes[i].ID == currentNodeID {
			currentNode = &flowData.Nodes[i]
			break
		}
	}

	if currentNode == nil {
		log.Printf("❌ Current node %s not found in flow", currentNodeID)
		return fmt.Errorf("current node not found: %s", currentNodeID)
	}

	log.Printf("✅ Found current node: %s (Type: %s)", currentNode.ID, currentNode.Type)

	// Add user's reply to conversation history
	if userMessage != "" {
		err := s.updateConvLast(ctx, conversationID, "User", userMessage)
		if err != nil {
			log.Printf("⚠️  Failed to update conv_last with user message: %v", err)
			// Don't fail the flow, just log the error
		} else {
			log.Printf("✅ Added user message to conv_last: %s", userMessage)
		}
	}

	// Find next node from current node
	nextNode := s.findNextNode(&flowData, currentNode, userMessage)
	if nextNode == nil {
		log.Printf("✅ No next node - flow completed")

		// Mark as completed
		updates := map[string]interface{}{
			"execution_status": "completed",
			"current_node_id":  "completed",
		}
		return s.convRepo.UpdateConversation(ctx, conversationID, updates)
	}

	// Execute from next node
	return s.executeFromNode(ctx, flow, &flowData, nextNode, conversationID, userMessage, "")
}

// findStartingNode finds the node to start execution from
func (s *FlowProcessorService) findStartingNode(flowData FlowData, currentStage string) *FlowNode {
	// If no current stage, find the first node (after start node if exists)
	if currentStage == "" || currentStage == "start" {
		// Look for a node that has no incoming connections (or is connected from start)
		for i := range flowData.Nodes {
			node := &flowData.Nodes[i]
			// Skip if this is a start-type node
			if strings.Contains(strings.ToLower(node.Type), "start") {
				continue
			}

			// Check if this node has incoming connections
			hasIncoming := false
			for _, edge := range flowData.Connections {
				if edge.To == node.ID {
					hasIncoming = true
					break
				}
			}

			// If no incoming connections, this could be the first node
			if !hasIncoming {
				return node
			}
		}

		// If all nodes have incoming connections, get the first node
		if len(flowData.Nodes) > 0 {
			return &flowData.Nodes[0]
		}
	}

	// Otherwise, try to find node by ID matching the stage
	for i := range flowData.Nodes {
		if flowData.Nodes[i].ID == currentStage {
			return &flowData.Nodes[i]
		}
	}

	// Default to first node
	if len(flowData.Nodes) > 0 {
		return &flowData.Nodes[0]
	}

	return nil
}

// executeFromNode executes the flow starting from a specific node
func (s *FlowProcessorService) executeFromNode(
	ctx context.Context,
	flow *models.ChatbotFlow,
	flowData *FlowData,
	node *FlowNode,
	conversationID string,
	userMessage string,
	currentStage string,
) error {
	log.Printf("🔄 Executing node: %s (Type: %s)", node.ID, node.Type)

	// Execute the current node
	continueFlow, err := s.executeNode(ctx, flow, node, conversationID, userMessage)
	if err != nil {
		return fmt.Errorf("failed to execute node %s: %w", node.ID, err)
	}

	// If node says to stop flow (e.g., waiting_reply), stop here
	if !continueFlow {
		log.Printf("⏸️  Flow paused at node: %s", node.ID)
		// Update current node in conversation
		return s.updateConversationNode(ctx, conversationID, node.ID)
	}

	// Find next node
	nextNode := s.findNextNode(flowData, node, userMessage)
	if nextNode == nil {
		log.Printf("✅ Flow completed - no more nodes")

		// Mark flow as completed
		updates := map[string]interface{}{
			"execution_status":  "completed",
			"current_node_id":   "completed",
			"waiting_for_reply": false,
		}

		err := s.convRepo.UpdateConversation(ctx, conversationID, updates)
		if err != nil {
			log.Printf("❌ Failed to mark flow as completed: %v", err)
			return fmt.Errorf("failed to mark flow as completed: %w", err)
		}

		log.Printf("✅ Flow marked as 'completed'")
		return nil
	}

	// Continue to next node
	return s.executeFromNode(ctx, flow, flowData, nextNode, conversationID, userMessage, currentStage)
}

// executeNode executes a single node's action
func (s *FlowProcessorService) executeNode(
	ctx context.Context,
	flow *models.ChatbotFlow,
	node *FlowNode,
	conversationID string,
	userMessage string,
) (bool, error) {
	log.Printf("⚙️  Executing node type: %s", node.Type)

	switch node.Type {
	case "send_message":
		return s.executeSendMessage(ctx, flow, node, conversationID)

	case "delay":
		return s.executeDelay(ctx, node)

	case "waiting_reply":
		return s.executeWaitingReply(ctx, conversationID, node)

	case "waiting_times":
		return s.executeWaitingTimes(ctx, conversationID, node)

	case "ai_prompt":
		return s.executeAIPrompt(ctx, flow, node, conversationID, userMessage)

	case "stage":
		return s.executeStage(ctx, conversationID, node)

	case "send_image", "send_audio", "send_video":
		return s.executeSendMedia(ctx, flow, node, conversationID)

	case "conditions":
		return s.executeConditions(ctx, node, userMessage)

	default:
		log.Printf("⚠️  Unknown node type: %s, skipping", node.Type)
		return true, nil
	}
}

// executeSendMessage sends a WhatsApp message
func (s *FlowProcessorService) executeSendMessage(
	ctx context.Context,
	flow *models.ChatbotFlow,
	node *FlowNode,
	conversationID string,
) (bool, error) {
	// Get message text from config
	text, ok := node.Config["text"].(string)
	if !ok || text == "" {
		log.Printf("⚠️  No text configured for send_message node")
		return true, nil
	}

	log.Printf("📤 Sending message: %s", text)

	// Get conversation to get phone number
	conversation, err := s.convRepo.GetConversationByID(ctx, conversationID)
	if err != nil || conversation == nil {
		log.Printf("❌ Failed to get conversation for sending: %v", err)
		return true, fmt.Errorf("failed to get conversation: %w", err)
	}

	// Send WhatsApp message
	err = s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, text, "", "")
	if err != nil {
		log.Printf("❌ Failed to send WhatsApp message: %v", err)
		return true, fmt.Errorf("failed to send message: %w", err)
	}

	log.Printf("✅ Message sent successfully to %s", conversation.ProspectNum)

	// Update conv_last with bot reply
	return true, s.updateConvLast(ctx, conversationID, "Bot", text)
}

// executeDelay pauses execution for specified seconds
func (s *FlowProcessorService) executeDelay(ctx context.Context, node *FlowNode) (bool, error) {
	// Get delay from config (should be 3 seconds by default)
	delay := 3
	if delayVal, ok := node.Config["delay"].(float64); ok {
		delay = int(delayVal)
	}

	log.Printf("⏱️  Delaying for %d seconds", delay)
	time.Sleep(time.Duration(delay) * time.Second)
	log.Printf("✅ Delay completed")

	return true, nil
}

// executeWaitingReply pauses flow until user replies (no timeout)
func (s *FlowProcessorService) executeWaitingReply(
	ctx context.Context,
	conversationID string,
	node *FlowNode,
) (bool, error) {
	log.Printf("⏸️  Waiting for user reply (no timeout)")

	// Update conversation to waiting state
	updates := map[string]interface{}{
		"waiting_for_reply": true,
		"current_node_id":   node.ID,
	}

	err := s.convRepo.UpdateConversation(ctx, conversationID, updates)
	if err != nil {
		return false, fmt.Errorf("failed to update waiting state: %w", err)
	}

	log.Printf("✅ Set waiting_for_reply=true, current_node_id=%s", node.ID)

	// Flow will resume when next webhook message arrives
	return false, nil // false = stop flow execution
}

// executeWaitingTimes pauses and waits for user reply with timeout
func (s *FlowProcessorService) executeWaitingTimes(
	ctx context.Context,
	conversationID string,
	node *FlowNode,
) (bool, error) {
	// Get timeout from config (should be 8 seconds by default)
	timeout := 8
	if delayVal, ok := node.Config["delay"].(float64); ok {
		timeout = int(delayVal)
	}

	log.Printf("⏳ Waiting for user reply with %d second timeout", timeout)

	// TODO: Implement timeout logic
	// For now, just continue after timeout
	time.Sleep(time.Duration(timeout) * time.Second)

	log.Printf("⏱️  Timeout reached, continuing flow")
	return true, nil
}

// executeAIPrompt processes AI prompt node
func (s *FlowProcessorService) executeAIPrompt(
	ctx context.Context,
	flow *models.ChatbotFlow,
	node *FlowNode,
	conversationID string,
	userMessage string,
) (bool, error) {
	log.Printf("✨ Starting AI Prompt execution")

	// Get promptData from node config
	promptData, ok := node.Config["text"].(string)
	if !ok || promptData == "" {
		log.Printf("❌ No prompt configured for AI node - terminating")
		return true, nil
	}

	// Get device settings to retrieve API key and model
	device, err := s.deviceRepo.GetDeviceByIDDevice(ctx, flow.IDDevice)
	if err != nil || device == nil {
		log.Printf("❌ Failed to get device settings: %v - terminating", err)
		return true, fmt.Errorf("failed to get device settings: %w", err)
	}

	// Get API key and model from device settings
	var apiKey, model string
	if device.APIKey != nil {
		apiKey = *device.APIKey
	}
	model = device.APIKeyOption

	// Terminate if any required field is null
	if promptData == "" || apiKey == "" || model == "" {
		log.Printf("❌ Missing required fields - promptData: %v, apiKey: %v, model: %v - terminating",
			promptData != "", apiKey != "", model != "")
		return true, nil
	}

	log.Printf("✅ Got API settings - Model: %s", model)

	// Get conversation to retrieve conv_last and other data
	conversation, err := s.convRepo.GetConversationByID(ctx, conversationID)
	if err != nil || conversation == nil {
		log.Printf("❌ Failed to get conversation: %v", err)
		return true, fmt.Errorf("failed to get conversation: %w", err)
	}

	// Get lasttext from conv_last (whole conversation history)
	lasttext := ""
	if conversation.ConvLast != nil {
		lasttext = *conversation.ConvLast
	}

	// Get currenttext from userMessage
	currenttext := userMessage

	log.Printf("📝 Building AI prompt with conv_last length: %d, currenttext: %s", len(lasttext), currenttext)

	// Build content string exactly as specified
	content := promptData + "\n\n" +
		"### Instructions:\n" +
		"1. If the current stage is null or undefined, default to the first stage.\n" +
		"2. Always analyze the user's input to determine the appropriate stage. If the input context is unclear, guide the user within the default stage context.\n" +
		"3. Follow all rules and steps strictly. Do not skip or ignore any rules or instructions.\n\n" +
		"4. **Do not repeat the same sentences or phrases that have been used in the recent conversation history.**\n" +
		"5. If the input contains the phrase \"I want this section in add response format [onemessage]\":\n" +
		"   - Add the `Jenis` field with the value `onemessage` at the item level for each text response.\n" +
		"   - The `Jenis` field is only added to `text` types within the `Response` array.\n" +
		"   - If the directive is not present, omit the `Jenis` field entirely.\n\n" +
		"### Response Format:\n" +
		"{\n" +
		"  \"Stage\": \"[Stage]\",  // Specify the current stage explicitly.\n" +
		"  \"Response\": [\n" +
		"    {\"type\": \"text\", \"Jenis\": \"onemessage\", \"content\": \"Provide the first response message here.\"},\n" +
		"    {\"type\": \"image\", \"content\": \"https://example.com/image1.jpg\"},\n" +
		"    {\"type\": \"text\", \"Jenis\": \"onemessage\", \"content\": \"Provide the second response message here.\"}\n" +
		"  ]\n" +
		"}\n\n" +
		"### Example Response:\n" +
		"// If the directive is present\n" +
		"{\n" +
		"  \"Stage\": \"Problem Identification\",\n" +
		"  \"Response\": [\n" +
		"    {\"type\": \"text\", \"Jenis\": \"onemessage\", \"content\": \"Maaf kak, Layla kena reconfirm balik dulu masalah utama anak akak ni.\"},\n" +
		"    {\"type\": \"text\", \"Jenis\": \"onemessage\", \"content\": \"Kurang selera makan, sembelit, atau kerap demam?\"}\n" +
		"  ]\n" +
		"}\n\n" +
		"// If the directive is NOT present\n" +
		"{\n" +
		"  \"Stage\": \"Problem Identification\",\n" +
		"  \"Response\": [\n" +
		"    {\"type\": \"text\", \"content\": \"Maaf kak, Layla kena reconfirm balik dulu masalah utama anak akak ni.\"},\n" +
		"    {\"type\": \"text\", \"content\": \"Kurang selera makan, sembelit, atau kerap demam?\"}\n" +
		"  ]\n" +
		"}\n\n" +
		"### Important Rules:\n" +
		"1. **Include the `Stage` field in every response**:\n" +
		"   - The `Stage` field must explicitly specify the current stage.\n" +
		"   - If the stage is unclear or missing, default to first stage.\n\n" +
		"2. **Use the Correct Response Format**:\n" +
		"   - Divide long responses into multiple short \"text\" segments for better readability.\n" +
		"   - Include all relevant images provided in the input, interspersed naturally with text responses.\n" +
		"   - If multiple images are provided, create separate `image` entries for each.\n\n" +
		"3. **Dynamic Field for [onemessage]**:\n" +
		"   - If the input specifies \"I want this section in add response format [onemessage]\":\n" +
		"      - Add `\"Jenis\": \"onemessage\"` to each `text` type in the `Response` array.\n" +
		"   - If the directive is not present, omit the `Jenis` field entirely.\n" +
		"   - Non-text types like `image` never include the `Jenis` field.\n\n"

	// Build payload exactly as specified
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": content},
			{"role": "assistant", "content": lasttext},
			{"role": "user", "content": currenttext},
		},
		"temperature":         0.67,
		"top_p":              1,
		"repetition_penalty": 1,
	}

	// Call OpenRouter API
	apiURL := "https://openrouter.ai/api/v1/chat/completions"

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("❌ Failed to marshal payload: %v", err)
		return true, fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("❌ Failed to create request: %v", err)
		return true, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ OpenRouter API error: %v", err)
		return true, fmt.Errorf("OpenRouter API error: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("❌ Failed to read response body: %v", err)
		return true, fmt.Errorf("failed to read response body: %w", err)
	}

	// Parse response
	var responseBody map[string]interface{}
	if err := json.Unmarshal(body, &responseBody); err != nil {
		log.Printf("❌ Failed to parse response: %v", err)
		return true, fmt.Errorf("failed to parse response: %w", err)
	}

	// Extract reply content
	choices, ok := responseBody["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		log.Printf("❌ Invalid OpenRouter API response: %v", string(body))
		return true, fmt.Errorf("invalid OpenRouter API response")
	}

	firstChoice, ok := choices[0].(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid choice format")
		return true, fmt.Errorf("invalid choice format")
	}

	message, ok := firstChoice["message"].(map[string]interface{})
	if !ok {
		log.Printf("❌ Invalid message format")
		return true, fmt.Errorf("invalid message format")
	}

	replyContent, ok := message["content"].(string)
	if !ok {
		log.Printf("❌ Invalid content format")
		return true, fmt.Errorf("invalid content format")
	}

	log.Printf("🤖 AI Response received: %d characters", len(replyContent))
	log.Printf("📄 Raw response: %s", replyContent)

	// Step 2: Sanitize content - remove ```json markers
	sanitizedContent := regexp.MustCompile("^```json|```$").ReplaceAllString(strings.TrimSpace(replyContent), "")

	// Try to parse as JSON
	var stage string
	var replyParts []AIResponsePart

	// Attempt 1: Try as JSON with Stage and Response
	var aiResp AIResponse
	if err := json.Unmarshal([]byte(sanitizedContent), &aiResp); err == nil {
		if aiResp.Stage != "" && len(aiResp.Response) > 0 {
			stage = aiResp.Stage
			replyParts = aiResp.Response
			log.Printf("✅ Parsed as JSON format - Stage: %s, Parts: %d", stage, len(replyParts))
		}
	}

	// Attempt 2: Try old format (Stage:\nResponse:)
	if len(replyParts) == 0 {
		re := regexp.MustCompile(`Stage:\s*(.+?)\nResponse:\s*(\[.*?\])$`)
		matches := re.FindStringSubmatch(replyContent)
		if len(matches) == 3 {
			stage = strings.TrimSpace(matches[1])
			responseJSON := matches[2]
			if err := json.Unmarshal([]byte(responseJSON), &replyParts); err == nil {
				log.Printf("✅ Parsed as old format - Stage: %s, Parts: %d", stage, len(replyParts))
			}
		}
	}

	// Attempt 3: Check if encapsulated JSON within triple backticks
	if len(replyParts) == 0 {
		re := regexp.MustCompile(`^\s*\{\s*"Stage":\s*".+?",\s*"Response":\s*\[.*\]\s*}\s*$`)
		if re.MatchString(sanitizedContent) {
			var aiResp2 AIResponse
			if err := json.Unmarshal([]byte(sanitizedContent), &aiResp2); err == nil {
				if aiResp2.Stage != "" && len(aiResp2.Response) > 0 {
					stage = aiResp2.Stage
					replyParts = aiResp2.Response
					log.Printf("✅ Parsed as encapsulated JSON - Stage: %s, Parts: %d", stage, len(replyParts))
				}
			}
		}
	}

	// Attempt 4: Plain text fallback
	if len(replyParts) == 0 {
		log.Printf("⚠️  Plain text response detected, using fallback")
		if stage == "" {
			stage = "Problem Identification" // Default stage
		}
		replyParts = []AIResponsePart{
			{Type: "text", Content: strings.TrimSpace(replyContent)},
		}
	}

	// Validate replyParts
	if len(replyParts) == 0 {
		log.Printf("❌ Failed to parse response parts")
		return true, fmt.Errorf("failed to parse response")
	}

	log.Printf("✅ Final parsed - Stage: %s, Parts: %d", stage, len(replyParts))

	// Step 3: Update stage if present
	if stage != "" {
		updates := map[string]interface{}{
			"stage": stage,
		}
		if err := s.convRepo.UpdateConversation(ctx, conversationID, updates); err != nil {
			log.Printf("⚠️  Failed to update stage: %v", err)
		} else {
			log.Printf("✅ Updated stage to: %s", stage)
		}
	}

	// Step 4: Process and send messages
	return s.processAIResponseParts(ctx, flow, conversationID, conversation, replyParts)
}

// executeStage updates the conversation stage
func (s *FlowProcessorService) executeStage(
	ctx context.Context,
	conversationID string,
	node *FlowNode,
) (bool, error) {
	// Get stage name from config
	stageName, ok := node.Config["value"].(string)
	if !ok || stageName == "" {
		log.Printf("⚠️  No stage value configured")
		return true, nil
	}

	log.Printf("🎯 Updating stage to: %s", stageName)

	// Update conversation stage
	updates := map[string]interface{}{
		"stage": stageName,
	}

	err := s.convRepo.UpdateConversation(ctx, conversationID, updates)
	if err != nil {
		return true, fmt.Errorf("failed to update stage: %w", err)
	}

	log.Printf("✅ Stage updated successfully")
	return true, nil
}

// executeSendMedia sends media (image/audio/video)
func (s *FlowProcessorService) executeSendMedia(
	ctx context.Context,
	flow *models.ChatbotFlow,
	node *FlowNode,
	conversationID string,
) (bool, error) {
	// Get media URL from config
	url, ok := node.Config["url"].(string)
	if !ok || url == "" {
		log.Printf("⚠️  No URL configured for media node")
		return true, nil
	}

	log.Printf("📤 Sending %s: %s", node.Type, url)

	// Get conversation to get phone number
	conversation, err := s.convRepo.GetConversationByID(ctx, conversationID)
	if err != nil || conversation == nil {
		log.Printf("❌ Failed to get conversation for sending media: %v", err)
		return true, fmt.Errorf("failed to get conversation: %w", err)
	}

	// Map node type to media type
	mediaType := ""
	switch node.Type {
	case "send_image":
		mediaType = "image"
	case "send_audio":
		mediaType = "audio"
	case "send_video":
		mediaType = "video"
	}

	// Send WhatsApp media
	err = s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, "", mediaType, url)
	if err != nil {
		log.Printf("❌ Failed to send WhatsApp media: %v", err)
		return true, fmt.Errorf("failed to send media: %w", err)
	}

	log.Printf("✅ Media sent successfully to %s", conversation.ProspectNum)

	// Update conv_last with bot media send (just the URL)
	return true, s.updateConvLast(ctx, conversationID, "Bot", url)
}

// executeConditions evaluates conditions
func (s *FlowProcessorService) executeConditions(
	ctx context.Context,
	node *FlowNode,
	userMessage string,
) (bool, error) {
	log.Printf("🔀 Evaluating conditions")

	// Conditions are handled in findNextNode
	// This node just passes through
	return true, nil
}

// processAIResponseParts processes AI response parts and sends messages
func (s *FlowProcessorService) processAIResponseParts(
	ctx context.Context,
	flow *models.ChatbotFlow,
	conversationID string,
	conversation *models.AIWhatsapp,
	replyParts []AIResponsePart,
) (bool, error) {
	log.Printf("📤 Processing %d AI response parts", len(replyParts))

	var textParts []string
	isOnemessageActive := false

	for index, part := range replyParts {
		if part.Type == "" || part.Content == "" {
			log.Printf("⚠️  Invalid response part structure at index %d", index)
			continue
		}

		// Check if this is a onemessage text part
		if part.Type == "text" && part.Jenis == "onemessage" {
			// Start collecting text parts
			textParts = append(textParts, part.Content)
			isOnemessageActive = true

			// Check if next part is also onemessage
			isLastOnemessage := true
			if index+1 < len(replyParts) {
				nextPart := replyParts[index+1]
				if nextPart.Type == "text" && nextPart.Jenis == "onemessage" {
					isLastOnemessage = false
				}
			}

			// If this is the last onemessage in sequence, send combined message
			if isLastOnemessage {
				combinedMessage := strings.Join(textParts, "\n")
				log.Printf("📨 Sending combined onemessage: %s", combinedMessage)

				// Send WhatsApp message
				err := s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, combinedMessage, "", "")
				if err != nil {
					log.Printf("❌ Failed to send combined message: %v", err)
				} else {
					log.Printf("✅ Combined message sent")

					// Update conv_last
					newBotEntry := fmt.Sprintf("Bot: %s", combinedMessage)
					if err := s.appendToConvLast(ctx, conversationID, newBotEntry); err != nil {
						log.Printf("⚠️  Failed to update conv_last: %v", err)
					}
				}

				// Reset
				textParts = []string{}
				isOnemessageActive = false
			}
		} else {
			// If we were collecting onemessage parts, send them first
			if isOnemessageActive {
				combinedMessage := strings.Join(textParts, "\n")
				log.Printf("📨 Sending combined onemessage (interrupted): %s", combinedMessage)

				err := s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, combinedMessage, "", "")
				if err != nil {
					log.Printf("❌ Failed to send combined message: %v", err)
				} else {
					newBotEntry := fmt.Sprintf("Bot: %s", combinedMessage)
					if err := s.appendToConvLast(ctx, conversationID, newBotEntry); err != nil {
						log.Printf("⚠️  Failed to update conv_last: %v", err)
					}
				}

				textParts = []string{}
				isOnemessageActive = false
			}

			// Now handle the current part (normal text or image)
			if part.Type == "text" {
				log.Printf("📨 Sending text message: %s", part.Content)

				err := s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, part.Content, "", "")
				if err != nil {
					log.Printf("❌ Failed to send text message: %v", err)
				} else {
					log.Printf("✅ Text message sent")

					newBotEntry := fmt.Sprintf("Bot: %s", part.Content)
					if err := s.appendToConvLast(ctx, conversationID, newBotEntry); err != nil {
						log.Printf("⚠️  Failed to update conv_last: %v", err)
					}
				}
			} else if part.Type == "image" || part.Type == "video" || part.Type == "audio" {
				// Decode URL if needed
				mediaURL := strings.TrimSpace(part.Content)
				if decodedURL, err := url.QueryUnescape(mediaURL); err == nil {
					mediaURL = decodedURL
				}

				// Detect MIME type and determine actual media type
				actualType, mimeType := s.detectMediaType(ctx, mediaURL)
				log.Printf("📨 Sending %s (MIME: %s): %s", actualType, mimeType, mediaURL)

				// Send message with detected media type and MIME type
				// SendMessage signature: (ctx, deviceID, to, message, mediaType, mediaURL, mimeType)
				err := s.whatsappService.SendMessage(ctx, flow.IDDevice, conversation.ProspectNum, "", actualType, mediaURL, mimeType)

				if err != nil {
					log.Printf("❌ Failed to send %s: %v", actualType, err)
				} else {
					log.Printf("✅ %s sent", actualType)

					newBotEntry := fmt.Sprintf("Bot: %s", mediaURL)
					if err := s.appendToConvLast(ctx, conversationID, newBotEntry); err != nil {
						log.Printf("⚠️  Failed to update conv_last: %v", err)
					}
				}
			}
		}
	}

	log.Printf("✅ All AI response parts processed")
	return true, nil
}

// detectMediaType detects the media type (image/video/audio) from URL
func (s *FlowProcessorService) detectMediaType(ctx context.Context, fileURL string) (string, string) {
	// Step 1: Try to get extension from URL path
	parsedURL, err := url.Parse(fileURL)
	if err == nil {
		path := parsedURL.Path
		ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(path), "."))

		// Map of extensions to MIME types
		extMap := map[string]string{
			// Images
			"jpg":  "image/jpeg",
			"jpeg": "image/jpeg",
			"png":  "image/png",
			"gif":  "image/gif",
			"webp": "image/webp",
			"bmp":  "image/bmp",
			"svg":  "image/svg+xml",
			// Videos
			"mp4":  "video/mp4",
			"avi":  "video/x-msvideo",
			"mov":  "video/quicktime",
			"wmv":  "video/x-ms-wmv",
			"flv":  "video/x-flv",
			"webm": "video/webm",
			"mkv":  "video/x-matroska",
			// Audio
			"mp3":  "audio/mpeg",
			"wav":  "audio/wav",
			"ogg":  "audio/ogg",
			"m4a":  "audio/mp4",
			"aac":  "audio/aac",
			"flac": "audio/flac",
		}

		if ext != "" {
			if mimeType, ok := extMap[ext]; ok {
				mediaType := s.mimeToMediaType(mimeType)
				log.Printf("🔍 Detected from extension: %s -> %s (%s)", ext, mediaType, mimeType)
				return mediaType, mimeType
			}
		}
	}

	// Step 2: Try to detect from HTTP headers
	log.Printf("🔍 No extension found, checking HTTP headers for: %s", fileURL)
	req, err := http.NewRequestWithContext(ctx, "HEAD", fileURL, nil)
	if err == nil {
		client := &http.Client{
			Timeout: 10 * time.Second,
		}
		resp, err := client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			contentType := resp.Header.Get("Content-Type")
			if contentType != "" {
				// Handle multiple content types (take the last one)
				parts := strings.Split(contentType, ",")
				mimeType := strings.TrimSpace(parts[len(parts)-1])
				// Remove charset if present
				mimeType = strings.Split(mimeType, ";")[0]

				mediaType := s.mimeToMediaType(mimeType)
				log.Printf("🔍 Detected from headers: %s -> %s", mimeType, mediaType)
				return mediaType, mimeType
			}
		} else {
			log.Printf("⚠️  Failed to fetch headers: %v", err)
		}
	}

	// Step 3: Fallback to image/jpeg
	log.Printf("⚠️  Could not detect media type, defaulting to image/jpeg")
	return "image", "image/jpeg"
}

// mimeToMediaType converts MIME type to media type (image/video/audio)
func (s *FlowProcessorService) mimeToMediaType(mimeType string) string {
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	} else if strings.HasPrefix(mimeType, "video/") {
		return "video"
	} else if strings.HasPrefix(mimeType, "audio/") {
		return "audio"
	}
	return "image" // default fallback
}

// appendToConvLast appends a new entry to conv_last
func (s *FlowProcessorService) appendToConvLast(ctx context.Context, conversationID string, entry string) error {
	conv, err := s.convRepo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return err
	}

	convLast := ""
	if conv.ConvLast != nil {
		convLast = *conv.ConvLast
	}

	if convLast != "" {
		convLast += "\n" + entry
	} else {
		convLast = entry
	}

	updates := map[string]interface{}{
		"conv_last": convLast,
	}

	return s.convRepo.UpdateConversation(ctx, conversationID, updates)
}

// findNextNode finds the next node to execute based on edges
func (s *FlowProcessorService) findNextNode(
	flowData *FlowData,
	currentNode *FlowNode,
	userMessage string,
) *FlowNode {
	// Find all outgoing edges from current node
	var outgoingEdges []FlowEdge
	for _, edge := range flowData.Connections {
		if edge.From == currentNode.ID {
			outgoingEdges = append(outgoingEdges, edge)
		}
	}

	if len(outgoingEdges) == 0 {
		log.Printf("ℹ️  No outgoing edges from node: %s", currentNode.ID)
		return nil
	}

	// If only one edge, follow it
	if len(outgoingEdges) == 1 {
		return s.findNodeByID(flowData, outgoingEdges[0].To)
	}

	// Multiple edges - check if this is a Conditions node
	if currentNode.Type == "conditions" {
		log.Printf("🔀 Conditions node with %d edges", len(outgoingEdges))

		// Match user message against conditions
		for _, edge := range outgoingEdges {
			if edge.ConditionType == "" || edge.ConditionValue == "" {
				log.Printf("⚠️  Edge has no condition type/value, skipping")
				continue
			}

			matched := false
			switch strings.ToLower(edge.ConditionType) {
			case "equal":
				matched = strings.ToLower(userMessage) == strings.ToLower(edge.ConditionValue)
			case "contains":
				matched = strings.Contains(strings.ToLower(userMessage), strings.ToLower(edge.ConditionValue))
			case "match":
				matched = strings.Contains(strings.ToLower(userMessage), strings.ToLower(edge.ConditionValue))
			case "default":
				matched = true // Default always matches
			}

			if matched {
				log.Printf("✅ Condition matched: %s '%s'", edge.ConditionType, edge.ConditionValue)
				return s.findNodeByID(flowData, edge.To)
			}
		}

		// No conditions matched, look for default
		for _, edge := range outgoingEdges {
			if strings.ToLower(edge.ConditionType) == "default" {
				log.Printf("✅ Using default condition")
				return s.findNodeByID(flowData, edge.To)
			}
		}

		// No conditions matched and no default - randomly select one of the edges
		if len(outgoingEdges) > 0 {
			randomIndex := rand.Intn(len(outgoingEdges))
			selectedEdge := outgoingEdges[randomIndex]
			log.Printf("🎲 No conditions matched, randomly selected edge %d/%d (to: %s)", randomIndex+1, len(outgoingEdges), selectedEdge.To)
			return s.findNodeByID(flowData, selectedEdge.To)
		}

		log.Printf("⚠️  No edges available, flow stops")
		return nil
	}

	// Not a conditions node, but multiple edges - follow first one
	log.Printf("⚠️  Multiple edges from non-condition node, following first one")
	return s.findNodeByID(flowData, outgoingEdges[0].To)
}

// findNodeByID finds a node by its ID
func (s *FlowProcessorService) findNodeByID(flowData *FlowData, nodeID string) *FlowNode {
	for i := range flowData.Nodes {
		if flowData.Nodes[i].ID == nodeID {
			return &flowData.Nodes[i]
		}
	}
	return nil
}

// updateConversationNode updates the current node in conversation
func (s *FlowProcessorService) updateConversationNode(
	ctx context.Context,
	conversationID string,
	nodeID string,
) error {
	updates := map[string]interface{}{
		"current_node_id": nodeID,
	}

	return s.convRepo.UpdateConversation(ctx, conversationID, updates)
}

// updateConvLast updates the conversation history
func (s *FlowProcessorService) updateConvLast(
	ctx context.Context,
	conversationID string,
	role string,
	message string,
) error {
	// Get current conversation
	conv, err := s.convRepo.GetConversationByID(ctx, conversationID)
	if err != nil {
		return err
	}

	// Append to conv_last
	convLast := ""
	if conv.ConvLast != nil {
		convLast = *conv.ConvLast
	}

	newLine := fmt.Sprintf("%s: %s", role, message)
	if convLast != "" {
		convLast += "\n" + newLine
	} else {
		convLast = newLine
	}

	updates := map[string]interface{}{
		"conv_last": convLast,
	}

	return s.convRepo.UpdateConversation(ctx, conversationID, updates)
}
