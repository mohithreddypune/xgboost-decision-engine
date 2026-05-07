package com.decisionengine.routing;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Action;
import org.springframework.stereotype.Component;

/**
 * Maps a model score (0..1) to a downstream action via configurable thresholds.
 */
@Component
public class DecisionRouter {

    private final EngineProperties props;

    public DecisionRouter(EngineProperties props) {
        this.props = props;
    }

    public Action route(double score) {
        EngineProperties.Thresholds t = props.getThresholds();
        if (score >= t.getBlock()) return Action.BLOCK;
        if (score >= t.getFlag()) return Action.FLAG;
        if (score >= t.getStepUp()) return Action.STEP_UP;
        return Action.APPROVE;
    }
}
