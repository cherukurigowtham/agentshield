package main

import (
	"context"
	"log"
	"net"
	"sync"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"

	agentshield "github.com/agentshield/sdk-go"
	pb "github.com/agentshield/gateway-grpc/gen/go"
)

type grpcServer struct {
	pb.UnimplementedAgentShieldServer
	shield      *agentshield.AgentShield
	policyStore map[string]agentshield.GuardrailPolicy
	mu          sync.RWMutex
}

func newGRPCServer() *grpcServer {
	return &grpcServer{
		shield:      agentshield.New(agentshield.AgentShieldConfig{}),
		policyStore: make(map[string]agentshield.GuardrailPolicy),
	}
}

func (s *grpcServer) Guard(ctx context.Context, req *pb.GuardRequest) (*pb.GuardResponse, error) {
	params, _ := structpb.NewStruct(req.Params.AsMap())
	policy := protoToPolicy(req.Policy)

	request := agentshield.ToolCallRequest{
		ToolName:      req.ToolName,
		Params:        params.AsMap(),
		AgentID:       req.AgentId,
		SessionID:     req.SessionId,
		EstimatedCost: req.EstimatedCost,
	}

	result := s.shield.Guard(request, policy)
	return evalToProto(result), nil
}

func (s *grpcServer) GuardBatch(ctx context.Context, req *pb.BatchGuardRequest) (*pb.BatchGuardResponse, error) {
	var results []*pb.GuardResponse
	for _, r := range req.Requests {
		params, _ := structpb.NewStruct(r.Params.AsMap())
		policy := protoToPolicy(r.Policy)

		request := agentshield.ToolCallRequest{
			ToolName:      r.ToolName,
			Params:        params.AsMap(),
			AgentID:       r.AgentId,
			SessionID:     r.SessionId,
			EstimatedCost: r.EstimatedCost,
		}

		result := s.shield.Guard(request, policy)
		results = append(results, evalToProto(result))
	}
	return &pb.BatchGuardResponse{Results: results}, nil
}

func (s *grpcServer) StorePolicy(ctx context.Context, req *pb.StorePolicyRequest) (*pb.StorePolicyResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.policyStore[req.Id] = protoToPolicy(req.Policy)
	return &pb.StorePolicyResponse{Id: req.Id, Stored: true}, nil
}

func (s *grpcServer) GetPolicy(ctx context.Context, req *pb.GetPolicyRequest) (*pb.GetPolicyResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	policy, ok := s.policyStore[req.Id]
	if !ok {
		return &pb.GetPolicyResponse{}, nil
	}
	return &pb.GetPolicyResponse{Policy: policyToProto(policy)}, nil
}

func (s *grpcServer) ListPolicies(ctx context.Context, req *pb.ListPoliciesRequest) (*pb.ListPoliciesResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var ids []string
	for id := range s.policyStore {
		ids = append(ids, id)
	}
	return &pb.ListPoliciesResponse{PolicyIds: ids}, nil
}

func (s *grpcServer) DeletePolicy(ctx context.Context, req *pb.DeletePolicyRequest) (*pb.DeletePolicyResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, ok := s.policyStore[req.Id]
	delete(s.policyStore, req.Id)
	return &pb.DeletePolicyResponse{Deleted: ok}, nil
}

func (s *grpcServer) GetSchema(ctx context.Context, req *pb.GetSchemaRequest) (*pb.GetSchemaResponse, error) {
	schema := `{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AgentShield Guardrail Policy",
  "type": "object",
  "properties": {
    "allowedTools": {"type": "array", "items": {"type": "string"}},
    "forbiddenTools": {"type": "array", "items": {"type": "string"}},
    "maxParamValues": {"type": "object", "additionalProperties": {"type": "number"}},
    "forbiddenPatterns": {"type": "array", "items": {"type": "string"}},
    "requiredFields": {"type": "array", "items": {"type": "string"}},
    "rateLimit": {"type": "object", "properties": {"maxCallsPerMinute": {"type": "integer"}}},
    "maxCostPerSession": {"type": "number"},
    "circuitBreaker": {"type": "object", "properties": {"maxRepeatedCalls": {"type": "integer"}, "timeWindowMs": {"type": "integer"}}},
    "enableInjectionSanitizer": {"type": "boolean"},
    "timeoutMs": {"type": "integer"},
    "requireApproval": {"type": "boolean"}
  }
}`
	return &pb.GetSchemaResponse{SchemaJson: schema}, nil
}

