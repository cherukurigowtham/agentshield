import { AgentShield, GuardrailPolicy, ToolCallRequest } from '@agentshield/sdk';

export interface ToolInterface {
  name: string;
  description: string;
  _run(input: any): Promise<string>;
  call(input: any): Promise<string>;
}

export interface ShieldedToolConfig {
  policy: GuardrailPolicy;
  agentId?: string;
  sessionId?: string;
  onViolation?: (result: any, request: ToolCallRequest) => void;
}

export function withAgentShield<T extends ToolInterface>(
  tool: T,
  config: ShieldedToolConfig
): T {
  const shield = new AgentShield({
    onViolation: config.onViolation,
  });

  const originalRun = tool._run.bind(tool);

  const shieldedRun = async (input: any): Promise<string> => {
    const request: ToolCallRequest = {
      toolName: tool.name,
      params: typeof input === 'object' ? input : { input },
      agentId: config.agentId,
      sessionId: config.sessionId,
    };

    const result = shield.guard(request, config.policy);

    if (!result.allowed) {
      throw new Error(`[AgentShield Blocked] ${result.reason}`);
    }

    return originalRun(input);
  };

  return {
    ...tool,
    _run: shieldedRun,
    call: shieldedRun,
  } as T;
}

export function createShieldedTool<T extends ToolInterface>(
  ToolClass: new (...args: any[]) => T,
  config: ShieldedToolConfig,
  ...constructorArgs: any[]
): T {
  const tool = new ToolClass(...constructorArgs);
  return withAgentShield(tool, config);
}

export class AgentShieldCallbackHandler {
  private shield: AgentShield;
  private policy: GuardrailPolicy;
  private agentId?: string;
  private sessionId?: string;

  constructor(config: ShieldedToolConfig) {
    this.shield = new AgentShield({
      onViolation: config.onViolation,
    });
    this.policy = config.policy;
    this.agentId = config.agentId;
    this.sessionId = config.sessionId;
  }

  async handleToolStart(toolName: string, input: any): Promise<void> {
    const request: ToolCallRequest = {
      toolName,
      params: typeof input === 'object' ? input : { input },
      agentId: this.agentId,
      sessionId: this.sessionId,
    };

    const result = this.shield.guard(request, this.policy);

    if (!result.allowed) {
      throw new Error(`[AgentShield Blocked] ${result.reason}`);
    }
  }

  async handleToolEnd(toolName: string, output: string): Promise<void> {
    // Optional: log successful execution
  }

  async handleToolError(toolName: string, error: Error): Promise<void> {
    // Optional: log errors
  }
}

export function createAgentShieldMiddleware(config: ShieldedToolConfig) {
  const handler = new AgentShieldCallbackHandler(config);
  return {
    onToolStart: handler.handleToolStart.bind(handler),
    onToolEnd: handler.handleToolEnd.bind(handler),
    onToolError: handler.handleToolError.bind(handler),
  };
}