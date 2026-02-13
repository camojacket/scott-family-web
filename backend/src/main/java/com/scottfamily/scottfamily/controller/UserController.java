// src/main/java/com/scottfamily/scottfamily/controller/UserController.java
package com.scottfamily.scottfamily.controller;

import com.scottfamily.scottfamily.dto.DTOs;
import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static org.jooq.impl.DSL.selectOne;

@RestController
@RequiredArgsConstructor
public class UserController {

    private final DSLContext dsl;

    // Inline field refs for PEOPLE columns not yet in generated jOOQ classes
    private static final org.jooq.Field<String> P_MIDDLE_NAME        = DSL.field(DSL.name("middle_name"),        String.class);
    private static final org.jooq.Field<String> P_PREFIX             = DSL.field(DSL.name("prefix"),             String.class);
    private static final org.jooq.Field<String> P_SUFFIX             = DSL.field(DSL.name("suffix"),             String.class);
    private static final org.jooq.Field<String> P_BIO                = DSL.field(DSL.name("bio"),                String.class);
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL = DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<String> P_BANNER_IMAGE_URL   = DSL.field(DSL.name("banner_image_url"),   String.class);
    private static final org.jooq.Field<String> P_LOCATION           = DSL.field(DSL.name("location"),           String.class);
    private static final org.jooq.Field<LocalDate> P_DATE_OF_DEATH   = DSL.field(DSL.name("date_of_death"),      LocalDate.class);

