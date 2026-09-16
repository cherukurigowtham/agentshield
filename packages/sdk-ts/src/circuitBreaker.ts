export interface CircuitBreakerConfig {
  maxRepeatedCalls?: number; // Max identical tool calls allowed in window
  timeWindowMs?: number;      // Time window in ms (e.g., 10000ms)
}

export class CircuitBreaker {
  private callTracker: Map<string, { paramsHash: string; timestamp: number }[]> = new Map();
  private trippedBreakers: Map<string, number> = new Map(); // sessionKey -> resetTimestamp

  check(sessionKey: string, toolName: string, params: Record<string, any>, config: CircuitBreakerConfig): { tripped: boolean; reason?: string } {
    const maxCalls = config.maxRepeatedCalls || 4;
    const windowMs = config.timeWindowMs || 10000;
    const now = Date.now();

    // Check if circuit breaker is currently open (tripped)
    const resetTime = this.trippedBreakers.get(sessionKey);
    if (resetTime && now < resetTime) {
      const remainingSec = Math.ceil((resetTime - now) / 1000);
      return {
        tripped: true,
        reason: `Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next ${remainingSec}s.`,
      };
    }

    const trackerKey = `${sessionKey}:${toolName}`;
    const paramsHash = JSON.stringify(params);

    const history = (this.callTracker.get(trackerKey) || []).filter(item => now - item.timestamp < windowMs);

    // Check for identical repeated tool calls
    const repeatedCount = history.filter(item => item.paramsHash === paramsHash).length;
    if (repeatedCount >= maxCalls) {
      // Trip the breaker for 30 seconds
      this.trippedBreakers.set(sessionKey, now + 30000);
      return {
        tripped: true,
        reason: `Circuit Breaker TRIPPED: Tool '${toolName}' called ${repeatedCount + 1} times with identical parameters within ${windowMs / 1000}s loop.`,
      };
    }

    history.push({ paramsHash, timestamp: now });
    this.callTracker.set(trackerKey, history);

    return { tripped: false };
  }

  reset(sessionKey: string): void {
    this.trippedBreakers.delete(sessionKey);
  }
}
