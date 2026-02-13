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
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Rejected");
        msg.setText("Your request to join the Scott Family site has been rejected.");
        mailSender.send(msg);
    }

    public void sendApprovalEmail(String email) {
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Approved");
        msg.setText("Welcome! Your account has been approved. You can now log in and access the site.");
        mailSender.send(msg);
    }

    public void sendEmail(String email,String subject, String text) {
        var msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject(subject);
        msg.setText(text);
        mailSender.send(msg);
    }
}
