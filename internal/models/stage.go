package models

// StageValue represents a stage set value configuration
type StageValue struct {
	ID            int     `json:"stagesetvalue_id,omitempty"`
	IDDevice      string  `json:"id_device"`
	Stage         string  `json:"stage"`
	TypeInputData string  `json:"type_inputdata"`
	ColumnsData   string  `json:"columnsdata"`
	InputHardCode string  `json:"inputhardcode,omitempty"`
}

// CreateStageValueRequest is the request body for creating a stage value
type CreateStageValueRequest struct {
	IDDevice      string `json:"id_device" validate:"required"`
	Stage         string `json:"stage" validate:"required"`
	TypeInputData string `json:"type_inputdata" validate:"required,oneof=Set Input"`
	ColumnsData   string `json:"columnsdata" validate:"required"`
	InputHardCode string `json:"inputhardcode"` // Not required - only needed when Type = "Set"
}

// UpdateStageValueRequest is the request body for updating a stage value
type UpdateStageValueRequest struct {
	IDDevice      *string `json:"id_device,omitempty"`
	Stage         *string `json:"stage,omitempty"`
	TypeInputData *string `json:"type_inputdata,omitempty"`
	ColumnsData   *string `json:"columnsdata,omitempty"`
	InputHardCode *string `json:"inputhardcode,omitempty"`
}

// StageValueResponse is the response for stage value operations
type StageValueResponse struct {
	Success     bool          `json:"success"`
	Message     string        `json:"message"`
	StageValue  *StageValue   `json:"stage_value,omitempty"`
	StageValues []StageValue `json:"stage_values,omitempty"`
}
