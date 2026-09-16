using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AgentShield;

public class CircuitBreaker
{
    private class CallRecord
    {
        public string ParamsHash { get; set; } = string.Empty;
        public long Timestamp { get; set; }
    }

    private readonly ConcurrentDictionary<string, List<CallRecord>> _callTracker = new();
    private readonly ConcurrentDictionary<string, long> _trippedBreakers = new();

    public CircuitBreakerResult Check(string sessionKey, string toolName, Dictionary<string, object> paramsDict, CircuitBreakerConfig config)
    {
        int maxCalls = config?.MaxRepeatedCalls ?? 4;
        int windowMs = config?.TimeWindowMs ?? 10000;
        long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        if (_trippedBreakers.TryGetValue(sessionKey, out long resetTime) && now < resetTime)
        {
            long remainingSec = (resetTime - now + 999) / 1000;
            return new CircuitBreakerResult(true, $"Circuit Breaker OPEN: Agent loop detected. Aborting tool calls for next {remainingSec}s.");
        }

        string trackerKey = $"{sessionKey}:{toolName}";
        string paramsHash = HashParams(paramsDict);

        if (!_callTracker.TryGetValue(trackerKey, out var history))
        {
            history = new List<CallRecord>();
        }

        var recent = history.Where(r => now - r.Timestamp < windowMs).ToList();
        long repeatedCount = recent.Count(r => r.ParamsHash == paramsHash);

        if (repeatedCount >= maxCalls)
        {
            _trippedBreakers[sessionKey] = now + 30000;
            return new CircuitBreakerResult(true,
                $"Circuit Breaker TRIPPED: Tool '{toolName}' called {repeatedCount + 1} times with identical parameters within {windowMs / 1000}s loop.");
        }

        recent.Add(new CallRecord { ParamsHash = paramsHash, Timestamp = now });
        _callTracker[trackerKey] = recent;

        return new CircuitBreakerResult(false, null);
    }

    public void Reset(string sessionKey)
    {
        _trippedBreakers.TryRemove(sessionKey, out _);
    }

    private string HashParams(Dictionary<string, object> paramsDict)
    {
        try
        {
            string json = JsonSerializer.Serialize(paramsDict);
            using var sha256 = SHA256.Create();
            byte[] hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(json));
            return Convert.ToHexString(hash);
        }
        catch
        {
            return paramsDict.ToString() ?? string.Empty;
        }
    }
}

public class CircuitBreakerResult
{
    public bool Tripped { get; }
    public string? Reason { get; }

    public CircuitBreakerResult(bool tripped, string? reason)
    {
        Tripped = tripped;
        Reason = reason;
    }
}