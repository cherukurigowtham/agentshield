import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Cpu, Lock, Terminal, Activity, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-gray-800 bg-gray-950/60 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">AgentShield</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">v0.1.0-beta</span>
          </div>
          <nav className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-gray-400 hover:text-white transition">Features</Link>
            <Link href="#docs" className="text-sm text-gray-400 hover:text-white transition">Docs</Link>
            <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg transition shadow-lg shadow-emerald-500/20">
              Live Control Plane <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 px-6 max-w-5xl mx-auto text-center flex-1 flex flex-col justify-center items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-8">
          <Activity className="w-3.5 h-3.5" /> Deterministic Governance Layer for Autonomous AI Agents
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight mb-6">
          Deploy AI Agents to Production <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Without Security Risk.
          </span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mb-10 leading-relaxed">
          AgentShield is the zero-latency security & policy proxy. Intercept rogue tool calls, stop prompt injections, enforce monetary caps, and audit agent execution in real-time.
        </p>

        {/* Quick Install Code Block */}
        <div className="w-full max-w-xl bg-gray-900 border border-gray-800 rounded-xl p-4 font-mono text-sm text-left shadow-2xl mb-10">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-3 border-b border-gray-800 pb-2">
            <span>Terminal</span>
            <span className="text-emerald-400">npm</span>
          </div>
          <div className="text-emerald-400">
            <span className="text-gray-600">$</span> npm install @agentshield/sdk
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link href="/dashboard" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-base transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2">
            Explore Security Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 font-semibold text-base transition flex items-center justify-center gap-2">
            <Terminal className="w-5 h-5" /> View on GitHub
          </a>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-20 bg-gray-950/50 border-t border-gray-900 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-3">Built for Production AI Infrastructure</h2>
            <p className="text-gray-400">Complete control over what your autonomous agents can see, say, and execute.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/60 border border-gray-800/80 p-6 rounded-2xl">
              <div className="p-3 bg-emerald-500/10 rounded-xl w-fit border border-emerald-500/20 mb-4">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Parameter Bound Caps</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Set hard limits on financial transfers, API quotas, or database query sizes so runaway agents never drain budgets.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/80 p-6 rounded-2xl">
              <div className="p-3 bg-teal-500/10 rounded-xl w-fit border border-teal-500/20 mb-4">
                <ShieldAlert className="w-6 h-6 text-teal-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Prompt Injection Shield</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Detect and strip malicious system prompts, destructive SQL commands, and unauthorized CLI parameters before tool execution.
              </p>
            </div>

            <div className="bg-gray-900/60 border border-gray-800/80 p-6 rounded-2xl">
              <div className="p-3 bg-cyan-500/10 rounded-xl w-fit border border-cyan-500/20 mb-4">
                <Cpu className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Real-Time Telemetry</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Gain full visibility into every tool call, decision path, and policy block across your entire agent fleet.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-8 px-6 text-center text-gray-600 text-xs">
        © 2026 AgentShield Inc. Open Source Security Infrastructure for AI Agents.
      </footer>
    </div>
  );
}
