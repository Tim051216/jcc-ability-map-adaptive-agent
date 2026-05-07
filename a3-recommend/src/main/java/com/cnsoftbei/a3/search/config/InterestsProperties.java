package com.cnsoftbei.a3.search.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "a3.interests")
public class InterestsProperties {
    private int topNumber;
}
