from agentshield import AgentShield, AgentShieldViolation

def test_python_guardrail():
    shield = AgentShield()
    policy = {
        "allowedTools": ["transfer_funds"],
        "maxParamValues": {"amount": 500},
        "forbiddenPatterns": ["DROP TABLE"]
    }

    @shield.guard(tool_name="transfer_funds", policy=policy)
    def transfer_funds(recipient: str, amount: float):
        return f"Sent ${amount} to {recipient}"

    # Valid call
    res = transfer_funds(recipient="Alice", amount=100)
    assert res == "Sent $100 to Alice"

    # Excessive transfer call
    try:
        transfer_funds(recipient="Bob", amount=2000)
        assert False, "Should have been blocked"
    except AgentShieldViolation as e:
        assert "exceeds max allowed cap" in str(e)

    print("✅ All Python SDK tests passed successfully!")

if __name__ == "__main__":
    test_python_guardrail()
