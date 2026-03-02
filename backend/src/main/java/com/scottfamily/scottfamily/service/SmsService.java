package com.scottfamily.scottfamily.service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Shared SMS sending via Twilio REST API (no SDK dependency).
 * Uses a single reusable HttpClient with connect/request timeouts to prevent
 * thread starvation on Azure App Service (limited SNAT ports).
 */
@Service
@Slf4j
public class SmsService {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(15);

    /** Single reusable client — avoids creating a new thread-pool + connection per call. */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .build();

    @Value("${twilio.account-sid:}")
    private String twilioAccountSid;

    @Value("${twilio.auth-token:}")
    private String twilioAuthToken;

    @Value("${twilio.from-number:}")
    private String twilioFromNumber;

    /**
     * Returns true if Twilio env vars are configured.
     */
    public boolean isConfigured() {
        return twilioAccountSid != null && !twilioAccountSid.isBlank()
                && twilioAuthToken != null && !twilioAuthToken.isBlank()
                && twilioFromNumber != null && !twilioFromNumber.isBlank();
    }

    /**
     * Send an SMS via Twilio REST API.
     *
     * @throws RuntimeException if Twilio is not configured or the API returns an error
     */
    public void send(String toNumber, String messageBody) {
        if (!isConfigured()) {
            throw new IllegalStateException("Twilio is not configured — cannot send SMS");
        }

        try {
            String url = "https://api.twilio.com/2010-04-01/Accounts/"
                    + twilioAccountSid + "/Messages.json";
            String auth = Base64.getEncoder()
                    .encodeToString((twilioAccountSid + ":" + twilioAuthToken).getBytes(StandardCharsets.UTF_8));

            String formData = "To=" + URLEncoder.encode(toNumber, StandardCharsets.UTF_8)
                    + "&From=" + URLEncoder.encode(twilioFromNumber, StandardCharsets.UTF_8)
                    + "&Body=" + URLEncoder.encode(messageBody, StandardCharsets.UTF_8);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(REQUEST_TIMEOUT)
                    .POST(HttpRequest.BodyPublishers.ofString(formData))
                    .build();

            HttpResponse<String> response =
                    httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 400) {
                throw new RuntimeException("Twilio SMS failed (HTTP "
                        + response.statusCode() + "): " + response.body());
            }

            log.debug("SMS sent to {}", toNumber);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Failed to send SMS to " + toNumber
                    + ": " + e.getMessage(), e);
        }
    }
}
