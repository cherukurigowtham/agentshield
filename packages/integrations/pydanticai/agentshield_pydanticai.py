"""
AgentShield integration for PydanticAI.

Provides decorators and middleware to wrap PydanticAI tools with AgentShield guardrails.
"""

from typing import Any, Callable, Dict, Optional
from functools import wraps
import inspect

from agentshield import AgentShield, AgentShieldViolation
from agentshield.main import GuardrailPolicy


def with_agentshield(
    tool_fn: Callable,
    policy: GuardrailPolicy,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    on_violation: Optional[Callable[[str, Dict[str, Any]], None]] = None,
) -> Callable:
    """
    Wrap a PydanticAI tool function with AgentShield guardrails.
    
    Usage:
        @with_agentshield(policy=my_policy, agent_id="my-agent")
        async def my_tool(param: str) -> str:
            return "result"
    """
    shield = AgentShield(on_violation=on_violation)
    tool_name = tool_fn.__name__

    if inspect.iscoroutinefunction(tool_fn):
        @wraps(tool_fn)
        async def async_wrapper(*args, **kwargs) -> Any:
            params = {**dict(zip(inspect.signature(tool_fn).parameters.keys(), args)), **kwargs}
            eval_res = shield.evaluate(tool_name, params, policy)
            if not eval_res["allowed"]:
                raise AgentShieldViolation(f"[AgentShield Blocked] {eval_res['reason']}")
            
            timeout_s = policy.get("timeoutSeconds")
            if timeout_s and timeout_s > 0:
                import asyncio
                try:
                    return await asyncio.wait_for(tool_fn(*args, **kwargs), timeout=timeout_s)
                except asyncio.TimeoutError:
                    raise AgentShieldViolation(f"[AgentShield Timeout] Tool execution timed out after {timeout_s}s")
            
            return await tool_fn(*args, **kwargs)
        return async_wrapper
    else:
        @wraps(tool_fn)
        def sync_wrapper(*args, **kwargs) -> Any:
            params = {**dict(zip(inspect.signature(tool_fn).parameters.keys(), args)), **kwargs}
            eval_res = shield.evaluate(tool_name, params, policy)
            if not eval_res["allowed"]:
                raise AgentShieldViolation(f"[AgentShield Blocked] {eval_res['reason']}")
            return tool_fn(*args, **kwargs)
        return sync_wrapper


def agentshield_tool(
    policy: GuardrailPolicy,
    agent_id: Optional[str] = None,
    session_id: Optional[str] = None,
    on_violation: Optional[Callable[[str, Dict[str, Any]], None]] = None,
):
    """
    Decorator to create an AgentShield-protected tool for PydanticAI.
    
    Usage:
        @agentshield_tool(policy=my_policy)
        async def transfer_funds(recipient: str, amount: float) -> str:
            return f"Sent ${amount} to {recipient}"
    """
    def decorator(tool_fn: Callable) -> Callable:
        return with_agentshield(tool_fn, policy, agent_id, session_id, on_violation)
    return decorator


class AgentShieldMiddleware:
    """
    Middleware class for PydanticAI agent to intercept all tool calls.
    """
    def __init__(
        self,
        policy: GuardrailPolicy,
        agent_id: Optional[str] = None,
        session_id: Optional[str] = None,
        on_violation: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ):
        self.shield = AgentShield(on_violation=on_violation)
        self.policy = policy
        self.agent_id = agent_id
        self.session_id = session_id

    async def intercept(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intercept and validate a tool call before execution.
        Returns the evaluation result.
        """
        eval_res = self.shield.evaluate(tool_name, params, self.policy)
        if not eval_res["allowed"]:
            raise AgentShieldViolation(f"[AgentShield Blocked] {eval_res['reason']}")
        return eval_res

    def wrap_tool(self, tool_fn: Callable) -> Callable:
        """Wrap a tool function with this middleware's policy."""
        return with_agentshield(tool_fn, self.policy, self.agent_id, self.session_id, self.shield.on_violation)


# Example usage
if __name__ == "__main__":
    import asyncio
    
    policy: GuardrailPolicy = {
        "allowedTools": ["transfer_funds", "check_balance"],
        "maxParamValues": {"amount": 1000},
        "forbiddenPatterns": ["DROP TABLE", "rm -rf", "IGNORE PREVIOUS INSTRUCTIONS"],
    }

    @agentshield_tool(policy=policy, agent_id="finance-agent")
    async def transfer_funds(recipient: str, amount: float) -> str:
        return f"Transferred ${amount} to {recipient}"

    @agentshield_tool(policy=policy, agent_id="finance-agent")
    async def check_balance(account_id: str) -> str:
        return f"Balance for {account_id}: $5000"

    async def test():
        # This should work
        result = await transfer_funds(recipient="Alice", amount=100)
        print(f"✅ {result}")

        # This should be blocked (over limit)
        try:
            await transfer_funds(recipient="Bob", amount=5000)
        except AgentShieldViolation as e:
            print(f"❌ Blocked: {e}")

        # This should be blocked (not allowed tool)
        try:
            @agentshield_tool(policy=policy)
            async def delete_database() -> str:
                return "Database deleted"
            await delete_database()
        except AgentShieldViolation as e:
            print(f"❌ Blocked: {e}")

    asyncio.run(test())