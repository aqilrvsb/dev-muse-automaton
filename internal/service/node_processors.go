package service

import (
	"chatbot-automation/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// StartNodeProcessor processes start nodes
type StartNodeProcessor struct{}

func (p *StartNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	if nextNodeID == "" {
		return &models.ExecutionResult{
			Success:       false,
			Message:       "No outgoing edge from start node",
			CompletedFlow: true,
		}, nil
	}

	return &models.ExecutionResult{
		Success:     true,
		Message:     "Flow started",
		NextNodeID:  nextNodeID,
		ShouldReply: false,
		Variables:   ctx.Variables,
	}, nil
}

func (p *StartNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeStart
}

// MessageNodeProcessor processes message nodes
type MessageNodeProcessor struct{}

func (p *MessageNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get message from node data
	message, ok := node.Data["message"].(string)
	if !ok || message == "" {
		message = "Hello!"
	}

	// Replace variables in message
	message = p.replaceVariables(message, ctx.Variables)

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Message sent",
		NextNodeID:    nextNodeID,
		Response:      message,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *MessageNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeMessage
}

func (p *MessageNodeProcessor) replaceVariables(message string, variables map[string]interface{}) string {
	if variables == nil {
		return message
	}

	result := message
	for key, value := range variables {
		placeholder := fmt.Sprintf("{{%s}}", key)
		valueStr := fmt.Sprintf("%v", value)
		result = strings.ReplaceAll(result, placeholder, valueStr)
	}

	return result
}

// AINodeProcessor processes AI nodes
type AINodeProcessor struct {
	aiService *AIService
}

func (p *AINodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get AI configuration from node data
	provider, _ := node.Data["provider"].(string)
	if provider == "" {
		provider = "openai"
	}

	model, _ := node.Data["model"].(string)
	if model == "" {
		model = "gpt-3.5-turbo"
	}

	systemPrompt, _ := node.Data["systemPrompt"].(string)
	prompt, _ := node.Data["prompt"].(string)

	// Build messages
	messages := make([]models.AIMessage, 0)

	// Add context if available
	if prompt != "" {
		messages = append(messages, models.AIMessage{
			Role:    "system",
			Content: prompt,
		})
	}

	// Add user message
	if ctx.UserMessage != "" {
		messages = append(messages, models.AIMessage{
			Role:    "user",
			Content: ctx.UserMessage,
		})
	}

	// Generate AI response
	aiReq := &models.AICompletionRequest{
		Provider:  models.AIProvider(provider),
		Model:     models.AIModel(model),
		Messages:  messages,
		DeviceID:  ctx.DeviceID,
	}

	if systemPrompt != "" {
		aiReq.SystemPrompt = &systemPrompt
	}

	// Note: This would need a userID - for now we'll skip actual AI call
	// In production, this should be called with proper authentication
	response := "AI response placeholder"

	// Store AI response in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["ai_response"] = response
	ctx.Variables["last_user_message"] = ctx.UserMessage

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "AI response generated",
		NextNodeID:    nextNodeID,
		Response:      response,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *AINodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeAI
}

// ConditionNodeProcessor processes condition nodes
type ConditionNodeProcessor struct{}

func (p *ConditionNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get condition from node data
	conditionType, _ := node.Data["conditionType"].(string)
	variableName, _ := node.Data["variable"].(string)
	operator, _ := node.Data["operator"].(string)
	compareValue, _ := node.Data["value"].(string)

	// Evaluate condition
	conditionMet := false

	if conditionType == "message_contains" {
		// Check if user message contains a keyword
		keyword, _ := node.Data["keyword"].(string)
		conditionMet = strings.Contains(strings.ToLower(ctx.UserMessage), strings.ToLower(keyword))
	} else if conditionType == "variable_check" {
		// Check variable value
		if ctx.Variables != nil {
			variableValue := ctx.Variables[variableName]
			conditionMet = p.evaluateCondition(variableValue, operator, compareValue)
		}
	}

	// Find next node based on condition
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source != node.ID {
			continue
		}

		// Check edge label/handle for "true" or "false"
		if conditionMet {
			if edge.SourceHandle == "true" || edge.Label == "true" || edge.Label == "Yes" {
				nextNodeID = edge.Target
				break
			}
		} else {
			if edge.SourceHandle == "false" || edge.Label == "false" || edge.Label == "No" {
				nextNodeID = edge.Target
				break
			}
		}
	}

	// If no specific edge found, take first available
	if nextNodeID == "" {
		for _, edge := range edges {
			if edge.Source == node.ID {
				nextNodeID = edge.Target
				break
			}
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("Condition evaluated: %v", conditionMet),
		NextNodeID:    nextNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *ConditionNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeCondition
}

func (p *ConditionNodeProcessor) evaluateCondition(value interface{}, operator string, compareValue string) bool {
	valueStr := fmt.Sprintf("%v", value)

	switch operator {
	case "equals", "==":
		return valueStr == compareValue
	case "not_equals", "!=":
		return valueStr != compareValue
	case "contains":
		return strings.Contains(strings.ToLower(valueStr), strings.ToLower(compareValue))
	case "greater_than", ">":
		valNum, err1 := strconv.ParseFloat(valueStr, 64)
		compareNum, err2 := strconv.ParseFloat(compareValue, 64)
		if err1 == nil && err2 == nil {
			return valNum > compareNum
		}
	case "less_than", "<":
		valNum, err1 := strconv.ParseFloat(valueStr, 64)
		compareNum, err2 := strconv.ParseFloat(compareValue, 64)
		if err1 == nil && err2 == nil {
			return valNum < compareNum
		}
	}

	return false
}

// DelayNodeProcessor processes delay nodes
type DelayNodeProcessor struct{}

func (p *DelayNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get delay duration from node data
	delaySeconds := 0
	if delayVal, ok := node.Data["delay"].(float64); ok {
		delaySeconds = int(delayVal)
	} else if delayStr, ok := node.Data["delay"].(string); ok {
		if val, err := strconv.Atoi(delayStr); err == nil {
			delaySeconds = val
		}
	}

	if delaySeconds <= 0 {
		delaySeconds = 1 // Default 1 second
	}

	// In a real implementation, this would schedule the next node execution
	// For now, we'll just pause
	time.Sleep(time.Duration(delaySeconds) * time.Second)

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("Delayed for %d seconds", delaySeconds),
		NextNodeID:    nextNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		DelaySeconds:  delaySeconds,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *DelayNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeDelay
}

// EndNodeProcessor processes end nodes
type EndNodeProcessor struct{}

func (p *EndNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get final message if any
	message, _ := node.Data["message"].(string)
	if message == "" {
		message = "Thank you for your time!"
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Flow completed",
		Response:      message,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: true,
	}, nil
}

func (p *EndNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeEnd
}

// ImageNodeProcessor processes image nodes
type ImageNodeProcessor struct{}

func (p *ImageNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get image URL and caption from node data
	imageURL, _ := node.Data["imageUrl"].(string)
	if imageURL == "" {
		imageURL, _ = node.Data["url"].(string)
	}

	caption, _ := node.Data["caption"].(string)
	if caption == "" {
		caption, _ = node.Data["message"].(string)
	}

	// Replace variables in caption
	if caption != "" && ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			caption = strings.ReplaceAll(caption, placeholder, valueStr)
		}
	}

	if imageURL == "" {
		return &models.ExecutionResult{
			Success: false,
			Message: "Image URL is required",
			Error:   "No image URL provided in node data",
		}, nil
	}

	// Store media info in variables for webhook handler to process
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_media_type"] = "image"
	ctx.Variables["_media_url"] = imageURL
	ctx.Variables["_media_caption"] = caption

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	// Construct response message for logging
	response := fmt.Sprintf("[Image: %s]", imageURL)
	if caption != "" {
		response = fmt.Sprintf("[Image: %s] %s", imageURL, caption)
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Image message prepared",
		NextNodeID:    nextNodeID,
		Response:      response,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *ImageNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeImage
}

// AudioNodeProcessor processes audio nodes
type AudioNodeProcessor struct{}

func (p *AudioNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get audio URL from node data
	audioURL, _ := node.Data["audioUrl"].(string)
	if audioURL == "" {
		audioURL, _ = node.Data["url"].(string)
	}

	if audioURL == "" {
		return &models.ExecutionResult{
			Success: false,
			Message: "Audio URL is required",
			Error:   "No audio URL provided in node data",
		}, nil
	}

	// Store media info in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_media_type"] = "audio"
	ctx.Variables["_media_url"] = audioURL

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Audio message prepared",
		NextNodeID:    nextNodeID,
		Response:      fmt.Sprintf("[Audio: %s]", audioURL),
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *AudioNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeAudio
}

// VideoNodeProcessor processes video nodes
type VideoNodeProcessor struct{}

func (p *VideoNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get video URL and caption from node data
	videoURL, _ := node.Data["videoUrl"].(string)
	if videoURL == "" {
		videoURL, _ = node.Data["url"].(string)
	}

	caption, _ := node.Data["caption"].(string)
	if caption == "" {
		caption, _ = node.Data["message"].(string)
	}

	// Replace variables in caption
	if caption != "" && ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			caption = strings.ReplaceAll(caption, placeholder, valueStr)
		}
	}

	if videoURL == "" {
		return &models.ExecutionResult{
			Success: false,
			Message: "Video URL is required",
			Error:   "No video URL provided in node data",
		}, nil
	}

	// Store media info in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_media_type"] = "video"
	ctx.Variables["_media_url"] = videoURL
	ctx.Variables["_media_caption"] = caption

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	response := fmt.Sprintf("[Video: %s]", videoURL)
	if caption != "" {
		response = fmt.Sprintf("[Video: %s] %s", videoURL, caption)
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Video message prepared",
		NextNodeID:    nextNodeID,
		Response:      response,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *VideoNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeVideo
}

