package com.scottfamily.scottfamily.config;

import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import com.azure.storage.blob.models.BlobCorsRule;
import com.azure.storage.blob.models.BlobServiceProperties;
import com.azure.core.http.policy.HttpLogOptions;
import com.azure.storage.common.policy.RequestRetryOptions;
import com.azure.storage.common.policy.RetryPolicyType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Configuration
public class AzureStorageConfig {

    private static final Logger log = LoggerFactory.getLogger(AzureStorageConfig.class);

    @Bean
    public BlobServiceClient blobServiceClient(
            @Value("${azure.storage.connection-string}") String connectionString,
            @Value("${app.cors.origin:http://localhost:3000}") String allowedOrigin) {

        // Retry options: 3 retries, 4s backoff, 30s per-try timeout, 120s total timeout
        RequestRetryOptions retryOptions = new RequestRetryOptions(
                RetryPolicyType.EXPONENTIAL,
                3,            // maxRetries
                30,           // tryTimeoutInSeconds
                4L * 1000,    // retryDelayInMs
                32L * 1000,   // maxRetryDelayInMs
                null          // secondaryHost
        );

        BlobServiceClient client = new BlobServiceClientBuilder()
                .connectionString(connectionString)
                .retryOptions(retryOptions)
                .buildClient();

        ensureBlobCors(client, allowedOrigin);

        return client;
    }

    /**
     * Sets CORS rules on the Azure Storage account so that browsers can PUT
     * directly to blob storage using SAS tokens (via @azure/storage-blob SDK).
     * Preserves any existing CORS rules that target different origins.
     */
    private void ensureBlobCors(BlobServiceClient client, String allowedOrigin) {
        try {
            BlobServiceProperties props = client.getProperties();
            List<BlobCorsRule> existing = props.getCors();
            if (existing == null) existing = new ArrayList<>();

            // Check if a rule for our origin already exists
            boolean alreadyConfigured = existing.stream().anyMatch(r ->
                    r.getAllowedOrigins() != null && r.getAllowedOrigins().contains(allowedOrigin)
                    && r.getAllowedMethods() != null && r.getAllowedMethods().contains("PUT"));

            if (alreadyConfigured) {
                log.info("Azure Blob Storage CORS already configured for origin: {}", allowedOrigin);
                return;
            }

            BlobCorsRule rule = new BlobCorsRule()
                    .setAllowedOrigins(allowedOrigin)
                    .setAllowedMethods("GET,PUT,DELETE,HEAD,OPTIONS")
                    .setAllowedHeaders("*")
                    .setExposedHeaders("*")
                    .setMaxAgeInSeconds(3600);

            List<BlobCorsRule> updated = new ArrayList<>(existing);
            updated.add(rule);
            props.setCors(updated);
            client.setProperties(props);
            log.info("Azure Blob Storage CORS configured for origin: {}", allowedOrigin);
        } catch (Exception e) {
            log.error("Could not set CORS on blob storage. Direct browser uploads will fail. "
                    + "Set CORS manually via Azure Portal (Storage account → Resource sharing (CORS)): "
                    + "Origin={}, Methods=GET,PUT,DELETE,HEAD,OPTIONS, AllowedHeaders=*, MaxAge=3600. Error: {}",
                    allowedOrigin, e.getMessage());
        }
    }

    @Bean
    public BlobContainerClient blobContainerClient(
            BlobServiceClient blobServiceClient,
            @Value("${azure.storage.container-name}") String containerName) {
        BlobContainerClient client = blobServiceClient.getBlobContainerClient(containerName);
        if (!client.exists()) {
            client.create();
        }
        return client;
    }
}