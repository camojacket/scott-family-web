package com.scottfamily.scottfamily.service;

import com.scottfamily.scottfamily.dto.DTOs;
import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static org.jooq.impl.DSL.selectOne;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final DSLContext dsl;
    private final PasswordEncoder passwordEncoder;

    public DTOs.ProfileDto authenticate(DTOs.LoginRequest req) {
        UsersRecord user = dsl.selectFrom(USERS)
                .where(USERS.USERNAME.eq(req.username()))
                .fetchOne();

        if (user == null || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Bad credentials");
        }

        if (user.getApprovedAt() == null) {
            throw new IllegalStateException("Account pending approval.");
        }

        return new DTOs.ProfileDto(
                user.getId(),
                user.getUsername(),
                user.getDisplayName(),
                user.getEmail(),
                user.getUserRole(),
                user.getBio(),
                user.getProfilePictureUrl(),
                user.getBannerImageUrl()
        );
    }

    public DTOs.ProfileDto signup(DTOs.SignupRequest req) {
        boolean exists = dsl.fetchExists(
                selectOne()
                        .from(USERS)
                        .where(USERS.USERNAME.eq(req.username())
                                .or(USERS.EMAIL.eq(req.email())))
        );

        if (exists) {
            throw new IllegalArgumentException("Username or email already in use.");
        }

        UsersRecord newUser = dsl.newRecord(USERS);
        newUser.setUsername(req.username());
        newUser.setPasswordHash(passwordEncoder.encode(req.password()));
        newUser.setDisplayName(req.displayName());
        newUser.setEmail(req.email());
        newUser.setRequestedAt(LocalDateTime.now()); // ✅ Track request time
        newUser.setUserRole("ROLE_USER"); // 👈 Default role
        newUser.store();
        newUser.setBio(req.bio());
        newUser.setProfilePictureUrl(req.profilePictureUrl()); // from blob upload later
        newUser.setBannerImageUrl(req.bannerImageUrl());        // from blob upload later
        newUser.store();

        return new DTOs.ProfileDto(
                newUser.getId(),
                newUser.getUsername(),
                newUser.getDisplayName(),
                newUser.getEmail(),
                newUser.getUserRole(),
                newUser.getBio(),
                newUser.getProfilePictureUrl(),
                newUser.getBannerImageUrl()
        );
    }
}
