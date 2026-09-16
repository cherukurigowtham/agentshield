import { NextRequest, NextResponse } from 'next/server';
import { AgentShield, GuardrailPolicy } from '@agentshield/sdk';

const shieldEngine = new AgentShield();

export interface UniversalShieldRequest {
  toolName: string;
  params: Record<string, any>;
  policy?: GuardrailPolicy;
  sessionId?: string;
  agentId?: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Control Plane Auth Gate (API Key check if configured)
    const authHeader = req.headers.get('authorization');
    const requiredApiKey = process.env.AGENTSHIELD_API_KEY;

    if (requiredApiKey) {
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== requiredApiKey) {
        return NextResponse.json(
          { allowed: false, reason: 'Unauthorized: Invalid or missing AgentShield API Key.' },
          { status: 401 }
        );
      }
    }

    // 2. Parse Request Payload
    const body: UniversalShieldRequest = await req.json();

    if (!body.toolName || !body.params) {
      return NextResponse.json(
        { allowed: false, reason: 'Invalid request payload: toolName and params required.' },
        { status: 400 }
      );
    }

    const { toolName, params, policy = {}, sessionId, agentId } = body;

    // 3. Delegate Evaluation directly to Core AgentShield Engine (Zero Duplication)
    const result = shieldEngine.guard(
      { toolName, params, sessionId, agentId },
      policy
    );

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { allowed: false, error: error.message },
      { status: 500 }
    );
  }
}
