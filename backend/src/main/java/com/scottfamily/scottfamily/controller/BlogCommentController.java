package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.BlogCommentService;
import com.scottfamily.scottfamily.service.BlogCommentService.CommentDto;
import com.scottfamily.scottfamily.service.BlogCommentService.ReactionResult;
import org.jooq.DSLContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

/**
 * REST API for blog comments.
 *
 *   GET    /api/blog-posts/{postId}/comments                    — list comments
 *   POST   /api/blog-posts/{postId}/comments                    — create
 *   DELETE /api/blog-posts/{postId}/comments/{commentId}        — delete (admin or author)
 *   POST   /api/blog-posts/{postId}/comments/{commentId}/like   — toggle like
 */
@RestController
@RequestMapping("/api/blog-posts/{postId}/comments")
public class BlogCommentController {

    private final BlogCommentService commentService;
    private final DSLContext dsl;

    public BlogCommentController(BlogCommentService commentService, DSLContext dsl) {
        this.commentService = commentService;
        this.dsl = dsl;
    }

    @GetMapping
    public List<CommentDto> listComments(
            @PathVariable Long postId,
            @RequestParam(defaultValue = "oldest") String sort,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        return commentService.listComments(postId, userId, sort);
    }

    @PostMapping
    public ResponseEntity<?> createComment(
            @PathVariable Long postId,
            @RequestBody CreateCommentRequest request,
            Authentication auth
    ) {
        if (request.content == null || request.content.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Content is required"));
        }
        Long authorId = resolveUserId(auth.getName());
        if (authorId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }
        CommentDto comment = commentService.create(postId, request.content, authorId);
        return ResponseEntity.ok(comment);
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<?> deleteComment(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }
        boolean isAdmin = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN"));

        boolean deleted = commentService.delete(commentId, userId, isAdmin);
        if (!deleted) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to delete this comment"));
        }
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/{commentId}/like")
    public ResponseEntity<?> toggleLike(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }
        ReactionResult result = commentService.toggleLike(commentId, userId);
        return ResponseEntity.ok(Map.of(
                "liked", result.liked(), "disliked", result.disliked(),
                "likeCount", result.likeCount(), "dislikeCount", result.dislikeCount()));
    }

    @PostMapping("/{commentId}/dislike")
    public ResponseEntity<?> toggleDislike(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            Authentication auth
    ) {
        Long userId = resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }
        ReactionResult result = commentService.toggleDislike(commentId, userId);
        return ResponseEntity.ok(Map.of(
                "liked", result.liked(), "disliked", result.disliked(),
                "likeCount", result.likeCount(), "dislikeCount", result.dislikeCount()));
    }

    // ── Helpers ──

    private Long resolveUserId(String username) {
        var rec = dsl.select(USERS.ID)
                .from(USERS)
                .where(USERS.USERNAME.eq(username))
                .fetchOne();
        return rec != null ? rec.value1() : null;
    }

    // ── Request body ──

    public static class CreateCommentRequest {
        public String content;
    }
}
