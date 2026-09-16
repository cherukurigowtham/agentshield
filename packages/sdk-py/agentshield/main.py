import functools
import json
import re
import asyncio
import time
import base64
import hashlib
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional, Callable

class AgentShieldViolation(Exception):
    pass

class AgentShieldTimeout(Exception):
    pass

class CircuitBreaker:
    def __init__(self):
        self.call_tracker: Dict[str, List[Dict[str, Any]]] = {}
        self.tripped_breakers: Dict[str, float] = {}

    def check(self, session_key: str, tool_name: str, params: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        max_calls = config.get("maxRepeatedCalls", 4)
        window_s = config.get("timeWindowSeconds", 10)
        now = time.time()

        reset_time = self.tripped_breakers.get(session_key)
        if reset_time and now < reset_time:
            remaining_sec = int(reset_time - now)
            return {
                "tripped": True,
                "reason": f"Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next {remaining_sec}s."
            }

        tracker_key = f"{session_key}:{tool_name}"
        params_hash = json.dumps(params, sort_keys=True)

        history = [item for item in self.call_tracker.get(tracker_key, []) if now - item["timestamp"] < window_s]
        repeated_count = sum(1 for item in history if item["params_hash"] == params_hash)

        if repeated_count >= max_calls:
            self.tripped_breakers[session_key] = now + 30.0
            return {
                "tripped": True,
                "reason": f"Circuit Breaker TRIPPED: Tool '{tool_name}' called {repeated_count + 1} times with identical parameters within {window_s}s loop."
            }

        history.append({"params_hash": params_hash, "timestamp": now})
        self.call_tracker[tracker_key] = history
        return {"tripped": False}

class InjectionSanitizer:
    INDIRECT_PATTERNS = [
        r"\[SYSTEM\s*OVERRIDE\]",
        r"IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS",
        r"DISREGARD\s+PRIOR\s+RULES",
        r"YOU\s+ARE\s+NOW\s+IN\s+DAN\s+MODE",
        r"NEW\s+SYSTEM\s+PROMPT:",
        r"ADMIN_OVERRIDE_KEY",
    ]

    DESTRUCTIVE_PATTERNS = [
        r"DROP\s+TABLE",
        r"DELETE\s+FROM\s+[a-z_]+",
        r"TRUNCATE\s+TABLE",
        r"rm\s+-rf\s+",
        r"chmod\s+777",
    ]

    @classmethod
    def inspect(cls, payload_str: str) -> Dict[str, Any]:
        normalized = re.sub(r"\\t|\\n|\\r", " ", payload_str)

        # Zero-width unicode scan
        if re.search(r"[\u200B-\u200D\uFEFF]", normalized):
            return {"detected": True, "type": "ZERO_WIDTH_UNICODE", "pattern": "Zero-width unicode detected"}

        for pattern in cls.INDIRECT_PATTERNS:
            if re.search(pattern, normalized, re.IGNORECASE):
                return {"detected": True, "type": "INDIRECT_PROMPT_INJECTION", "pattern": pattern}

        for pattern in cls.DESTRUCTIVE_PATTERNS:
            if re.search(pattern, normalized, re.IGNORECASE):
                return {"detected": True, "type": "DESTRUCTIVE_PATTERN", "pattern": pattern}

        # Base64 obfuscation scan
        b64_matches = re.findall(r"([A-Za-z0-9+/]{8,}={0,2})", normalized)
        for match in b64_matches:
            try:
                decoded = base64.b64decode(match).decode('utf-8', errors='ignore')
                for pattern in cls.INDIRECT_PATTERNS + cls.DESTRUCTIVE_PATTERNS:
                    if re.search(pattern, decoded, re.IGNORECASE):
                        return {"detected": True, "type": "OBFUSCATED_PAYLOAD", "pattern": f"Base64 Decoded: {pattern}"}
            except Exception:
                pass

        return {"detected": False}

class AuditExporter:
    def __init__(self):
        self.last_hash = "GENESIS_HASH_00000000000000000000000000000000"
        self.records: List[Dict[str, Any]] = []

    def create_record(self, request: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
        record_id = f"rec_{int(time.time() * 1000)}"
        timestamp = result.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ"))

        params_copy = dict(request.get("params", {}))
        if "password" in params_copy: params_copy["password"] = "***MASKED***"
        if "apiKey" in params_copy: params_copy["apiKey"] = "***MASKED***"

        payload = json.dumps({
            "recordId": record_id,
            "previousHash": self.last_hash,
            "timestamp": timestamp,
            "agentId": request.get("agentId", "default-agent"),
            "toolName": request.get("toolName"),
            "actionTaken": result.get("actionTaken", "ALLOW"),
            "paramsSanitized": params_copy,
            "reason": result.get("reason"),
        }, sort_keys=True)

        current_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()

        record = {
            "recordId": record_id,
            "previousHash": self.last_hash,
            "hash": current_hash,
            "timestamp": timestamp,
            "agentId": request.get("agentId", "default-agent"),
            "toolName": request.get("toolName"),
            "actionTaken": result.get("actionTaken", "ALLOW"),
            "paramsSanitized": params_copy,
            "reason": result.get("reason"),
        }

        self.last_hash = current_hash
        self.records.append(record)
        return record

    def export_soc2_log(self) -> str:
        return json.dumps({
            "version": "AgentShield-Audit-v1",
            "totalRecords": len(self.records),
            "genesisHash": "GENESIS_HASH_00000000000000000000000000000000",
            "finalHash": self.last_hash,
            "auditChain": self.records,
        }, indent=2)

class AgentShield:
    def __init__(
        self,
        api_key: Optional[str] = None,
        telemetry_url: Optional[str] = None,
        webhook_url: Optional[str] = None,
        on_violation: Optional[Callable[[str, Dict[str, Any]], None]] = None
    ):
        self.api_key = api_key
        self.telemetry_url = telemetry_url
        self.webhook_url = webhook_url
        self.on_violation = on_violation
        self.circuit_breaker = CircuitBreaker()
        self.audit_exporter = AuditExporter()

    def evaluate(
        self,
        tool_name: str,
        params: Dict[str, Any],
        policy: Dict[str, Any],
        session_id: Optional[str] = None,
        agent_id: Optional[str] = None
    ) -> Dict[str, Any]:
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ")
        session_key = session_id or agent_id or "default-session"

        # 1. Circuit Breaker Loop Protection
        if "circuitBreaker" in policy:
            cb_res = self.circuit_breaker.check(session_key, tool_name, params, policy["circuitBreaker"])
            if cb_res["tripped"]:
                res = {"allowed": False, "actionTaken": "CIRCUIT_TRIPPED", "reason": cb_res["reason"], "timestamp": timestamp}
                self._handle_violation_and_telemetry(tool_name, params, res, policy)
                return res

        # 2. Indirect Prompt Injection & Zero-Width Unicode Scan
        if policy.get("enableInjectionSanitizer", True):
            inj_res = InjectionSanitizer.inspect(json.dumps(params))
            if inj_res["detected"]:
                reason = f"Security Threat: {inj_res['type']} ({inj_res['pattern']})"
                res = {"allowed": False, "actionTaken": "BLOCK", "reason": reason, "timestamp": timestamp}
                self._handle_violation_and_telemetry(tool_name, params, res, policy)
                return res

        # 3. Allowed Tools
        allowed_tools = policy.get("allowedTools")
        if allowed_tools and tool_name not in allowed_tools:
            reason = f"Tool '{tool_name}' is not in allowed tools list."
            res = {"allowed": False, "actionTaken": "BLOCK", "reason": reason, "timestamp": timestamp}
            self._handle_violation_and_telemetry(tool_name, params, res, policy)
            return res

        # 4. Forbidden Tools
        forbidden_tools = policy.get("forbiddenTools")
        if forbidden_tools and tool_name in forbidden_tools:
            reason = f"Tool '{tool_name}' is explicitly forbidden."
            res = {"allowed": False, "actionTaken": "BLOCK", "reason": reason, "timestamp": timestamp}
            self._handle_violation_and_telemetry(tool_name, params, res, policy)
            return res

        # 5. Max Param Values
        max_params = policy.get("maxParamValues", {})
        for param_key, max_val in max_params.items():
            if param_key in params and isinstance(params[param_key], (int, float)):
                if params[param_key] > max_val:
                    reason = f"Parameter '{param_key}' value ({params[param_key]}) exceeds max allowed cap ({max_val})."
                    res = {
                        "allowed": False,
                        "actionTaken": "BLOCK",
                        "reason": reason,
                        "remediation": {"suggestedFix": f"Reduce '{param_key}' parameter to <= {max_val}."},
                        "timestamp": timestamp
                    }
                    self._handle_violation_and_telemetry(tool_name, params, res, policy)
                    return res

        # 6. Forbidden Patterns
        forbidden_patterns = policy.get("forbiddenPatterns", [])
        payload_str = json.dumps(params)
        for pattern in forbidden_patterns:
            if re.search(pattern, payload_str, re.IGNORECASE):
                reason = f"Tool payload matched forbidden pattern: '{pattern}'."
                res = {"allowed": False, "actionTaken": "BLOCK", "reason": reason, "timestamp": timestamp}
                self._handle_violation_and_telemetry(tool_name, params, res, policy)
                return res

        res = {"allowed": True, "actionTaken": "ALLOW", "timestamp": timestamp}
        self.audit_exporter.create_record({"toolName": tool_name, "params": params, "agentId": agent_id}, res)
        return res

    def _handle_violation_and_telemetry(self, tool_name: str, params: Dict[str, Any], res: Dict[str, Any], policy: Dict[str, Any]):
        self.audit_exporter.create_record({"toolName": tool_name, "params": params}, res)
        if self.on_violation:
            self.on_violation(res["reason"], params)
        
        wb_url = policy.get("webhookUrl") or self.webhook_url
        if wb_url:
            self._dispatch_webhook(wb_url, tool_name, params, res)

    def _dispatch_webhook(self, url: str, tool_name: str, params: Dict[str, Any], res: Dict[str, Any]):
        try:
            data = json.dumps({"event": "AGENTSHIELD_VIOLATION_BLOCKED", "toolName": tool_name, "reason": res.get("reason"), "params": params}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            urllib.request.urlopen(req, timeout=2.0)
        except Exception:
            pass

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

    def aguard(self, tool_name: str, policy: Dict[str, Any]):
        def decorator(func):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                eval_res = self.evaluate(tool_name, kwargs, policy)
                if not eval_res["allowed"]:
                    raise AgentShieldViolation(f"[AgentShield Blocked] {eval_res['reason']}")
                
                timeout_s = policy.get("timeoutSeconds")
                if timeout_s and timeout_s > 0:
                    try:
                        return await asyncio.wait_for(func(*args, **kwargs), timeout=timeout_s)
                    except asyncio.TimeoutError:
                        raise AgentShieldTimeout(f"[AgentShield Timeout] Async tool execution timed out after {timeout_s}s.")
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator
