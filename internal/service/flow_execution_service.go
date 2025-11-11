package service

import (
	"chatbot-automation/internal/models"
	"chatbot-automation/internal/repository"
	"context"
	"fmt"
	"time"
)

// FlowExecutionService handles flow execution logic
type FlowExecutionService struct {
	flowRepo         *repository.FlowRepository
	conversationRepo *repository.ConversationRepository
	deviceRepo       *repository.DeviceRepository
	aiService        *AIService
	processors       map[models.NodeType]models.NodeProcessor
}

// NewFlowExecutionService creates a new flow execution service
func NewFlowExecutionService(
	flowRepo *repository.FlowRepository,
	conversationRepo *repository.ConversationRepository,
	deviceRepo *repository.DeviceRepository,
	aiService *AIService,
) *FlowExecutionService {
	service := &FlowExecutionService{
		flowRepo:         flowRepo,
		conversationRepo: conversationRepo,
		deviceRepo:       deviceRepo,
		aiService:        aiService,
		processors:       make(map[models.NodeType]models.NodeProcessor),
	}

	// Register node processors
	service.registerProcessors()

	return service
}

// registerProcessors registers all node processors
func (s *FlowExecutionService) registerProcessors() {
	s.processors[models.NodeTypeStart] = &StartNodeProcessor{}
	s.processors[models.NodeTypeMessage] = &MessageNodeProcessor{}
	s.processors[models.NodeTypeImage] = &ImageNodeProcessor{}
	s.processors[models.NodeTypeAudio] = &AudioNodeProcessor{}
	s.processors[models.NodeTypeVideo] = &VideoNodeProcessor{}
	s.processors[models.NodeTypeDocument] = &DocumentNodeProcessor{}
	s.processors[models.NodeTypeAI] = &AINodeProcessor{aiService: s.aiService}
	s.processors[models.NodeTypeCondition] = &ConditionNodeProcessor{}
	s.processors[models.NodeTypeDelay] = &DelayNodeProcessor{}
	s.processors[models.NodeTypeStage] = &StageNodeProcessor{}
	s.processors[models.NodeTypePrompt] = &PromptNodeProcessor{}
	s.processors[models.NodeTypeUserReply] = &UserReplyNodeProcessor{}
	s.processors[models.NodeTypeAPI] = &APINodeProcessor{}
	s.processors[models.NodeTypeEnd] = &EndNodeProcessor{}
}

// StartFlow initiates a new flow execution
func (s *FlowExecutionService) StartFlow(ctx context.Context, userID string, req *models.StartFlowRequest) (*models.StartFlowResponse, error) {
	// Verify device ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, req.DeviceID)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, req.DeviceID)
		if err != nil {
			return &models.StartFlowResponse{
				Success: false,
				Message: "Device not found",
			}, nil
		}
	}

	if device == nil || device.UserID == nil || *device.UserID != userID {
		return &models.StartFlowResponse{
			Success: false,
			Message: "Access denied: device not found or unauthorized",
		}, nil
	}

	// Get device identifier
	deviceIdentifier := req.DeviceID
	if device.IDDevice != nil && *device.IDDevice != "" {
		deviceIdentifier = *device.IDDevice
	} else if device.DeviceID != nil && *device.DeviceID != "" {
		deviceIdentifier = *device.DeviceID
	}

	// Get flow for device
	var flow *models.ChatbotFlow
	if req.FlowID != "" {
		flow, err = s.flowRepo.GetFlowByID(ctx, req.FlowID)
		if err != nil {
			return &models.StartFlowResponse{
				Success: false,
				Message: "Flow not found",
			}, nil
		}
	} else {
		// Get first flow for device
		flows, err := s.flowRepo.GetFlowsByDeviceID(ctx, deviceIdentifier)
		if err != nil || len(flows) == 0 {
			return &models.StartFlowResponse{
				Success: false,
				Message: "No flow found for device",
			}, nil
		}
		flow = &flows[0]
	}

	// Find start node
	startNode := s.findStartNode(flow.Nodes)
	if startNode == nil {
		return &models.StartFlowResponse{
			Success: false,
			Message: "Flow has no start node",
		}, nil
	}

	// Create or get conversation
	conversation, err := s.conversationRepo.GetConversationByProspectNum(ctx, req.ProspectNum, deviceIdentifier)
	if err != nil || conversation == nil {
		// Create new conversation
		stage := "started"
		niche := flow.Niche
		executionStatus := "active"
		conversation = &models.AIWhatsapp{
			ProspectNum:     req.ProspectNum,
			IDDevice:        deviceIdentifier,
			Stage:           &stage,
			Niche:           &niche,
			FlowID:          &flow.ID,
			ExecutionStatus: &executionStatus,
		}

		if err := s.conversationRepo.CreateConversation(ctx, conversation); err != nil {
			return &models.StartFlowResponse{
				Success: false,
				Message: "Failed to create conversation",
				Error:   err.Error(),
			}, nil
		}
	}

	// Update conversation with current node
	conversation.CurrentNodeID = &startNode.ID
	conversation.FlowID = &flow.ID
	executionStatus := "active"
	conversation.ExecutionStatus = &executionStatus

	// Convert IDProspect to string for update
	prospectIDStr := fmt.Sprintf("%d", *conversation.IDProspect)

	updates := map[string]interface{}{
		"current_node_id":  startNode.ID,
		"flow_id":          flow.ID,
		"execution_status": "active",
	}

	if err := s.conversationRepo.UpdateConversation(ctx, prospectIDStr, updates); err != nil {
		return &models.StartFlowResponse{
			Success: false,
			Message: "Failed to update conversation",
			Error:   err.Error(),
		}, nil
	}

	return &models.StartFlowResponse{
		Success:        true,
		Message:        "Flow started successfully",
		ConversationID: prospectIDStr,
	}, nil
}

