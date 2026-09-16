import { AgentShieldConfig, GuardrailPolicy, ToolCallRequest, EvaluationResult } from './types.js';
import { PolicyEvaluator } from './evaluator.js';

export class AgentShield {
  private config: AgentShieldConfig;
  private evaluator: PolicyEvaluator;

  constructor(config: AgentShieldConfig = {}) {
    this.config = config;
    this.evaluator = new PolicyEvaluator();
  }

  /**
   * Evaluates a tool call request against a security policy before execution.
   */
  guard(request: ToolCallRequest, policy: GuardrailPolicy): EvaluationResult {
    const result = this.evaluator.evaluate(request, policy);

    if (!result.allowed) {
      if (this.config.onViolation) {
        this.config.onViolation(result, request);
      }
      this.dispatchWebhookAlert(result, request, policy.webhookUrl || this.config.webhookUrl);
    }

    this.sendTelemetry(result, request);

    return result;
  }

  /**
   * Wraps an asynchronous tool function with AgentShield guardrail security & execution timeout protection.
   */
  async wrapTool<TParams extends Record<string, any>, TResult>(
    toolName: string,
    toolFn: (params: TParams) => Promise<TResult>,
    policy: GuardrailPolicy
  ): Promise<(params: TParams) => Promise<TResult>> {
    return async (params: TParams): Promise<TResult> => {
      const evalResult = this.guard({ toolName, params }, policy);

      if (!evalResult.allowed) {
        throw new Error(`[AgentShield Blocked] ${evalResult.reason}`);
      }

      // Enforce Execution Timeout if configured
      if (policy.timeoutMs && policy.timeoutMs > 0) {
        return await this.executeWithTimeout(toolFn(params), policy.timeoutMs);
      }

      return await toolFn(params);
    };
  }

  private executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`[AgentShield Timeout] Execution timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async dispatchWebhookAlert(result: EvaluationResult, request: ToolCallRequest, webhookUrl?: string) {
    if (!webhookUrl) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'AGENTSHIELD_VIOLATION_BLOCKED',
          toolName: request.toolName,
          reason: result.reason,
          timestamp: result.timestamp,
          params: request.params,
        }),
      });
    } catch {
      // Non-blocking background alert
    }
  }

  private async sendTelemetry(result: EvaluationResult, request: ToolCallRequest) {
    if (!this.config.telemetryUrl) return;

    try {
      await fetch(this.config.telemetryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: request.agentId,
          toolName: request.toolName,
          params: request.params,
          actionTaken: result.actionTaken,
          reason: result.reason,
          timestamp: result.timestamp,
        }),
      });
    } catch {
      // Non-blocking telemetry sync
    }
  }
}
