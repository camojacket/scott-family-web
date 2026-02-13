package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.config.AppConfig;
import com.scottfamily.scottfamily.service.MailService;
import org.jooq.DSLContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static com.yourproject.generated.scott_family_web.tables.PasswordResetTokens.PASSWORD_RESET_TOKENS;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final DSLContext dsl;
    private final PasswordEncoder passwordEncoder;
    private final MailService mailer;       // your existing mail abstraction
    private final String appBaseUrl;   // e.g., injected from config like "https://your.app"

    public AuthController(DSLContext dsl, PasswordEncoder passwordEncoder, MailService mailer, AppConfig appConfig) {
        this.dsl = dsl;
        this.passwordEncoder = passwordEncoder;
        this.mailer = mailer;
        this.appBaseUrl = appConfig.getBaseUrl();
    }

    @PostMapping("/forgot-username")
    public void forgotUsername(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null) return;

        var u = dsl.select(USERS.USERNAME).from(USERS).where(USERS.EMAIL.eq(email)).fetchOne(USERS.USERNAME);
        if (u != null) {
            mailer.sendEmail(email, "Your username", "Your username is: " + u);
        }
    }

    @PostMapping("/request-password-reset")
    public void requestPasswordReset(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        if (email == null) return;

        var userId = dsl.select(USERS.ID).from(USERS).where(USERS.EMAIL.eq(email)).fetchOne(USERS.ID);
        if (userId != null) {
            String token = UUID.randomUUID().toString();
            dsl.insertInto(PASSWORD_RESET_TOKENS)
                    .set(PASSWORD_RESET_TOKENS.USER_ID, userId)
                    .set(PASSWORD_RESET_TOKENS.TOKEN, token)
                    .set(PASSWORD_RESET_TOKENS.EXPIRES_AT, OffsetDateTime.now().plusHours(2))
                    .execute();

            String link = appBaseUrl + "/reset-password?token=" + token;
            mailer.sendEmail(email, "Password reset", "Use this link to reset your password: " + link);
        }
    }

    @PostMapping("/reset-password")
    public void resetPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String newPassword = body.get("newPassword");
        if (token == null || newPassword == null) return;

        var rec = dsl.selectFrom(PASSWORD_RESET_TOKENS)
                .where(PASSWORD_RESET_TOKENS.TOKEN.eq(token))
                .fetchOne();

        if (rec == null) return;
        if (rec.getExpiresAt().isBefore(OffsetDateTime.now())) {
            // expired, remove and bail
            dsl.deleteFrom(PASSWORD_RESET_TOKENS)
                    .where(PASSWORD_RESET_TOKENS.ID.eq(rec.getId()))
                    .execute();
            return;
        }

        dsl.update(USERS)
                .set(USERS.PASSWORD_HASH, passwordEncoder.encode(newPassword))
                .where(USERS.ID.eq(rec.getUserId()))
                .execute();

        dsl.deleteFrom(PASSWORD_RESET_TOKENS)
                .where(PASSWORD_RESET_TOKENS.ID.eq(rec.getId()))
                .execute();
    }
}