// ProcessMessage processes an incoming message and executes the flow
func (s *FlowExecutionService) ProcessMessage(ctx context.Context, conversationID string, userMessage string) (*models.ExecutionResult, error) {
	// Get conversation
	conversation, err := s.conversationRepo.GetConversationByID(ctx, conversationID)
	if err != nil || conversation == nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "Conversation not found",
		}, nil
	}

	// Get flow
	if conversation.FlowID == nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "No flow assigned to conversation",
		}, nil
	}

	flow, err := s.flowRepo.GetFlowByID(ctx, *conversation.FlowID)
	if err != nil || flow == nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "Flow not found",
		}, nil
	}

	// Get current node
	currentNodeID := ""
	if conversation.CurrentNodeID != nil {
		currentNodeID = *conversation.CurrentNodeID
	}

	if currentNodeID == "" {
		// Start from beginning
		startNode := s.findStartNode(flow.Nodes)
		if startNode == nil {
			return &models.ExecutionResult{
				Success: false,
				Message: "Flow has no start node",
			}, nil
		}
		currentNodeID = startNode.ID
	}

	// Execute flow from current node
	// Note: SessionData not available in current schema, using empty map
	execCtx := &models.ExecutionContext{
		ConversationID: conversationID,
		DeviceID:       conversation.IDDevice,
		ProspectNum:    conversation.ProspectNum,
		CurrentNodeID:  currentNodeID,
		FlowID:         *conversation.FlowID,
		UserMessage:    userMessage,
		Variables:      make(map[string]interface{}), // SessionData not in current schema
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	result, err := s.executeNode(ctx, execCtx, flow)
	if err != nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "Failed to execute node",
			Error:   err.Error(),
		}, err
	}

	// Build updates map
	updates := make(map[string]interface{})

	if result.NextNodeID != "" {
		updates["current_node"] = result.NextNodeID
	}

	if result.Variables != nil {
		updates["session_data"] = result.Variables
	}

	if result.CompletedFlow {
		updates["is_active"] = false
		updates["status"] = "completed"
		updates["completed_at"] = time.Now()
	}

	if result.Response != "" {
		// Update conv_last with format: "User: message\nBot: reply"
		convLast := ""
		if conversation.ConvLast != nil {
			convLast = *conversation.ConvLast
		}

		// Add user message
		userLine := fmt.Sprintf("User: %s", userMessage)
		if convLast != "" {
			convLast += "\n" + userLine
		} else {
			convLast = userLine
		}

		// Add bot reply
		botLine := fmt.Sprintf("Bot: %s", result.Response)
		convLast += "\n" + botLine

		updates["conv_last"] = convLast
	}

	if err := s.conversationRepo.UpdateConversation(ctx, conversationID, updates); err != nil {
		return result, fmt.Errorf("failed to update conversation: %w", err)
	}

	return result, nil
}

