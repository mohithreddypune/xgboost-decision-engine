package com.decisionengine.copilot;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.decisionengine.audit.Decision;
import com.decisionengine.audit.DecisionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * AI Co-Pilot — answers natural-language questions about the decision stream.
 *
 * <p>By default this runs in <strong>local mode</strong>: it interprets a small set of
 * canned intents (e.g. "blocked transactions over X", "fraud rate spike", "what is happening")
 * by querying Postgres directly and synthesizing a deterministic answer. No external
 * API call is made and no API key is required.
 *
 * <p>To enable <strong>LLM mode</strong> (Anthropic Claude, OpenAI, etc.):
 * <ol>
 *   <li>Set <code>copilot.api-key</code> in application.yml or as <code>COPILOT_API_KEY</code> env.</li>
 *   <li>Set <code>copilot.provider</code> to <code>anthropic</code> or <code>openai</code>.</li>
 *   <li>Implement the {@link #askLlm(String, String)} method body to make the API call
 *       with the prompt + the relevant Postgres rows as context. A starter is included
 *       below — uncomment and adjust to your provider's API.</li>
 * </ol>
 */
@RestController
@RequestMapping("/api/copilot")
public class CopilotController {

    private static final Logger log = LoggerFactory.getLogger(CopilotController.class);

    private final DecisionRepository decisions;
    private final RestTemplate rest;

    @Value("${copilot.api-key:}") private String apiKey;
    @Value("${copilot.provider:local}") private String provider;

    public CopilotController(DecisionRepository decisions, RestTemplate mlRestTemplate) {
        this.decisions = decisions;
        this.rest = mlRestTemplate;
    }

    @PostMapping("/ask")
    public ResponseEntity<Map<String, Object>> ask(@RequestBody Map<String, String> body) {
        String question = body.getOrDefault("question", "").trim();
        if (question.isBlank()) {
            return ResponseEntity.ok(Map.of("answer", "Ask me about decisions, fraud rates, or model behavior.", "rows", List.of()));
        }

        // Always run the local intent classifier first — even when an API key is present,
        // it provides the structured data the LLM needs as context.
        IntentResult local = handleLocally(question);

        if (apiKey == null || apiKey.isBlank() || "local".equalsIgnoreCase(provider)) {
            return ResponseEntity.ok(Map.of(
                    "answer", local.answer(),
                    "rows", local.rows(),
                    "mode", "local"
            ));
        }

        // LLM mode — calls out to Anthropic/OpenAI with question + local data context.
        String llmAnswer = askLlm(question, summarizeContext(local));
        Map<String, Object> response = new HashMap<>();
        response.put("answer", llmAnswer);
        response.put("rows", local.rows());
        response.put("mode", provider);
        return ResponseEntity.ok(response);
    }

    private IntentResult handleLocally(String q) {
        String lower = q.toLowerCase();
        Instant since60m = Instant.now().minus(60, ChronoUnit.MINUTES);
        List<Decision> recent = decisions.findTop100ByOrderByCreatedAtDesc().stream()
                .filter(d -> d.getCreatedAt().isAfter(since60m)).toList();

        if (lower.contains("block") && (lower.contains("over") || lower.contains("above") || lower.contains("more"))) {
            double threshold = parseAmount(lower).orElse(1000.0);
            List<Decision> matches = recent.stream()
                    .filter(d -> "BLOCK".equals(d.getAction().name()) && d.getAmount() >= threshold)
                    .toList();
            return new IntentResult(
                    String.format("Found %d blocked transactions over $%,.2f in the last hour.",
                            matches.size(), threshold),
                    matches.stream().map(this::summary).toList()
            );
        }
        if (lower.contains("fraud rate") || lower.contains("how much fraud") || lower.contains("spik")) {
            long blocks = recent.stream().filter(d -> "BLOCK".equals(d.getAction().name())).count();
            long flags = recent.stream().filter(d -> "FLAG".equals(d.getAction().name())).count();
            double pct = recent.isEmpty() ? 0 : 100.0 * (blocks + flags) / recent.size();
            return new IntentResult(
                    String.format("In the last hour: %d BLOCK + %d FLAG out of %d decisions (%.1f%% high-risk).",
                            blocks, flags, recent.size(), pct),
                    List.of()
            );
        }
        if (lower.contains("recent") || lower.contains("happening") || lower.contains("status")) {
            Map<String, Long> counts = new HashMap<>();
            for (Decision d : recent) counts.merge(d.getAction().name(), 1L, Long::sum);
            return new IntentResult(
                    "Last hour summary — " + counts.entrySet().stream()
                            .map(e -> e.getKey() + ": " + e.getValue())
                            .reduce((a, b) -> a + ", " + b).orElse("no decisions"),
                    List.of()
            );
        }
        return new IntentResult(
                "I can answer questions like: 'blocked transactions over $1000', 'what's the current fraud rate', 'what's happening right now'.",
                List.of()
        );
    }

    /**
     * LLM call. Replace this body with your provider's API call when you set COPILOT_API_KEY.
     *
     * Example for Anthropic Claude:
     * <pre>
     * String body = """
     *   { "model": "claude-sonnet-4-5", "max_tokens": 400,
     *     "messages": [{"role":"user","content": "%s\\n\\nContext:\\n%s"}] }""".formatted(question, context);
     * HttpHeaders h = new HttpHeaders();
     * h.set("x-api-key", apiKey);
     * h.set("anthropic-version", "2023-06-01");
     * h.setContentType(MediaType.APPLICATION_JSON);
     * Map resp = rest.postForObject("https://api.anthropic.com/v1/messages",
     *                                new HttpEntity<>(body, h), Map.class);
     * return ((List<Map>)resp.get("content")).get(0).get("text").toString();
     * </pre>
     */
    private String askLlm(String question, String context) {
        log.warn("LLM mode requested but askLlm() is not implemented. Falling back to local.");
        return "[LLM not configured — set COPILOT_API_KEY and implement askLlm(). Local result: " + handleLocally(question).answer() + "]";
    }

    private static java.util.Optional<Double> parseAmount(String s) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("\\$?(\\d+[\\d,.]*)").matcher(s);
        if (m.find()) {
            try {
                return java.util.Optional.of(Double.parseDouble(m.group(1).replace(",", "")));
            } catch (NumberFormatException e) { /* fall through */ }
        }
        return java.util.Optional.empty();
    }

    private Map<String, Object> summary(Decision d) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", d.getId());
        m.put("transactionId", d.getTransactionId());
        m.put("amount", d.getAmount());
        m.put("score", d.getScore());
        m.put("action", d.getAction().name());
        m.put("createdAt", d.getCreatedAt().toString());
        return m;
    }

    private String summarizeContext(IntentResult r) {
        return r.answer() + "\nMatched rows: " + r.rows().size();
    }

    private record IntentResult(String answer, List<Map<String, Object>> rows) { }
}
