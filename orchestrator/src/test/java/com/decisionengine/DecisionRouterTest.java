package com.decisionengine;

import com.decisionengine.config.EngineProperties;
import com.decisionengine.model.Action;
import com.decisionengine.routing.DecisionRouter;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DecisionRouterTest {

    private DecisionRouter router(double block, double flag, double stepUp) {
        EngineProperties p = new EngineProperties();
        EngineProperties.Thresholds t = new EngineProperties.Thresholds();
        t.setBlock(block);
        t.setFlag(flag);
        t.setStepUp(stepUp);
        p.setThresholds(t);
        return new DecisionRouter(p);
    }

    @Test
    void mapsScoresToActions() {
        DecisionRouter r = router(0.9, 0.6, 0.2);
        assertEquals(Action.BLOCK, r.route(0.95));
        assertEquals(Action.BLOCK, r.route(0.90));
        assertEquals(Action.FLAG, r.route(0.75));
        assertEquals(Action.STEP_UP, r.route(0.30));
        assertEquals(Action.APPROVE, r.route(0.10));
    }
}