    /**
     * Update current user profile.
     *
     * After V12, ALL profile data lives on PEOPLE.
     * USERS only stores username, email, password_hash, user_role, person_id.
     *
     * motherId / fatherId are ignored here — submit parent changes via
     * /api/profile-change-requests for admin review.
     */
    @PutMapping("/api/users/me")
    public DTOs.ProfileDto updateMe(
            @AuthenticationPrincipal User principal,
            @RequestBody Map<String, Object> body
    ) {
        return dsl.transactionResult(cfg -> {
            var d = DSL.using(cfg);

            UsersRecord me = d.selectFrom(USERS)
                    .where(USERS.USERNAME.eq(principal.getUsername()))
                    .fetchOne();
            if (me == null) {
                throw new IllegalArgumentException("User not found");
            }

            // ---- Parse fields from body (all optional) ----
            String username          = str(body.get("username"));
            String email             = str(body.get("email"));
            String firstName         = str(body.get("firstName"));
            String lastName          = str(body.get("lastName"));
            String middleName        = str(body.get("middleName"));
            String prefix            = str(body.get("prefix"));
            String suffix            = str(body.get("suffix"));
            String bio               = str(body.get("bio"));
            String profilePictureUrl = str(body.get("profilePictureUrl"));
            String bannerImageUrl    = str(body.get("bannerImageUrl"));
            String location          = str(body.get("location"));
            LocalDate dateOfBirth    = date(body.get("dateOfBirth"));

            // ---- Update USERS (auth-only columns) ----
            if (notBlank(username))          me.setUsername(username);
            if (notBlank(email))             me.setEmail(email);
            me.update();

            // ---- Ensure a linked PEOPLE row exists; create if missing ----
            Long personId = me.getPersonId();
            if (personId == null) {
                personId = d.insertInto(PEOPLE)
                        .set(PEOPLE.FIRST_NAME, firstName)
                        .set(PEOPLE.LAST_NAME,  lastName)
                        .set(P_MIDDLE_NAME,     middleName)
                        .set(P_PREFIX,          prefix)
                        .set(P_SUFFIX,          suffix)
                        .set(P_BIO,             bio)
                        .set(P_PROFILE_PICTURE_URL, profilePictureUrl)
                        .set(P_BANNER_IMAGE_URL,    bannerImageUrl)
                        .set(P_LOCATION,        location)
                        .set(PEOPLE.DATE_OF_BIRTH, dateOfBirth)
                        .returning(PEOPLE.ID)
                        .fetchOne(PEOPLE.ID);

                me.setPersonId(personId);
                me.update();
            } else {
                // ---- Write ALL profile data to PEOPLE ----
                var pUpd = d.update(PEOPLE).set(PEOPLE.ID, PEOPLE.ID); // no-op seed
                if (notBlank(firstName))       pUpd = pUpd.set(PEOPLE.FIRST_NAME, firstName);
                if (lastName != null)          pUpd = pUpd.set(PEOPLE.LAST_NAME,  lastName.isBlank() ? null : lastName);
                if (middleName != null)        pUpd = pUpd.set(P_MIDDLE_NAME,     middleName.isBlank() ? null : middleName);
                if (prefix != null)            pUpd = pUpd.set(P_PREFIX,          prefix.isBlank() ? null : prefix);
                if (suffix != null)            pUpd = pUpd.set(P_SUFFIX,          suffix.isBlank() ? null : suffix);
                if (bio != null)               pUpd = pUpd.set(P_BIO,             bio);
                if (profilePictureUrl != null)  pUpd = pUpd.set(P_PROFILE_PICTURE_URL, profilePictureUrl);
                if (bannerImageUrl != null)     pUpd = pUpd.set(P_BANNER_IMAGE_URL,    bannerImageUrl);
                if (location != null)          pUpd = pUpd.set(P_LOCATION,        location);
                if (dateOfBirth != null)        pUpd = pUpd.set(PEOPLE.DATE_OF_BIRTH, dateOfBirth);
                pUpd.where(PEOPLE.ID.eq(personId)).execute();
            }

            // ---- Build response: read profile data from PEOPLE ----
            Record personRec = d.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, P_MIDDLE_NAME, P_PREFIX, P_SUFFIX,
                            PEOPLE.DATE_OF_BIRTH, P_DATE_OF_DEATH, PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID,
                            P_BIO, P_PROFILE_PICTURE_URL, P_BANNER_IMAGE_URL, P_LOCATION)
                    .from(PEOPLE)
                    .where(PEOPLE.ID.eq(personId))
                    .fetchOne();

            String displayName = personRec != null
                    ? DTOs.buildDisplayName(
                            personRec.get(P_PREFIX),
                            personRec.get(PEOPLE.FIRST_NAME),
                            personRec.get(P_MIDDLE_NAME),
                            personRec.get(PEOPLE.LAST_NAME),
                            personRec.get(P_SUFFIX))
                    : null;

            LocalDateTime joinedAt =
                    me.getApprovedAt() != null ? me.getApprovedAt()
                            : me.getRequestedAt() != null ? me.getRequestedAt()
                            : me.getCreatedAt();

            return DTOs.ProfileDto.builder()
                    .personId(me.getPersonId())
                    .hasAccount(true)
                    .id(me.getId())
                    .username(me.getUsername())
                    .email(me.getEmail())
                    .userRole(me.getUserRole())
                    .joinedAt(joinedAt)
                    .displayName(displayName)
                    .bio(personRec != null ? personRec.get(P_BIO) : null)
                    .profilePictureUrl(personRec != null ? personRec.get(P_PROFILE_PICTURE_URL) : null)
                    .bannerImageUrl(personRec != null ? personRec.get(P_BANNER_IMAGE_URL) : null)
                    .motherId(personRec != null ? personRec.get(PEOPLE.MOTHER_ID) : null)
                    .fatherId(personRec != null ? personRec.get(PEOPLE.FATHER_ID) : null)
                    .dateOfBirth(personRec != null ? personRec.get(PEOPLE.DATE_OF_BIRTH) : null)
                    .dateOfDeath(personRec != null ? personRec.get(P_DATE_OF_DEATH) : null)
                    .location(personRec != null ? personRec.get(P_LOCATION) : null)
                    .parents(List.of())
                    .children(List.of())
                    .siblings(List.of())
                    .spouses(List.of())
                    .build();
        });
    }

    /* ============================== Helpers ============================== */

    private static String str(Object o) {
        return (o == null) ? null : String.valueOf(o).trim();
    }

    private static LocalDate date(Object o) {
        if (o == null) return null;
        var s = String.valueOf(o).trim();
        if (s.isEmpty()) return null;
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date (yyyy-MM-dd expected): " + s);
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
