import { AgentShield } from '../guard.js';
import { GuardrailPolicy } from '../types.js';

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string of parameters
  };
}

export class OpenAIAdapter {
  private shield: AgentShield;

  constructor(shield?: AgentShield) {
    this.shield = shield || new AgentShield();
  }

  /**
   * Intercepts and validates OpenAI Chat Completion Tool Calls before execution.
   */
  validateToolCalls(toolCalls: OpenAIToolCall[], policies: Record<string, GuardrailPolicy>): {
    validToolCalls: OpenAIToolCall[];
    blockedToolCalls: { toolCall: OpenAIToolCall; reason: string }[];
  } {
    const validToolCalls: OpenAIToolCall[] = [];
    const blockedToolCalls: { toolCall: OpenAIToolCall; reason: string }[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const policy = policies[toolName] || policies['*'] || {};

      let parsedParams: Record<string, any> = {};
      try {
        parsedParams = JSON.parse(toolCall.function.arguments || '{}');
      } catch {
        parsedParams = { raw: toolCall.function.arguments };
      }

      const evalResult = this.shield.guard(
        { toolName, params: parsedParams },
        policy
      );

      if (evalResult.allowed) {
        validToolCalls.push(toolCall);
      } else {
        blockedToolCalls.push({
          toolCall,
          reason: evalResult.reason || 'Blocked by AgentShield Security Policy',
        });
      }
    }

    return { validToolCalls, blockedToolCalls };
  }
}
