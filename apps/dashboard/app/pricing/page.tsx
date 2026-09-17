'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, ShieldAlert, Zap, Building2, Terminal, Loader2 } from 'lucide-react';
import { redirectToCheckout } from '@/lib/stripe';

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-lg text-white">AgentShield Pricing & Plans</span>
          </div>
        </div>
        <Link href="/dashboard" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-black px-4 py-2 rounded-lg font-semibold transition">
          Live Control Plane
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 flex-1 w-full text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-6">
          🎉 100% Free During Public Launch — All Pro & Enterprise Features Included
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Start Free. Scale Security Without Limits.
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-base mb-16">
          AgentShield is currently 100% free for developers and production AI teams. Get full access to local SDKs, the Next.js control plane, real-time alert webhooks, and enterprise policy packs with zero credit card required.
        </p>

        {/* Pricing Cards Grid */}
        <div className="grid md:grid-cols-3 gap-8 text-left">
          {/* Free Tier */}
          <div className="bg-gray-900/80 border border-gray-800 p-8 rounded-2xl flex flex-col">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
              <Terminal className="w-4 h-4" /> Developer Open Source
            </div>
            <div className="text-4xl font-extrabold text-white mb-1">$0 <span className="text-xs font-normal text-gray-400">/ forever</span></div>
            <p className="text-xs text-gray-400 mb-6">Perfect for individual developers & prototype agents.</p>
            
            <ul className="space-y-3 text-xs text-gray-300 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Full TypeScript & Python SDKs</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> In-process deterministic evaluator</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Parameter & financial caps</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Prompt injection pattern defense</li>
              <li className="flex items-center gap-2 text-gray-500"><Check className="w-4 h-4 text-gray-600" /> 10,000 monthly telemetry events</li>
            </ul>

            <Link href="https://github.com" target="_blank" className="w-full text-center py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs transition">
              Get Started Open Source
            </Link>
          </div>

          {/* Pro Tier (Popular) */}
          <div className="bg-gradient-to-b from-emerald-950/40 to-gray-900 border-2 border-emerald-500/80 p-8 rounded-2xl flex flex-col relative shadow-2xl shadow-emerald-500/10">
            <div className="absolute -top-3 right-6 bg-emerald-500 text-black font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm mb-2">
              <Zap className="w-4 h-4" /> Pro Cloud
            </div>
            <div className="text-4xl font-extrabold text-white mb-1">$49 <span className="text-xs font-normal text-gray-400">/ month</span></div>
            <p className="text-xs text-gray-400 mb-6">For AI startups deploying production agents.</p>

            <ul className="space-y-3 text-xs text-gray-300 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Everything in Open Source</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Real-time Control Plane Dashboard</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 1,000,000 monthly telemetry events</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Slack & Discord violation alerts</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Custom policy regex builder</li>
            </ul>

            <button
              onClick={() => {
                setLoadingPlan('pro');
                redirectToCheckout('pro');
              }}
              disabled={loadingPlan === 'pro'}
              className="w-full text-center py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingPlan === 'pro' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Start 14-Day Free Trial'
              )}
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-gray-900/80 border border-gray-800 p-8 rounded-2xl flex flex-col">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm mb-2">
              <Building2 className="w-4 h-4" /> Enterprise Fleet
            </div>
            <div className="text-4xl font-extrabold text-white mb-1">$499 <span className="text-xs font-normal text-gray-400">/ month</span></div>
            <p className="text-xs text-gray-400 mb-6">For Fortune 500 & scale-up AI engineering teams.</p>

            <ul className="space-y-3 text-xs text-gray-300 mb-8 flex-1">
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Unlimited telemetry & agents</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> SOC2 Type II audit logs & exports</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> SSO / SAML & Team RBAC</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> Dedicated low-latency cloud proxy</li>
              <li className="flex items-center gap-2"><Check className="w-4 h-4 text-cyan-400" /> 99.99% Uptime SLA & 24/7 support</li>
            </ul>

            <button
              onClick={() => {
                setLoadingPlan('enterprise');
                redirectToCheckout('enterprise');
              }}
              disabled={loadingPlan === 'enterprise'}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-xs transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loadingPlan === 'enterprise' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Contact Sales / Start Trial'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
