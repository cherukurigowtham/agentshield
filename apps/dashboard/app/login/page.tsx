'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ArrowRight, Github, Mail, Lock, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('alex@acme.ai');
  const [password, setPassword] = useState('••••••••••••');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push('/dashboard');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Logo */}
      <div className="mb-8 text-center space-y-2 z-10">
        <Link href="/" className="inline-flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-xl">
            <ShieldAlert className="w-8 h-8 text-emerald-400" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-white">AgentShield</span>
        </Link>
        <p className="text-xs text-slate-400">Sign in to your production AI security control plane</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl z-10 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-bold text-white">Welcome back</h1>
          <p className="text-xs text-slate-400">Enter your credentials to access your API keys and telemetry stream</p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition"
          >
            <Github className="w-4 h-4 text-white" /> GitHub
          </button>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Google
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-900 px-3 text-[10px] font-mono text-slate-500 uppercase tracking-wider relative">or continue with email</span>
        </div>

        {/* Email Form */}
        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="name@company.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-emerald-400" /> Password</span>
              <a href="#" className="text-[11px] text-emerald-400 hover:underline">Forgot?</a>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? 'Signing in...' : 'Sign in to Dashboard'} <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-emerald-400 font-semibold hover:underline">
            Create free organization account
          </Link>
        </p>
      </div>
    </div>
  );
}
