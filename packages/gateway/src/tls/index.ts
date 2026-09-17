import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSecureContext } from 'node:tls';

export interface TLSConfig {
  enabled: boolean;
  certPath?: string;
  keyPath?: string;
  caPath?: string;
  requestCert?: boolean;
  rejectUnauthorized?: boolean;
}

export interface TLSOptions {
  cert: string;
  key: string;
  ca?: string;
  requestCert: boolean;
  rejectUnauthorized: boolean;
}

export function loadTLSConfig(): TLSConfig {
  const enabled = process.env.TLS_ENABLED === 'true';
  
  if (!enabled) {
    return { enabled: false };
  }

  const certPath = process.env.TLS_CERT_PATH || join(process.cwd(), 'certs', 'server.crt');
  const keyPath = process.env.TLS_KEY_PATH || join(process.cwd(), 'certs', 'server.key');
  const caPath = process.env.TLS_CA_PATH || join(process.cwd(), 'certs', 'ca.crt');
  const requestCert = process.env.TLS_REQUEST_CERT === 'true';
  const rejectUnauthorized = process.env.TLS_REJECT_UNAUTHORIZED !== 'false';

  return {
    enabled: true,
    certPath,
    keyPath,
    caPath,
    requestCert,
    rejectUnauthorized,
  };
}

export function createTLSOptions(config: TLSConfig): TLSOptions | null {
  if (!config.enabled) {
    return null;
  }

  if (!config.certPath || !config.keyPath) {
    throw new Error('TLS enabled but TLS_CERT_PATH and TLS_KEY_PATH must be set');
  }

  if (!existsSync(config.certPath)) {
    throw new Error(`TLS certificate not found at ${config.certPath}`);
  }

  if (!existsSync(config.keyPath)) {
    throw new Error(`TLS key not found at ${config.keyPath}`);
  }

  const cert = readFileSync(config.certPath, 'utf-8');
  const key = readFileSync(config.keyPath, 'utf-8');

  const options: TLSOptions = {
    cert,
    key,
    requestCert: config.requestCert || false,
    rejectUnauthorized: config.rejectUnauthorized !== false,
  };

  if (config.caPath && existsSync(config.caPath)) {
    options.ca = readFileSync(config.caPath, 'utf-8');
  }

  return options;
}

export function createSecureContextFromConfig(config: TLSConfig) {
  const options = createTLSOptions(config);
  if (!options) return null;
  
  return createSecureContext({
    cert: options.cert,
    key: options.key,
    ca: options.ca,
  });
}

export function generateSelfSignedCert(outputDir: string = 'certs'): { certPath: string; keyPath: string } {
  const { execSync } = require('child_process');
  const { mkdirSync } = require('fs');
  
  mkdirSync(outputDir, { recursive: true });
  
  const certPath = join(outputDir, 'server.crt');
  const keyPath = join(outputDir, 'server.key');
  
  // Generate self-signed certificate
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -keyout ${keyPath} -out ${certPath} ` +
    `-days 365 -subj "/CN=localhost/O=AgentShield/OU=Gateway" ` +
    `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
    { stdio: 'inherit' }
  );
  
  return { certPath, keyPath };
}

export function generateCA(outputDir: string = 'certs'): { caPath: string; caKeyPath: string } {
  const { execSync } = require('child_process');
  const { mkdirSync } = require('fs');
  
  mkdirSync(outputDir, { recursive: true });
  
  const caPath = join(outputDir, 'ca.crt');
  const caKeyPath = join(outputDir, 'ca.key');
  
  execSync(
    `openssl req -x509 -newkey rsa:4096 -nodes -keyout ${caKeyPath} -out ${caPath} ` +
    `-days 730 -subj "/CN=AgentShield CA/O=AgentShield/OU=Certificate Authority"`,
    { stdio: 'inherit' }
  );
  
  return { caPath, caKeyPath };
}

export function generateClientCert(
  caPath: string, 
  caKeyPath: string, 
  outputDir: string = 'certs',
  commonName: string = 'client'
): { certPath: string; keyPath: string } {
  const { execSync } = require('child_process');
  const { mkdirSync } = require('fs');
  
  mkdirSync(outputDir, { recursive: true });
  
  const certPath = join(outputDir, `${commonName}.crt`);
  const keyPath = join(outputDir, `${commonName}.key`);
  const csrPath = join(outputDir, `${commonName}.csr`);
  
  // Generate client key
  execSync(`openssl genrsa -out ${keyPath} 2048`);
  
  // Generate CSR
  execSync(
    `openssl req -new -key ${keyPath} -out ${csrPath} ` +
    `-subj "/CN=${commonName}/O=AgentShield/OU=Client"`
  );
  
  // Sign with CA
  execSync(
    `openssl x509 -req -in ${csrPath} -CA ${caPath} -CAkey ${caKeyPath} ` +
    `-CAcreateserial -out ${certPath} -days 365 -sha256`
  );
  
  return { certPath, keyPath };
}