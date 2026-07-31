package com.cnsoftbei.a3.gateway.fairlimit;

public class FairLimitSnapshot {

    private final String key;
    private final long waiting;
    private final long active;
    private final long permits;
    private final long updatedAt;

    public FairLimitSnapshot(String key, long waiting, long active, long permits, long updatedAt) {
        this.key = key;
        this.waiting = waiting;
        this.active = active;
        this.permits = permits;
        this.updatedAt = updatedAt;
    }

    public String getKey() {
        return key;
    }

    public long getWaiting() {
        return waiting;
    }

    public long getActive() {
        return active;
    }

    public long getPermits() {
        return permits;
    }

    public long getUpdatedAt() {
        return updatedAt;
    }
}
