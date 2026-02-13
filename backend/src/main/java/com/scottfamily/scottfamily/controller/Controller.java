package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.scottfamily.scottfamily.service.AuthService;
import com.scottfamily.scottfamily.service.CommentService;
import com.scottfamily.scottfamily.service.FamilyTreeService;
import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class Controller {

    private final AuthService authService;
    private final CommentService commentService;
    private final FamilyTreeService familyTreeService;
    private final DSLContext dsl;
    private final JavaMailSender mailSender;


    // 🔐 Login endpoint
    @PostMapping("/auth/login")
    public DTOs.ProfileDto login(@RequestBody DTOs.LoginRequest req) {
        return authService.authenticate(req);
    }

    // 🔐 Signup endpoint
    @PostMapping("/auth/signup")
    public DTOs.ProfileDto signup(@RequestBody DTOs.SignupRequest req) {
        return authService.signup(req);
    }

    // 💬 Get comments for blog post
    @GetMapping("/comments/post/{postId}")
    public List<DTOs.CommentDto> getCommentsForBlogPost(@PathVariable Long postId) {
        return commentService.getComments(postId);
    }

    // 🌳 Get family tree root
    @GetMapping("/family/tree")
    public DTOs.FamilyNodeDto getFamilyTree() {
        return familyTreeService.buildTree();
    }

    @GetMapping("/admin/pending-signups")
    public List<DTOs.PendingUserDto> getPendingSignups() {
        return dsl.selectFrom(USERS)
                .where(USERS.APPROVED_AT.isNull())
                .orderBy(USERS.REQUESTED_AT.asc())
                .fetch()
                .map(r -> new DTOs.PendingUserDto(
                        r.getId(),
                        r.getUsername(),
                        r.getDisplayName(),
                        r.getEmail(),
                        r.getRequestedAt().toString()
                ));
    }

    @PostMapping("/admin/approve/{userId}")
    public ResponseEntity<Void> approveUser(@PathVariable Long userId) {
        dsl.update(USERS)
                .set(USERS.APPROVED_AT, DSL.currentLocalDateTime())
                .where(USERS.ID.eq(userId))
                .execute();
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/admin/reject/{userId}")
    public ResponseEntity<Void> rejectUser(@PathVariable Long userId) {
        UsersRecord user = dsl.selectFrom(USERS).where(USERS.ID.eq(userId)).fetchOne();
        if (user != null) {
            String email = user.getEmail();
            dsl.deleteFrom(USERS).where(USERS.ID.eq(userId)).execute();
            // Send rejection email
            sendRejectionEmail(email);
        }
        return ResponseEntity.ok().build();
    }

    private void sendRejectionEmail(String email) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setTo(email);
        msg.setSubject("Signup Rejected");
        msg.setText("Your request to join the Scott Family site has been rejected.");
        mailSender.send(msg);
    }
}
