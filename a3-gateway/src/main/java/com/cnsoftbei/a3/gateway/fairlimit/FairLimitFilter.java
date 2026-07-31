package com.cnsoftbei.a3.gateway.fairlimit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
public class FairLimitFilter implements GlobalFilter, Ordered {

    private final FairLimitProperties properties;
    private final FairLimitRedisService redisService;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();

    public FairLimitFilter(FairLimitProperties properties, FairLimitRedisService redisService) {
        this.properties = properties;
        this.redisService = redisService;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        Optional<FairLimitProperties.Rule> matchedRule = matchRule(exchange);
        if (!properties.isEnabled() || !matchedRule.isPresent()) {
            return chain.filter(exchange);
        }

        FairLimitProperties.Rule rule = matchedRule.get();
        String requestId = requestId(exchange);
        long deadline = System.currentTimeMillis() + rule.getMaxWait().toMillis();

        return waitForPermit(rule, requestId, deadline)
                .onErrorMap(FairLimitUnavailableException::new)
                .flatMap(result -> {
                    if (result.getStatus() == FairLimitAcquireResult.Status.ACQUIRED) {
                        exchange.getResponse().getHeaders().add("X-A3-Fair-Limit", "acquired");
                        return chain.filter(exchange)
                                .doFinally(signalType -> redisService.release(rule, requestId)
                                        .doOnError(ex -> log.warn("Fair queue release failed, rule={}, requestId={}", rule.getKey(), requestId, ex))
                                        .subscribe());
                    }
                    return reject(exchange, result);
                })
                .onErrorResume(FairLimitUnavailableException.class, ex -> {
                    log.warn("Fair queue limiter failed before routing, rule={}, failOpen={}", rule.getKey(), properties.isFailOpen(), ex.getCause());
                    if (properties.isFailOpen()) {
                        exchange.getResponse().getHeaders().add("X-A3-Fair-Limit", "redis-unavailable; fail-open");
                        return chain.filter(exchange);
                    }
                    return reject(exchange, new FairLimitAcquireResult(FairLimitAcquireResult.Status.REJECTED, -1, 0, 0));
                });
    }

    private Mono<FairLimitAcquireResult> waitForPermit(FairLimitProperties.Rule rule, String requestId, long deadline) {
        return redisService.acquire(rule, requestId)
                .flatMap(result -> {
                    if (result.getStatus() != FairLimitAcquireResult.Status.QUEUED || System.currentTimeMillis() >= deadline) {
                        return Mono.just(result);
                    }
                    Duration interval = properties.getPollInterval();
                    return Mono.delay(interval).then(waitForPermit(rule, requestId, deadline));
                });
    }

    private Mono<Void> reject(ServerWebExchange exchange, FairLimitAcquireResult result) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", 429);
        body.put("message", "当前 AI 请求较多，已超出公平排队等待时间，请稍后重试");
        body.put("position", result.getPosition());
        body.put("waiting", result.getWaiting());
        body.put("active", result.getActive());
        byte[] bytes = redisService.encode(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        return exchange.getResponse().writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(bytes)));
    }

    private Optional<FairLimitProperties.Rule> matchRule(ServerWebExchange exchange) {
        String path = exchange.getRequest().getPath().toString();
        if (path.startsWith("/fair-limit/")) {
            return Optional.empty();
        }
        return properties.getRules().stream()
                .filter(rule -> pathMatcher.match(rule.getPath(), path))
                .findFirst();
    }

    private String requestId(ServerWebExchange exchange) {
        String requestId = exchange.getRequest().getHeaders().getFirst("X-Request-Id");
        if (requestId == null || requestId.trim().isEmpty()) {
            requestId = UUID.randomUUID().toString().replace("-", "");
        }
        return requestId;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 50;
    }

    private static class FairLimitUnavailableException extends RuntimeException {
        FairLimitUnavailableException(Throwable cause) {
            super(cause);
        }
    }
}
