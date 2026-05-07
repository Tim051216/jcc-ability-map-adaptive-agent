package com.cnsoftbei.a3.media.config;

import com.cnsoftbei.a3.media.enums.Platform;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "a3.platform")
public class PlatformProperties {
    private Platform file;
    private Platform media;
}
