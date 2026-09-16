import { GuardrailPolicy, ToolCallRequest, EvaluationResult } from './types.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { InjectionSanitizer } from './sanitizer.js';

export class PolicyEvaluator {
  private callHistory: Map<string, number[]> = new Map();
  private sessionCosts: Map<string, number> = new Map();
  private circuitBreaker = new CircuitBreaker();

  evaluate(request: ToolCallRequest, policy: GuardrailPolicy): EvaluationResult {
    const timestamp = new Date().toISOString();
    const sessionKey = request.sessionId || request.agentId || 'default-session';

    // 1. Circuit Breaker Evaluation (Anti Death-Loop Protection)
    if (policy.circuitBreaker) {
      const cbCheck = this.circuitBreaker.check(sessionKey, request.toolName, request.params, policy.circuitBreaker);
      if (cbCheck.tripped) {
        return {
          allowed: false,
          reason: cbCheck.reason,
          actionTaken: 'CIRCUIT_TRIPPED',
          timestamp,
          remediation: {
            status: 'BLOCKED',
            suggestedFix: 'Agent in retry loop. Abort current tool sequence and ask human for clarification.',
          },
        };
      }
    }

    // 2. Indirect Prompt Injection & Zero-Width Unicode Sanitization
    if (policy.enableInjectionSanitizer !== false) {
      const payloadStr = JSON.stringify(request.params);
      const sanitizeRes = InjectionSanitizer.inspect(payloadStr);

      if (sanitizeRes.detected) {
        return {
          allowed: false,
          reason: `Security Threat Detected: ${sanitizeRes.type} (${sanitizeRes.patternMatched}).`,
          actionTaken: 'BLOCK',
          timestamp,
          remediation: {
            status: 'BLOCKED',
            suggestedFix: 'Sanitize input payload to remove prompt overrides or hidden unicode characters.',
          },
        };
      }
    }

    // 3. Allowed Tools Check
    if (policy.allowedTools && policy.allowedTools.length > 0) {
      if (!policy.allowedTools.includes(request.toolName)) {
        return {
          allowed: false,
          reason: `Tool '${request.toolName}' is not in the allowed tools list.`,
          actionTaken: 'BLOCK',
          timestamp,
          remediation: {
            status: 'BLOCKED',
            suggestedFix: `Tool '${request.toolName}' is not authorized. Permitted tools: ${policy.allowedTools.join(', ')}.`,
          },
        };
      }
    }

    // 4. Forbidden Tools Check
    if (policy.forbiddenTools && policy.forbiddenTools.includes(request.toolName)) {
      return {
        allowed: false,
        reason: `Tool '${request.toolName}' is explicitly forbidden by policy.`,
        actionTaken: 'BLOCK',
        timestamp,
        remediation: {
          status: 'BLOCKED',
          suggestedFix: `Tool '${request.toolName}' is prohibited in production environment.`,
        },
      };
    }

    // 5. Required Parameter Fields Verification
    if (policy.requiredFields) {
      for (const field of policy.requiredFields) {
        if (request.params[field] === undefined || request.params[field] === null) {
          return {
            allowed: false,
            reason: `Missing required parameter field '${field}'.`,
            actionTaken: 'BLOCK',
            timestamp,
            remediation: {
              status: 'REQUIRES_REMEDIATION',
              suggestedFix: `Provide required parameter '${field}' before invoking tool '${request.toolName}'.`,
            },
          };
        }
      }
    }

    // 6. Rate Limit Evaluation
    if (policy.rateLimit) {
      const now = Date.now();
      const oneMinuteAgo = now - 60000;
      
      const timestamps = (this.callHistory.get(sessionKey) || []).filter(t => t > oneMinuteAgo);
      if (timestamps.length >= policy.rateLimit.maxCallsPerMinute) {
        return {
          allowed: false,
          reason: `Rate limit exceeded: Max ${policy.rateLimit.maxCallsPerMinute} calls/min allowed.`,
          actionTaken: 'BLOCK',
          timestamp,
          remediation: {
            status: 'BLOCKED',
            suggestedFix: `Wait 60 seconds before issuing further tool calls for session '${sessionKey}'.`,
          },
        };
      }
      timestamps.push(now);
      this.callHistory.set(sessionKey, timestamps);
    }

    // 7. Financial & Session Budget Cap Check
    if (policy.maxCostPerSession && request.estimatedCost) {
      const currentCost = this.sessionCosts.get(sessionKey) || 0;
      const newCost = currentCost + request.estimatedCost;

      if (newCost > policy.maxCostPerSession) {
        return {
          allowed: false,
          reason: `Session cost threshold exceeded ($${newCost.toFixed(4)} > $${policy.maxCostPerSession.toFixed(4)} cap).`,
          actionTaken: 'BLOCK',
          timestamp,
          remediation: {
            status: 'BLOCKED',
            suggestedFix: `Budget limit reached ($${policy.maxCostPerSession}). Request budget approval.`,
          },
        };
      }
      this.sessionCosts.set(sessionKey, newCost);
    }

    // 8. Parameter Bound Verification
    if (policy.maxParamValues) {
      for (const [paramKey, maxValue] of Object.entries(policy.maxParamValues)) {
        const actualVal = request.params[paramKey];
        if (typeof actualVal === 'number' && actualVal > maxValue) {
          return {
            allowed: false,
            reason: `Parameter '${paramKey}' value (${actualVal}) exceeds maximum allowed threshold (${maxValue}).`,
            actionTaken: 'BLOCK',
            timestamp,
            remediation: {
              status: 'REQUIRES_REMEDIATION',
              suggestedFix: `Reduce '${paramKey}' parameter to <= ${maxValue}.`,
              maxAllowedValue: maxValue,
            },
          };
        }
      }
    }

    // 9. Forbidden String/Regex Pattern Checks
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
            remediation: {
              status: 'BLOCKED',
              suggestedFix: `Remove forbidden pattern '${pattern}' from input payload.`,
            },
          };
        }
      }
    }

    // 10. Approval Gate Check
    if (policy.requireApproval) {
      return {
        allowed: false,
        reason: `Tool '${request.toolName}' requires human authorization prior to execution.`,
        actionTaken: 'REQUIRE_APPROVAL',
        timestamp,
        remediation: {
          status: 'BLOCKED',
          suggestedFix: 'Request human authorization token.',
        },
      };
    }

    return {
      allowed: true,
      actionTaken: 'ALLOW',
      timestamp,
    };
  }
}
