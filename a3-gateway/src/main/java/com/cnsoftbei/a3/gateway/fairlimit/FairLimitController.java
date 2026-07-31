package com.cnsoftbei.a3.gateway.fairlimit;

import org.springframework.http.MediaType;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
@RestController
public class FairLimitController {

    private final FairLimitProperties properties;
    private final FairLimitRedisService redisService;

    public FairLimitController(FairLimitProperties properties, FairLimitRedisService redisService) {
        this.properties = properties;
        this.redisService = redisService;
    }

    @GetMapping(value = "/fair-limit/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<ServerSentEvent<String>> stream(@RequestParam(defaultValue = "ai") String key) {
        Flux<ServerSentEvent<String>> redisEvents = redisService.events()
                .filter(payload -> payload.contains("\"key\":\"" + key + "\""))
                .map(payload -> ServerSentEvent.<String>builder(payload).event("queue-update").build());

        Flux<ServerSentEvent<String>> heartbeats = Flux.interval(Duration.ZERO, Duration.ofSeconds(2))
                .flatMap(tick -> snapshot(key))
                .map(payload -> ServerSentEvent.<String>builder(payload).event("snapshot").build());

        return Flux.merge(redisEvents, heartbeats);
    }

    @GetMapping(value = "/fair-limit/status", produces = MediaType.APPLICATION_JSON_VALUE)
    public Mono<String> status(@RequestParam(defaultValue = "ai") String key) {
        return snapshot(key).map(payload -> "{\"code\":0,\"data\":" + payload + "}");
    }

    private Mono<String> snapshot(String key) {
        return properties.getRules().stream()
                .filter(rule -> rule.getKey().equals(key))
                .findFirst()
                .map(rule -> redisService.snapshot(rule).map(redisService::encode))
                .orElseGet(() -> Mono.just("{\"key\":\"" + key + "\",\"waiting\":0,\"active\":0,\"permits\":0}"))
                .onErrorReturn("{\"key\":\"" + key + "\",\"status\":\"redis-unavailable\",\"waiting\":0,\"active\":0,\"permits\":0}");
    }
}
