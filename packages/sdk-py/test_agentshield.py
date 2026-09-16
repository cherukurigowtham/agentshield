import asyncio
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

    # Async Guardrail Test
    async def run_async_test():
        @shield.aguard(tool_name="transfer_funds", policy=policy)
        async def async_transfer(recipient: str, amount: float):
            await asyncio.sleep(0.01)
            return f"Async Sent ${amount} to {recipient}"

        async_res = await async_transfer(recipient="Charlie", amount=250)
        assert async_res == "Async Sent $250 to Charlie"

    asyncio.run(run_async_test())

    print("✅ All Sync & Async Python SDK tests passed successfully!")

if __name__ == "__main__":
    test_python_guardrail()
