package com.decisionengine.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "decision-engine")
public class EngineProperties {

    private String topic = "transactions";
    private String mlServiceUrl = "http://localhost:8000";
    private Thresholds thresholds = new Thresholds();

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }

    public String getMlServiceUrl() { return mlServiceUrl; }
    public void setMlServiceUrl(String mlServiceUrl) { this.mlServiceUrl = mlServiceUrl; }

    public Thresholds getThresholds() { return thresholds; }
    public void setThresholds(Thresholds thresholds) { this.thresholds = thresholds; }

    public static class Thresholds {
        private double block = 0.90;
        private double flag = 0.60;
        private double stepUp = 0.20;

        public double getBlock() { return block; }
        public void setBlock(double block) { this.block = block; }

        public double getFlag() { return flag; }
        public void setFlag(double flag) { this.flag = flag; }

        public double getStepUp() { return stepUp; }
        public void setStepUp(double stepUp) { this.stepUp = stepUp; }
    }
}
