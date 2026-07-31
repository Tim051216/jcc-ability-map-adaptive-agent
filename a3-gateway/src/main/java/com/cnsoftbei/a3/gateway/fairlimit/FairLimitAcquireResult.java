package com.cnsoftbei.a3.gateway.fairlimit;

public class FairLimitAcquireResult {

    public enum Status {
        ACQUIRED,
        QUEUED,
        REJECTED
    }

    private final Status status;
    private final long position;
    private final long waiting;
    private final long active;

    public FairLimitAcquireResult(Status status, long position, long waiting, long active) {
        this.status = status;
        this.position = position;
        this.waiting = waiting;
        this.active = active;
    }

    public Status getStatus() {
        return status;
    }

    public long getPosition() {
        return position;
    }

    public long getWaiting() {
        return waiting;
    }

    public long getActive() {
        return active;
    }
}
