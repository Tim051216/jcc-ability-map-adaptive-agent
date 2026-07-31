package com.cnsoftbei.a3.gateway.fairlimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@ConfigurationProperties(prefix = "a3.fair-limit")
public class FairLimitProperties {

    private boolean enabled = true;
    private boolean failOpen = true;
    private Duration pollInterval = Duration.ofMillis(200);
    private List<Rule> rules = new ArrayList<>();

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isFailOpen() {
        return failOpen;
    }

    public void setFailOpen(boolean failOpen) {
        this.failOpen = failOpen;
    }

    public Duration getPollInterval() {
        return pollInterval;
    }

    public void setPollInterval(Duration pollInterval) {
        this.pollInterval = pollInterval;
    }

    public List<Rule> getRules() {
        return rules;
    }

    public void setRules(List<Rule> rules) {
        this.rules = rules;
    }

    public static class Rule {
        private String key = "default";
        private String path = "/ai/**";
        private int permits = 2;
        private int queueLimit = 100;
        private Duration maxWait = Duration.ofSeconds(8);
        private Duration lease = Duration.ofSeconds(30);

        public String getKey() {
            return key;
        }

        public void setKey(String key) {
            this.key = key;
        }

        public String getPath() {
            return path;
        }

        public void setPath(String path) {
            this.path = path;
        }

        public int getPermits() {
            return permits;
        }

        public void setPermits(int permits) {
            this.permits = permits;
        }

        public int getQueueLimit() {
            return queueLimit;
        }

        public void setQueueLimit(int queueLimit) {
            this.queueLimit = queueLimit;
        }

        public Duration getMaxWait() {
            return maxWait;
        }

        public void setMaxWait(Duration maxWait) {
            this.maxWait = maxWait;
        }

        public Duration getLease() {
            return lease;
        }

        public void setLease(Duration lease) {
            this.lease = lease;
        }
    }
}
