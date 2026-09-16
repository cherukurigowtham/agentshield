'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldAlert, CheckCircle2, AlertOctagon, Activity, 
  Play, Sliders, Lock, ArrowUpRight, Zap, RefreshCw, Layers
} from 'lucide-react';

interface SecurityEvent {
  id: string;
  timestamp: string;
  agentId: string;
  toolName: string;
  params: string;
  status: 'ALLOW' | 'BLOCK' | 'CIRCUIT_TRIPPED';
  reason?: string;
  remediation?: string;
}

export default function CleanSecurityDashboard() {
  const [activeTab, setActiveTab] = useState<'feed' | 'policies'>('feed');
  const [maxTransferCap, setMaxTransferCap] = useState(1000);
  const [enableInjectionDefense, setEnableInjectionDefense] = useState(true);

  const [events, setEvents] = useState<SecurityEvent[]>([
    {
      id: 'evt_1',
      timestamp: '14:32:05',
      agentId: 'finance-bot',
      toolName: 'transfer_funds',
      params: '{"recipient": "Alice", "amount": 250}',
      status: 'ALLOW',
    },
    {
      id: 'evt_2',
      timestamp: '14:32:12',
      agentId: 'finance-bot',
      toolName: 'transfer_funds',
      params: '{"recipient": "Unknown", "amount": 5000}',
      status: 'BLOCK',
      reason: 'Amount ($5,000) exceeds maximum transaction cap ($1,000)',
      remediation: 'Reduce amount parameter to <= $1,000.',
    },
    {
      id: 'evt_3',
      timestamp: '14:32:28',
      agentId: 'support-agent',
      toolName: 'query_database',
      params: '{"query": "SELECT * FROM users; DROP TABLE users;"}',
      status: 'BLOCK',
      reason: 'Security threat detected: Indirect Prompt Injection (DROP TABLE)',
      remediation: 'Sanitize payload string before database execution.',
    },
    {
      id: 'evt_4',
      timestamp: '14:33:01',
      agentId: 'retry-agent',
      toolName: 'retry_payment',
      params: '{"orderId": "ORD-99"}',
      status: 'CIRCUIT_TRIPPED',
      reason: 'Circuit Breaker TRIPPED: Tool called 4 times in 5s loop',
      remediation: 'Abort retry loop and request human authorization.',
    },
  ]);

  const triggerLiveSim = () => {
    const isThreat = Math.random() > 0.4;
    const newEvt: SecurityEvent = isThreat
      ? {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'auto-bot-99',
          toolName: 'delete_account',
          params: '{"userId": "101"}',
          status: 'BLOCK',
          reason: "Tool 'delete_account' is not in allowed tools whitelist.",
          remediation: 'Add delete_account to allowedTools policy array.',
        }
      : {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'search-bot',
          toolName: 'read_docs',
          params: '{"docId": "api_v2"}',
          status: 'ALLOW',
        };

    setEvents(prev => [newEvt, ...prev]);
  };

  const totalCalls = events.length;
  const blockedCalls = events.filter(e => e.status !== 'ALLOW').length;
  const allowedCalls = events.filter(e => e.status === 'ALLOW').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-bold text-base text-white tracking-tight flex items-center gap-2">
              AgentShield <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">Production Control</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'feed' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Telemetry Feed
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'policies' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Policy Rules
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={triggerLiveSim}
            className="flex items-center gap-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-3.5 py-2 rounded-xl transition shadow-md shadow-emerald-500/10"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Simulate Tool Call
          </button>
          <Link href="/pricing" className="text-xs text-slate-400 hover:text-white transition">
            Pricing
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* At-a-Glance Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-400" /> Total Agent Tool Calls
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">{totalCalls}</div>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 font-mono text-xs">
              100% Audited
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-400 font-medium mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Allowed Executions
              </div>
              <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">{allowedCalls}</div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400 font-mono text-xs">
              Safe
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="text-xs text-rose-400 font-medium mb-1 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4 text-rose-400" /> Violations Prevented
              </div>
              <div className="text-3xl font-extrabold text-rose-400 tracking-tight">{blockedCalls}</div>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400 font-mono text-xs">
              Blocked
            </div>
          </div>
        </div>

        {/* Tab 1: Live Telemetry Feed */}
        {activeTab === 'feed' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" /> Real-Time Agent Tool Call Audit Stream
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Showing in-flight security evaluation logs for registered AI agents.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live WebSocket Connection
              </div>
            </div>

            <div className="space-y-3 font-mono text-xs max-h-[520px] overflow-y-auto pr-1">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-4 rounded-xl border transition ${
                    evt.status === 'ALLOW'
                      ? 'bg-slate-950/40 border-slate-800/80 hover:border-emerald-500/30'
                      : 'bg-rose-950/10 border-rose-900/30 hover:border-rose-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                        evt.status === 'ALLOW' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {evt.status}
                      </span>
                      <span className="text-slate-200 font-bold">{evt.toolName}</span>
                      <span className="text-slate-600">by</span>
                      <span className="text-slate-400">{evt.agentId}</span>
                    </div>
                    <span className="text-slate-500 text-[11px]">{evt.timestamp}</span>
                  </div>

                  <div className="text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 truncate">
                    {evt.params}
                  </div>

                  {evt.reason && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        ⚠️ Reason: {evt.reason}
                      </span>
                      {evt.remediation && (
                        <span className="text-cyan-400 font-medium">
                          💡 Remediation: {evt.remediation}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Policy Rules Config */}
        {activeTab === 'policies' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" /> Active Security Policy Rules
              </h2>
              <p className="text-xs text-slate-400 mt-1">Configure live parameter bounds and security guardrails for your agent fleet.</p>
            </div>

            <div className="space-y-6 border-t border-slate-800 pt-6">
              {/* Rule 1 */}
              <div>
                <label className="text-xs font-semibold text-slate-200 mb-2 flex items-center justify-between">
                  <span>Max Financial Transaction Limit</span>
                  <span className="font-mono text-emerald-400 font-bold">${maxTransferCap}</span>
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="10000" 
                  step="100"
                  value={maxTransferCap}
                  onChange={(e) => setMaxTransferCap(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2"
                />
                <p className="text-[11px] text-slate-500 mt-1">Interceptors block any tool call attempt requesting transferAmount above this cap.</p>
              </div>

              {/* Rule 2 */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-4">
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-400" /> Indirect Prompt Injection Defense
                  </div>
                  <div className="text-[11px] text-slate-500">Scan zero-width unicode & instruction override markers.</div>
                </div>
                <button
                  onClick={() => setEnableInjectionDefense(!enableInjectionDefense)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    enableInjectionDefense ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    enableInjectionDefense ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
