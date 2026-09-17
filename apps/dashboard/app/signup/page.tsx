'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight, Building, Mail, Lock, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [orgName, setOrgName] = useState('Acme AI Inc.');
  const [email, setEmail] = useState('alex@acme.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [plan, setPlan] = useState<'free' | 'pro'>('pro');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Logo */}
      <div className="mb-8 text-center space-y-2 z-10">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-xl">
            <ShieldAlert className="w-8 h-8 text-emerald-400" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">AgentShield</span>
        </Link>
        <p className="text-xs text-slate-400">Deploy AI agents to production without security risk</p>
      </div>

      {/* Signup Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl z-10 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-white">Create organization account</h1>
          <p className="text-xs text-slate-400">100% free during public developer launch — all features included</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-emerald-400" /> Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition"
              placeholder="e.g. Acme AI Corp"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-emerald-400" /> Work Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition"
              placeholder="alex@company.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" /> Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition"
            />
          </div>

          {/* Plan Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Select Initial Plan</label>
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setPlan('free')}
                className={`p-3 rounded-xl border cursor-pointer transition text-xs ${
                  plan === 'free'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold flex items-center justify-between mb-1">
                  <span>Free Dev</span>
                  {plan === 'free' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-slate-400">$0/mo • 10k calls</div>
              </div>

              <div
                onClick={() => setPlan('pro')}
                className={`p-3 rounded-xl border cursor-pointer transition text-xs ${
                  plan === 'pro'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <div className="font-bold flex items-center justify-between mb-1">
                  <span>Pro Cloud</span>
                  {plan === 'pro' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-[10px] text-slate-400">Free Launch • 1M calls</div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? 'Creating account...' : 'Create Free Account & Provision API Key'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
