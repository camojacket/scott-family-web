package com.scottfamily.scottfamily.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * All send methods are @Async so they execute on the bounded asyncExecutor
 * thread pool instead of blocking the Tomcat request thread.
 * Callers should treat these as fire-and-forget.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {
    private final JavaMailSender mailSender;

    @Async
    public void sendRejectionEmail(String email) {
        if (email == null || email.isBlank()) return;
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Rejected");
        msg.setText("Your request to join the Scott Family site has been rejected.");
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send rejection email to {}", email, e);
        }
    }

    @Async
    public void sendApprovalEmail(String email) {
        if (email == null || email.isBlank()) return;
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Approved");
        msg.setText("Welcome! Your account has been approved. You can now log in and access the site.");
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send approval email to {}", email, e);
        }
    }

    @Async
    public void sendEmail(String email, String subject, String text) {
        if (email == null || email.isBlank()) return;
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject(subject);
        msg.setText(text);
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send email to {}", email, e);
        }
    }
}
