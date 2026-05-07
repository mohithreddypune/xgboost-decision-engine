package com.decisionengine.api;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.decisionengine.audit.Decision;
import com.decisionengine.audit.DecisionRepository;
import com.decisionengine.model.Action;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/decisions")
public class DecisionController {

    private final DecisionRepository repo;

    public DecisionController(DecisionRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public List<Decision> recent() {
        return repo.findTop100ByOrderByCreatedAtDesc();
    }

    @GetMapping("/by-action")
    public List<Decision> byAction(
            @RequestParam Action action,
            @RequestParam(defaultValue = "50") int limit) {
        return repo.findByActionOrderByCreatedAtDesc(action, PageRequest.of(0, limit));
    }

    @GetMapping("/stats")
    public Map<String, Object> stats(@RequestParam(defaultValue = "60") int minutes) {
        Instant since = Instant.now().minus(minutes, ChronoUnit.MINUTES);
        Map<String, Long> counts = new HashMap<>();
        for (Action a : Action.values()) counts.put(a.name(), 0L);
        repo.countByActionSince(since)
                .forEach(c -> counts.put(c.getAction().name(), c.getCount()));
        Map<String, Object> body = new HashMap<>();
        body.put("windowMinutes", minutes);
        body.put("counts", counts);
        body.put("totalDecisions", counts.values().stream().mapToLong(Long::longValue).sum());
        return body;
    }
}