// DocumentNodeProcessor processes document nodes
type DocumentNodeProcessor struct{}

func (p *DocumentNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get document URL and filename from node data
	documentURL, _ := node.Data["documentUrl"].(string)
	if documentURL == "" {
		documentURL, _ = node.Data["url"].(string)
	}

	filename, _ := node.Data["filename"].(string)
	caption, _ := node.Data["caption"].(string)
	if caption == "" {
		caption, _ = node.Data["message"].(string)
	}

	// Replace variables in caption
	if caption != "" && ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			caption = strings.ReplaceAll(caption, placeholder, valueStr)
		}
	}

	if documentURL == "" {
		return &models.ExecutionResult{
			Success: false,
			Message: "Document URL is required",
			Error:   "No document URL provided in node data",
		}, nil
	}

	// Store media info in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_media_type"] = "document"
	ctx.Variables["_media_url"] = documentURL
	ctx.Variables["_media_filename"] = filename
	ctx.Variables["_media_caption"] = caption

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	response := fmt.Sprintf("[Document: %s]", documentURL)
	if filename != "" {
		response = fmt.Sprintf("[Document: %s (%s)]", filename, documentURL)
	}
	if caption != "" {
		response += " " + caption
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       "Document message prepared",
		NextNodeID:    nextNodeID,
		Response:      response,
		ShouldReply:   true,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *DocumentNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeDocument
}

