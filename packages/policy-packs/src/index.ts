import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://agentshield.dev/schemas/guardrail-policy.json',
  title: 'AgentShield Guardrail Policy',
  type: 'object',
  properties: {
    $schema: { type: 'string', format: 'uri' },
    id: { type: 'string', pattern: '^[a-z0-9-]+$' },
    name: { type: 'string' },
    description: { type: 'string' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    allowedTools: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    },
    forbiddenTools: {
      type: 'array',
      items: { type: 'string' },
      uniqueItems: true,
    },
    maxParamValues: {
      type: 'object',
      additionalProperties: { type: 'number', minimum: 0 },
    },
    forbiddenPatterns: {
      type: 'array',
      items: { type: 'string' },
    },
    requiredFields: {
      type: 'array',
      items: { type: 'string' },
    },
    rateLimit: {
      type: 'object',
      properties: {
        maxCallsPerMinute: { type: 'integer', minimum: 1 },
      },
      required: ['maxCallsPerMinute'],
    },
    maxCostPerSession: { type: 'number', minimum: 0 },
    circuitBreaker: {
      type: 'object',
      properties: {
        maxRepeatedCalls: { type: 'integer', minimum: 1, default: 4 },
        timeWindowMs: { type: 'integer', minimum: 1000, default: 10000 },
      },
    },
    enableInjectionSanitizer: { type: 'boolean', default: true },
    timeoutMs: { type: 'integer', minimum: 100 },
    requireApproval: { type: 'boolean' },
  },
  additionalProperties: false,
  required: ['id', 'name', 'version'],
};

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

export function validatePolicy(policy: any): { valid: boolean; errors?: any[] } {
  const valid = validate(policy);
  return { valid: !!valid, errors: validate.errors ?? undefined };
}

export function loadPolicy(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

export function loadAllPolicies(policiesDir: string = path.join(__dirname, '../policies')): Map<string, any> {
  const policies = new Map<string, any>();
  
  if (!fs.existsSync(policiesDir)) {
    return policies;
  }

  const files = fs.readdirSync(policiesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const policy = loadPolicy(path.join(policiesDir, file));
    const { valid, errors } = validatePolicy(policy);
    
    if (!valid) {
      console.error(`❌ Invalid policy ${file}:`, errors);
      continue;
    }
    
    policies.set(policy.id, policy);
    console.log(`✅ Loaded policy: ${policy.name} (${policy.id})`);
  }
  
  return policies;
}

export { schema };