import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

// Helper to issue HTTP requests
function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode || 500, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode || 500, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

test('Multi-Tenant API Gateway: API Key Provisioning & Account Isolation', async () => {
  // Step 1: Provision Key for User A (Acme Corp)
  const keyARes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/v1/auth/keys',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Acme Corp Production Key', plan: 'pro' });

  assert.equal(keyARes.statusCode, 200);
  assert.equal(keyARes.body.plan, 'pro');
  const apiKeyA = keyARes.body.apiKey;
  const tenantIdA = keyARes.body.tenantId;

  // Step 2: Provision Key for User B (Beta Startups)
  const keyBRes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/v1/auth/keys',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { name: 'Beta Startups Dev Key', plan: 'free' });

  assert.equal(keyBRes.statusCode, 200);
  const apiKeyB = keyBRes.body.apiKey;
  const tenantIdB = keyBRes.body.tenantId;

  assert.notEqual(tenantIdA, tenantIdB, 'Tenants must have isolated IDs');

  // Step 3: User A stores a policy under ID "financial-policy"
  const storeARes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/v1/policies',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKeyA }
  }, { id: 'financial-policy', policy: { maxParamValues: { amount: 500 } } });

  assert.equal(storeARes.statusCode, 200);
  assert.equal(storeARes.body.tenantId, tenantIdA);

  // Step 4: User B attempts to read User A's policy under ID "financial-policy" -> Must be 404 NOT FOUND
  const readBRes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/v1/policies/financial-policy',
    method: 'GET',
    headers: { 'x-api-key': apiKeyB }
  });

  assert.equal(readBRes.statusCode, 404, 'User B must not be able to access User A isolated policies');

  // Step 5: Check Usage Metrics for User A
  const usageARes = await makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: '/v1/auth/usage',
    method: 'GET',
    headers: { 'x-api-key': apiKeyA }
  });

  assert.equal(usageARes.statusCode, 200);
  assert.equal(usageARes.body.tenantId, tenantIdA);
  assert.equal(usageARes.body.plan, 'pro');
  assert.equal(usageARes.body.monthlyQuota, 1000000);
});
