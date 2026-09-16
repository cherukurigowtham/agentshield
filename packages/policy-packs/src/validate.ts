import { validatePolicy, loadAllPolicies, schema } from './index.js';
import * as fs from 'fs';
import * as path from 'path';

const policies = loadAllPolicies();

console.log(`\n📋 Loaded ${policies.size} policy pack(s)\n`);

for (const [id, policy] of policies) {
  const { valid, errors } = validatePolicy(policy);
  console.log(`${valid ? '✅' : '❌'} ${policy.name} (${id}) v${policy.version}`);
  if (!valid) {
    console.log('   Errors:', errors);
  }
}

const schemaOutput = JSON.stringify(schema, null, 2);
const outputPath = path.join(__dirname, 'guardrail-policy.schema.json');
fs.writeFileSync(outputPath, schemaOutput);
console.log(`\n📄 Schema written to ${outputPath}`);