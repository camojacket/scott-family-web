package com.scottfamily.scottfamily.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

/**
 * Shared SMS sending via Twilio REST API (no SDK dependency).
 * Used by both bulk notification sending and two-factor authentication.
 */
@Service
@Slf4j
public class SmsService {

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
            String auth = java.util.Base64.getEncoder()
                    .encodeToString((twilioAccountSid + ":" + twilioAuthToken).getBytes());

            String formData = "To=" + java.net.URLEncoder.encode(toNumber, "UTF-8")
                    + "&From=" + java.net.URLEncoder.encode(twilioFromNumber, "UTF-8")
                    + "&Body=" + java.net.URLEncoder.encode(messageBody, "UTF-8");

            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(url))
                    .header("Authorization", "Basic " + auth)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(formData))
                    .build();

            java.net.http.HttpResponse<String> response =
                    client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

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
