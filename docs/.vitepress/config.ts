import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'AgentShield',
  description: 'Deterministic Security, Guardrails & Governance OS for Autonomous AI Agents',
  lang: 'en-US',
  head: [
    ['link', { rel: 'icon', href: '/shield.svg' }],
    ['meta', { name: 'theme-color', content: '#10b981' }],
  ],
  themeConfig: {
    logo: '/shield.svg',
    nav: [
      { text: 'Getting Started', link: '/getting-started/quickstart' },
      { text: 'SDKs', link: '/sdks/overview', activeMatch: '/sdks/' },
      { text: 'Integrations', link: '/integrations/overview', activeMatch: '/integrations/' },
      { text: 'Policy Packs', link: '/policies/overview', activeMatch: '/policies/' },
      { text: 'API Reference', link: '/api/rest', activeMatch: '/api/' },
      { text: 'Guides', link: '/guides/production-deployment', activeMatch: '/guides/' },
      {
        text: 'v0.1.0',
        items: [
          { text: 'Changelog', link: 'https://github.com/agentshield/agentshield/blob/main/CHANGELOG.md' },
          { text: 'GitHub', link: 'https://github.com/agentshield/agentshield' },
          { text: 'Discord', link: 'https://discord.gg/agentshield' },
        ],
      },
    ],

    sidebar: {
      '/getting-started/': [
        { text: 'Quickstart', link: '/getting-started/quickstart' },
        { text: 'Installation', link: '/getting-started/installation' },
        { text: 'Core Concepts', link: '/getting-started/concepts' },
        { text: 'First Guardrail', link: '/getting-started/first-guardrail' },
      ],
      '/sdks/': [
        { text: 'Overview', link: '/sdks/overview' },
        { text: 'TypeScript', link: '/sdks/typescript' },
        { text: 'Python', link: '/sdks/python' },
        { text: 'Go', link: '/sdks/go' },
        { text: 'Java', link: '/sdks/java' },
        { text: '.NET / C#', link: '/sdks/dotnet' },
        { text: 'Rust', link: '/sdks/rust' },
      ],
      '/integrations/': [
        { text: 'Overview', link: '/integrations/overview' },
        { text: 'LangChain / LangGraph', link: '/integrations/langchain' },
        { text: 'CrewAI', link: '/integrations/crewai' },
        { text: 'AutoGen', link: '/integrations/autogen' },
        { text: 'LlamaIndex', link: '/integrations/llamaindex' },
        { text: 'PydanticAI', link: '/integrations/pydanticai' },
      ],
      '/policies/': [
        { text: 'Overview', link: '/policies/overview' },
        { text: 'Policy Schema', link: '/policies/schema' },
        { text: 'PCI-DSS', link: '/policies/pci-dss' },
        { text: 'HIPAA', link: '/policies/hipaa' },
        { text: 'No-Crypto', link: '/policies/no-crypto' },
        { text: 'Custom Policies', link: '/policies/custom' },
      ],
      '/api/': [
        { text: 'REST API', link: '/api/rest' },
        { text: 'gRPC API', link: '/api/grpc' },
        { text: 'CLI Reference', link: '/api/cli' },
      ],
      '/guides/': [
        { text: 'Production Deployment', link: '/guides/production-deployment' },
        { text: 'Zero-Trust Architecture', link: '/guides/zero-trust' },
        { text: 'Compliance (SOC2, PCI, HIPAA)', link: '/guides/compliance' },
        { text: 'Multi-Tenant SaaS', link: '/guides/multi-tenant' },
        { text: 'Agent Identity & Reputation', link: '/guides/agent-identity' },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/agentshield/agentshield' },
      { icon: 'discord', link: 'https://discord.gg/agentshield' },
      { icon: 'twitter', link: 'https://twitter.com/agentshield' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 AgentShield Team',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/agentshield/agentshield/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: true,
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
})