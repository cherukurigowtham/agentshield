export interface InjectionSanitizeResult {
  detected: boolean;
  type?: 'INDIRECT_PROMPT_INJECTION' | 'ZERO_WIDTH_UNICODE' | 'OBFUSCATED_PAYLOAD' | 'DESTRUCTIVE_PATTERN';
  patternMatched?: string;
}

export class InjectionSanitizer {
  private static INDIRECT_INJECTION_PATTERNS = [
    /\[SYSTEM\s*OVERRIDE\]/i,
    /IGNORE\s+(ALL\s+)?PREVIOUS\s+(INSTRUCTIONS|GOALS|RULES)/i,
    /DISREGARD\s+PRIOR\s+(RULES|GOALS|INSTRUCTIONS)/i,
    /YOU\s+ARE\s+NOW\s+IN\s+DAN\s+MODE/i,
    /UNRESTRICTED\s+(MODE|PROMPT)/i,
    /NEW\s+SYSTEM\s+PROMPT:/i,
    /ADMIN_OVERRIDE_KEY/i,
  ];

  private static DESTRUCTIVE_PATTERNS = [
    /DROP(?:\/\*[\s\S]*?\*\/|\s)+TABLE/i,
    /DELETE(?:\/\*[\s\S]*?\*\/|\s)+FROM(?:\/\*[\s\S]*?\*\/|\s)+[a-z_]+/i,
    /TRUNCATE(?:\/\*[\s\S]*?\*\/|\s)+TABLE/i,
    /UNION(?:\/\*[\s\S]*?\*\/|\s)+SELECT/i,
    /INFORMATION_SCHEMA/i,
    /rm\s+-rf\s+/i,
    /chmod\s+777/i,
    /mkfs\./i,
  ];

  static inspect(payloadStr: string): InjectionSanitizeResult {
    let unescapedPayload = payloadStr;
    
    // 0. URL-Decode payload if encoded (%5BSYSTEM%20OVERRIDE%5D)
    try {
      if (unescapedPayload.includes('%')) {
        unescapedPayload = decodeURIComponent(unescapedPayload);
      }
    } catch {
      // Ignore if malformed URI component
    }

    // 0b. Unicode NFKC Normalization (converts full-width ＤＡＮ ＭＯＤＥ to DAN MODE)
    const normalizedPayload = unescapedPayload
      .normalize('NFKC')
      .replace(/\\t|\\n|\\r/g, ' ');

    // 1. Check Zero-Width Unicode Characters (used to hide injections)
    const zeroWidthRegex = /[\u200B-\u200D\uFEFF]/;
    if (zeroWidthRegex.test(normalizedPayload)) {
      return {
        detected: true,
        type: 'ZERO_WIDTH_UNICODE',
        patternMatched: 'Hidden Zero-Width Unicode Characters Detected',
      };
    }

    // 2. Check Indirect Prompt Injection Patterns
    for (const pattern of this.INDIRECT_INJECTION_PATTERNS) {
      if (pattern.test(normalizedPayload)) {
        return {
          detected: true,
          type: 'INDIRECT_PROMPT_INJECTION',
          patternMatched: pattern.source,
        };
      }
    }

    // 3. Check Destructive Patterns
    for (const pattern of this.DESTRUCTIVE_PATTERNS) {
      if (pattern.test(normalizedPayload)) {
        return {
          detected: true,
          type: 'DESTRUCTIVE_PATTERN',
          patternMatched: pattern.source,
        };
      }
    }

    // 4. Base64 Obfuscation Inspection
    const base64Regex = /([A-Za-z0-9+/]{8,}={0,2})/g;
    let match;
    while ((match = base64Regex.exec(normalizedPayload)) !== null) {
      try {
        const decoded = Buffer.from(match[1], 'base64').toString('utf-8').normalize('NFKC');
        for (const pattern of [...this.INDIRECT_INJECTION_PATTERNS, ...this.DESTRUCTIVE_PATTERNS]) {
          if (pattern.test(decoded)) {
            return {
              detected: true,
              type: 'OBFUSCATED_PAYLOAD',
              patternMatched: `Base64 Decoded: ${pattern.source}`,
            };
          }
        }
      } catch {
        // Ignored if not valid Base64
      }
    }

    return { detected: false };
  }
}
