package com.scottfamily.scottfamily.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;


@Configuration
@ConfigurationProperties(prefix = "cdn")
public class CdnProperties {
    /** e.g. https://cdn.yourdomain.com */
    private String baseUrl;
    /** Target container name; should match azure.storage.container-name */
    private String containerName;


    /** default max file size in bytes for uploads (10 MB for profile images etc.) */
    private long maxBytes = 10 * 1024 * 1024; // 10 MB default


    /** cache-control for user uploads (override per call if needed) */
    private String cacheControl = "public, max-age=86400"; // 1 day


    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }


    public String getContainerName() { return containerName; }
    public void setContainerName(String containerName) { this.containerName = containerName; }


    public long getMaxBytes() { return maxBytes; }
    public void setMaxBytes(long maxBytes) { this.maxBytes = maxBytes; }


    public String getCacheControl() { return cacheControl; }
    public void setCacheControl(String cacheControl) { this.cacheControl = cacheControl; }
}
