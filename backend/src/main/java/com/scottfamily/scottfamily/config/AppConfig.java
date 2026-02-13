package com.scottfamily.scottfamily.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "app-config")
public class AppConfig {
    private String baseUrl;
}
