package com.cnsoftbei.a3.learning.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * 评估 AI 客户端相关 Bean
 */
@Configuration
@EnableConfigurationProperties(EvaluationAiProperties.class)
public class EvaluationAiConfiguration {

    @Bean
    public RestTemplate evaluationRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(15_000);
        factory.setReadTimeout(120_000);
        return new RestTemplate(factory);
    }
}
