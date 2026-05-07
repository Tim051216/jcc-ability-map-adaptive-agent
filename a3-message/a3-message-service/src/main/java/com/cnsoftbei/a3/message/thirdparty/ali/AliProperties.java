package com.cnsoftbei.a3.message.thirdparty.ali;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "a3.sms.ali")
public class AliProperties {
    private String accessId;
    private String accessSecret;
}
