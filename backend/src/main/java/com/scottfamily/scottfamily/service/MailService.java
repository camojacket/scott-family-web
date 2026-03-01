package com.scottfamily.scottfamily.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class MailService {
    private final JavaMailSender mailSender;

    public void sendRejectionEmail(String email) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Email address is required");
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Rejected");
        msg.setText("Your request to join the Scott Family site has been rejected.");
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send rejection email to " + email, e);
        }
    }

    public void sendApprovalEmail(String email) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Email address is required");
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Approved");
        msg.setText("Welcome! Your account has been approved. You can now log in and access the site.");
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send approval email to " + email, e);
        }
    }

    public void sendEmail(String email, String subject, String text) {
        if (email == null || email.isBlank()) throw new IllegalArgumentException("Email address is required");
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject(subject);
        msg.setText(text);
        try {
            mailSender.send(msg);
        } catch (Exception e) {
            throw new RuntimeException("Failed to send email to " + email, e);
        }
    }
}
