import { AgentShield } from '../guard.js';
import { GuardrailPolicy, EvaluationResult } from '../types.js';

export interface GeminiFunctionCall {
  name: string;
  args: Record<string, any>;
}

export class VertexAIAdapter {
  private shield: AgentShield;

  constructor(shield?: AgentShield) {
    this.shield = shield || new AgentShield();
  }

  /**
   * Intercepts and validates a Gemini / Vertex AI Function Call before execution.
   */
  validateFunctionCall(
    call: GeminiFunctionCall,
    policy: GuardrailPolicy,
    sessionId?: string
  ): EvaluationResult {
    return this.shield.guard(
      {
        toolName: call.name,
        params: call.args || {},
        sessionId,
      },
      policy
    );
  }

  /**
   * Batch validates multiple Gemini function calls against a policy set.
   */
  validateFunctionCalls(
    calls: GeminiFunctionCall[],
    policies: Record<string, GuardrailPolicy>,
    sessionId?: string
  ): {
    validCalls: GeminiFunctionCall[];
    blockedCalls: { call: GeminiFunctionCall; result: EvaluationResult }[];
  } {
    const validCalls: GeminiFunctionCall[] = [];
    const blockedCalls: { call: GeminiFunctionCall; result: EvaluationResult }[] = [];

    for (const call of calls) {
      const policy = policies[call.name] || policies['*'] || {};
      const result = this.validateFunctionCall(call, policy, sessionId);

      if (result.allowed) {
        validCalls.push(call);
      } else {
        blockedCalls.push({ call, result });
      }
    }

    return { validCalls, blockedCalls };
  }
}
