import { NextRequest, NextResponse } from 'next/server';

export interface TelemetryPayload {
  agentId?: string;
  toolName: string;
  params: Record<string, any>;
  actionTaken: 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL';
  reason?: string;
  timestamp?: string;
}

// In-memory telemetry log storage for active dashboard session
const inMemoryLogs: TelemetryPayload[] = [];

export async function POST(req: NextRequest) {
  try {
    const body: TelemetryPayload = await req.json();

    if (!body.toolName || !body.actionTaken) {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: toolName and actionTaken required' },
        { status: 400 }
      );
    }

    const logEntry: TelemetryPayload = {
      ...body,
      timestamp: body.timestamp || new Date().toISOString(),
    };

    inMemoryLogs.unshift(logEntry);

    // Keep memory clean (max 500 events)
    if (inMemoryLogs.length > 500) {
      inMemoryLogs.pop();
    }

    return NextResponse.json({
      success: true,
      message: 'Telemetry log received',
      eventId: `evt_${Date.now()}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    totalLogs: inMemoryLogs.length,
    logs: inMemoryLogs,
  });
}
