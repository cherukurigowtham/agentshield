export interface MitreTtpMapping {
  ttpId: string;
  techniqueName: string;
  tactic: string;
  agentShieldEngine: string;
  mitigationStatus: 'ACTIVE' | 'PARTIAL' | 'MONITORED';
}

export class MitreAtlasMapper {
  private static TTP_CATALOG: MitreTtpMapping[] = [
    {
      ttpId: 'AML.T0054',
      techniqueName: 'LLM Prompt Injection (Direct & Indirect)',
      tactic: 'Initial Access / Execution',
      agentShieldEngine: 'InjectionSanitizer & PolicyEvaluator',
      mitigationStatus: 'ACTIVE',
    },
    {
      ttpId: 'AML.T0051',
      techniqueName: 'LLM Plugin / Tool Compromise',
      tactic: 'Privilege Escalation / Exploitation',
      agentShieldEngine: 'PolicyEvaluator (Tool Whitelist & Parameter Bounds)',
      mitigationStatus: 'ACTIVE',
    },
    {
      ttpId: 'AML.T0056',
      techniqueName: 'Context & Memory Poisoning',
      tactic: 'Persistence / Impact',
      agentShieldEngine: 'InjectionSanitizer (Zero-Width Unicode & Base64 Decoder)',
      mitigationStatus: 'ACTIVE',
    },
    {
      ttpId: 'AML.T0058',
      techniqueName: 'Data Exfiltration via Agent Tool Chaining',
      tactic: 'Exfiltration',
      agentShieldEngine: 'AgentDependencyGraph & AuditExporter',
      mitigationStatus: 'ACTIVE',
    },
    {
      ttpId: 'AML.T0055',
      techniqueName: 'LLM Denial of Service & Death Loop',
      tactic: 'Impact',
      agentShieldEngine: 'CircuitBreaker & RateLimiter',
      mitigationStatus: 'ACTIVE',
    },
    {
      ttpId: 'AML.T0050',
      techniqueName: 'Evasion & Obfuscation via Code Splitting',
      tactic: 'Defense Evasion',
      agentShieldEngine: 'ASTSandboxEngine (String De-concatenation)',
      mitigationStatus: 'ACTIVE',
    },
  ];

  static getCatalog(): MitreTtpMapping[] {
    return this.TTP_CATALOG;
  }

  static getTtpDetails(ttpId: string): MitreTtpMapping | undefined {
    return this.TTP_CATALOG.find((item) => item.ttpId === ttpId);
  }
}
