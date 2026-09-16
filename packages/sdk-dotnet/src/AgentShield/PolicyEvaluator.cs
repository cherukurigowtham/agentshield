using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AgentShield;

public class PolicyEvaluator
{
    private readonly ConcurrentDictionary<string, List<long>> _callHistory = new();
    private readonly ConcurrentDictionary<string, double> _sessionCosts = new();
    private readonly CircuitBreaker _circuitBreaker = new();

    public EvaluationResult Evaluate(ToolCallRequest request, GuardrailPolicy policy)
    {
        string timestamp = DateTime.UtcNow.ToString("O");
        string sessionKey = request.SessionId ?? request.AgentId ?? "default-session";

        if (policy.CircuitBreaker != null)
        {
            var cbCheck = _circuitBreaker.Check(sessionKey, request.ToolName, request.Params, policy.CircuitBreaker);
            if (cbCheck.Tripped)
            {
                return new EvaluationResult
                {
                    Allowed = false,
                    Reason = cbCheck.Reason,
                    ActionTaken = ActionTaken.CIRCUIT_TRIPPED,
                    Timestamp = timestamp,
                    Remediation = new Remediation
                    {
                        Status = "BLOCKED",
                        SuggestedFix = "Agent in retry loop. Abort current tool sequence and ask human for clarification."
                    }
                };
            }
        }

        if (policy.EnableInjectionSanitizer != false)
        {
            string payloadStr = JsonSerializer.Serialize(request.Params);
            var sanitizeRes = InjectionSanitizer.Inspect(payloadStr);
            if (sanitizeRes.Detected)
            {
                return new EvaluationResult
                {
                    Allowed = false,
                    Reason = $"Security Threat Detected: {sanitizeRes.Type} ({sanitizeRes.PatternMatched}).",
                    ActionTaken = ActionTaken.BLOCK,
                    Timestamp = timestamp,
                    Remediation = new Remediation
                    {
                        Status = "BLOCKED",
                        SuggestedFix = "Sanitize input payload to remove prompt overrides or hidden unicode characters."
                    }
                };
            }
        }

        if (policy.AllowedTools?.Count > 0 && !policy.AllowedTools.Contains(request.ToolName))
        {
            return new EvaluationResult
            {
                Allowed = false,
                Reason = $"Tool '{request.ToolName}' is not in the allowed tools list.",
                ActionTaken = ActionTaken.BLOCK,
                Timestamp = timestamp,
                Remediation = new Remediation
                {
                    Status = "BLOCKED",
                    SuggestedFix = $"Tool '{request.ToolName}' is not authorized. Permitted tools: {string.Join(", ", policy.AllowedTools)}."
                }
            };
        }

        if (policy.ForbiddenTools?.Contains(request.ToolName) == true)
        {
            return new EvaluationResult
            {
                Allowed = false,
                Reason = $"Tool '{request.ToolName}' is explicitly forbidden by policy.",
                ActionTaken = ActionTaken.BLOCK,
                Timestamp = timestamp,
                Remediation = new Remediation
                {
                    Status = "BLOCKED",
                    SuggestedFix = $"Tool '{request.ToolName}' is prohibited in production environment."
                }
            };
        }

        if (policy.RequiredFields != null)
        {
            foreach (var field in policy.RequiredFields)
            {
                if (!request.Params.ContainsKey(field) || request.Params[field] == null)
                {
                    return new EvaluationResult
                    {
                        Allowed = false,
                        Reason = $"Missing required parameter field '{field}'.",
                        ActionTaken = ActionTaken.BLOCK,
                        Timestamp = timestamp,
                        Remediation = new Remediation
                        {
                            Status = "REQUIRES_REMEDIATION",
                            SuggestedFix = $"Provide required parameter '{field}' before invoking tool '{request.ToolName}'."
                        }
                    };
                }
            }
        }

        if (policy.RateLimit?.MaxCallsPerMinute > 0)
        {
            long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            long oneMinuteAgo = now - 60000;

            var timestamps = _callHistory.GetOrAdd(sessionKey, _ => new List<long>());
            lock (timestamps)
            {
                var recent = timestamps.Where(t => t > oneMinuteAgo).ToList();
                if (recent.Count >= policy.RateLimit.MaxCallsPerMinute)
                {
                    return new EvaluationResult
                    {
                        Allowed = false,
                        Reason = $"Rate limit exceeded: Max {policy.RateLimit.MaxCallsPerMinute} calls/min allowed.",
                        ActionTaken = ActionTaken.BLOCK,
                        Timestamp = timestamp,
                        Remediation = new Remediation
                        {
                            Status = "BLOCKED",
                            SuggestedFix = $"Wait 60 seconds before issuing further tool calls for session '{sessionKey}'."
                        }
                    };
                }
                recent.Add(now);
                timestamps.Clear();
                timestamps.AddRange(recent);
            }
        }

        if (policy.MaxCostPerSession.HasValue && request.EstimatedCost.HasValue)
        {
            double currentCost = _sessionCosts.GetOrAdd(sessionKey, 0);
            double newCost = currentCost + request.EstimatedCost.Value;

            if (newCost > policy.MaxCostPerSession.Value)
            {
                return new EvaluationResult
                {
                    Allowed = false,
                    Reason = $"Session cost threshold exceeded (${newCost:F4} > ${policy.MaxCostPerSession.Value:F4} cap).",
                    ActionTaken = ActionTaken.BLOCK,
                    Timestamp = timestamp,
                    Remediation = new Remediation
                    {
                        Status = "BLOCKED",
                        SuggestedFix = $"Budget limit reached (${policy.MaxCostPerSession.Value:F2}). Request budget approval."
                    }
                };
            }
            _sessionCosts[sessionKey] = newCost;
        }

        if (policy.MaxParamValues != null)
        {
            foreach (var kvp in policy.MaxParamValues)
            {
                if (request.Params.TryGetValue(kvp.Key, out object? actualVal) && actualVal is double fv && fv > kvp.Value)
                {
                    return new EvaluationResult
                    {
                        Allowed = false,
                        Reason = $"Parameter '{kvp.Key}' value ({fv}) exceeds maximum allowed threshold ({kvp.Value}).",
                        ActionTaken = ActionTaken.BLOCK,
                        Timestamp = timestamp,
                        Remediation = new Remediation
                        {
                            Status = "REQUIRES_REMEDIATION",
                            SuggestedFix = $"Reduce '{kvp.Key}' parameter to <= {kvp.Value}.",
                            MaxAllowedValue = kvp.Value
                        }
                    };
                }
            }
        }

        if (policy.ForbiddenPatterns != null)
        {
            string paramStr = JsonSerializer.Serialize(request.Params);
            foreach (var patternStr in policy.ForbiddenPatterns)
            {
                if (Regex.IsMatch(paramStr, patternStr, RegexOptions.IgnoreCase))
                {
                    return new EvaluationResult
                    {
                        Allowed = false,
                        Reason = $"Parameter payload matched forbidden pattern: '{patternStr}'.",
                        ActionTaken = ActionTaken.BLOCK,
                        Timestamp = timestamp,
                        Remediation = new Remediation
                        {
                            Status = "BLOCKED",
                            SuggestedFix = $"Remove forbidden pattern '{patternStr}' from input payload."
                        }
                    };
                }
            }
        }

        if (policy.RequireApproval == true)
        {
            return new EvaluationResult
            {
                Allowed = false,
                Reason = $"Tool '{request.ToolName}' requires human authorization prior to execution.",
                ActionTaken = ActionTaken.REQUIRE_APPROVAL,
                Timestamp = timestamp,
                Remediation = new Remediation
                {
                    Status = "BLOCKED",
                    SuggestedFix = "Request human authorization token."
                }
            };
        }

        return new EvaluationResult
        {
            Allowed = true,
            ActionTaken = ActionTaken.ALLOW,
            Timestamp = timestamp
        };
    }
}