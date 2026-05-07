package com.decisionengine.audit;

import java.time.Instant;
import java.util.List;

import com.decisionengine.model.Action;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DecisionRepository extends JpaRepository<Decision, Long> {

    List<Decision> findTop100ByOrderByCreatedAtDesc();

    List<Decision> findByActionOrderByCreatedAtDesc(Action action, Pageable pageable);

    @Query("select d.action as action, count(d) as count from Decision d " +
           "where d.createdAt >= :since group by d.action")
    List<ActionCount> countByActionSince(Instant since);

    interface ActionCount {
        Action getAction();
        long getCount();
    }
}
