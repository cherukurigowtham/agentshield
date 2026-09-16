import './globals.css';
import React from 'react';

export const metadata = {
  title: 'AgentShield - Deterministic AI Agent Security & Governance OS',
  description: 'Real-time security guardrails, injection defense, and governance platform for autonomous AI agents.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-gray-100 min-h-screen selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
