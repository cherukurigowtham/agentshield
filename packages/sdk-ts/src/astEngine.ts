export interface ASTNode {
  type: 'STRING' | 'IDENTIFIER' | 'OPERATOR' | 'CALL';
  value: string;
}

export class ASTSandboxEngine {
  /**
   * Lexically tokenizes input strings and inspects AST structures for concatenated or obfuscated exploit signatures.
   */
  static analyzeCodePayload(codeStr: string): { dangerous: boolean; reason?: string } {
    const tokens = this.tokenize(codeStr);
    
    // 1. Detect String Concatenation Attacks (e.g., "DRO" + "P TAB" + "LE")
    const concatenatedStr = this.deconcatenateStrings(tokens);
    if (/DROP\s+TABLE/i.test(concatenatedStr) || /DELETE\s+FROM/i.test(concatenatedStr) || /rm\s+-rf/i.test(concatenatedStr)) {
      return {
        dangerous: true,
        reason: `AST Tokenizer detected obfuscated concatenated command: '${concatenatedStr}'`,
      };
    }

    // 2. Detect Dynamic Function Execution Calls (eval, Function, exec, system)
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'IDENTIFIER' && ['eval', 'exec', 'system', 'passthru', 'popen', 'Function'].includes(token.value)) {
        if (i + 1 < tokens.length && tokens[i + 1].type === 'OPERATOR' && tokens[i + 1].value === '(') {
          return {
            dangerous: true,
            reason: `AST Node Call detected forbidden dynamic function invocation: '${token.value}()'`,
          };
        }
      }
    }

    return { dangerous: false };
  }

  private static tokenize(str: string): ASTNode[] {
    const tokens: ASTNode[] = [];
    let cursor = 0;

    while (cursor < str.length) {
      const char = str[cursor];

      if (/\s/.test(char)) {
        cursor++;
        continue;
      }

      if (char === '"' || char === "'") {
        const quote = char;
        let val = '';
        cursor++;
        while (cursor < str.length && str[cursor] !== quote) {
          val += str[cursor];
          cursor++;
        }
        cursor++;
        tokens.push({ type: 'STRING', value: val });
        continue;
      }

      if (/[+\-*/(),;]/.test(char)) {
        tokens.push({ type: 'OPERATOR', value: char });
        cursor++;
        continue;
      }

      if (/[a-zA-Z0-9_$]/.test(char)) {
        let val = '';
        while (cursor < str.length && /[a-zA-Z0-9_$]/.test(str[cursor])) {
          val += str[cursor];
          cursor++;
        }
        tokens.push({ type: 'IDENTIFIER', value: val });
        continue;
      }

      cursor++;
    }

    return tokens;
  }

  private static deconcatenateStrings(tokens: ASTNode[]): string {
    let result = '';
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type === 'STRING') {
        result += tokens[i].value;
      }
    }
    return result;
  }
}