// executeNode executes a single node in the flow
func (s *FlowExecutionService) executeNode(ctx context.Context, execCtx *models.ExecutionContext, flow *models.ChatbotFlow) (*models.ExecutionResult, error) {
	// Find current node
	var currentNode *models.FlowNode
	for _, node := range flow.Nodes {
		nodeMap, ok := node.(map[string]interface{})
		if !ok {
			continue
		}

		id, ok := nodeMap["id"].(string)
		if !ok || id != execCtx.CurrentNodeID {
			continue
		}

		// Convert to FlowNode
		typeStr, _ := nodeMap["type"].(string)
		data, _ := nodeMap["data"].(map[string]interface{})

		currentNode = &models.FlowNode{
			ID:   id,
			Type: models.NodeType(typeStr),
			Data: data,
		}
		break
	}

	if currentNode == nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "Current node not found",
		}, nil
	}

	// Get processor for node type
	processor, ok := s.processors[currentNode.Type]
	if !ok {
		return &models.ExecutionResult{
			Success: false,
			Message: fmt.Sprintf("No processor for node type: %s", currentNode.Type),
		}, nil
	}

	// Convert edges
	edges := make([]models.FlowEdge, 0)
	for _, edge := range flow.Edges {
		edgeMap, ok := edge.(map[string]interface{})
		if !ok {
			continue
		}

		id, _ := edgeMap["id"].(string)
		source, _ := edgeMap["source"].(string)
		target, _ := edgeMap["target"].(string)
		sourceHandle, _ := edgeMap["sourceHandle"].(string)
		targetHandle, _ := edgeMap["targetHandle"].(string)
		label, _ := edgeMap["label"].(string)

		edges = append(edges, models.FlowEdge{
			ID:           id,
			Source:       source,
			Target:       target,
			SourceHandle: sourceHandle,
			TargetHandle: targetHandle,
			Label:        label,
		})
	}

	// Process node
	result, err := processor.ProcessNode(execCtx, currentNode, edges)
	if err != nil {
		return &models.ExecutionResult{
			Success: false,
			Message: "Failed to process node",
			Error:   err.Error(),
		}, err
	}

	return result, nil
}

// findStartNode finds the start node in a flow
func (s *FlowExecutionService) findStartNode(nodes map[string]interface{}) *models.FlowNode {
	// Try to convert nodes to array
	var nodeArray []interface{}

	// Check if it's already an array
	if arr, ok := nodes["nodes"].([]interface{}); ok {
		nodeArray = arr
	} else {
		// Maybe the entire map IS the nodes array stored differently
		// Try to iterate over the map values
		for _, v := range nodes {
			if arr, ok := v.([]interface{}); ok {
				nodeArray = arr
				break
			}
		}
	}

	// If still not found, maybe it's stored as direct array (should be in Nodes field)
	if nodeArray == nil {
		return nil
	}

	for _, node := range nodeArray {
		nodeMap, ok := node.(map[string]interface{})
		if !ok {
			continue
		}

		typeStr, ok := nodeMap["type"].(string)
		if !ok || typeStr != string(models.NodeTypeStart) {
			continue
		}

		id, _ := nodeMap["id"].(string)
		data, _ := nodeMap["data"].(map[string]interface{})

		return &models.FlowNode{
			ID:   id,
			Type: models.NodeTypeStart,
			Data: data,
		}
	}

	return nil
}

// GetExecutionStatus gets the current execution status of a conversation
func (s *FlowExecutionService) GetExecutionStatus(ctx context.Context, userID string, conversationID string) (*models.ExecutionContext, error) {
	// Get conversation
	conversation, err := s.conversationRepo.GetConversationByID(ctx, conversationID)
	if err != nil || conversation == nil {
		return nil, fmt.Errorf("conversation not found")
	}

	// Verify ownership
	device, err := s.deviceRepo.GetDeviceByDeviceID(ctx, conversation.IDDevice)
	if err != nil {
		device, err = s.deviceRepo.GetDeviceByID(ctx, conversation.IDDevice)
		if err != nil {
			return nil, fmt.Errorf("device not found")
		}
	}

	if device == nil || device.UserID == nil || *device.UserID != userID {
		return nil, fmt.Errorf("access denied")
	}

	currentNodeID := ""
	if conversation.CurrentNodeID != nil {
		currentNodeID = *conversation.CurrentNodeID
	}

	flowID := ""
	if conversation.FlowID != nil {
		flowID = *conversation.FlowID
	}

	createdAt := time.Now()
	if conversation.CreatedAt != nil {
		createdAt = *conversation.CreatedAt
	}
	updatedAt := time.Now()
	if conversation.UpdatedAt != nil {
		updatedAt = *conversation.UpdatedAt
	}

	return &models.ExecutionContext{
		ConversationID: conversationID,
		DeviceID:       conversation.IDDevice,
		ProspectNum:    conversation.ProspectNum,
		CurrentNodeID:  currentNodeID,
		FlowID:         flowID,
		Variables:      make(map[string]interface{}), // SessionData not in current schema
		CreatedAt:      createdAt,
		UpdatedAt:      updatedAt,
	}, nil
}
