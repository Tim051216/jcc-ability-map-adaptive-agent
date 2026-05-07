package com.cnsoftbei.a3.pay.sdk.config;


import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableFeignClients(basePackages = "com.cnsoftbei.a3.pay.sdk.client")
public class PayApiImportConfiguration {

}