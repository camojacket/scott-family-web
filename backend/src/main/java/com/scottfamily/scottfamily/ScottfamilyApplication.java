package com.scottfamily.scottfamily;

import com.scottfamily.scottfamily.config.AppConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(value = {AppConfig.class})
@EnableScheduling
public class ScottfamilyApplication {

	public static void main(String[] args) {
		SpringApplication.run(ScottfamilyApplication.class, args);
	}

}
