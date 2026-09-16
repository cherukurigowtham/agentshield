import { CircuitBreakerConfig } from './circuitBreaker.js';

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
  timeoutMs?: number;               // Execution timeout in ms
  maxCostPerSession?: number;        // Maximum USD session cost budget cap
  circuitBreaker?: CircuitBreakerConfig; // Anti-death loop configuration
  enableInjectionSanitizer?: boolean;   // Indirect prompt injection & zero-width check
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
  actionTaken: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'CIRCUIT_TRIPPED';
  timestamp: string;
  remediation?: {
    status: 'BLOCKED' | 'REQUIRES_REMEDIATION';
    suggestedFix?: string;
    maxAllowedValue?: number;
  };
}

export interface AgentShieldConfig {
  apiKey?: string;
  environment?: 'development' | 'production';
  telemetryUrl?: string;
  webhookUrl?: string;
  onViolation?: (result: EvaluationResult, request: ToolCallRequest) => void;
}