// StageNodeProcessor processes stage nodes (for tracking conversation stage)
type StageNodeProcessor struct{}

func (p *StageNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get stage name from node data
	stageName, _ := node.Data["stage"].(string)
	if stageName == "" {
		stageName, _ = node.Data["name"].(string)
	}

	if stageName == "" {
		stageName = "stage_" + node.ID
	}

	// Store stage in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_current_stage"] = stageName
	ctx.Variables["_stage_timestamp"] = time.Now().Unix()

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("Stage set to: %s", stageName),
		NextNodeID:    nextNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *StageNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeStage
}

// PromptNodeProcessor processes prompt nodes (wait for user input and store in variable)
type PromptNodeProcessor struct{}

func (p *PromptNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get prompt message and variable name from node data
	promptMessage, _ := node.Data["message"].(string)
	if promptMessage == "" {
		promptMessage, _ = node.Data["prompt"].(string)
	}
	if promptMessage == "" {
		promptMessage = "Please provide your input:"
	}

	variableName, _ := node.Data["variable"].(string)
	if variableName == "" {
		variableName, _ = node.Data["variableName"].(string)
	}
	if variableName == "" {
		variableName = "user_input"
	}

	// Replace variables in prompt message
	if ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			promptMessage = strings.ReplaceAll(promptMessage, placeholder, valueStr)
		}
	}

	// Check if user has already provided input
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}

	// If this is the first time hitting this node, send the prompt
	promptSentKey := "_prompt_sent_" + node.ID
	if _, alreadySent := ctx.Variables[promptSentKey]; !alreadySent {
		// Mark prompt as sent
		ctx.Variables[promptSentKey] = true

		// Don't move to next node yet - wait for user response
		return &models.ExecutionResult{
			Success:       true,
			Message:       "Prompt sent, waiting for user input",
			NextNodeID:    node.ID, // Stay on this node
			Response:      promptMessage,
			ShouldReply:   true,
			Variables:     ctx.Variables,
			CompletedFlow: false,
		}, nil
	}

	// User has responded - store their message in the variable
	ctx.Variables[variableName] = ctx.UserMessage
	delete(ctx.Variables, promptSentKey) // Clean up tracking variable

	// Find next node
	nextNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			nextNodeID = edge.Target
			break
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("User input stored in variable: %s", variableName),
		NextNodeID:    nextNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *PromptNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypePrompt
}

