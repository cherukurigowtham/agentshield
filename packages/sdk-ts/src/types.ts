export interface GuardrailPolicy {
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxParamValues?: Record<string, number>;
  forbiddenPatterns?: RegExp[] | string[];
  requireApproval?: boolean;
  rateLimit?: {
    maxCallsPerMinute: number;
  };
  requiredFields?: string[];
  webhookUrl?: string;
  timeoutMs?: number; // Maximum allowed execution time in ms
  maxCostPerSession?: number; // Maximum USD budget cap per session
}

export interface ToolCallRequest {
  toolName: string;
  params: Record<string, any>;
  agentId?: string;
  sessionId?: string;
  estimatedCost?: number;
}

export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
  actionTaken: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
  timestamp: string;
}

export interface AgentShieldConfig {
  apiKey?: string;
  environment?: 'development' | 'production';
  telemetryUrl?: string;
  webhookUrl?: string;
  onViolation?: (result: EvaluationResult, request: ToolCallRequest) => void;
}
