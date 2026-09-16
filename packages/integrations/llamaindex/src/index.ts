import { AgentShield, GuardrailPolicy, ToolCallRequest } from '@agentshield/sdk';

export interface FunctionToolInterface {
  metadata: {
    name: string;
    description: string;
  };
  call(args: any): Promise<any>;
}

export interface ShieldedToolConfig {
  policy: GuardrailPolicy;
  agentId?: string;
  sessionId?: string;
  onViolation?: (result: any, request: ToolCallRequest) => void;
}

export function withAgentShield<T extends FunctionToolInterface>(
  tool: T,
  config: ShieldedToolConfig
): T {
  const shield = new AgentShield({
    onViolation: config.onViolation,
  });

  const originalCall = tool.call.bind(tool);

  const shieldedCall = async (args: any): Promise<any> => {
    const request: ToolCallRequest = {
      toolName: tool.metadata.name,
      params: args,
      agentId: config.agentId,
      sessionId: config.sessionId,
    };

    const result = shield.guard(request, config.policy);

    if (!result.allowed) {
      throw new Error(`[AgentShield Blocked] ${result.reason}`);
    }

    return originalCall(args);
  };

  return {
    ...tool,
    call: shieldedCall,
  } as T;
}

export function createShieldedTool<T extends FunctionToolInterface>(
  ToolClass: new (...args: any[]) => T,
  config: ShieldedToolConfig,
  ...constructorArgs: any[]
): T {
  const tool = new ToolClass(...constructorArgs);
  return withAgentShield(tool, config);
}

export function shieldFunction(
  name: string,
  description: string,
  schema: any,
  fn: (args: any) => Promise<any>,
  config: ShieldedToolConfig
): FunctionToolInterface {
  const shield = new AgentShield({
    onViolation: config.onViolation,
  });

  const shieldedFn = async (args: any): Promise<any> => {
    const request: ToolCallRequest = {
      toolName: name,
      params: args,
      agentId: config.agentId,
      sessionId: config.sessionId,
    };

    const result = shield.guard(request, config.policy);

    if (!result.allowed) {
      throw new Error(`[AgentShield Blocked] ${result.reason}`);
    }

    return fn(args);
  };

  return {
    metadata: { name, description },
    call: shieldedFn,
  };
}

export class AgentShieldCallback {
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

  async onToolStart(toolName: string, args: any): Promise<void> {
    const request: ToolCallRequest = {
      toolName,
      params: args,
      agentId: this.agentId,
      sessionId: this.sessionId,
    };

    const result = this.shield.guard(request, this.policy);

    if (!result.allowed) {
      throw new Error(`[AgentShield Blocked] ${result.reason}`);
    }
  }

  async onToolEnd(toolName: string, result: any): Promise<void> {
    // Optional: log successful execution
  }

  async onToolError(toolName: string, error: Error): Promise<void> {
    // Optional: log errors
  }
}

export function createAgentShieldCallback(config: ShieldedToolConfig) {
  const callback = new AgentShieldCallback(config);
  return {
    onToolStart: callback.onToolStart.bind(callback),
    onToolEnd: callback.onToolEnd.bind(callback),
    onToolError: callback.onToolError.bind(callback),
  };
}