// UserReplyNodeProcessor processes user_reply nodes (wait for user input with timeout)
type UserReplyNodeProcessor struct{}

func (p *UserReplyNodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get configuration from node data
	message, _ := node.Data["message"].(string)
	if message == "" {
		message, _ = node.Data["prompt"].(string)
	}
	if message == "" {
		message = "Please provide your response:"
	}

	variableName, _ := node.Data["variable"].(string)
	if variableName == "" {
		variableName, _ = node.Data["variableName"].(string)
	}
	if variableName == "" {
		variableName = "user_reply"
	}

	// Get timeout configuration (in seconds)
	timeoutSeconds := 300 // Default 5 minutes
	if timeoutVal, ok := node.Data["timeout"].(float64); ok {
		timeoutSeconds = int(timeoutVal)
	} else if timeoutStr, ok := node.Data["timeout"].(string); ok {
		if val, err := strconv.Atoi(timeoutStr); err == nil {
			timeoutSeconds = val
		}
	}

	// Replace variables in message
	if ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			message = strings.ReplaceAll(message, placeholder, valueStr)
		}
	}

	// Initialize variables if needed
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}

	// Tracking keys
	replySentKey := "_user_reply_sent_" + node.ID
	replyTimestampKey := "_user_reply_timestamp_" + node.ID

	// Check if we've already sent the prompt
	replySent, alreadySent := ctx.Variables[replySentKey].(bool)

	if !alreadySent || !replySent {
		// First time - send the prompt and wait
		ctx.Variables[replySentKey] = true
		ctx.Variables[replyTimestampKey] = time.Now().Unix()

		return &models.ExecutionResult{
			Success:       true,
			Message:       "Waiting for user reply",
			NextNodeID:    node.ID, // Stay on this node
			Response:      message,
			ShouldReply:   true,
			Variables:     ctx.Variables,
			CompletedFlow: false,
		}, nil
	}

	// Check timeout
	if timestamp, ok := ctx.Variables[replyTimestampKey].(int64); ok {
		elapsedSeconds := time.Now().Unix() - timestamp

		if elapsedSeconds > int64(timeoutSeconds) {
			// Timeout occurred - take timeout path
			ctx.Variables[variableName] = "" // Empty response
			ctx.Variables["_timeout_occurred"] = true
			delete(ctx.Variables, replySentKey)
			delete(ctx.Variables, replyTimestampKey)

			// Find timeout edge (handle labeled "timeout" or "no")
			timeoutNodeID := ""
			normalNodeID := ""

			for _, edge := range edges {
				if edge.Source == node.ID {
					if edge.Label == "timeout" || edge.SourceHandle == "timeout" ||
					   edge.Label == "no" || edge.SourceHandle == "no" {
						timeoutNodeID = edge.Target
					} else if edge.Label == "success" || edge.SourceHandle == "success" ||
					          edge.Label == "yes" || edge.SourceHandle == "yes" {
						normalNodeID = edge.Target
					} else if normalNodeID == "" {
						normalNodeID = edge.Target // Fallback to first edge
					}
				}
			}

			nextNodeID := timeoutNodeID
			if nextNodeID == "" {
				nextNodeID = normalNodeID // No timeout edge, use normal path
			}

			return &models.ExecutionResult{
				Success:       true,
				Message:       fmt.Sprintf("User reply timeout after %d seconds", timeoutSeconds),
				NextNodeID:    nextNodeID,
				ShouldReply:   false,
				Variables:     ctx.Variables,
				CompletedFlow: nextNodeID == "",
			}, nil
		}
	}

	// User responded in time - store their reply
	ctx.Variables[variableName] = ctx.UserMessage
	ctx.Variables["_timeout_occurred"] = false
	delete(ctx.Variables, replySentKey)
	delete(ctx.Variables, replyTimestampKey)

	// Find success edge (handle labeled "success" or "yes")
	successNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			if edge.Label == "success" || edge.SourceHandle == "success" ||
			   edge.Label == "yes" || edge.SourceHandle == "yes" {
				successNodeID = edge.Target
				break
			}
		}
	}

	// If no success edge found, take first available edge
	if successNodeID == "" {
		for _, edge := range edges {
			if edge.Source == node.ID {
				successNodeID = edge.Target
				break
			}
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("User reply stored in variable: %s", variableName),
		NextNodeID:    successNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		CompletedFlow: successNodeID == "",
	}, nil
}

