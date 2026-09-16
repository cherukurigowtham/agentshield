import functools
import json
import re
from typing import Dict, Any, List, Optional, Callable

class AgentShieldViolation(Exception):
    pass

class AgentShield:
    def __init__(self, on_violation: Optional[Callable[[str, Dict[str, Any]], None]] = None):
        self.on_violation = on_violation

    def evaluate(
        self,
        tool_name: str,
        params: Dict[str, Any],
        policy: Dict[str, Any]
    ) -> Dict[str, Any]:
        # 1. Allowed Tools
        allowed_tools = policy.get("allowedTools")
        if allowed_tools and tool_name not in allowed_tools:
            reason = f"Tool '{tool_name}' is not in allowed tools list."
            if self.on_violation:
                self.on_violation(reason, params)
            return {"allowed": False, "reason": reason}

        # 2. Forbidden Tools
        forbidden_tools = policy.get("forbiddenTools")
        if forbidden_tools and tool_name in forbidden_tools:
            reason = f"Tool '{tool_name}' is explicitly forbidden."
            if self.on_violation:
                self.on_violation(reason, params)
            return {"allowed": False, "reason": reason}

        # 3. Max Param Values
        max_params = policy.get("maxParamValues", {})
        for param_key, max_val in max_params.items():
            if param_key in params and isinstance(params[param_key], (int, float)):
                if params[param_key] > max_val:
                    reason = f"Parameter '{param_key}' value ({params[param_key]}) exceeds max allowed cap ({max_val})."
                    if self.on_violation:
                        self.on_violation(reason, params)
                    return {"allowed": False, "reason": reason}

        # 4. Forbidden Patterns (Prompt Injection & Destructive Payload)
        forbidden_patterns = policy.get("forbiddenPatterns", [])
        payload_str = json.dumps(params)
        for pattern in forbidden_patterns:
            if re.search(pattern, payload_str, re.IGNORECASE):
                reason = f"Tool payload matched forbidden pattern: '{pattern}'."
                if self.on_violation:
                    self.on_violation(reason, params)
                return {"allowed": False, "reason": reason}

        return {"allowed": True}

    def guard(self, tool_name: str, policy: Dict[str, Any]):
        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                eval_res = self.evaluate(tool_name, kwargs, policy)
                if not eval_res["allowed"]:
                    raise AgentShieldViolation(f"[AgentShield Blocked] {eval_res['reason']}")
                return func(*args, **kwargs)
            return wrapper
        return decorator
