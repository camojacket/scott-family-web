package com.scottfamily.scottfamily.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.AsyncConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configures a bounded thread pool for @Async methods (email, SMS, blob deletes).
 * Without this bean Spring uses a SimpleAsyncTaskExecutor that creates an unbounded
 * number of threads — dangerous on Azure B2 (2 vCPU, 3.5 GB RAM).
 */
@Configuration
public class AsyncConfig implements AsyncConfigurer {

    @Bean("asyncExecutor")
    public ThreadPoolTaskExecutor asyncExecutor() {
        var executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(50);
        executor.setThreadNamePrefix("async-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }

    @Override
    public Executor getAsyncExecutor() {
        return asyncExecutor();
    }
}