func (p *UserReplyNodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeUserReply
}

// APINodeProcessor processes API nodes (external HTTP calls)
type APINodeProcessor struct{}

func (p *APINodeProcessor) ProcessNode(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge) (*models.ExecutionResult, error) {
	// Get API configuration from node data
	url, _ := node.Data["url"].(string)
	if url == "" {
		return &models.ExecutionResult{
			Success: false,
			Message: "API URL is required",
			Error:   "No URL provided in node data",
		}, nil
	}

	// Replace variables in URL
	if ctx.Variables != nil {
		for key, value := range ctx.Variables {
			placeholder := fmt.Sprintf("{{%s}}", key)
			valueStr := fmt.Sprintf("%v", value)
			url = strings.ReplaceAll(url, placeholder, valueStr)
		}
	}

	// Get HTTP method (default: GET)
	method, _ := node.Data["method"].(string)
	if method == "" {
		method = "GET"
	}
	method = strings.ToUpper(method)

	// Get response variable name
	responseVariable, _ := node.Data["responseVariable"].(string)
	if responseVariable == "" {
		responseVariable = "api_response"
	}

	// Get headers
	headers := make(map[string]string)
	if headersData, ok := node.Data["headers"].(map[string]interface{}); ok {
		for key, value := range headersData {
			if strValue, ok := value.(string); ok {
				// Replace variables in header values
				if ctx.Variables != nil {
					for varKey, varValue := range ctx.Variables {
						placeholder := fmt.Sprintf("{{%s}}", varKey)
						valueStr := fmt.Sprintf("%v", varValue)
						strValue = strings.ReplaceAll(strValue, placeholder, valueStr)
					}
				}
				headers[key] = strValue
			}
		}
	}

	// Get request body
	var requestBody string
	if bodyData, ok := node.Data["body"].(string); ok {
		requestBody = bodyData
		// Replace variables in body
		if ctx.Variables != nil {
			for key, value := range ctx.Variables {
				placeholder := fmt.Sprintf("{{%s}}", key)
				valueStr := fmt.Sprintf("%v", value)
				requestBody = strings.ReplaceAll(requestBody, placeholder, valueStr)
			}
		}
	} else if bodyData, ok := node.Data["body"].(map[string]interface{}); ok {
		// Convert map to JSON
		bodyBytes, err := json.Marshal(bodyData)
		if err == nil {
			requestBody = string(bodyBytes)
			// Replace variables
			if ctx.Variables != nil {
				for key, value := range ctx.Variables {
					placeholder := fmt.Sprintf("{{%s}}", key)
					valueStr := fmt.Sprintf("%v", value)
					requestBody = strings.ReplaceAll(requestBody, placeholder, valueStr)
				}
			}
		}
	}

	// Get timeout (default: 30 seconds)
	timeoutSeconds := 30
	if timeoutVal, ok := node.Data["timeout"].(float64); ok {
		timeoutSeconds = int(timeoutVal)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: time.Duration(timeoutSeconds) * time.Second,
	}

	// Create request
	var req *http.Request
	var err error

	if requestBody != "" && (method == "POST" || method == "PUT" || method == "PATCH") {
		req, err = http.NewRequest(method, url, strings.NewReader(requestBody))
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return p.handleAPIError(ctx, node, edges, fmt.Sprintf("Failed to create request: %v", err))
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// Make request
	resp, err := client.Do(req)
	if err != nil {
		return p.handleAPIError(ctx, node, edges, fmt.Sprintf("Request failed: %v", err))
	}
	defer resp.Body.Close()

	// Read response
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return p.handleAPIError(ctx, node, edges, fmt.Sprintf("Failed to read response: %v", err))
	}

	responseBody := string(bodyBytes)

	// Check if response is successful (2xx status code)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return p.handleAPIError(ctx, node, edges, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, responseBody))
	}

	// Store response in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}

	// Try to parse as JSON
	var jsonResponse interface{}
	if err := json.Unmarshal(bodyBytes, &jsonResponse); err == nil {
		ctx.Variables[responseVariable] = jsonResponse
		ctx.Variables[responseVariable+"_raw"] = responseBody
	} else {
		// Not JSON, store as string
		ctx.Variables[responseVariable] = responseBody
	}

	// Store status code
	ctx.Variables[responseVariable+"_status"] = resp.StatusCode

	// Find success edge
	successNodeID := ""
	for _, edge := range edges {
		if edge.Source == node.ID {
			if edge.Label == "success" || edge.SourceHandle == "success" ||
			   edge.Label == "yes" || edge.SourceHandle == "yes" {
				successNodeID = edge.Target
				break
			}
		}
	}

	// If no success edge, take first edge
	if successNodeID == "" {
		for _, edge := range edges {
			if edge.Source == node.ID {
				successNodeID = edge.Target
				break
			}
		}
	}

	return &models.ExecutionResult{
		Success:       true,
		Message:       fmt.Sprintf("API call successful: %s %s (HTTP %d)", method, url, resp.StatusCode),
		NextNodeID:    successNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		CompletedFlow: successNodeID == "",
	}, nil
}

