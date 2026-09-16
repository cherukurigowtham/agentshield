'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, Cpu, Activity, 
  CheckCircle2, XCircle, ArrowLeft, RefreshCw, Sliders, DollarSign, Terminal, Lock
} from 'lucide-react';

interface TelemetryEvent {
  id: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  params: string;
  status: 'ALLOW' | 'BLOCK';
  reason?: string;
}

export default function SecurityControlPlane() {
  const [maxTransferCap, setMaxTransferCap] = useState(1000);
  const [enableInjectionShield, setEnableInjectionShield] = useState(true);
  const [enableWhitelistOnly, setEnableWhitelistOnly] = useState(true);

  // Initial Telemetry Feed
  const [events, setEvents] = useState<TelemetryEvent[]>([
    {
      id: 'evt_101',
      timestamp: '14:32:05',
      agentId: 'finance-agent-01',
      toolName: 'transfer_funds',
      params: '{"recipient":"Alice","transferAmount":250}',
      status: 'ALLOW',
    },
    {
      id: 'evt_102',
      timestamp: '14:32:12',
      agentId: 'finance-agent-01',
      toolName: 'transfer_funds',
      params: '{"recipient":"Unknown Account","transferAmount":5000}',
      status: 'BLOCK',
      reason: "Parameter 'transferAmount' (5000) exceeds maximum cap ($1,000).",
    },
    {
      id: 'evt_103',
      timestamp: '14:32:28',
      agentId: 'db-assistant-04',
      toolName: 'query_db',
      params: '{"query":"SELECT * FROM products; DROP TABLE users;"}',
      status: 'BLOCK',
      reason: "Tool payload matched forbidden injection pattern: 'DROP TABLE'.",
    },
    {
      id: 'evt_104',
      timestamp: '14:33:01',
      agentId: 'support-agent-09',
      toolName: 'search_kb',
      params: '{"query":"reset password workflow"}',
      status: 'ALLOW',
    },
  ]);

  const simulateNewEvent = () => {
    const isViolation = Math.random() > 0.5;
    const newEvt: TelemetryEvent = isViolation
      ? {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'agent-sandbox-99',
          toolName: 'execute_shell',
          params: '{"cmd":"rm -rf /var/data"}',
          status: 'BLOCK',
          reason: "Tool 'execute_shell' is not in the allowed tools whitelist.",
        }
      : {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'analytics-bot-02',
          toolName: 'read_docs',
          params: '{"docId":"api_v2_spec"}',
          status: 'ALLOW',
        };

    setEvents(prev => [newEvt, ...prev]);
  };

  const totalCalls = events.length;
  const blockedCalls = events.filter(e => e.status === 'BLOCK').length;
  const allowedCalls = events.filter(e => e.status === 'ALLOW').length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Dashboard Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-lg text-white">AgentShield Control Plane</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={simulateNewEvent}
            className="flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Simulate Live Agent Call
          </button>
          <div className="flex items-center gap-2 text-xs bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-gray-400">Status:</span>
            <span className="text-white font-medium">GUARD ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Metrics & Live Feed */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/90 border border-gray-800 p-4 rounded-xl">
              <div className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-400" /> Total Agent Tool Calls
              </div>
              <div className="text-2xl font-bold text-white">{totalCalls}</div>
            </div>

            <div className="bg-gray-900/90 border border-emerald-500/20 p-4 rounded-xl">
              <div className="text-xs text-emerald-400 font-medium mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Executed (Allowed)
              </div>
              <div className="text-2xl font-bold text-emerald-400">{allowedCalls}</div>
            </div>

            <div className="bg-gray-900/90 border border-red-500/20 p-4 rounded-xl">
              <div className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Violations Blocked
              </div>
              <div className="text-2xl font-bold text-red-400">{blockedCalls}</div>
            </div>
          </div>

          {/* Live Telemetry Audit Feed */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-3">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" /> Real-Time Telemetry Audit Log
              </h2>
              <span className="text-xs text-gray-500 font-mono">Live WebSocket Feed</span>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-[480px] overflow-y-auto pr-1">
              {events.map((evt) => (
                <div 
                  key={evt.id} 
                  className={`p-3.5 rounded-lg border transition ${
                    evt.status === 'ALLOW' 
                      ? 'bg-gray-950/60 border-gray-800/80 hover:border-emerald-500/30' 
                      : 'bg-red-950/20 border-red-900/40 hover:border-red-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        evt.status === 'ALLOW' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {evt.status}
                      </span>
                      <span className="text-gray-300 font-semibold">{evt.toolName}</span>
                      <span className="text-gray-600">by</span>
                      <span className="text-gray-400">{evt.agentId}</span>
                    </div>
                    <span className="text-gray-500 text-[11px]">{evt.timestamp}</span>
                  </div>

                  <div className="text-gray-400 bg-gray-950 p-2 rounded border border-gray-800/60 truncate">
                    {evt.params}
                  </div>

                  {evt.reason && (
                    <div className="mt-2 text-red-400 text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> {evt.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Policy Configuration Panel */}
        <div className="space-y-6">
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 font-semibold text-white mb-4 border-b border-gray-800 pb-3">
              <Sliders className="w-4 h-4 text-emerald-400" /> Active Security Policy Rules
            </div>

            <div className="space-y-6">
              {/* Rule 1: Max Financial Transfer Cap */}
              <div>
                <label className="text-xs text-gray-300 font-medium mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Max Transaction Limit</span>
                  <span className="font-mono text-emerald-400 font-bold">${maxTransferCap}</span>
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="10000" 
                  step="100"
                  value={maxTransferCap}
                  onChange={(e) => setMaxTransferCap(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-gray-800 rounded-lg cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 mt-1">Interceptors block tool payload transferAmount exceeding this cap.</p>
              </div>

              {/* Rule 2: Prompt Injection Defense */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                <div>
                  <div className="text-xs text-white font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-400" /> Prompt Injection Shield
                  </div>
                  <div className="text-[11px] text-gray-500">Block destructive SQL/CLI patterns.</div>
                </div>
                <button
                  onClick={() => setEnableInjectionShield(!enableInjectionShield)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    enableInjectionShield ? 'bg-emerald-500' : 'bg-gray-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    enableInjectionShield ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Rule 3: Tool Whitelist Enforcement */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                <div>
                  <div className="text-xs text-white font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Strict Whitelist Mode
                  </div>
                  <div className="text-[11px] text-gray-500">Only permit pre-approved tool names.</div>
                </div>
                <button
                  onClick={() => setEnableWhitelistOnly(!enableWhitelistOnly)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    enableWhitelistOnly ? 'bg-emerald-500' : 'bg-gray-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    enableWhitelistOnly ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Integration Snippet */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" /> SDK Connection Code
            </div>
            <pre className="bg-gray-950 p-3 rounded border border-gray-800/80 text-[11px] font-mono text-emerald-400 overflow-x-auto">
              {`import { AgentShield } from '@agentshield/sdk';

const shield = new AgentShield();
const guardedTool = shield.wrapTool(
  'transfer_funds',
  transferFn,
  { maxParamValues: { amount: ${maxTransferCap} } }
);`}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
