import { NextRequest, NextResponse } from 'next/server';

export interface UniversalShieldRequest {
  toolName: string;
  params: Record<string, any>;
  policy?: {
    allowedTools?: string[];
    forbiddenTools?: string[];
    maxParamValues?: Record<string, number>;
    forbiddenPatterns?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: UniversalShieldRequest = await req.json();

    if (!body.toolName || !body.params) {
      return NextResponse.json(
        { allowed: false, reason: 'Invalid request payload: toolName and params required.' },
        { status: 400 }
      );
    }

    const { toolName, params, policy = {} } = body;
    const timestamp = new Date().toISOString();

    // 1. Tool Whitelist Check
    if (policy.allowedTools && policy.allowedTools.length > 0) {
      if (!policy.allowedTools.includes(toolName)) {
        return NextResponse.json({
          allowed: false,
          actionTaken: 'BLOCK',
          reason: `Tool '${toolName}' is not in allowed tools list.`,
          timestamp,
        });
      }
    }

    // 2. Forbidden Tools Check
    if (policy.forbiddenTools && policy.forbiddenTools.includes(toolName)) {
      return NextResponse.json({
        allowed: false,
        actionTaken: 'BLOCK',
        reason: `Tool '${toolName}' is explicitly forbidden by policy.`,
        timestamp,
      });
    }

    // 3. Parameter Bound Check
    if (policy.maxParamValues) {
      for (const [paramKey, maxValue] of Object.entries(policy.maxParamValues)) {
        const actualVal = params[paramKey];
        if (typeof actualVal === 'number' && actualVal > maxValue) {
          return NextResponse.json({
            allowed: false,
            actionTaken: 'BLOCK',
            reason: `Parameter '${paramKey}' (${actualVal}) exceeds max allowed cap (${maxValue}).`,
            remediation: { suggestedFix: `Reduce '${paramKey}' parameter to <= ${maxValue}.` },
            timestamp,
          });
        }
      }
    }

    // 4. Prompt Injection Scan
    const payloadStr = JSON.stringify(params);
    const injectionPatterns = policy.forbiddenPatterns || ['DROP TABLE', 'rm -rf', 'IGNORE PREVIOUS INSTRUCTIONS', '\\[SYSTEM OVERRIDE\\]'];
    for (const pattern of injectionPatterns) {
      if (new RegExp(pattern, 'i').test(payloadStr)) {
        return NextResponse.json({
          allowed: false,
          actionTaken: 'BLOCK',
          reason: `Payload matched forbidden injection pattern: '${pattern}'.`,
          timestamp,
        });
      }
    }

    return NextResponse.json({
      allowed: true,
      actionTaken: 'ALLOW',
      timestamp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
}