func (p *APINodeProcessor) handleAPIError(ctx *models.ExecutionContext, node *models.FlowNode, edges []models.FlowEdge, errorMsg string) (*models.ExecutionResult, error) {
	// Store error in variables
	if ctx.Variables == nil {
		ctx.Variables = make(map[string]interface{})
	}
	ctx.Variables["_api_error"] = errorMsg
	ctx.Variables["_api_success"] = false

	// Find error edge
	errorNodeID := ""
	normalNodeID := ""

	for _, edge := range edges {
		if edge.Source == node.ID {
			if edge.Label == "error" || edge.SourceHandle == "error" ||
			   edge.Label == "no" || edge.SourceHandle == "no" {
				errorNodeID = edge.Target
			} else if edge.Label == "success" || edge.SourceHandle == "success" ||
			          edge.Label == "yes" || edge.SourceHandle == "yes" {
				normalNodeID = edge.Target
			} else if normalNodeID == "" {
				normalNodeID = edge.Target // Fallback
			}
		}
	}

	nextNodeID := errorNodeID
	if nextNodeID == "" {
		nextNodeID = normalNodeID // No error edge, use success path
	}

	return &models.ExecutionResult{
		Success:       false,
		Message:       "API call failed",
		NextNodeID:    nextNodeID,
		ShouldReply:   false,
		Variables:     ctx.Variables,
		Error:         errorMsg,
		CompletedFlow: nextNodeID == "",
	}, nil
}

func (p *APINodeProcessor) GetNodeType() models.NodeType {
	return models.NodeTypeAPI
}
