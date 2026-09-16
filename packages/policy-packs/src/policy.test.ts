import test from 'node:test';
import assert from 'node:assert/strict';
import * as path from 'path';
import { loadAllPolicies, validatePolicy } from './index.js';
import { AgentShield, EvaluationResult } from '@agentshield/sdk';

test('Policy Packs - Load and Validate JSON Policy Packs', () => {
  const policiesDir = path.join(__dirname, '../policies');
  const policies = loadAllPolicies(policiesDir);

  assert.equal(policies.size >= 5, true, 'Should load 5 enterprise policy packs');
  assert.equal(policies.has('hipaa-v1'), true);
  assert.equal(policies.has('pci-dss-v1'), true);
  assert.equal(policies.has('no-crypto-v1'), true);
  assert.equal(policies.has('devops-infrastructure-v1'), true);
  assert.equal(policies.has('financial-banking-v1'), true);
});


test('Policy Packs - Evaluate HIPAA Policy against AgentShield SDK', () => {
  const policiesDir = path.join(__dirname, '../policies');
  const policies = loadAllPolicies(policiesDir);
  const hipaaPolicy = policies.get('hipaa-v1');


  const shield = new AgentShield();

  // Test violating parameter or forbidden pattern in HIPAA context
  if (hipaaPolicy.forbiddenPatterns && hipaaPolicy.forbiddenPatterns.length > 0) {
    const attackCall: EvaluationResult = shield.guard(
      {
        toolName: 'query_patient_records',
        params: { query: 'SELECT * FROM patients; DROP TABLE patients;' },
      },
      hipaaPolicy
    );

    assert.equal(attackCall.allowed, false);
  }
});
