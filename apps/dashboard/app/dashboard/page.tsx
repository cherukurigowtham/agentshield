'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, Activity, Sliders, Key, Copy, Check, LogOut, Layers, Sparkles
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

export default function EnterpriseSecurityDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'keys' | 'policies'>('dashboard');
  const [maxTransferCap, setMaxTransferCap] = useState(1000);
  const [enableInjectionDefense, setEnableInjectionDefense] = useState(true);

  // Authenticated user state
  const user = {
    name: 'Alex Chen',
    email: 'alex@acme.ai',
    orgName: 'Acme AI Inc.',
    apiKey: 'ag_live_44a9d72291c89393282ad0ed23e6dff6',
    tenantId: 'tenant_1789653550007_ce58b2c0',
    plan: 'Pro Plan',
    monthlyQuota: 1000000,
    usageCount: 3,
  };

  const [copiedKey, setCopiedKey] = useState(false);
  const [events, setEvents] = useState<SecurityEvent[]>([]);

  // Fetch real telemetry logs from backend
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch('/api/telemetry');
        if (res.ok) {
          const data = await res.json();
          if (data.logs && Array.isArray(data.logs) && data.logs.length > 0) {
            const mapped: SecurityEvent[] = data.logs.map((log: any, i: number) => ({
              id: `evt_${i}_${Date.now()}`,
              timestamp: new Date(log.timestamp || Date.now()).toLocaleTimeString(),
              agentId: log.agentId || 'agent-service',
              toolName: log.toolName || 'tool_execution',
              params: typeof log.params === 'string' ? log.params : JSON.stringify(log.params || {}),
              status: log.actionTaken === 'BLOCK' ? 'BLOCK' : 'ALLOW',
              reason: log.reason,
            }));
            setEvents(mapped);
          }
        }
      } catch {
        // Fallback to empty clean state
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(user.apiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const totalCalls = events.length;
  const blockedCalls = events.filter(e => e.status !== 'ALLOW').length;
  const allowedCalls = events.filter(e => e.status === 'ALLOW').length;

  const handleLogout = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex antialiased">
      {/* Sleek Minimalist Sidebar */}
      <aside className="w-60 bg-slate-950 border-r border-slate-900 flex flex-col justify-between p-4 sticky top-0 h-screen shrink-0 z-40">
        <div className="space-y-6">
          {/* Clean Brand Header */}
          <Link href="/" className="flex items-center gap-2.5 px-2 py-1.5 group">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-bold text-sm text-white tracking-tight">AgentShield</span>
          </Link>

          {/* Minimal Navigation List */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2.5 ${
                activeTab === 'dashboard'
                  ? 'bg-slate-900 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Activity className="w-4 h-4" /> Dashboard
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2.5 ${
                activeTab === 'logs'
                  ? 'bg-slate-900 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Layers className="w-4 h-4" /> Logs
            </button>

            <button
              onClick={() => setActiveTab('keys')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2.5 ${
                activeTab === 'keys'
                  ? 'bg-slate-900 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Key className="w-4 h-4" /> API Keys
            </button>

            <button
              onClick={() => setActiveTab('policies')}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2.5 ${
                activeTab === 'policies'
                  ? 'bg-slate-900 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
              }`}
            >
              <Sliders className="w-4 h-4" /> Policies
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-900 text-[10px] text-slate-500 font-mono text-center">
          AgentShield OS v0.1
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {/* Top Header Navbar */}
        <header className="h-14 border-b border-slate-900 px-8 flex items-center justify-between sticky top-0 bg-slate-950/80 backdrop-blur z-30">
          <div className="text-xs font-bold text-slate-300">
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'logs' && 'Audit Logs'}
            {activeTab === 'keys' && 'API Keys & Metered Usage'}
            {activeTab === 'policies' && 'Security Policies'}
          </div>

          {/* User Name & Profile on Top Navbar */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-white">{user.name}</span>
              <span className="text-slate-500 font-mono text-[10px]">({user.orgName})</span>
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 rounded-lg text-xs font-medium transition"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="p-8 max-w-6xl w-full mx-auto space-y-8 flex-1">
          {/* Tab 1: Dashboard Overview */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Status Summary Banner */}
              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">System Status: Protected</div>
                    <div className="text-[11px] text-slate-500">Multi-tenant Gateway active on http://localhost:8080</div>
                  </div>
                </div>
                <div className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                  {user.plan} Active
                </div>
              </div>

              {/* Clean Metric Grid */}
              <div className="grid grid-cols-3 gap-5">
                <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-1">
                  <div className="text-xs font-medium text-slate-400">Total Tool Calls</div>
                  <div className="text-2xl font-bold text-white tracking-tight">{totalCalls}</div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-1">
                  <div className="text-xs font-medium text-emerald-400">Allowed Executions</div>
                  <div className="text-2xl font-bold text-emerald-400 tracking-tight">{allowedCalls}</div>
                </div>

                <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-5 space-y-1">
                  <div className="text-xs font-medium text-rose-400">Violations Prevented</div>
                  <div className="text-2xl font-bold text-rose-400 tracking-tight">{blockedCalls}</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Logs */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Audit Log Feed</h2>
                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Telemetry Feed Active
                </span>
              </div>

              {events.length === 0 ? (
                <div className="p-12 text-center border border-slate-900 rounded-xl bg-slate-900/20 text-slate-500 text-xs">
                  No telemetry logs received yet. Execute agent requests via API key to view live logs.
                </div>
              ) : (
                <div className="space-y-2.5 font-mono text-xs">
                  {events.map((evt) => (
                    <div
                      key={evt.id}
                      className={`p-4 rounded-xl border transition ${
                        evt.status === 'ALLOW'
                          ? 'bg-slate-900/30 border-slate-900'
                          : 'bg-rose-950/10 border-rose-950/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            evt.status === 'ALLOW' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {evt.status === 'ALLOW' ? 'ALLOWED' : 'BLOCKED'}
                          </span>
                          <span className="text-white font-semibold">{evt.toolName}</span>
                          <span className="text-slate-500">by {evt.agentId}</span>
                        </div>
                        <span className="text-slate-500 text-[10px]">{evt.timestamp}</span>
                      </div>

                      <div className="text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-900 text-[11px] truncate">
                        {evt.params}
                      </div>

                      {evt.reason && (
                        <div className="mt-2 text-[11px] text-rose-400">
                          Reason: {evt.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: API Keys */}
          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3">
                <div className="text-xs font-semibold text-white">Production API Key</div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={user.apiKey}
                    className="w-full bg-slate-950 border border-slate-900 rounded-lg px-3.5 py-2 font-mono text-xs text-emerald-400 outline-none"
                  />
                  <button
                    onClick={handleCopyKey}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition whitespace-nowrap"
                  >
                    {copiedKey ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Monthly Quota</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {user.usageCount} / {user.monthlyQuota.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-900">
                  <div className="bg-emerald-500 h-full rounded-full w-1" />
                </div>
              </div>

              <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-5 space-y-2">
                <div className="text-xs font-semibold text-white">HTTP Request Header</div>
                <div className="bg-slate-950 p-3 rounded-lg font-mono text-[11px] text-slate-300">
                  curl -X POST http://localhost:8080/v1/guard -H "x-api-key: {user.apiKey}"
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Policies */}
          {activeTab === 'policies' && (
            <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
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
              </div>

              <div className="flex items-center justify-between border-t border-slate-900 pt-5">
                <div>
                  <div className="text-xs font-semibold text-white">Indirect Prompt Injection Defense</div>
                  <div className="text-[11px] text-slate-500">Strips malicious override markers.</div>
                </div>
                <button
                  onClick={() => setEnableInjectionDefense(!enableInjectionDefense)}
                  className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 ${
                    enableInjectionDefense ? 'bg-emerald-500' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    enableInjectionDefense ? 'translate-x-4.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
