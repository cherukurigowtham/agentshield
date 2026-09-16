import { AgentShield, GuardrailPolicy, EvaluationResult } from '../index.js';

export interface AnthropicToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface AnthropicGuardResult {
  allowed: boolean;
  block?: AnthropicToolUseBlock;
  evaluation: EvaluationResult;
}

export class AnthropicShieldAdapter {
  private shield: AgentShield;

  constructor(shield?: AgentShield) {
    this.shield = shield || new AgentShield();
  }

  /**
   * Evaluates an Anthropic Claude tool_use content block.
   */
  guardToolUse(
    toolUseBlock: AnthropicToolUseBlock,
    policy: GuardrailPolicy,
    agentId?: string
  ): AnthropicGuardResult {
    const evalResult = this.shield.guard(
      {
        toolName: toolUseBlock.name,
        params: toolUseBlock.input || {},
        agentId,
      },
      policy
    );

    return {
      allowed: evalResult.allowed,
      block: toolUseBlock,
      evaluation: evalResult,
    };
  }

  /**
   * Filters an array of Anthropic response content blocks, stripping unallowed tool calls.
   */
  filterContentBlocks(
    contentBlocks: Array<{ type: string; [key: string]: any }>,
    policy: GuardrailPolicy,
    agentId?: string
  ): {
    safeBlocks: Array<{ type: string; [key: string]: any }>;
    blockedCalls: AnthropicGuardResult[];
  } {
    const safeBlocks: Array<{ type: string; [key: string]: any }> = [];
    const blockedCalls: AnthropicGuardResult[] = [];

    for (const block of contentBlocks) {
      if (block.type === 'tool_use') {
        const guarded = this.guardToolUse(block as AnthropicToolUseBlock, policy, agentId);
        if (guarded.allowed) {
          safeBlocks.push(block);
        } else {
          blockedCalls.push(guarded);
        }
      } else {
        safeBlocks.push(block);
      }
    }

    return { safeBlocks, blockedCalls };
  }
}
