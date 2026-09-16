import { AgentShield, GuardrailPolicy, EvaluationResult } from '../index.js';

export interface McpCallToolRequest {
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}

export interface McpToolHandler {
  (name: string, args: Record<string, any>): Promise<any> | any;
}

export class McpShieldAdapter {
  private shield: AgentShield;

  constructor(shield?: AgentShield) {
    this.shield = shield || new AgentShield();
  }

  /**
   * Wraps an MCP call_tool request handler with AgentShield policy checks.
   */
  wrapMcpHandler(
    handler: McpToolHandler,
    policy: GuardrailPolicy,
    agentId?: string
  ): McpToolHandler {
    return async (name: string, args: Record<string, any> = {}) => {
      const evalResult: EvaluationResult = this.shield.guard(
        {
          toolName: name,
          params: args,
          agentId: agentId || 'mcp-agent',
        },
        policy
      );

      if (!evalResult.allowed) {
        throw new Error(
          `[AgentShield MCP Interceptor] Blocked tool execution '${name}': ${evalResult.reason}`
        );
      }

      return await handler(name, args);
    };
  }
}
