package com.scottfamily.scottfamily.service;

import com.scottfamily.scottfamily.dto.DTOs;
import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.jooq.impl.DSL;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.jooq.Field;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static org.jooq.impl.DSL.selectOne;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final DSLContext dsl;
    private final PasswordEncoder passwordEncoder;
    private final UserDetailsService userDetailsService;
    private final SiteSettingsService siteSettings;

    // Inline field refs for PEOPLE columns (pending jOOQ regen after V12)
    private static final Field<String> P_MIDDLE_NAME        = DSL.field(DSL.name("middle_name"),        String.class);
    private static final Field<String> P_PREFIX             = DSL.field(DSL.name("prefix"),             String.class);
    private static final Field<String> P_SUFFIX             = DSL.field(DSL.name("suffix"),             String.class);
    private static final Field<String> P_BIO                = DSL.field(DSL.name("bio"),                String.class);
    private static final Field<String> P_PROFILE_PICTURE_URL = DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final Field<String> P_BANNER_IMAGE_URL   = DSL.field(DSL.name("banner_image_url"),   String.class);
    private static final Field<String> P_LOCATION           = DSL.field(DSL.name("location"),           String.class);
    private static final Field<LocalDate> P_DATE_OF_DEATH   = DSL.field(DSL.name("date_of_death"),      LocalDate.class);

    // Ban support columns (inline until jOOQ regen)
    private static final Field<java.time.OffsetDateTime> U_BANNED_UNTIL = DSL.field(DSL.name("banned_until"), java.time.OffsetDateTime.class);
    private static final Field<String>                   U_BAN_REASON   = DSL.field(DSL.name("ban_reason"),   String.class);
    private static final Field<Long>                     U_ARCHIVED_CLAIM_PERSON_ID = DSL.field(DSL.name("archived_claim_person_id"), Long.class);
    private static final Field<Boolean>                  IS_ARCHIVED    = DSL.field(DSL.name("is_archived"), Boolean.class);

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

        // Check if user is banned
        java.time.OffsetDateTime bannedUntil = dsl.select(U_BANNED_UNTIL)
                .from(USERS).where(USERS.ID.eq(user.getId()))
                .fetchOne(U_BANNED_UNTIL);
        if (bannedUntil != null && bannedUntil.isAfter(java.time.OffsetDateTime.now())) {
            String reason = dsl.select(U_BAN_REASON)
                    .from(USERS).where(USERS.ID.eq(user.getId()))
                    .fetchOne(U_BAN_REASON);
            boolean permanent = bannedUntil.getYear() >= 9999;
            String msg = permanent
                    ? "BANNED|permanent|" + (reason != null ? reason : "")
                    : "BANNED|" + bannedUntil.toString() + "|" + (reason != null ? reason : "");
            throw new IllegalStateException(msg);
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        Authentication auth = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        SecurityContextHolder.getContext().setAuthentication(auth);

        // Ensure PEOPLE row exists for legacy users with null person_id
        if (user.getPersonId() == null) {
            Long personId = dsl.insertInto(PEOPLE)
                    .set(PEOPLE.FIRST_NAME, (String) null)
                    .set(PEOPLE.LAST_NAME,  (String) null)
                    .returning(PEOPLE.ID)
                    .fetchOne(PEOPLE.ID);
            user.setPersonId(personId);
            user.update();
        }

        return toProfile(user);
    }

    public DTOs.SignupResponse signup(DTOs.SignupRequest req) {
        return dsl.transactionResult(tx -> {
            final var d = DSL.using(tx);

            // 1) Prevent duplicates
            boolean exists = d.fetchExists(
                    selectOne().from(USERS)
                            .where(USERS.USERNAME.eq(req.username()))
                            .or(USERS.EMAIL.eq(req.email()))
            );
            if (exists) throw new IllegalArgumentException("Username or email already in use.");

            // 2) Resolve parents: prefer IDs; otherwise create/reuse by name+dob
            Long motherId = null;
            if (req.motherId() != null) {
                motherId = ensurePersonExists(d, req.motherId(), "Mother");
            } else if (req.motherName() != null && !req.motherName().isBlank()) {
                motherId = upsertPersonByNameDob(d, req.motherName(), req.motherDateOfBirth());
            }

            Long fatherId = null;
            if (req.fatherId() != null) {
                fatherId = ensurePersonExists(d, req.fatherId(), "Father");
            } else if (req.fatherName() != null && !req.fatherName().isBlank()) {
                fatherId = upsertPersonByNameDob(d, req.fatherName(), req.fatherDateOfBirth());
            }

            // 3) Person row: either claim an existing profile or create a new one
            Long personId;
            if (req.claimPersonId() != null) {
                // Profile claim: verify the person exists and is NOT already linked to a user
                boolean personExists = d.fetchExists(
                        selectOne().from(PEOPLE).where(PEOPLE.ID.eq(req.claimPersonId())));
                if (!personExists)
                    throw new IllegalArgumentException("Person not found for claim (id=" + req.claimPersonId() + ")");
                boolean alreadyLinked = d.fetchExists(
                        selectOne().from(USERS).where(USERS.PERSON_ID.eq(req.claimPersonId())));
                if (alreadyLinked)
                    throw new IllegalArgumentException("This person profile is already linked to another account.");

                // Prevent claiming deceased profiles
                boolean isDeceased = d.fetchExists(
                        selectOne().from(PEOPLE)
                                .where(PEOPLE.ID.eq(req.claimPersonId()))
                                .and(PEOPLE.DATE_OF_DEATH.isNotNull()
                                        .or(DSL.field(DSL.name("is_deceased"), Boolean.class).eq(true))));
                if (isDeceased)
                    throw new IllegalArgumentException("Deceased profiles cannot be claimed. Contact an admin if this is an error.");

                personId = req.claimPersonId();

                // Update the claimed PEOPLE row with signup info
                d.update(PEOPLE)
                        .set(PEOPLE.FIRST_NAME, req.firstName())
                        .set(PEOPLE.LAST_NAME,  req.lastName())
                        .set(P_MIDDLE_NAME,     req.middleName())
                        .set(P_PREFIX,          req.prefix())
                        .set(P_SUFFIX,          req.suffix())
                        .set(P_BIO,             req.bio())
                        .set(P_PROFILE_PICTURE_URL, req.profilePictureUrl())
                        .set(P_BANNER_IMAGE_URL,    req.bannerImageUrl())
                        .set(P_LOCATION,        req.location())
                        .where(PEOPLE.ID.eq(personId))
                        .execute();
            } else {
                // Create the user's corresponding people row with all profile data
                personId = d.insertInto(PEOPLE)
                        .set(PEOPLE.FIRST_NAME, req.firstName())
                        .set(PEOPLE.LAST_NAME,  req.lastName())
                        .set(P_MIDDLE_NAME,     req.middleName())
                        .set(P_PREFIX,          req.prefix())
                        .set(P_SUFFIX,          req.suffix())
                        .set(PEOPLE.DATE_OF_BIRTH, req.dateOfBirth())
                        .set(PEOPLE.MOTHER_ID, motherId)
                        .set(PEOPLE.FATHER_ID, fatherId)
                        .set(P_BIO,             req.bio())
                        .set(P_PROFILE_PICTURE_URL, req.profilePictureUrl())
                        .set(P_BANNER_IMAGE_URL,    req.bannerImageUrl())
                        .set(P_LOCATION,        req.location())
                        .returning(PEOPLE.ID)
                        .fetchOne(PEOPLE.ID);

                // Insert PERSON_PARENT rows with relation
                if (personId != null && motherId != null) {
                    String motherRel = req.motherRelation() != null && !req.motherRelation().isBlank()
                            ? req.motherRelation() : "BIOLOGICAL_MOTHER";
                    upsertPersonParent(d, personId, motherId, motherRel);
                }
                if (personId != null && fatherId != null) {
                    String fatherRel = req.fatherRelation() != null && !req.fatherRelation().isBlank()
                            ? req.fatherRelation() : "BIOLOGICAL_FATHER";
                    upsertPersonParent(d, personId, fatherId, fatherRel);
                }
            }

            // 4) Create user (auth-only columns)
            var u = d.newRecord(USERS);
            u.setUsername(req.username());
            u.setPasswordHash(passwordEncoder.encode(req.password()));
            u.setEmail(req.email());
            u.setRequestedAt(LocalDateTime.now());
            u.setUserRole("ROLE_USER");
            u.setPersonId(personId);

            // Detect if this signup involves an archived profile claim
            boolean isArchivedClaim = req.claimPersonId() != null && d.fetchExists(
                    selectOne().from(PEOPLE)
                            .where(PEOPLE.ID.eq(req.claimPersonId()))
                            .and(IS_ARCHIVED.eq(true)));

            // Auto-approve if bypass is enabled — EXCEPT for archived claims which always need admin review
            if (siteSettings.isEnabled(SiteSettingsService.BYPASS_SIGNUP_APPROVAL) && !isArchivedClaim) {
                u.setApprovedAt(LocalDateTime.now());
            }

            u.store();

            // If this is an archived claim, record it on the user row for admin visibility
            if (isArchivedClaim) {
                d.update(USERS)
                        .set(U_ARCHIVED_CLAIM_PERSON_ID, req.claimPersonId())
                        .where(USERS.ID.eq(u.getId()))
                        .execute();
            }

            // 5) Return signup result with approval status
            boolean approved = u.getApprovedAt() != null;
            String message = approved
                    ? "You've successfully signed up! You can now log in."
                    : "Your signup request has been submitted. You'll receive an email once your account is approved.";
            return new DTOs.SignupResponse(approved, message);
        });
    }

    /* ------------ Helpers ------------ */

    /** If id exists in PEOPLE, return it; else fail with clear message. */
    private Long ensurePersonExists(DSLContext d, Long id, String label) {
        boolean ok = d.fetchExists(selectOne().from(PEOPLE).where(PEOPLE.ID.eq(id)));
        if (!ok) throw new IllegalArgumentException(label + " not found (invalid person id: " + id + ")");
        return id;
    }

    /** Create or reuse a person by (first,last,dob). */
    private Long upsertPersonByNameDob(DSLContext d, String fullName, java.time.LocalDate dob) {
        String first = extractFirstName(fullName);
        String last  = extractLastName(fullName);

        // Try to find an existing person with same name + (optional) DOB
        var cond = PEOPLE.FIRST_NAME.eq(first == null ? "" : first)
                .and(PEOPLE.LAST_NAME.eq(last == null ? "" : last));
        if (dob != null) cond = cond.and(PEOPLE.DATE_OF_BIRTH.eq(dob));

        Long existing = d.select(PEOPLE.ID)
                .from(PEOPLE)
                .where(cond)
                .limit(1)
                .fetchOne(PEOPLE.ID);

        if (existing != null) return existing;

        // Otherwise create
        return d.insertInto(PEOPLE)
                .set(PEOPLE.FIRST_NAME, first)
                .set(PEOPLE.LAST_NAME,  last)
                .set(PEOPLE.DATE_OF_BIRTH, dob)
                .returning(PEOPLE.ID)
                .fetchOne(PEOPLE.ID);
    }

    private static String extractFirstName(String fullName) {
        if (fullName == null) return null;
        String[] parts = fullName.trim().split("\\s+");
        return parts.length > 0 ? parts[0] : null;
    }

    private static String extractLastName(String fullName) {
        if (fullName == null) return null;
        String[] parts = fullName.trim().split("\\s+");
        return parts.length > 1 ? String.join(" ", java.util.Arrays.copyOfRange(parts, 1, parts.length)) : null;
    }


    /* ========================== DTO MAPPING ========================== */

    /**
     * Build a ProfileDto for a user by joining to their PEOPLE row.
     * All profile data lives on PEOPLE; USERS only has auth fields.
     */
    private DTOs.ProfileDto toProfile(UsersRecord user) {
        final LocalDateTime joinedAt =
                user.getApprovedAt() != null ? user.getApprovedAt()
                        : user.getRequestedAt() != null ? user.getRequestedAt()
                        : user.getCreatedAt();

        // Fetch profile data from PEOPLE
        Record personRec = null;
        if (user.getPersonId() != null) {
            personRec = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, P_MIDDLE_NAME, P_PREFIX, P_SUFFIX,
                            PEOPLE.DATE_OF_BIRTH, P_DATE_OF_DEATH, PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID,
                            P_BIO, P_PROFILE_PICTURE_URL, P_BANNER_IMAGE_URL, P_LOCATION)
                    .from(PEOPLE)
                    .where(PEOPLE.ID.eq(user.getPersonId()))
                    .fetchOne();
        }

        String prefix = personRec != null ? personRec.get(P_PREFIX) : null;
        String firstName = personRec != null ? personRec.get(PEOPLE.FIRST_NAME) : null;
        String middleName = personRec != null ? personRec.get(P_MIDDLE_NAME) : null;
        String lastName = personRec != null ? personRec.get(PEOPLE.LAST_NAME) : null;
        String suffix = personRec != null ? personRec.get(P_SUFFIX) : null;
        LocalDate dob = personRec != null ? personRec.get(PEOPLE.DATE_OF_BIRTH) : null;
        LocalDate dod = personRec != null ? personRec.get(P_DATE_OF_DEATH) : null;

        String displayName = personRec != null
                ? PeopleService.fullDisplayName(prefix, firstName, middleName, lastName, suffix, dob, dod)
                : null;

        return DTOs.ProfileDto.builder()
                .personId(user.getPersonId())
                .hasAccount(true)
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .userRole(user.getUserRole())
                .joinedAt(joinedAt)
                .displayName(displayName)
                .prefix(prefix)
                .firstName(firstName)
                .middleName(middleName)
                .lastName(lastName)
                .suffix(suffix)
                .bio(personRec != null ? personRec.get(P_BIO) : null)
                .profilePictureUrl(personRec != null ? personRec.get(P_PROFILE_PICTURE_URL) : null)
                .bannerImageUrl(personRec != null ? personRec.get(P_BANNER_IMAGE_URL) : null)
                .motherId(personRec != null ? personRec.get(PEOPLE.MOTHER_ID) : null)
                .fatherId(personRec != null ? personRec.get(PEOPLE.FATHER_ID) : null)
                .dateOfBirth(dob)
                .dateOfDeath(dod)
                .location(personRec != null ? personRec.get(P_LOCATION) : null)
                .parents(List.of())
                .children(List.of())
                .siblings(List.of())
                .spouses(List.of())
                .build();
    }

    /** Upsert a row in PERSON_PARENT (childId → parentId with given relation). */
    private void upsertPersonParent(DSLContext d, Long childId, Long parentId, String relation) {
        boolean exists = d.fetchExists(
                selectOne()
                        .from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(relation))
        );
        if (!exists) {
            d.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID,
                            PERSON_PARENT.PARENT_PERSON_ID,
                            PERSON_PARENT.RELATION,
                            PERSON_PARENT.VALID_FROM)
                    .values(childId, parentId, relation, LocalDate.now())
                    .execute();
        }
    }
}
