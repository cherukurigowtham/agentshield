import { GuardrailPolicy, ToolCallRequest, EvaluationResult } from './types.js';

export class PolicyEvaluator {
  private callHistory: Map<string, number[]> = new Map();

  evaluate(request: ToolCallRequest, policy: GuardrailPolicy): EvaluationResult {
    const timestamp = new Date().toISOString();

    // 1. Check Allowed Tools
    if (policy.allowedTools && policy.allowedTools.length > 0) {
      if (!policy.allowedTools.includes(request.toolName)) {
        return {
          allowed: false,
          reason: `Tool '${request.toolName}' is not in the allowed tools list.`,
          actionTaken: 'BLOCK',
          timestamp,
        };
      }
    }

    // 2. Check Forbidden Tools
    if (policy.forbiddenTools && policy.forbiddenTools.includes(request.toolName)) {
      return {
        allowed: false,
        reason: `Tool '${request.toolName}' is explicitly forbidden by policy.`,
        actionTaken: 'BLOCK',
        timestamp,
      };
    }

    // 3. Required Parameter Fields Verification
    if (policy.requiredFields) {
      for (const field of policy.requiredFields) {
        if (request.params[field] === undefined || request.params[field] === null) {
          return {
            allowed: false,
            reason: `Missing required parameter field '${field}'.`,
            actionTaken: 'BLOCK',
            timestamp,
          };
        }
      }
    }

    // 4. Rate Limit Evaluation
    if (policy.rateLimit) {
      const agentKey = request.agentId || 'default-agent';
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      const timestamps = (this.callHistory.get(agentKey) || []).filter(t => t > oneMinuteAgo);
      if (timestamps.length >= policy.rateLimit.maxCallsPerMinute) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: Max ${policy.rateLimit.maxCallsPerMinute} calls/min allowed.`,
          actionTaken: 'BLOCK',
          timestamp,
        };
      }
      timestamps.push(now);
      this.callHistory.set(agentKey, timestamps);
    }

    // 5. Parameter Bound Verification
    if (policy.maxParamValues) {
      for (const [paramKey, maxValue] of Object.entries(policy.maxParamValues)) {
        const actualVal = request.params[paramKey];
        if (typeof actualVal === 'number' && actualVal > maxValue) {
          return {
            allowed: false,
            reason: `Parameter '${paramKey}' value (${actualVal}) exceeds maximum allowed threshold (${maxValue}).`,
            actionTaken: 'BLOCK',
            timestamp,
          };
        }
      }
    }

    // 6. Forbidden String/Regex Pattern Checks (Prompt Injection & Destructive SQL/CLI)
    if (policy.forbiddenPatterns) {
      const paramStr = JSON.stringify(request.params);
      for (const pattern of policy.forbiddenPatterns) {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        if (regex.test(paramStr)) {
          return {
            allowed: false,
            reason: `Parameter payload matched forbidden pattern: '${pattern}'.`,
            actionTaken: 'BLOCK',
            timestamp,
          };
        }
      }
    }

    // 7. Approval Gate Check
    if (policy.requireApproval) {
      return {
        allowed: false,
        reason: `Tool '${request.toolName}' requires human authorization prior to execution.`,
        actionTaken: 'REQUIRE_APPROVAL',
        timestamp,
      };
    }

    return {
      allowed: true,
      actionTaken: 'ALLOW',
      timestamp,
    };
  }
}
