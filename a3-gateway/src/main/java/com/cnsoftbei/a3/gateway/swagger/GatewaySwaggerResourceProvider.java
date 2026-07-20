package com.cnsoftbei.a3.gateway.swagger;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.config.GatewayProperties;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import springfox.documentation.swagger.web.SwaggerResource;
import springfox.documentation.swagger.web.SwaggerResourcesProvider;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Component
@Primary
@RequiredArgsConstructor
public class GatewaySwaggerResourceProvider implements SwaggerResourcesProvider {

    private static final String SWAGGER2_URL = "/v2/api-docs";
    private static final Set<String> NON_SWAGGER2_ROUTE_IDS = Set.of("ai", "ai-api");

    private final GatewayProperties gatewayProperties;

    @Value("${spring.application.name}")
    private String gatewayName;

    @Override
    public List<SwaggerResource> get() {
        List<SwaggerResource> resources = new ArrayList<>();
        Set<String> routeIds = new LinkedHashSet<>();
        gatewayProperties.getRoutes().stream()
                .filter(route -> Objects.nonNull(route.getUri()))
                .filter(route -> Objects.nonNull(route.getUri().getHost()))
                .filter(route -> !gatewayName.equals(route.getUri().getHost()))
                .map(route -> route.getId())
                .filter(routeId -> !NON_SWAGGER2_ROUTE_IDS.contains(routeId))
                .forEach(routeIds::add);

        routeIds.forEach(routeId -> {
            SwaggerResource swaggerResource = new SwaggerResource();
            swaggerResource.setUrl("/" + routeId + SWAGGER2_URL);
            swaggerResource.setName(routeId);
            swaggerResource.setSwaggerVersion("3.0.0");
            resources.add(swaggerResource);
        });
        return resources;
    }
}
