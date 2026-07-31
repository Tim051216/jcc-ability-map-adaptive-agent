package com.cnsoftbei.a3.gateway.fairlimit;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

import javax.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

@Slf4j
@Service
public class FairLimitRedisService {

    private static final String ACQUIRE_LUA =
            "local queue = KEYS[1]\n" +
            "local holders = KEYS[2]\n" +
            "local channel = KEYS[3]\n" +
            "local requestId = ARGV[1]\n" +
            "local now = tonumber(ARGV[2])\n" +
            "local permits = tonumber(ARGV[3])\n" +
            "local maxWait = tonumber(ARGV[4])\n" +
            "local lease = tonumber(ARGV[5])\n" +
            "local queueLimit = tonumber(ARGV[6])\n" +
            "local ruleKey = ARGV[7]\n" +
            "redis.call('ZREMRANGEBYSCORE', holders, '-inf', now)\n" +
            "redis.call('ZREMRANGEBYSCORE', queue, '-inf', now - maxWait)\n" +
            "if not redis.call('ZSCORE', queue, requestId) and not redis.call('ZSCORE', holders, requestId) then\n" +
            "  if queueLimit > 0 and redis.call('ZCARD', queue) >= queueLimit then\n" +
            "    local payload = cjson.encode({key=ruleKey,status='rejected',waiting=redis.call('ZCARD', queue),active=redis.call('ZCARD', holders),updatedAt=now})\n" +
            "    redis.call('PUBLISH', channel, payload)\n" +
            "    return {2, -1, redis.call('ZCARD', queue), redis.call('ZCARD', holders)}\n" +
            "  end\n" +
            "  redis.call('ZADD', queue, now, requestId)\n" +
            "end\n" +
            "if redis.call('ZSCORE', holders, requestId) then\n" +
            "  return {0, 0, redis.call('ZCARD', queue), redis.call('ZCARD', holders)}\n" +
            "end\n" +
            "local rank = redis.call('ZRANK', queue, requestId)\n" +
            "if not rank then\n" +
            "  return {2, -1, redis.call('ZCARD', queue), redis.call('ZCARD', holders)}\n" +
            "end\n" +
            "local active = redis.call('ZCARD', holders)\n" +
            "if rank < permits and active < permits then\n" +
            "  redis.call('ZREM', queue, requestId)\n" +
            "  redis.call('ZADD', holders, now + lease, requestId)\n" +
            "  local payload = cjson.encode({key=ruleKey,status='acquired',waiting=redis.call('ZCARD', queue),active=redis.call('ZCARD', holders),updatedAt=now})\n" +
            "  redis.call('PUBLISH', channel, payload)\n" +
            "  return {0, rank + 1, redis.call('ZCARD', queue), redis.call('ZCARD', holders)}\n" +
            "end\n" +
            "local score = tonumber(redis.call('ZSCORE', queue, requestId))\n" +
            "if now - score >= maxWait then\n" +
            "  redis.call('ZREM', queue, requestId)\n" +
            "  local payload = cjson.encode({key=ruleKey,status='timeout',waiting=redis.call('ZCARD', queue),active=redis.call('ZCARD', holders),updatedAt=now})\n" +
            "  redis.call('PUBLISH', channel, payload)\n" +
            "  return {2, rank + 1, redis.call('ZCARD', queue), active}\n" +
            "end\n" +
            "local payload = cjson.encode({key=ruleKey,status='queued',position=rank + 1,waiting=redis.call('ZCARD', queue),active=active,updatedAt=now})\n" +
            "redis.call('PUBLISH', channel, payload)\n" +
            "return {1, rank + 1, redis.call('ZCARD', queue), active}\n";

    private static final String RELEASE_LUA =
            "local removed = redis.call('ZREM', KEYS[2], ARGV[1])\n" +
            "local now = tonumber(ARGV[2])\n" +
            "local payload = cjson.encode({key=ARGV[3],status='released',waiting=redis.call('ZCARD', KEYS[1]),active=redis.call('ZCARD', KEYS[2]),updatedAt=now})\n" +
            "redis.call('PUBLISH', KEYS[3], payload)\n" +
            "return removed\n";

    private static final String STATUS_LUA =
            "local now = tonumber(ARGV[1])\n" +
            "redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)\n" +
            "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - tonumber(ARGV[2]))\n" +
            "return {redis.call('ZCARD', KEYS[1]), redis.call('ZCARD', KEYS[2])}\n";

