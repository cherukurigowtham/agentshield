'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sliders, Code2, Copy, Check, ShieldAlert, Lock, Terminal } from 'lucide-react';

export default function PolicyBuilderPage() {
  const [allowedTools, setAllowedTools] = useState('search_kb, transfer_funds, read_docs');
  const [maxTransferCap, setMaxTransferCap] = useState(1000);
  const [enableInjectionSanitizer, setEnableInjectionSanitizer] = useState(true);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const activePolicyJson = {
    allowedTools: allowedTools.split(',').map(s => s.trim()).filter(Boolean),
    maxParamValues: {
      amount: maxTransferCap,
    },
    enableInjectionSanitizer: enableInjectionSanitizer,
  };

  const tsCode = `import { shield } from '@agentshield/sdk';

const policy = ${JSON.stringify(activePolicyJson, null, 2)};

const safeTool = shield('transfer_funds', transferFn, policy);`;

  const pyCode = `from agentshield import AgentShield

shield = AgentShield()
policy = ${JSON.stringify(activePolicyJson, null, 2).replace(/true/g, 'True').replace(/false/g, 'False')}

@shield.guard(tool_name="transfer_funds", policy=policy)
def transfer_funds(amount: float):
    return f"Transferred \${amount}"`;

  const curlCode = `curl -X POST http://localhost:3000/api/shield \\
  -H "Content-Type: application/json" \\
  -d '{
    "toolName": "transfer_funds",
    "params": { "amount": 500 },
    "policy": ${JSON.stringify(activePolicyJson)}
  }'`;

  const copyToClipboard = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-lg text-white">Visual Guardrail Policy Generator</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition">Telemetry</Link>
          <Link href="/pricing" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg font-semibold transition">
            Upgrade Pro
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <main className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        {/* Left Column: Interactive Form Controls */}
        <div className="space-y-6">
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" /> Configure Guardrail Rules
            </h2>

            <div className="space-y-6">
              {/* Allowed Tools Input */}
              <div>
                <label className="text-xs text-gray-300 font-medium mb-2 block">
                  Allowed Tool Names (Comma Separated)
                </label>
                <input 
                  type="text" 
                  value={allowedTools}
                  onChange={(e) => setAllowedTools(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Max Param Cap Slider */}
              <div>
                <label className="text-xs text-gray-300 font-medium mb-2 flex items-center justify-between">
                  <span>Max Transaction Amount Cap ($)</span>
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
              </div>

              {/* Toggle Injection Sanitizer */}
              <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                <div>
                  <div className="text-xs text-white font-medium flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-teal-400" /> Indirect Prompt Injection Defense
                  </div>
                  <div className="text-[11px] text-gray-500">Scan zero-width unicode & instruction overrides.</div>
                </div>
                <button
                  onClick={() => setEnableInjectionSanitizer(!enableInjectionSanitizer)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    enableInjectionSanitizer ? 'bg-emerald-500' : 'bg-gray-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    enableInjectionSanitizer ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Code Output Snippets */}
        <div className="space-y-6">
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Code2 className="w-5 h-5 text-emerald-400" /> Generated Code Snippets
            </h2>

            {/* TypeScript Snippet */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                <span>TypeScript / Node.js</span>
                <button 
                  onClick={() => copyToClipboard(tsCode, 'ts')}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                >
                  {copiedTab === 'ts' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTab === 'ts' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-xs font-mono text-emerald-400 overflow-x-auto">
                {tsCode}
              </pre>
            </div>

            {/* Python Snippet */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                <span>Python (agentshield-os)</span>
                <button 
                  onClick={() => copyToClipboard(pyCode, 'py')}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                >
                  {copiedTab === 'py' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTab === 'py' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-xs font-mono text-cyan-400 overflow-x-auto">
                {pyCode}
              </pre>
            </div>

            {/* cURL REST API Snippet */}
            <div>
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                <span>cURL / Multi-Language REST API</span>
                <button 
                  onClick={() => copyToClipboard(curlCode, 'curl')}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                >
                  {copiedTab === 'curl' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedTab === 'curl' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-gray-950 p-4 rounded-xl border border-gray-800 text-xs font-mono text-gray-300 overflow-x-auto">
                {curlCode}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