func (s *grpcServer) HealthCheck(ctx context.Context, req *pb.HealthCheckRequest) (*pb.HealthCheckResponse, error) {
	return &pb.HealthCheckResponse{Status: "ok", Version: "0.1.0"}, nil
}

func protoToPolicy(p *pb.Policy) agentshield.GuardrailPolicy {
	if p == nil {
		return agentshield.GuardrailPolicy{}
	}
	policy := agentshield.GuardrailPolicy{
		AllowedTools:             p.AllowedTools,
		ForbiddenTools:           p.ForbiddenTools,
		MaxParamValues:           p.MaxParamValues,
		ForbiddenPatterns:        p.ForbiddenPatterns,
		RequiredFields:           p.RequiredFields,
		MaxCostPerSession:        p.MaxCostPerSession,
		EnableInjectionSanitizer: p.EnableInjectionSanitizer,
		TimeoutMs:                int(p.TimeoutMs),
		RequireApproval:          p.RequireApproval,
		WebhookURL:               p.WebhookUrl,
	}
	if p.RateLimit != nil {
		policy.RateLimit = &agentshield.RateLimitConfig{MaxCallsPerMinute: int(p.RateLimit.MaxCallsPerMinute)}
	}
	if p.CircuitBreaker != nil {
		policy.CircuitBreaker = &agentshield.CircuitBreakerConfig{
			MaxRepeatedCalls: int(p.CircuitBreaker.MaxRepeatedCalls),
			TimeWindowMs:     int(p.CircuitBreaker.TimeWindowMs),
		}
	}
	return policy
}

func policyToProto(p agentshield.GuardrailPolicy) *pb.Policy {
	policy := &pb.Policy{
		AllowedTools:             p.AllowedTools,
		ForbiddenTools:           p.ForbiddenTools,
		MaxParamValues:           p.MaxParamValues,
		ForbiddenPatterns:        p.ForbiddenPatterns,
		RequiredFields:           p.RequiredFields,
		MaxCostPerSession:        p.MaxCostPerSession,
		EnableInjectionSanitizer: p.EnableInjectionSanitizer,
		TimeoutMs:                int32(p.TimeoutMs),
		RequireApproval:          p.RequireApproval,
		WebhookUrl:               p.WebhookURL,
	}
	if p.RateLimit != nil {
		policy.RateLimit = &pb.RateLimit{MaxCallsPerMinute: int32(p.RateLimit.MaxCallsPerMinute)}
	}
	if p.CircuitBreaker != nil {
		policy.CircuitBreaker = &pb.CircuitBreaker{
			MaxRepeatedCalls: int32(p.CircuitBreaker.MaxRepeatedCalls),
			TimeWindowMs:     int32(p.CircuitBreaker.TimeWindowMs),
		}
	}
	return policy
}

func evalToProto(result agentshield.EvaluationResult) *pb.GuardResponse {
	resp := &pb.GuardResponse{
		Allowed:     result.Allowed,
		Reason:      result.Reason,
		Timestamp:   result.Timestamp,
		ActionTaken: actionToProto(result.ActionTaken),
	}
	if result.Remediation != nil {
		resp.Remediation = &pb.Remediation{
			Status:           result.Remediation.Status,
			SuggestedFix:     result.Remediation.SuggestedFix,
			MaxAllowedValue:  result.Remediation.MaxAllowedValue,
		}
	}
	return resp
}

func actionToProto(a agentshield.ActionTaken) pb.ActionTaken {
	switch a {
	case agentshield.ActionAllow:
		return pb.ActionTaken_ALLOW
	case agentshield.ActionBlock:
		return pb.ActionTaken_BLOCK
	case agentshield.ActionRequireApproval:
		return pb.ActionTaken_REQUIRE_APPROVAL
	case agentshield.ActionCircuitTripped:
		return pb.ActionTaken_CIRCUIT_TRIPPED
	default:
		return pb.ActionTaken_ACTION_TAKEN_UNSPECIFIED
	}
}

func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcSrv := grpc.NewServer()
	pb.RegisterAgentShieldServer(grpcSrv, newGRPCServer())

	log.Println("🛡️ AgentShield gRPC Gateway running on :50051")
	if err := grpcSrv.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}