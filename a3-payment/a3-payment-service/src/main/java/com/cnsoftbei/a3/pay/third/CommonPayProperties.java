package com.cnsoftbei.a3.pay.third;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "a3.pay")
public class CommonPayProperties {
    private String notifyHost;
}
