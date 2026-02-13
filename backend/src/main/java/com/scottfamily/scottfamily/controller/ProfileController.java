// src/main/java/com/scottfamily/scottfamily/controller/ProfileController.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final DSLContext dsl;

    // Inline field refs for PEOPLE columns not yet in generated jOOQ classes
    private static final org.jooq.Field<String> P_MIDDLE_NAME        = DSL.field(DSL.name("middle_name"),        String.class);
    private static final org.jooq.Field<String> P_PREFIX             = DSL.field(DSL.name("prefix"),             String.class);
    private static final org.jooq.Field<String> P_SUFFIX             = DSL.field(DSL.name("suffix"),             String.class);
    private static final org.jooq.Field<String> P_BIO                = DSL.field(DSL.name("bio"),                String.class);
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL = DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<String> P_BANNER_IMAGE_URL   = DSL.field(DSL.name("banner_image_url"),   String.class);
    private static final org.jooq.Field<String> P_LOCATION           = DSL.field(DSL.name("location"),           String.class);

    @Value("${uploads.dir:uploads}")
    private String uploadsDir;

    public record UpdateProfile(
            String firstName,
            String lastName,
            String middleName,
            String prefix,
            String suffix,
            String bio,
            LocalDate dateOfBirth,
            String location,
            String bannerImageUrl,
            String profilePictureUrl
    ) {}

    /**
     * After V12, ALL profile data lives on PEOPLE.
     * This endpoint resolves the user's person_id, then writes directly to PEOPLE.
     */
    @PutMapping("/{userId}")
    public void update(@PathVariable Long userId, @RequestBody UpdateProfile body) {
        // Resolve person_id from user
        Long personId = dsl.select(USERS.PERSON_ID).from(USERS)
                .where(USERS.ID.eq(userId)).fetchOneInto(Long.class);

        if (personId == null) {
            // Create a PEOPLE row if needed
            personId = dsl.insertInto(PEOPLE)
                    .set(PEOPLE.FIRST_NAME, body.firstName())
                    .set(PEOPLE.LAST_NAME,  body.lastName())
                    .set(P_MIDDLE_NAME,     body.middleName())
                    .set(P_PREFIX,          body.prefix())
                    .set(P_SUFFIX,          body.suffix())
                    .set(P_BIO,             body.bio())
                    .set(P_PROFILE_PICTURE_URL, body.profilePictureUrl())
                    .set(P_BANNER_IMAGE_URL,    body.bannerImageUrl())
                    .set(PEOPLE.DATE_OF_BIRTH,  body.dateOfBirth())
                    .set(P_LOCATION,        body.location())
                    .returning(PEOPLE.ID)
                    .fetchOne(PEOPLE.ID);
            dsl.update(USERS).set(USERS.PERSON_ID, personId)
                    .where(USERS.ID.eq(userId)).execute();
        } else {
            // Write all profile data to PEOPLE
            var upd = dsl.update(PEOPLE)
                    .set(PEOPLE.FIRST_NAME, body.firstName())
                    .set(PEOPLE.LAST_NAME,  body.lastName())
                    .set(P_MIDDLE_NAME,     body.middleName())
                    .set(P_PREFIX,          body.prefix())
                    .set(P_SUFFIX,          body.suffix())
                    .set(P_BIO,             body.bio())
                    .set(P_BANNER_IMAGE_URL, body.bannerImageUrl())
                    .set(PEOPLE.DATE_OF_BIRTH, body.dateOfBirth())
                    .set(P_LOCATION,        body.location());

            if (StringUtils.hasText(body.profilePictureUrl())) {
                upd.set(P_PROFILE_PICTURE_URL, body.profilePictureUrl());
            }
            upd.where(PEOPLE.ID.eq(personId)).execute();
        }
    }

    @PostMapping(path = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public String upload(@RequestPart("file") MultipartFile file) throws Exception {
        Files.createDirectories(Path.of(uploadsDir));
        var cleanName = System.currentTimeMillis() + "-" + file.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_");
        var path = Path.of(uploadsDir, cleanName);
        file.transferTo(path.toFile());
        return "/uploads/" + cleanName;
    }
}
