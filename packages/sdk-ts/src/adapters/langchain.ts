import { AgentShield, GuardrailPolicy } from '../index.js';

export interface LangChainToolLike {
  name: string;
  description?: string;
  func?: (...args: any[]) => any;
  _call?: (...args: any[]) => any;
  invoke?: (...args: any[]) => any;
}

export class LangChainShieldAdapter {
  private shield: AgentShield;

  constructor(shield?: AgentShield) {
    this.shield = shield || new AgentShield();
  }

  /**
   * Wraps a LangChain / LangGraph tool function with runtime AgentShield protection.
   */
  wrapTool<T extends LangChainToolLike>(tool: T, policy: GuardrailPolicy, agentId?: string): T {
    const shield = this.shield;
    const toolName = tool.name;

    const originalFunc = tool.func || tool._call || tool.invoke;

    if (!originalFunc) {
      return tool;
    }

    const guardedFunc = async (input: any, ...rest: any[]) => {
      const params = typeof input === 'object' && input !== null ? input : { input };
      const evalRes = shield.guard(
        {
          toolName,
          params,
          agentId: agentId || 'langchain-agent',
        },
        policy
      );

      if (!evalRes.allowed) {
        throw new Error(
          `[AgentShield LangChain Guard] Tool '${toolName}' execution blocked: ${evalRes.reason}`
        );
      }

      return await originalFunc.call(tool, input, ...rest);
    };

    return new Proxy(tool, {
      get(target, prop, receiver) {
        if (prop === 'func' || prop === '_call' || prop === 'invoke') {
          return guardedFunc;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
}
