package main

import (
	"context"
	"log"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/types/known/structpb"

	pb "github.com/agentshield/gateway-grpc/gen/go"
)

func main() {
	conn, err := grpc.Dial("localhost:50051", grpc.WithInsecure())
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	client := pb.NewAgentShieldClient(conn)

	params, _ := structpb.NewStruct(map[string]interface{}{
		"amount":    5000.0,
		"recipient": "Alice",
	})

	policy := &pb.Policy{
		MaxParamValues: map[string]float64{"amount": 1000},
	}

	req := &pb.GuardRequest{
		ToolName: "transfer_funds",
		Params:   params,
		Policy:   policy,
	}

	resp, err := client.Guard(context.Background(), req)
	if err != nil {
		log.Fatalf("Guard failed: %v", err)
	}

	log.Printf("Response: allowed=%v, reason=%s, action=%s", resp.Allowed, resp.Reason, resp.ActionTaken)
}