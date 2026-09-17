import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;
let initialized = false;

export interface TelemetryConfig {
  serviceName: string;
  otlpEndpoint?: string;
  consoleExport?: boolean;
  sampleRate?: number;
}

export function initTelemetry(config: TelemetryConfig): NodeSDK {
  if (initialized && sdk) {
    return sdk;
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: '0.1.0',
  });

  const spanProcessors: any[] = [];
  
  if (config.otlpEndpoint) {
    spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter({
      url: `${config.otlpEndpoint}/v1/traces`,
    })));
  }
  
  if (config.consoleExport) {
    const { ConsoleSpanExporter } = require('@opentelemetry/sdk-trace-base');
    spanProcessors.push(new BatchSpanProcessor(new ConsoleSpanExporter()));
  }

  const metricReaders: any[] = [];
  
  if (config.otlpEndpoint) {
    metricReaders.push(new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: `${config.otlpEndpoint}/v1/metrics`,
      }),
      exportIntervalMillis: 60000,
    }));
  }
  
  if (config.consoleExport) {
    metricReaders.push(new PeriodicExportingMetricReader({
      exporter: new ConsoleMetricExporter(),
      exportIntervalMillis: 60000,
    }));
  }

  sdk = new NodeSDK({
    resource,
    spanProcessors: spanProcessors as any,
    metricReader: metricReaders[0] as any,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  initialized = true;
  
  console.log('📊 OpenTelemetry initialized for', config.serviceName);
  if (config.otlpEndpoint) {
    console.log('   Exporting to:', config.otlpEndpoint);
  }
  if (config.consoleExport) {
    console.log('   Console export enabled');
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await shutdownTelemetry();
    process.exit(0);
  });

  return sdk;
}

export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    initialized = false;
    sdk = null;
    console.log('📊 OpenTelemetry shutdown complete');
  }
}

export function getTracer() {
  return trace.getTracer('agentshield-gateway');
}

export function getMeter() {
  const { metrics } = require('@opentelemetry/api');
  return metrics.getMeter('agentshield-gateway');
}

// Custom span helpers for AgentShield operations
export async function withSpan<T>(
  name: string,
  fn: (span: any) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { kind, attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// Pre-built metrics
let httpRequestCounter: any;
let httpRequestDuration: any;
let guardEvaluationCounter: any;
let guardEvaluationDuration: any;
let activeSessionsGauge: any;

export function initMetrics() {
  const meter = getMeter();
  
  httpRequestCounter = meter.createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  });
  
  httpRequestDuration = meter.createHistogram('http_request_duration_seconds', {
    description: 'HTTP request duration in seconds',
    unit: 's',
  });
  
  guardEvaluationCounter = meter.createCounter('guard_evaluations_total', {
    description: 'Total number of guard evaluations',
  });
  
  guardEvaluationDuration = meter.createHistogram('guard_evaluation_duration_seconds', {
    description: 'Guard evaluation duration in seconds',
    unit: 's',
  });
  
  activeSessionsGauge = meter.createUpDownCounter('active_sessions', {
    description: 'Number of active sessions',
  });
}

export function recordHttpRequest(method: string, path: string, statusCode: number, durationMs: number) {
  if (!httpRequestCounter) initMetrics();
  
  httpRequestCounter.add(1, { method, path, status_code: statusCode.toString() });
  httpRequestDuration.record(durationMs / 1000, { method, path });
}

export function recordGuardEvaluation(allowed: boolean, durationMs: number, tenantId?: string) {
  if (!guardEvaluationCounter) initMetrics();
  
  guardEvaluationCounter.add(1, { 
    allowed: allowed.toString(),
    tenant_id: tenantId || 'unknown',
  });
  guardEvaluationDuration.record(durationMs / 1000, { allowed: allowed.toString() });
}

export function updateActiveSessions(delta: number) {
  if (!activeSessionsGauge) initMetrics();
  activeSessionsGauge.add(delta);
}

// Express/Fastify middleware for automatic HTTP instrumentation
export function createTelemetryMiddleware() {
  return async (request: any, reply: any, done: any) => {
    const startTime = Date.now();
    const method = request.method;
    const path = request.url.split('?')[0];
    
    reply.raw.on('finish', () => {
      const durationMs = Date.now() - startTime;
      const statusCode = reply.statusCode;
      recordHttpRequest(method, path, statusCode, durationMs);
    });
    
    done();
  };
}