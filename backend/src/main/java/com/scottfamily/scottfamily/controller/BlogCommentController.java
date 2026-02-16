package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.BlogCommentService;
import com.scottfamily.scottfamily.service.BlogCommentService.CommentDto;
import com.scottfamily.scottfamily.service.BlogCommentService.ReactionResult;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

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
    private final UserHelper userHelper;

    public BlogCommentController(BlogCommentService commentService, UserHelper userHelper) {
        this.commentService = commentService;
        this.userHelper = userHelper;
    }

    @GetMapping
    public List<CommentDto> listComments(
            @PathVariable Long postId,
            @RequestParam(defaultValue = "oldest") String sort,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
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
        Long authorId = userHelper.resolveUserId(auth.getName());
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
        Long userId = userHelper.resolveUserId(auth.getName());
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
        Long userId = userHelper.resolveUserId(auth.getName());
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
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }
        ReactionResult result = commentService.toggleDislike(commentId, userId);
        return ResponseEntity.ok(Map.of(
                "liked", result.liked(), "disliked", result.disliked(),
                "likeCount", result.likeCount(), "dislikeCount", result.dislikeCount()));
    }

    // ── Request body ──

    public static class CreateCommentRequest {
        public String content;
    }
}