    private final StringRedisTemplate redisTemplate;
    private final RedisMessageListenerContainer listenerContainer;
    private final ObjectMapper objectMapper;
    private final Sinks.Many<String> eventSink = Sinks.many().multicast().directBestEffort();
    private final AtomicBoolean listenerRegistered = new AtomicBoolean(false);

    private final DefaultRedisScript<List> acquireScript = new DefaultRedisScript<>(ACQUIRE_LUA, List.class);
    private final DefaultRedisScript<Long> releaseScript = new DefaultRedisScript<>(RELEASE_LUA, Long.class);
    private final DefaultRedisScript<List> statusScript = new DefaultRedisScript<>(STATUS_LUA, List.class);

    public FairLimitRedisService(StringRedisTemplate redisTemplate,
                                 RedisMessageListenerContainer listenerContainer,
                                 ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.listenerContainer = listenerContainer;
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void subscribeQueueEvents() {
        if (!listenerRegistered.compareAndSet(false, true)) {
            return;
        }
        listenerContainer.addMessageListener(new MessageListener() {
            @Override
            public void onMessage(Message message, byte[] pattern) {
                String body = new String(message.getBody(), StandardCharsets.UTF_8);
                eventSink.tryEmitNext(body);
            }
        }, new PatternTopic("a3:fair-limit:*:events"));
    }

    public Mono<FairLimitAcquireResult> acquire(FairLimitProperties.Rule rule, String requestId) {
        return Mono.fromCallable(() -> {
            long now = System.currentTimeMillis();
            List<?> raw = redisTemplate.execute(
                    acquireScript,
                    keys(rule.getKey()),
                    requestId,
                    String.valueOf(now),
                    String.valueOf(rule.getPermits()),
                    String.valueOf(rule.getMaxWait().toMillis()),
                    String.valueOf(rule.getLease().toMillis()),
                    String.valueOf(rule.getQueueLimit()),
                    rule.getKey()
            );
            return toAcquireResult(raw);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Mono<Void> release(FairLimitProperties.Rule rule, String requestId) {
        return Mono.fromRunnable(() -> redisTemplate.execute(
                releaseScript,
                keys(rule.getKey()),
                requestId,
                String.valueOf(System.currentTimeMillis()),
                rule.getKey()
        )).subscribeOn(Schedulers.boundedElastic()).then();
    }

    public Mono<FairLimitSnapshot> snapshot(FairLimitProperties.Rule rule) {
        return Mono.fromCallable(() -> {
            long now = System.currentTimeMillis();
            List<?> raw = redisTemplate.execute(
                    statusScript,
                    keys(rule.getKey()),
                    String.valueOf(now),
                    String.valueOf(rule.getMaxWait().toMillis())
            );
            long waiting = numberAt(raw, 0);
            long active = numberAt(raw, 1);
            return new FairLimitSnapshot(rule.getKey(), waiting, active, rule.getPermits(), now);
        }).subscribeOn(Schedulers.boundedElastic());
    }

    public Flux<String> events() {
        startListenerIfNecessary();
        return eventSink.asFlux();
    }

    private void startListenerIfNecessary() {
        if (listenerContainer.isRunning()) {
            return;
        }
        try {
            listenerContainer.start();
        } catch (Exception e) {
            log.warn("Redis Pub/Sub listener is not ready yet, SSE will keep heartbeat snapshots only", e);
        }
    }

    public String encode(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private List<String> keys(String ruleKey) {
        String safeKey = ruleKey.replaceAll("[^a-zA-Z0-9:_-]", "-");
        return Arrays.asList(
                "a3:fair-limit:" + safeKey + ":queue",
                "a3:fair-limit:" + safeKey + ":holders",
                "a3:fair-limit:" + safeKey + ":events"
        );
    }

    private FairLimitAcquireResult toAcquireResult(List<?> raw) {
        int code = (int) numberAt(raw, 0);
        FairLimitAcquireResult.Status status;
        if (code == 0) {
            status = FairLimitAcquireResult.Status.ACQUIRED;
        } else if (code == 1) {
            status = FairLimitAcquireResult.Status.QUEUED;
        } else {
            status = FairLimitAcquireResult.Status.REJECTED;
        }
        return new FairLimitAcquireResult(status, numberAt(raw, 1), numberAt(raw, 2), numberAt(raw, 3));
    }

    private long numberAt(List<?> raw, int index) {
        if (raw == null || raw.size() <= index || raw.get(index) == null) {
            return 0L;
        }
        Object value = raw.get(index);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }
}
