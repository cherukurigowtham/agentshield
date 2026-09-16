import { AgentShield, GuardrailPolicy, ToolCallRequest } from '@agentshield/sdk';

export interface FunctionToolInterface {
  name: string;
  description: string;
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
      toolName: tool.name,
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
    name,
    description,
    call: shieldedFn,
  };
}

export class AgentShieldHook {
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

  async preToolCall(toolName: string, args: any): Promise<void> {
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

  async postToolCall(toolName: string, result: any): Promise<void> {
    // Optional: log successful execution
  }
}

export function createAgentShieldHook(config: ShieldedToolConfig) {
  const hook = new AgentShieldHook(config);
  return {
    preToolCall: hook.preToolCall.bind(hook),
    postToolCall: hook.postToolCall.bind(hook),
  };
}