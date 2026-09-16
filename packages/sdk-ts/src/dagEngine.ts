export interface WorkflowStep {
  agentId: string;
  allowedNextAgents?: string[];
  allowedTools?: string[];
}

export class AgentDependencyGraph {
  private workflowMap: Map<string, WorkflowStep> = new Map();
  private executionTrace: Map<string, string[]> = new Map(); // sessionId -> agentId sequence

  registerStep(step: WorkflowStep): void {
    this.workflowMap.set(step.agentId, step);
  }

  validateTransition(sessionId: string, currentAgentId: string, toolName: string): { valid: boolean; reason?: string } {
    const trace = this.executionTrace.get(sessionId) || [];
    const lastAgentId = trace[trace.length - 1];

    if (lastAgentId) {
      const lastStep = this.workflowMap.get(lastAgentId);
      if (lastStep && lastStep.allowedNextAgents && lastStep.allowedNextAgents.length > 0) {
        if (!lastStep.allowedNextAgents.includes(currentAgentId)) {
          return {
            valid: false,
            reason: `Multi-Agent DAG Sequence Violation: Agent '${currentAgentId}' cannot execute after Agent '${lastAgentId}'. Authorized successors: ${lastStep.allowedNextAgents.join(', ')}.`,
          };
        }
      }
    }

    const currentStep = this.workflowMap.get(currentAgentId);
    if (currentStep && currentStep.allowedTools && currentStep.allowedTools.length > 0) {
      if (!currentStep.allowedTools.includes(toolName)) {
        return {
          valid: false,
          reason: `Multi-Agent Role Violation: Agent '${currentAgentId}' is not authorized to invoke tool '${toolName}'.`,
        };
      }
    }

    trace.push(currentAgentId);
    this.executionTrace.set(sessionId, trace);

    return { valid: true };
  }

  resetSession(sessionId: string): void {
    this.executionTrace.delete(sessionId);
  }
}
