package com.scottfamily.scottfamily.dto;

import java.util.List;

public class DTOs {

    public record CommentDto(
            Long id,
            Long postId,
            String author,
            String content,
            String createdAt
    ) {}

    public record FamilyNodeDto(
            Long id,
            String name,
            List<FamilyNodeDto> children
    ) {}

    public record PaymentRequest(
            String sourceId,
            long amount,
            String currency,
            String email
    ) {}

    public record LoginRequest(
            String username,
            String password
    ) {}

    public record ProfileDto(
            Long id,
            String username,
            String displayName,
            String email,
            String userRole, // 👈 NEW
            String bio,
            String profilePictureUrl,
            String bannerImageUrl
    ) {}

    public record SignupRequest(
            String username,
            String password,
            String displayName,
            String email,
            String bio,                        // ✅ New
            String profilePictureUrl,         // ✅ New (URL or blob path)
            String bannerImageUrl             // ✅ New
    ) {}

    public record PendingUserDto(
            Long id,
            String username,
            String displayName,
            String email,
            String requestedAt
    ) {}
}