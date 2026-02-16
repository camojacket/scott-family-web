package com.scottfamily.scottfamily.service;

import static com.yourproject.generated.scott_family_web.tables.People.PEOPLE;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static com.yourproject.generated.scott_family_web.tables.Users.USERS;
import static org.jooq.impl.DSL.selectOne;

import com.scottfamily.scottfamily.dto.*;
import lombok.RequiredArgsConstructor;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PeopleService {
    private final DSLContext dsl;

    // Inline field references for PEOPLE columns not yet in generated jOOQ classes
    private static final org.jooq.Field<LocalDate> DATE_OF_DEATH =
            DSL.field(DSL.name("date_of_death"), LocalDate.class);
    private static final org.jooq.Field<String> P_MIDDLE_NAME =
            DSL.field(DSL.name("middle_name"), String.class);
    private static final org.jooq.Field<String> P_PREFIX =
            DSL.field(DSL.name("prefix"), String.class);
    private static final org.jooq.Field<String> P_SUFFIX =
            DSL.field(DSL.name("suffix"), String.class);
    private static final org.jooq.Field<String> P_BIO =
            DSL.field(DSL.name("bio"), String.class);
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL =
            DSL.field(DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<String> P_BANNER_IMAGE_URL =
            DSL.field(DSL.name("banner_image_url"), String.class);
    private static final org.jooq.Field<String> P_LOCATION =
            DSL.field(DSL.name("location"), String.class);
    private static final org.jooq.Field<Boolean> IS_DECEASED =
            DSL.field(DSL.name("is_deceased"), Boolean.class);
    private static final org.jooq.Field<Boolean> IS_ARCHIVED =
            DSL.field(DSL.name("is_archived"), Boolean.class);

    /**
     * Build a full display name from all name parts, with optional birth–death year suffix.
     * Example: "Dr. John Michael Smith Jr. (1945–2020)"
     */
    public static String fullDisplayName(String prefix, String firstName, String middleName,
                                   String lastName, String suffix,
                                   LocalDate dob, LocalDate dod) {
        String name = DTOs.buildDisplayName(prefix, firstName, middleName, lastName, suffix);
        String years = yearRange(dob, dod);
        return years != null ? name + " " + years : name;
    }

    /** Returns "(YYYY–YYYY)", "(b. YYYY)", "(d. YYYY)", or null if no dates. */
    private static String yearRange(LocalDate dob, LocalDate dod) {
        if (dob != null && dod != null) return "(" + dob.getYear() + "–" + dod.getYear() + ")";
        if (dob != null)                return "(b. " + dob.getYear() + ")";
        if (dod != null)                return "(d. " + dod.getYear() + ")";
        return null;
    }

    public List<DTOs.PersonSummaryDto> searchPeople(String q, int limit) {
        return searchPeople(q, limit, true);
    }

    public List<DTOs.PersonSummaryDto> searchPeople(String q, int limit, boolean excludeArchived) {
        String like = "%" + q.trim() + "%";

        Condition cond = PEOPLE.FIRST_NAME.likeIgnoreCase(like)
                .or(PEOPLE.LAST_NAME.likeIgnoreCase(like))
                .or(DSL.concat(PEOPLE.FIRST_NAME, DSL.inline(" "), PEOPLE.LAST_NAME).likeIgnoreCase(like));
        if (excludeArchived) {
            cond = cond.and(IS_ARCHIVED.isNull().or(IS_ARCHIVED.eq(false)));
        }

        return dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH, IS_DECEASED,
                        P_PROFILE_PICTURE_URL,
                        USERS.USERNAME)
                .from(PEOPLE)
                .leftJoin(USERS).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(cond)
                .orderBy(PEOPLE.LAST_NAME.asc(), PEOPLE.FIRST_NAME.asc(), PEOPLE.DATE_OF_BIRTH.asc().nullsLast())
                .limit(limit)
                .fetch(r -> {
                    LocalDate dob = r.get(PEOPLE.DATE_OF_BIRTH);
                    LocalDate dod = r.get(DATE_OF_DEATH);
                    return DTOs.PersonSummaryDto.builder()
                            .personId(r.get(PEOPLE.ID))
                            .displayName(fullDisplayName(
                                    r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                    r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX), dob, dod))
                            .dateOfBirth(Optional.ofNullable(dob).map(LocalDate::toString).orElse(null))
                            .dateOfDeath(dod != null ? dod.toString() : null)
                            .deceased(dod != null)
                            .profilePictureUrl(r.get(P_PROFILE_PICTURE_URL))
                            .username(r.get(USERS.USERNAME))
                            .build();
                });
    }

    @Transactional
    public Long createPerson(DTOs.CreatePersonRequest req) {
        LocalDate dob = req.getDateOfBirth() != null && !req.getDateOfBirth().isBlank()
                ? LocalDate.parse(req.getDateOfBirth()) : null;
        LocalDate dod = req.getDateOfDeath() != null && !req.getDateOfDeath().isBlank()
                ? LocalDate.parse(req.getDateOfDeath()) : null;

        Long id = dsl.insertInto(PEOPLE)
                .set(PEOPLE.FIRST_NAME, req.getFirstName().trim())
                .set(PEOPLE.LAST_NAME, Optional.ofNullable(req.getLastName()).map(String::trim).orElse(null))
                .set(P_MIDDLE_NAME, req.getMiddleName() != null ? req.getMiddleName().trim() : null)
                .set(P_PREFIX, req.getPrefix() != null ? req.getPrefix().trim() : null)
                .set(P_SUFFIX, req.getSuffix() != null ? req.getSuffix().trim() : null)
                .set(PEOPLE.DATE_OF_BIRTH, dob)
                .set(DATE_OF_DEATH, dod)
                .set(PEOPLE.MOTHER_ID, req.getMotherId())
                .set(PEOPLE.FATHER_ID, req.getFatherId())
                .set(P_BIO, req.getBio() != null ? req.getBio().trim() : null)
                .set(P_PROFILE_PICTURE_URL, req.getProfilePictureUrl())
                .set(P_BANNER_IMAGE_URL, req.getBannerImageUrl())
                .set(P_LOCATION, req.getLocation() != null ? req.getLocation().trim() : null)
                .returning(PEOPLE.ID)
                .fetchOne(PEOPLE.ID);

        // Insert PERSON_PARENT rows for mother/father with relation
        if (id != null && req.getMotherId() != null) {
            String motherRel = req.getMotherRelation() != null && !req.getMotherRelation().isBlank()
                    ? req.getMotherRelation() : "BIOLOGICAL_MOTHER";
            upsertPersonParent(id, req.getMotherId(), motherRel);
        }
        if (id != null && req.getFatherId() != null) {
            String fatherRel = req.getFatherRelation() != null && !req.getFatherRelation().isBlank()
                    ? req.getFatherRelation() : "BIOLOGICAL_FATHER";
            upsertPersonParent(id, req.getFatherId(), fatherRel);
        }

        return id;
    }

    public DTOs.ProfileDto getProfile(Long personId) {
        var p = dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH, PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID,
                        P_BIO, P_PROFILE_PICTURE_URL, P_BANNER_IMAGE_URL, P_LOCATION, IS_DECEASED)
                .from(PEOPLE)
                .where(PEOPLE.ID.eq(personId))
                .fetchOne();

        // If not found by PEOPLE.ID, try treating the id as a USERS.ID
        // (family tree links may pass userId when personId isn't directly known)
        if (p == null) {
            var userRec = dsl.select(USERS.PERSON_ID)
                    .from(USERS)
                    .where(USERS.ID.eq(personId))
                    .fetchOne();
            if (userRec != null && userRec.get(USERS.PERSON_ID) != null) {
                personId = userRec.get(USERS.PERSON_ID);
                p = dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                                P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                                PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH, PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID,
                                P_BIO, P_PROFILE_PICTURE_URL, P_BANNER_IMAGE_URL, P_LOCATION, IS_DECEASED)
                        .from(PEOPLE)
                        .where(PEOPLE.ID.eq(personId))
                        .fetchOne();
            }
        }

        if (p == null) return null;

        // USERS only needed for hasAccount / username check
        var user = dsl.select(USERS.ID, USERS.USERNAME)
                .from(USERS)
                .where(USERS.PERSON_ID.eq(personId))
                .fetchOne();

        // Parents — collect from BOTH PEOPLE columns and PERSON_PARENT, then deduplicate by personId
        Map<Long, DTOs.PersonRelDto> parentMap = new LinkedHashMap<>();

        if (p.get(PEOPLE.MOTHER_ID) != null) {
            parentMap.put(p.get(PEOPLE.MOTHER_ID), relDto(p.get(PEOPLE.MOTHER_ID), "BIOLOGICAL_MOTHER"));
        }
        if (p.get(PEOPLE.FATHER_ID) != null) {
            parentMap.put(p.get(PEOPLE.FATHER_ID), relDto(p.get(PEOPLE.FATHER_ID), "BIOLOGICAL_FATHER"));
        }

        // Additional parents from PERSON_PARENT (step/adoptive/guardian + bio if not already added)
        dsl.select(PERSON_PARENT.PARENT_PERSON_ID, PERSON_PARENT.RELATION, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX, PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH)
                .from(PERSON_PARENT.join(PEOPLE).on(PEOPLE.ID.eq(PERSON_PARENT.PARENT_PERSON_ID)))
                .where(PERSON_PARENT.CHILD_PERSON_ID.eq(personId))
                .and(PERSON_PARENT.VALID_TO.isNull().or(PERSON_PARENT.VALID_TO.ge(DSL.currentLocalDate())))
                .fetch(r -> DTOs.PersonRelDto.builder()
                        .personId(r.get(PERSON_PARENT.PARENT_PERSON_ID))
                        .relation(r.get(PERSON_PARENT.RELATION))
                        .displayName(fullDisplayName(
                                r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX),
                                r.get(PEOPLE.DATE_OF_BIRTH), r.get(DATE_OF_DEATH)))
                        .build())
                .forEach(rel -> parentMap.putIfAbsent(rel.getPersonId(), rel)); // skip dupes

        List<DTOs.PersonRelDto> parents = new ArrayList<>(parentMap.values());

        // Siblings — same mother or same father (excluding self)
        // Use a map so we can track the relation type per sibling
        Map<Long, String> siblingRelMap = new LinkedHashMap<>();
        Long myMotherId = p.get(PEOPLE.MOTHER_ID);
        Long myFatherId = p.get(PEOPLE.FATHER_ID);

        // Siblings sharing the same mother
        Set<Long> maternalSibIds = new LinkedHashSet<>();
        if (myMotherId != null) {
            dsl.select(PEOPLE.ID).from(PEOPLE)
                    .where(PEOPLE.MOTHER_ID.eq(myMotherId).and(PEOPLE.ID.ne(personId)))
                    .fetch(PEOPLE.ID)
                    .forEach(maternalSibIds::add);
        }

        // Siblings sharing the same father
        Set<Long> paternalSibIds = new LinkedHashSet<>();
        if (myFatherId != null) {
            dsl.select(PEOPLE.ID).from(PEOPLE)
                    .where(PEOPLE.FATHER_ID.eq(myFatherId).and(PEOPLE.ID.ne(personId)))
                    .fetch(PEOPLE.ID)
                    .forEach(paternalSibIds::add);
        }

        // Classify: shared both parents = full sibling, one parent = half sibling
        Set<Long> allColumnSibs = new LinkedHashSet<>();
        allColumnSibs.addAll(maternalSibIds);
        allColumnSibs.addAll(paternalSibIds);
        for (Long sid : allColumnSibs) {
            boolean shareMother = maternalSibIds.contains(sid);
            boolean shareFather = paternalSibIds.contains(sid);
            if (shareMother && shareFather) {
                siblingRelMap.put(sid, "SIBLING");
            } else if (shareMother) {
                siblingRelMap.put(sid, "HALF_SIBLING_MATERNAL");
            } else {
                siblingRelMap.put(sid, "HALF_SIBLING_PATERNAL");
            }
        }

        // Also check PERSON_SIBLING table (explicit entries with RELATION)
        dsl.select(DSL.field(DSL.name("PERSON_B_ID"), Long.class),
                   DSL.field(DSL.name("RELATION"), String.class))
                .from(DSL.table(DSL.name("PERSON_SIBLING")))
                .where(DSL.field(DSL.name("PERSON_A_ID"), Long.class).eq(personId))
                .fetch()
                .forEach(r -> siblingRelMap.putIfAbsent(
                        r.get(DSL.field(DSL.name("PERSON_B_ID"), Long.class)),
                        r.get(DSL.field(DSL.name("RELATION"), String.class))));
        dsl.select(DSL.field(DSL.name("PERSON_A_ID"), Long.class),
                   DSL.field(DSL.name("RELATION"), String.class))
                .from(DSL.table(DSL.name("PERSON_SIBLING")))
                .where(DSL.field(DSL.name("PERSON_B_ID"), Long.class).eq(personId))
                .fetch()
                .forEach(r -> siblingRelMap.putIfAbsent(
                        r.get(DSL.field(DSL.name("PERSON_A_ID"), Long.class)),
                        r.get(DSL.field(DSL.name("RELATION"), String.class))));

        List<DTOs.PersonRelDto> siblings = new ArrayList<>();
        for (var entry : siblingRelMap.entrySet()) {
            siblings.add(relDto(entry.getKey(), entry.getValue() != null ? entry.getValue() : "SIBLING"));
        }

        // Spouses from PERSON_SPOUSE table
        List<DTOs.PersonRelDto> spouses = new ArrayList<>();
        dsl.select(DSL.field(DSL.name("SPOUSE_PERSON_ID"), Long.class),
                   DSL.field(DSL.name("RELATION"), String.class))
                .from(DSL.table(DSL.name("PERSON_SPOUSE")))
                .where(DSL.field(DSL.name("PERSON_ID"), Long.class).eq(personId))
                .fetch()
                .forEach(r -> spouses.add(relDto(
                        r.get(DSL.field(DSL.name("SPOUSE_PERSON_ID"), Long.class)),
                        r.get(DSL.field(DSL.name("RELATION"), String.class)))));
        dsl.select(DSL.field(DSL.name("PERSON_ID"), Long.class),
                   DSL.field(DSL.name("RELATION"), String.class))
                .from(DSL.table(DSL.name("PERSON_SPOUSE")))
                .where(DSL.field(DSL.name("SPOUSE_PERSON_ID"), Long.class).eq(personId))
                .fetch()
                .forEach(r -> spouses.add(relDto(
                        r.get(DSL.field(DSL.name("PERSON_ID"), Long.class)),
                        r.get(DSL.field(DSL.name("RELATION"), String.class)))));

        // Children = (inverse of columns) UNION (PERSON_PARENT), deduplicated
        var childrenViaColumns = dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX, PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH,
                        PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID)
                .from(PEOPLE)
                .where(PEOPLE.MOTHER_ID.eq(personId).or(PEOPLE.FATHER_ID.eq(personId)))
                .fetch(r -> DTOs.PersonRelDto.builder()
                        .personId(r.get(PEOPLE.ID))
                        .displayName(fullDisplayName(
                                r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX),
                                r.get(PEOPLE.DATE_OF_BIRTH), r.get(DATE_OF_DEATH)))
                        .relation("BIOLOGICAL_CHILD")
                        .build());

        var childrenViaPP = dsl.select(PERSON_PARENT.CHILD_PERSON_ID, PERSON_PARENT.RELATION,
                        PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME, P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH)
                .from(PERSON_PARENT.join(PEOPLE).on(PEOPLE.ID.eq(PERSON_PARENT.CHILD_PERSON_ID)))
                .where(PERSON_PARENT.PARENT_PERSON_ID.eq(personId))
                .and(PERSON_PARENT.VALID_TO.isNull().or(PERSON_PARENT.VALID_TO.ge(DSL.currentLocalDate())))
                .fetch(r -> {
                    // Convert the parent-type relation to a child-type relation
                    String parentRel = r.get(PERSON_PARENT.RELATION);
                    String childRel;
                    if (parentRel != null) {
                        switch (parentRel) {
                            case "BIOLOGICAL_MOTHER": case "BIOLOGICAL_FATHER":
                                childRel = "BIOLOGICAL_CHILD"; break;
                            case "ADOPTIVE_MOTHER": case "ADOPTIVE_FATHER": case "ADOPTIVE_PARENT":
                                childRel = "ADOPTED_CHILD"; break;
                            case "STEP_MOTHER": case "STEP_FATHER": case "STEP_PARENT":
                                childRel = "STEP_CHILD"; break;
                            case "FOSTER_MOTHER": case "FOSTER_FATHER": case "FOSTER_PARENT":
                                childRel = "FOSTER_CHILD"; break;
                            case "GUARDIAN":
                                childRel = "WARD"; break;
                            default:
                                childRel = "CHILD"; break;
                        }
                    } else {
                        childRel = "CHILD";
                    }
                    return DTOs.PersonRelDto.builder()
                        .personId(r.get(PERSON_PARENT.CHILD_PERSON_ID))
                        .relation(childRel)
                        .displayName(fullDisplayName(
                                r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX),
                                r.get(PEOPLE.DATE_OF_BIRTH), r.get(DATE_OF_DEATH)))
                        .build();
                });

        // Merge children lists, dedupe by personId
        Map<Long, DTOs.PersonRelDto> children = new LinkedHashMap<>();
        for (var c : childrenViaPP) children.put(c.getPersonId(), c);
        for (var c : childrenViaColumns) children.putIfAbsent(c.getPersonId(), c);

        String display = fullDisplayName(
                p.get(P_PREFIX), p.get(PEOPLE.FIRST_NAME), p.get(P_MIDDLE_NAME),
                p.get(PEOPLE.LAST_NAME), p.get(P_SUFFIX),
                p.get(PEOPLE.DATE_OF_BIRTH), p.get(DATE_OF_DEATH));

        return DTOs.ProfileDto.builder()
                .personId(p.get(PEOPLE.ID))
                .displayName(display)
                .prefix(p.get(P_PREFIX))
                .firstName(p.get(PEOPLE.FIRST_NAME))
                .middleName(p.get(P_MIDDLE_NAME))
                .lastName(p.get(PEOPLE.LAST_NAME))
                .suffix(p.get(P_SUFFIX))
                .dateOfBirth(p.get(PEOPLE.DATE_OF_BIRTH))
                .dateOfDeath(p.get(DATE_OF_DEATH))
                .deceased(Boolean.TRUE.equals(p.get(IS_DECEASED)) || p.get(DATE_OF_DEATH) != null)
                .motherId(p.get(PEOPLE.MOTHER_ID))
                .fatherId(p.get(PEOPLE.FATHER_ID))
                .bio(p.get(P_BIO))
                .location(p.get(P_LOCATION))
                .profilePictureUrl(p.get(P_PROFILE_PICTURE_URL))
                .bannerImageUrl(p.get(P_BANNER_IMAGE_URL))
                .hasAccount(user != null)
                .username(user != null ? user.get(USERS.USERNAME) : null)
                .parents(parents)
                .children(new ArrayList<>(children.values()))
                .siblings(siblings)
                .spouses(spouses)
                .build();
    }

    @Transactional
    public Long linkChild(Long parentId, DTOs.LinkChildRequest req) {
        Long childId = req.getChildId();
        if (childId == null) {
            // Create child first
            DTOs.CreatePersonRequest c = new DTOs.CreatePersonRequest();
            c.setFirstName(req.getFirstName());
            c.setLastName(req.getLastName());
            c.setDateOfBirth(req.getDateOfBirth());
            c.setDateOfDeath(req.getDateOfDeath());
            childId = createPerson(c);
        }

        final String rel = req.getRelation(); // expected: BIOLOGICAL_MOTHER | BIOLOGICAL_FATHER | ADOPTIVE_PARENT | STEP_PARENT | FOSTER_FATHER | FOSTER_MOTHER | GUARDIAN | OTHER
        if (rel == null || rel.isBlank()) {
            throw new IllegalArgumentException("relation is required");
        }

        // 1) Mirror BIO_* into PEOPLE columns (keeps legacy fast reads intact)
        if ("BIOLOGICAL_MOTHER".equals(rel)) {
            dsl.update(PEOPLE)
                    .set(PEOPLE.MOTHER_ID, parentId)
                    .where(PEOPLE.ID.eq(childId))
                    .execute();
        } else if ("BIOLOGICAL_FATHER".equals(rel)) {
            dsl.update(PEOPLE)
                    .set(PEOPLE.FATHER_ID, parentId)
                    .where(PEOPLE.ID.eq(childId))
                    .execute();
        }

        // 2) Upsert into PERSON_PARENT (SQL Server–safe upsert: check-then-insert)
        boolean exists = dsl.fetchExists(
                selectOne()
                        .from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(rel))
        );

        if (!exists) {
            // VALID_FROM is optional; set to today for new links
            dsl.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID,
                            PERSON_PARENT.PARENT_PERSON_ID,
                            PERSON_PARENT.RELATION,
                            PERSON_PARENT.VALID_FROM)
                    .values(childId, parentId, rel, LocalDate.now())
                    .execute();
        }

        return childId;
    }

    /**
     * Direct update of a PEOPLE-only row (no USERS account).
     * Used by admin direct edit and by admin approval of queued changes.
     */
    @Transactional
    public void updatePerson(Long personId, DTOs.EditPersonRequest req) {
        var update = dsl.update(PEOPLE).set(PEOPLE.FIRST_NAME, PEOPLE.FIRST_NAME); // no-op seed for chaining (cannot use identity column)

        if (req.getFirstName() != null && !req.getFirstName().isBlank())
            update = update.set(PEOPLE.FIRST_NAME, req.getFirstName().trim());
        if (req.getLastName() != null)
            update = update.set(PEOPLE.LAST_NAME, req.getLastName().trim().isEmpty() ? null : req.getLastName().trim());
        if (req.getMiddleName() != null)
            update = update.set(P_MIDDLE_NAME, req.getMiddleName().trim().isEmpty() ? null : req.getMiddleName().trim());
        if (req.getPrefix() != null)
            update = update.set(P_PREFIX, req.getPrefix().trim().isEmpty() ? null : req.getPrefix().trim());
        if (req.getSuffix() != null)
            update = update.set(P_SUFFIX, req.getSuffix().trim().isEmpty() ? null : req.getSuffix().trim());
        if (req.getDateOfBirth() != null)
            update = update.set(PEOPLE.DATE_OF_BIRTH, req.getDateOfBirth().isBlank() ? null : LocalDate.parse(req.getDateOfBirth()));
        if (req.getDateOfDeath() != null)
            update = update.set(DATE_OF_DEATH, req.getDateOfDeath().isBlank() ? null : LocalDate.parse(req.getDateOfDeath()));
        if (req.getMotherId() != null)
            update = update.set(PEOPLE.MOTHER_ID, req.getMotherId() == 0 ? null : req.getMotherId());
        if (req.getFatherId() != null)
            update = update.set(PEOPLE.FATHER_ID, req.getFatherId() == 0 ? null : req.getFatherId());

        // Upsert PERSON_PARENT with relation
        if (req.getMotherId() != null && req.getMotherId() != 0) {
            String motherRel = req.getMotherRelation() != null && !req.getMotherRelation().isBlank()
                    ? req.getMotherRelation() : "BIOLOGICAL_MOTHER";
            upsertPersonParent(personId, req.getMotherId(), motherRel);
        }
        if (req.getFatherId() != null && req.getFatherId() != 0) {
            String fatherRel = req.getFatherRelation() != null && !req.getFatherRelation().isBlank()
                    ? req.getFatherRelation() : "BIOLOGICAL_FATHER";
            upsertPersonParent(personId, req.getFatherId(), fatherRel);
        }
        if (req.getBio() != null)
            update = update.set(P_BIO, req.getBio().trim().isEmpty() ? null : req.getBio().trim());
        if (req.getProfilePictureUrl() != null)
            update = update.set(P_PROFILE_PICTURE_URL, req.getProfilePictureUrl().trim().isEmpty() ? null : req.getProfilePictureUrl().trim());
        if (req.getBannerImageUrl() != null)
            update = update.set(P_BANNER_IMAGE_URL, req.getBannerImageUrl().trim().isEmpty() ? null : req.getBannerImageUrl().trim());
        if (req.getLocation() != null)
            update = update.set(P_LOCATION, req.getLocation().trim().isEmpty() ? null : req.getLocation().trim());

        update.where(PEOPLE.ID.eq(personId)).execute();
    }

    /**
     * Admin-only: mark a person as deceased (or alive) without requiring a date of death.
     * Also auto-sets is_deceased=true whenever date_of_death is set.
     */
    @Transactional
    public void setDeceased(Long personId, boolean deceased) {
        dsl.update(PEOPLE)
                .set(IS_DECEASED, deceased)
                .where(PEOPLE.ID.eq(personId))
                .execute();
    }

    /**
     * Check if the given person has a linked USERS row.
     */
    public boolean hasAccount(Long personId) {
        return dsl.fetchExists(
                dsl.selectOne().from(USERS).where(USERS.PERSON_ID.eq(personId))
        );
    }

    /**
     * Search for PEOPLE records matching first+last name that do NOT have a linked user account.
     * Used during signup to support profile claiming.
     */
    public List<DTOs.PersonSummaryDto> searchUnclaimed(String firstName, String lastName) {
        if (firstName == null || firstName.isBlank()) return List.of();

        Condition cond = PEOPLE.FIRST_NAME.likeIgnoreCase("%" + firstName.trim() + "%");
        if (lastName != null && !lastName.isBlank()) {
            cond = cond.and(PEOPLE.LAST_NAME.likeIgnoreCase("%" + lastName.trim() + "%"));
        }
        // Exclude people who already have a linked user
        cond = cond.andNotExists(
                DSL.selectOne().from(USERS).where(USERS.PERSON_ID.eq(PEOPLE.ID))
        );
        // Exclude deceased people — they shouldn't be claimable
        cond = cond.and(
                IS_DECEASED.isNull().or(IS_DECEASED.eq(false))
        ).and(
                DATE_OF_DEATH.isNull()
        );
        // Exclude archived profiles
        cond = cond.and(IS_ARCHIVED.isNull().or(IS_ARCHIVED.eq(false)));

        return dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH, IS_DECEASED)
                .from(PEOPLE)
                .where(cond)
                .orderBy(PEOPLE.LAST_NAME.asc(), PEOPLE.FIRST_NAME.asc())
                .limit(10)
                .fetch(r -> {
                    LocalDate dob = r.get(PEOPLE.DATE_OF_BIRTH);
                    LocalDate dod = r.get(DATE_OF_DEATH);
                    boolean isDeceased = Boolean.TRUE.equals(r.get(IS_DECEASED)) || dod != null;
                    return DTOs.PersonSummaryDto.builder()
                            .personId(r.get(PEOPLE.ID))
                            .displayName(fullDisplayName(
                                    r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                    r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX), dob, dod))
                            .dateOfBirth(Optional.ofNullable(dob).map(LocalDate::toString).orElse(null))
                            .dateOfDeath(dod != null ? dod.toString() : null)
                            .deceased(isDeceased)
                            .build();
                });
    }

    /**
     * Search for ARCHIVED, living PEOPLE records matching first+last name + DOB.
     * These are profiles from genealogy imports that may belong to living elders.
     * Requires name + DOB match to surface, and claims always require admin approval.
     */
    public List<DTOs.PersonSummaryDto> searchUnclaimedArchived(String firstName, String lastName, LocalDate dateOfBirth) {
        if (firstName == null || firstName.isBlank()) return List.of();
        if (dateOfBirth == null) return List.of(); // DOB required to match archived profiles

        Condition cond = PEOPLE.FIRST_NAME.likeIgnoreCase("%" + firstName.trim() + "%");
        if (lastName != null && !lastName.isBlank()) {
            cond = cond.and(PEOPLE.LAST_NAME.likeIgnoreCase("%" + lastName.trim() + "%"));
        }
        // Must match DOB exactly
        cond = cond.and(PEOPLE.DATE_OF_BIRTH.eq(dateOfBirth));
        // Must be archived
        cond = cond.and(IS_ARCHIVED.eq(true));
        // Must be living (not deceased)
        cond = cond.and(IS_DECEASED.isNull().or(IS_DECEASED.eq(false)))
                   .and(DATE_OF_DEATH.isNull());
        // Must not already be linked to a user
        cond = cond.andNotExists(
                DSL.selectOne().from(USERS).where(USERS.PERSON_ID.eq(PEOPLE.ID))
        );

        return dsl.select(PEOPLE.ID, PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH, IS_DECEASED)
                .from(PEOPLE)
                .where(cond)
                .orderBy(PEOPLE.LAST_NAME.asc(), PEOPLE.FIRST_NAME.asc())
                .limit(5)
                .fetch(r -> {
                    LocalDate dob = r.get(PEOPLE.DATE_OF_BIRTH);
                    LocalDate dod = r.get(DATE_OF_DEATH);
                    boolean isDeceased = Boolean.TRUE.equals(r.get(IS_DECEASED)) || dod != null;
                    return DTOs.PersonSummaryDto.builder()
                            .personId(r.get(PEOPLE.ID))
                            .displayName(fullDisplayName(
                                    r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                                    r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX), dob, dod))
                            .dateOfBirth(Optional.ofNullable(dob).map(LocalDate::toString).orElse(null))
                            .dateOfDeath(dod != null ? dod.toString() : null)
                            .deceased(isDeceased)
                            .archived(true)
                            .build();
                });
    }


    private DTOs.PersonRelDto relDto(Long personId, String relation) {
        var r = dsl.select(PEOPLE.FIRST_NAME, PEOPLE.LAST_NAME,
                        P_PREFIX, P_MIDDLE_NAME, P_SUFFIX,
                        PEOPLE.DATE_OF_BIRTH, DATE_OF_DEATH)
                .from(PEOPLE).where(PEOPLE.ID.eq(personId)).fetchOne();
        String name = r != null
                ? fullDisplayName(r.get(P_PREFIX), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                        r.get(PEOPLE.LAST_NAME), r.get(P_SUFFIX),
                        r.get(PEOPLE.DATE_OF_BIRTH), r.get(DATE_OF_DEATH))
                : ("#" + personId);
        return DTOs.PersonRelDto.builder()
                .personId(personId)
                .displayName(name)
                .relation(relation)
                .build();
    }

    /** Upsert a row in PERSON_PARENT (childId → parentId with given relation). */
    private void upsertPersonParent(Long childId, Long parentId, String relation) {
        boolean exists = dsl.fetchExists(
                selectOne()
                        .from(PERSON_PARENT)
                        .where(PERSON_PARENT.CHILD_PERSON_ID.eq(childId))
                        .and(PERSON_PARENT.PARENT_PERSON_ID.eq(parentId))
                        .and(PERSON_PARENT.RELATION.eq(relation))
        );
        if (!exists) {
            dsl.insertInto(PERSON_PARENT,
                            PERSON_PARENT.CHILD_PERSON_ID,
                            PERSON_PARENT.PARENT_PERSON_ID,
                            PERSON_PARENT.RELATION,
                            PERSON_PARENT.VALID_FROM)
                    .values(childId, parentId, relation, LocalDate.now())
                    .execute();
        }
    }
}
