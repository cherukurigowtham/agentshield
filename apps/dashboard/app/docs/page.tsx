import React from 'react';
import Link from 'next/link';
import { ShieldAlert, BookOpen, Terminal, Code, Cpu, Lock, ArrowRight, CheckCircle } from 'lucide-react';

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col antialiased">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
          </div>
          <Link href="/" className="font-bold text-base text-white tracking-tight flex items-center gap-2">
            AgentShield <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">Docs</span>
          </Link>
        </div>

        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/policies" className="text-xs text-slate-400 hover:text-white transition">
            Policy Packs
          </Link>
          <a href="https://github.com/cherukurigowtham/agentshield" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-white transition">
            GitHub
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto w-full p-6 space-y-10 flex-1">
        {/* Header Title */}
        <div className="border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono mb-4">
            <BookOpen className="w-3.5 h-3.5" /> Developer Quickstart & API Reference
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">AgentShield Architecture & Integration Guide</h1>
          <p className="text-sm text-slate-400 mt-2 max-w-2xl">
            Learn how to integrate AgentShield into TypeScript, Python, OpenAI, Gemini, Claude, LangChain, or microservice gateways in under 5 minutes.
          </p>
        </div>

        {/* Section 1: TypeScript Quickstart */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-400" /> 1. TypeScript / Node.js Integration
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400 space-y-2">
            <div className="text-slate-500">// Install via npm</div>
            <div>npm install @agentshield/sdk</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-slate-500">// Initialize AgentShield in your agent loop</div>
            <div><span className="text-purple-400">import</span> &#123; AgentShield &#125; <span className="text-purple-400">from</span> <span className="text-emerald-300">'@agentshield/sdk'</span>;</div>
            <div><span className="text-purple-400">const</span> shield = <span className="text-purple-400">new</span> AgentShield();</div>
            <br />
            <div><span className="text-purple-400">const</span> result = shield.guard(&#123;</div>
            <div>&nbsp;&nbsp;toolName: <span className="text-emerald-300">'transfer_funds'</span>,</div>
            <div>&nbsp;&nbsp;params: &#123; amount: 2500, recipient: <span className="text-emerald-300">'Alice'</span> &#125;</div>
            <div>&#125;, policy);</div>
            <br />
            <div><span className="text-purple-400">if</span> (!result.allowed) &#123;</div>
            <div>&nbsp;&nbsp;<span className="text-purple-400">throw new</span> Error(result.reason);</div>
            <div>&#125;</div>
          </div>
        </section>

        {/* Section 2: Python Quickstart */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-teal-400" /> 2. Python Integration
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-teal-400 space-y-2">
            <div className="text-slate-500"># Install via PyPI</div>
            <div>pip install agentshield</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-2">
            <div className="text-slate-500"># Use decorator on any tool function</div>
            <div><span className="text-purple-400">from</span> agentshield <span className="text-purple-400">import</span> AgentShield</div>
            <div>shield = AgentShield()</div>
            <br />
            <div><span className="text-yellow-400">@shield.guard</span>(tool_name=<span className="text-emerald-300">"db_query"</span>, policy=policy)</div>
            <div><span className="text-purple-400">def</span> db_query(query: str):</div>
            <div>&nbsp;&nbsp;<span className="text-purple-400">return</span> db.execute(query)</div>
          </div>
        </section>

        {/* Section 3: REST Gateway Spec */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cpu className="w-5 h-5 text-cyan-400" /> 3. HTTP Sidecar Gateway Endpoint (`POST /v1/guard`)
          </h2>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-3">
            <div className="text-slate-500"># POST http://localhost:8080/v1/guard</div>
            <div className="text-cyan-400">curl -X POST http://localhost:8080/v1/guard \</div>
            <div className="text-slate-300">&nbsp;&nbsp;-H "Content-Type: application/json" \</div>
            <div className="text-slate-300">&nbsp;&nbsp;-d '&#123;"toolName": "transfer_funds", "params": &#123;"amount": 500&#125;, "policy": &#123;"maxParamValues": &#123;"amount": 1000&#125;&#125;&#125;'</div>
          </div>
        </section>
      </main>
    </div>
  );
}
