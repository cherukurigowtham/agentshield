using System.Text.RegularExpressions;

namespace AgentShield;

public static class InjectionSanitizer
{
    private static readonly Regex[] IndirectInjectionPatterns =
    {
        new(@"\[SYSTEM\s*OVERRIDE\]", RegexOptions.IgnoreCase),
        new(@"IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS", RegexOptions.IgnoreCase),
        new(@"DISREGARD\s+PRIOR\s+RULES", RegexOptions.IgnoreCase),
        new(@"YOU\s+ARE\s+NOW\s+IN\s+DAN\s+MODE", RegexOptions.IgnoreCase),
        new(@"NEW\s+SYSTEM\s+PROMPT:", RegexOptions.IgnoreCase),
        new(@"ADMIN_OVERRIDE_KEY", RegexOptions.IgnoreCase)
    };

    private static readonly Regex[] DestructivePatterns =
    {
        new(@"DROP\s+TABLE", RegexOptions.IgnoreCase),
        new(@"DELETE\s+FROM\s+[a-z_]+", RegexOptions.IgnoreCase),
        new(@"TRUNCATE\s+TABLE", RegexOptions.IgnoreCase),
        new(@"rm\s+-rf\s+", RegexOptions.IgnoreCase),
        new(@"chmod\s+777", RegexOptions.IgnoreCase),
        new(@"mkfs\.", RegexOptions.IgnoreCase)
    };

    private static readonly Regex ZeroWidthRegex = new(@"[\u200B-\u200D\uFEFF]");
    private static readonly Regex Base64Regex = new(@"([A-Za-z0-9+/]{8,}={0,2})");

    public class InjectionSanitizeResult
    {
        public bool Detected { get; set; }
        public string? Type { get; set; }
        public string? PatternMatched { get; set; }
    }

    public static InjectionSanitizeResult Inspect(string payloadStr)
    {
        string normalizedPayload = payloadStr.Replace("\\t", " ").Replace("\\n", " ").Replace("\\r", " ");

        if (ZeroWidthRegex.IsMatch(normalizedPayload))
        {
            return new InjectionSanitizeResult
            {
                Detected = true,
                Type = "ZERO_WIDTH_UNICODE",
                PatternMatched = "Hidden Zero-Width Unicode Characters Detected"
            };
        }

        foreach (var pattern in IndirectInjectionPatterns)
        {
            if (pattern.IsMatch(normalizedPayload))
            {
                return new InjectionSanitizeResult
                {
                    Detected = true,
                    Type = "INDIRECT_PROMPT_INJECTION",
                    PatternMatched = pattern.ToString()
                };
            }
        }

        foreach (var pattern in DestructivePatterns)
        {
            if (pattern.IsMatch(normalizedPayload))
            {
                return new InjectionSanitizeResult
                {
                    Detected = true,
                    Type = "DESTRUCTIVE_PATTERN",
                    PatternMatched = pattern.ToString()
                };
            }
        }

        var matches = Base64Regex.Matches(normalizedPayload);
        foreach (Match match in matches)
        {
            try
            {
                string decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(match.Groups[1].Value));
                foreach (var pattern in IndirectInjectionPatterns)
                {
                    if (pattern.IsMatch(decoded))
                    {
                        return new InjectionSanitizeResult
                        {
                            Detected = true,
                            Type = "OBFUSCATED_PAYLOAD",
                            PatternMatched = "Base64 Decoded: " + pattern.ToString()
                        };
                    }
                }
                foreach (var pattern in DestructivePatterns)
                {
                    if (pattern.IsMatch(decoded))
                    {
                        return new InjectionSanitizeResult
                        {
                            Detected = true,
                            Type = "OBFUSCATED_PAYLOAD",
                            PatternMatched = "Base64 Decoded: " + pattern.ToString()
                        };
                    }
                }
            }
            catch
            {
                // Not valid Base64
            }
        }

        return new InjectionSanitizeResult { Detected = false };
    }
}