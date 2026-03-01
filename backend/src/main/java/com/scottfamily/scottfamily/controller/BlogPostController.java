package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.service.BlogPostService;
import com.scottfamily.scottfamily.service.BlogPostService.BlogPostDto;
import com.scottfamily.scottfamily.service.BlogPostService.ReactionResult;
import com.scottfamily.scottfamily.service.UserHelper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;

/**
 * REST API for blog posts.
 *
 *   GET    /api/blog-posts             — list all posts (sort: newest|oldest|popular)
 *   POST   /api/blog-posts             — create a new post
 *   DELETE /api/blog-posts/{id}        — delete (admin or author)
 *   POST   /api/blog-posts/{id}/like   — toggle like
 */
@RestController
@RequestMapping("/api/blog-posts")
@PreAuthorize("isAuthenticated()")
public class BlogPostController {

    private final BlogPostService blogPostService;
    private final UserHelper userHelper;

    public BlogPostController(BlogPostService blogPostService, UserHelper userHelper) {
        this.blogPostService = blogPostService;
        this.userHelper = userHelper;
    }

    @GetMapping
    public List<BlogPostDto> listPosts(
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "50") int limit,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        return blogPostService.listAll(userId, sort, offset, Math.min(limit, 100));
    }

    @PostMapping
    public ResponseEntity<?> createPost(
            @Valid @RequestBody CreatePostRequest request,
            Authentication auth
    ) {
        if (request.title == null || request.title.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Title is required"));
        }

        Long authorId = userHelper.resolveUserId(auth.getName());
        if (authorId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        BlogPostDto post = blogPostService.create(
                request.title.trim(),
                request.content,
                authorId
        );
        return ResponseEntity.ok(post);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deletePost(
            @PathVariable Long id,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        boolean isAdmin = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_ADMIN"));

        boolean deleted = blogPostService.delete(id, userId, isAdmin);
        if (!deleted) {
            return ResponseEntity.status(403).body(Map.of("error", "Not authorized to delete this post"));
        }
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<?> toggleLike(
            @PathVariable Long id,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        ReactionResult result = blogPostService.toggleLike(id, userId);
        return ResponseEntity.ok(Map.of(
                "liked", result.liked(), "disliked", result.disliked(),
                "likeCount", result.likeCount(), "dislikeCount", result.dislikeCount()));
    }

    @PostMapping("/{id}/dislike")
    public ResponseEntity<?> toggleDislike(
            @PathVariable Long id,
            Authentication auth
    ) {
        Long userId = userHelper.resolveUserId(auth.getName());
        if (userId == null) {
            return ResponseEntity.status(403).body(Map.of("error", "Could not resolve user"));
        }

        ReactionResult result = blogPostService.toggleDislike(id, userId);
        return ResponseEntity.ok(Map.of(
                "liked", result.liked(), "disliked", result.disliked(),
                "likeCount", result.likeCount(), "dislikeCount", result.dislikeCount()));
    }

    // ── Request body ──

    public static class CreatePostRequest {
        public String title;
        public String content;
    }
}
