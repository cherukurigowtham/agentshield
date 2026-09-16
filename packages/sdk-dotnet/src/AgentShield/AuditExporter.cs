using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace AgentShield;

public class AuditExporter
{
    private string _lastHash = "GENESIS_HASH_00000000000000000000000000000000";
    private readonly List<AuditRecord> _records = new();
    private readonly Random _random = new();

    public AuditRecord CreateRecord(ToolCallRequest request, EvaluationResult result)
    {
        string recordId = $"rec_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{RandomString(6)}";
        string timestamp = result.Timestamp ?? DateTime.UtcNow.ToString("O");
        string agentId = request.AgentId ?? "default-agent";

        var paramsSanitized = new Dictionary<string, object>(request.Params);
        if (paramsSanitized.ContainsKey("password")) paramsSanitized["password"] = "***MASKED***";
        if (paramsSanitized.ContainsKey("apiKey")) paramsSanitized["apiKey"] = "***MASKED***";

        var payload = new
        {
            recordId,
            previousHash = _lastHash,
            timestamp,
            agentId,
            toolName = request.ToolName,
            actionTaken = result.ActionTaken.ToString(),
            paramsSanitized,
            reason = result.Reason
        };

        string hash = ComputeHash(JsonSerializer.Serialize(payload));
        _lastHash = hash;

        var record = new AuditRecord
        {
            RecordId = recordId,
            PreviousHash = _lastHash,
            Hash = hash,
            Timestamp = timestamp,
            AgentId = agentId,
            ToolName = request.ToolName,
            ActionTaken = result.ActionTaken.ToString(),
            ParamsSanitized = paramsSanitized,
            Reason = result.Reason
        };

        _records.Add(record);
        return record;
    }

    public string ExportSOC2Log()
    {
        var output = new
        {
            version = "AgentShield-Audit-v1",
            totalRecords = _records.Count,
            genesisHash = "GENESIS_HASH_00000000000000000000000000000000",
            finalHash = _lastHash,
            auditChain = _records
        };
        return JsonSerializer.Serialize(output, new JsonSerializerOptions { WriteIndented = true });
    }

    private string ComputeHash(string input)
    {
        using var sha256 = SHA256.Create();
        byte[] hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        return "sha256_" + Convert.ToHexString(hash);
    }

    private string RandomString(int length)
    {
        const string chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        char[] buffer = new char[length];
        for (int i = 0; i < length; i++)
        {
            buffer[i] = chars[_random.Next(chars.Length)];
        }
        return new string(buffer);
    }

    public class AuditRecord
    {
        public string RecordId { get; set; } = string.Empty;
        public string PreviousHash { get; set; } = string.Empty;
        public string Hash { get; set; } = string.Empty;
        public string Timestamp { get; set; } = string.Empty;
        public string AgentId { get; set; } = string.Empty;
        public string ToolName { get; set; } = string.Empty;
        public string ActionTaken { get; set; } = string.Empty;
        public Dictionary<string, object> ParamsSanitized { get; set; } = new();
        public string Reason { get; set; } = string.Empty;
    }
}