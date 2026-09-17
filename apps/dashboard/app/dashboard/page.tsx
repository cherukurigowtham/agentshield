'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, ShieldAlert, CheckCircle2, AlertOctagon, Activity, 
  Play, Sliders, Lock, Zap, Layers, Code, Sparkles, BookOpen, Terminal, Key, Copy, Check, User, LogOut, Cpu
} from 'lucide-react';
import { AgentShield, GuardrailPolicy } from '@agentshield/sdk';

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

const shieldEngine = new AgentShield();

export default function EnterpriseSecurityDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'feed' | 'playground' | 'keys' | 'policies'>('feed');
  const [maxTransferCap, setMaxTransferCap] = useState(1000);
  const [enableInjectionDefense, setEnableInjectionDefense] = useState(true);

  // Authenticated user state
  const user = {
    name: 'Alex Chen',
    email: 'alex@acme.ai',
    orgName: 'Acme AI Inc.',
    apiKey: 'ag_live_44a9d72291c89393282ad0ed23e6dff6',
    tenantId: 'tenant_1789653550007_ce58b2c0',
    plan: 'pro',
    monthlyQuota: 1000000,
    usageCount: 3,
  };

  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(user.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Playground state
  const [playToolName, setPlayToolName] = useState('transfer_funds');
  const [playParams, setPlayParams] = useState('{\n  "recipient": "ACC-998877",\n  "amount": 2500,\n  "note": "Invoice payment"\n}');
  const [playPolicy, setPlayPolicy] = useState<GuardrailPolicy>({
    allowedTools: ['transfer_funds', 'search_kb', 'check_balance'],
    maxParamValues: { amount: 1000 },
    enableInjectionSanitizer: true
  });
  const [playgroundResult, setPlaygroundResult] = useState<any>(null);
  const [evalTimeMs, setEvalTimeMs] = useState<number | null>(null);

  const [events, setEvents] = useState<SecurityEvent[]>([
    {
      id: 'evt_1',
      timestamp: '14:32:05',
      agentId: 'acme-finance-bot',
      toolName: 'transfer_funds',
      params: '{"recipient": "Alice", "amount": 250}',
      status: 'ALLOW',
    },
    {
      id: 'evt_2',
      timestamp: '14:32:12',
      agentId: 'acme-finance-bot',
      toolName: 'transfer_funds',
      params: '{"recipient": "Unknown", "amount": 5000}',
      status: 'BLOCK',
      reason: 'Amount ($5,000) exceeds maximum transaction cap ($1,000)',
      remediation: 'Reduce amount parameter to <= $1,000.',
    },
    {
      id: 'evt_3',
      timestamp: '14:32:28',
      agentId: 'acme-support-bot',
      toolName: 'query_database',
      params: '{"query": "SELECT * FROM users; DROP TABLE users;"}',
      status: 'BLOCK',
      reason: 'Security threat detected: Indirect Prompt Injection (DROP TABLE)',
      remediation: 'Sanitize payload string before database execution.',
    },
    {
      id: 'evt_4',
      timestamp: '14:33:01',
      agentId: 'acme-retry-bot',
      toolName: 'retry_payment',
      params: '{"orderId": "ORD-99"}',
      status: 'CIRCUIT_TRIPPED',
      reason: 'Circuit Breaker TRIPPED: Tool called 4 times in 5s loop',
      remediation: 'Abort retry loop and request human authorization.',
    },
  ]);

  const handleRunPlayground = () => {
    let parsedParams = {};
    try {
      parsedParams = JSON.parse(playParams);
    } catch {
      setPlaygroundResult({
        allowed: false,
        reason: 'Invalid JSON syntax in tool parameters payload.',
        actionTaken: 'BLOCK'
      });
      return;
    }

    const start = performance.now();
    const res = shieldEngine.guard({
      toolName: playToolName,
      params: parsedParams,
      sessionId: 'playground-session'
    }, playPolicy);
    const elapsed = performance.now() - start;

    setEvalTimeMs(elapsed);
    setPlaygroundResult(res);
  };

  const triggerLiveSim = () => {
    const isThreat = Math.random() > 0.4;
    const newEvt: SecurityEvent = isThreat
      ? {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'acme-auto-bot',
          toolName: 'delete_account',
          params: '{"userId": "101"}',
          status: 'BLOCK',
          reason: "Tool 'delete_account' is not in allowed tools whitelist.",
          remediation: 'Add delete_account to allowedTools policy array.',
        }
      : {
          id: `evt_${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          agentId: 'acme-search-bot',
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
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur sticky top-0 z-50 px-8 h-20 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>
          <div>
            <div className="font-extrabold text-lg text-white tracking-tight flex items-center gap-3">
              AgentShield <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Multi-Tenant OS v0.1.0</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">Real-time security governance & API quota metering</div>
          </div>
        </div>

        {/* Tab Navigation Buttons */}
        <div className="flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'feed' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" /> Telemetry Stream
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'playground' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" /> Playground
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'keys' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" /> API Keys & Metering
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
              activeTab === 'policies' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-4 h-4" /> Policy Rules
          </button>
        </div>

        {/* User Account & Actions */}
        <div className="flex items-center gap-4">
          <button
            onClick={triggerLiveSim}
            className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold px-3.5 py-2 rounded-xl border border-slate-700 transition"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Simulate Event
          </button>

          {/* User Profile Capsule */}
          <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
            <div className="text-right">
              <div className="text-xs font-bold text-white leading-none">{user.name}</div>
              <div className="text-[10px] font-mono text-emerald-400 mt-0.5">{user.orgName}</div>
            </div>
            <button
              onClick={() => router.push('/login')}
              title="Sign Out"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition border border-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-8 py-10 space-y-8 flex-1">
        {/* System Status Banner */}
        <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                Account Status: <span className="text-emerald-400 flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span> Active ({user.orgName})</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Multi-Tenant API Gateway active on <code className="text-emerald-300">http://localhost:8080</code> with isolated policy storage.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-slate-950/60 px-4 py-2.5 rounded-xl border border-slate-800">
            <span>Plan: <strong className="text-emerald-400 uppercase">{user.plan} Cloud</strong></span>
            <span>•</span>
            <span>Usage: <strong className="text-emerald-400">{user.usageCount.toLocaleString()} / {user.monthlyQuota.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Spacious Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> Audited Tool Calls
              </div>
              <div className="text-4xl font-extrabold text-white tracking-tight">{totalCalls}</div>
              <div className="text-[11px] text-slate-500">100% In-Process Evaluated</div>
            </div>
            <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400 font-mono text-xs font-bold">
              Metered
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-2">
              <div className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Allowed Executions
              </div>
              <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">{allowedCalls}</div>
              <div className="text-[11px] text-slate-500">Policy Approved</div>
            </div>
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
              Safe
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex items-center justify-between shadow-lg">
            <div className="space-y-2">
              <div className="text-xs font-medium text-rose-400 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-400" /> Violations Prevented
              </div>
              <div className="text-4xl font-extrabold text-rose-400 tracking-tight">{blockedCalls}</div>
              <div className="text-[11px] text-slate-500">Threats Neutralized</div>
            </div>
            <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400 font-mono text-xs font-bold">
              Blocked
            </div>
          </div>
        </div>

        {/* Tab 1: Live Telemetry Stream */}
        {activeTab === 'feed' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-6">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" /> Telemetry Stream ({user.orgName})
                </h2>
                <p className="text-xs text-slate-400 mt-1">Real-time evaluation logs of agent tool calls across microservices.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> Live WebSocket Stream
              </div>
            </div>

            <div className="space-y-4 font-mono text-xs max-h-[560px] overflow-y-auto pr-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    evt.status === 'ALLOW'
                      ? 'bg-slate-950/60 border-slate-800/80 hover:border-emerald-500/30 shadow-md'
                      : 'bg-rose-950/20 border-rose-900/40 hover:border-rose-500/50 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide ${
                        evt.status === 'ALLOW' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {evt.status === 'ALLOW' ? '✓ ALLOWED' : '❌ BLOCKED'}
                      </span>
                      <span className="text-white font-bold text-sm">{evt.toolName}</span>
                      <span className="text-slate-500">by</span>
                      <span className="text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{evt.agentId}</span>
                    </div>
                    <span className="text-slate-500 text-xs">{evt.timestamp}</span>
                  </div>

                  <div className="text-slate-200 bg-slate-950 p-3 rounded-xl border border-slate-800/80 truncate text-xs">
                    {evt.params}
                  </div>

                  {evt.reason && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-rose-400 font-semibold">
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

        {/* Tab 2: API Keys & Usage Metering */}
        {activeTab === 'keys' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 space-y-8 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-400" /> API Keys & Usage Quota Metering
              </h2>
              <p className="text-xs text-slate-400 mt-1">Manage isolated API credentials and monitor monthly request quotas for {user.orgName}.</p>
            </div>

            {/* API Key Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Production API Key</div>
                  <div className="text-[11px] text-slate-500">Include this key in the <code className="text-emerald-400">x-api-key</code> header for all Gateway requests.</div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono border border-emerald-500/20 font-bold uppercase">
                  {user.plan} PLAN ACTIVE
                </span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={user.apiKey}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs text-emerald-400 outline-none"
                />
                <button
                  onClick={handleCopyKey}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? 'Copied!' : 'Copy Key'}
                </button>
              </div>
            </div>

            {/* Usage Quota Metering Progress Bar */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Monthly API Request Quota Metering</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {user.usageCount.toLocaleString()} / {user.monthlyQuota.toLocaleString()} Requests (0.0003%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.max(1, (user.usageCount / user.monthlyQuota) * 100)}%` }} 
                />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1">
                <span>Billing Cycle Resets: 1st of next month</span>
                <span>Gateway Endpoint: <code className="text-cyan-400">http://localhost:8080/v1/guard</code></span>
              </div>
            </div>

            {/* Integration Snippet */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-3">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" /> Multi-Tenant HTTP Authentication Snippet
              </div>
              <div className="bg-slate-900 p-4 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto">
                <span className="text-cyan-400">curl</span> -X POST http://localhost:8080/v1/guard \<br />
                &nbsp;&nbsp;-H <span className="text-emerald-300">"x-api-key: {user.apiKey}"</span> \<br />
                &nbsp;&nbsp;-H <span className="text-emerald-300">"Content-Type: application/json"</span> \<br />
                &nbsp;&nbsp;-d <span className="text-emerald-300">'&#123;"toolName": "transfer_funds", "params": &#123;"amount": 250&#125;, "policy": &#123;"maxParamValues": &#123;"amount": 1000&#125;&#125;&#125;'</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Playground */}
        {activeTab === 'playground' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 space-y-6 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-emerald-400" /> Interactive Guardrail Playground
              </h2>
              <p className="text-xs text-slate-400 mt-1">Test tool calls live against AgentShield's in-process evaluation engine.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Input Form */}
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">Tool Name</label>
                  <input
                    type="text"
                    value={playToolName}
                    onChange={(e) => setPlayToolName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white font-mono focus:border-emerald-500 outline-none transition"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">Tool Parameters (JSON)</label>
                  <textarea
                    rows={6}
                    value={playParams}
                    onChange={(e) => setPlayParams(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-emerald-400 font-mono focus:border-emerald-500 outline-none transition"
                  />
                </div>

                <button
                  onClick={handleRunPlayground}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4 fill-current" /> Run AgentShield Inspection
                </button>
              </div>

              {/* Live Result Display */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between font-mono text-xs">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                    <span className="text-slate-400 text-xs font-semibold">Evaluation Output</span>
                    {evalTimeMs !== null && (
                      <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-bold">
                        ⚡ {evalTimeMs.toFixed(4)} ms
                      </span>
                    )}
                  </div>

                  {playgroundResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold ${
                          playgroundResult.allowed 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}>
                          {playgroundResult.allowed ? '✓ ALLOWED' : '❌ BLOCKED'}
                        </span>
                        <span className="text-slate-400 text-xs">{playgroundResult.actionTaken}</span>
                      </div>

                      {playgroundResult.reason && (
                        <div className="p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl text-rose-300 space-y-1">
                          <div className="font-bold text-xs">Reason:</div>
                          <div className="text-xs leading-relaxed">{playgroundResult.reason}</div>
                        </div>
                      )}

                      {playgroundResult.remediation && (
                        <div className="p-4 bg-cyan-950/30 border border-cyan-900/50 rounded-xl text-cyan-300 space-y-1">
                          <div className="font-bold text-xs">Suggested Remediation:</div>
                          <div className="text-xs leading-relaxed">{playgroundResult.remediation.suggestedFix}</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-600 text-center py-16 text-xs">
                      Click "Run AgentShield Inspection" to evaluate payload.
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-600 border-t border-slate-900 pt-3">
                  Engine: BloomFilter + ASTLexical + InjectionSanitizer (In-Process)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Policy Rules */}
        {activeTab === 'policies' && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-8 max-w-3xl mx-auto space-y-8 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" /> Active Security Policy Rules ({user.orgName})
              </h2>
              <p className="text-xs text-slate-400 mt-1">Configure live parameter caps and security guardrails.</p>
            </div>

            <div className="space-y-8 border-t border-slate-800 pt-6">
              {/* Rule 1 */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Max Financial Transaction Limit</span>
                  <span className="font-mono text-emerald-400 font-extrabold text-sm">${maxTransferCap}</span>
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="10000" 
                  step="100"
                  value={maxTransferCap}
                  onChange={(e) => setMaxTransferCap(Number(e.target.value))}
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer h-2.5"
                />
                <p className="text-xs text-slate-500">Interceptors block any tool call requesting transfer amounts above this cap.</p>
              </div>

              {/* Rule 2 */}
              <div className="flex items-center justify-between border-t border-slate-800 pt-6">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-teal-400" /> Indirect Prompt Injection Defense
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Strips zero-width unicode & instruction override markers.</div>
                </div>
                <button
                  onClick={() => setEnableInjectionDefense(!enableInjectionDefense)}
                  className={`w-12 h-6.5 rounded-full transition-colors relative p-1 ${
                    enableInjectionDefense ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                    enableInjectionDefense ? 'translate-x-5.5' : 'translate-x-0'
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
