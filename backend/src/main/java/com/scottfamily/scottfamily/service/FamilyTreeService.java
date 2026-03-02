package com.scottfamily.scottfamily.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import com.scottfamily.scottfamily.dto.DTOs;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;
import static com.yourproject.generated.scott_family_web.tables.PersonSpouse.PERSON_SPOUSE;

@Service
@RequiredArgsConstructor
public class FamilyTreeService {
    private final DSLContext dsl;

    // Inline field refs for columns not yet in generated jOOQ
    private static final org.jooq.Field<String> P_PROFILE_PICTURE_URL =
            org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("profile_picture_url"), String.class);
    private static final org.jooq.Field<Boolean> IS_DECEASED =
            org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("is_deceased"), Boolean.class);
    private static final org.jooq.Field<String> P_MIDDLE_NAME =
            org.jooq.impl.DSL.field(org.jooq.impl.DSL.name("middle_name"), String.class);

    /**
     * Build the full family tree DTO. Cached for 5 minutes (see CacheConfig).
     * The tree is rebuilt from scratch on cache miss — 5+ queries loading all people,
     * relationships, and spouses into memory.
     */
    @Cacheable("familyTree")
    public DTOs.FamilyNodeDto buildTree() {
        // 1) Pending person IDs (APPROVED_AT is null)
        Set<Long> pendingPersonIds = new HashSet<>(
                dsl.select(USERS.PERSON_ID)
                        .from(USERS)
                        .where(USERS.PERSON_ID.isNotNull())
                        .and(USERS.APPROVED_AT.isNull())
                        .fetch(USERS.PERSON_ID)
        );

        // 2) All people (including profile_picture_url, middle_name from PEOPLE)
        var rows = dsl.select(
                PEOPLE.ID, PEOPLE.FIRST_NAME, P_MIDDLE_NAME, PEOPLE.LAST_NAME,
                PEOPLE.DATE_OF_BIRTH, PEOPLE.MOTHER_ID, PEOPLE.FATHER_ID,
                PEOPLE.DATE_OF_DEATH, P_PROFILE_PICTURE_URL, IS_DECEASED
        ).from(PEOPLE).fetch();

        // 3) User info by person_id (only need userId for linking)
        var userByPersonId = dsl
                .select(USERS.PERSON_ID, USERS.ID)
                .from(USERS)
                .where(USERS.PERSON_ID.isNotNull())
                .fetch().stream()
                .collect(Collectors.toMap(
                        r -> r.get(USERS.PERSON_ID),
                        r -> r.get(USERS.ID),
                        (a, b) -> a
                ));

        if (rows.isEmpty()) {
            return new DTOs.FamilyNodeDto(0L, "All Families", null, null, List.of(), null, null, List.of(), false, null);
        }

        // 3b) Build child→parent relation map from PERSON_PARENT
        //     Key = childId:parentId → relation string
        Map<String, String> childParentRelation = new HashMap<>();
        dsl.select(PERSON_PARENT.CHILD_PERSON_ID, PERSON_PARENT.PARENT_PERSON_ID, PERSON_PARENT.RELATION)
                .from(PERSON_PARENT)
                .where(PERSON_PARENT.VALID_TO.isNull())
                .fetch()
                .forEach(r -> childParentRelation.put(
                        r.get(PERSON_PARENT.CHILD_PERSON_ID) + ":" + r.get(PERSON_PARENT.PARENT_PERSON_ID),
                        r.get(PERSON_PARENT.RELATION)));

        // 4) Build person map, excluding pending
        Map<Long, PersonRow> byId = rows.stream()
                .map(PersonRow::from)
                .filter(p -> !pendingPersonIds.contains(p.id))
                .collect(Collectors.toMap(p -> p.id, Function.identity()));

        // 5) Build mutable tree nodes
        Map<Long, TreeNode> nodeById = new LinkedHashMap<>();
        for (PersonRow p : byId.values()) {
            Long userId = userByPersonId.get(p.id);
            TreeNode tn = new TreeNode();
            tn.id = p.id;
            tn.name = fullName(p.firstName, p.middleName, p.lastName);
            tn.dateOfBirth = p.dateOfBirth != null ? p.dateOfBirth.toString() : null;
            tn.dateOfDeath = p.dateOfDeath != null ? p.dateOfDeath.toString() : null;
            tn.avatarUrl = emptyToNull(p.avatarUrl);
            tn.userId = userId;
            tn.deceased = p.deceased;
            nodeById.put(p.id, tn);
        }

        // 6) Attach children under ONE parent; the other parent becomes a spouse badge.
        //    When both parents are known, prefer the parent who has ancestors already
        //    in the tree (i.e., the one who "belongs" to this family tree).
        //
        //    primaryToSecondaryChildren: primaryId → { secondaryId → [childId, …] }
        //    This lets us build spouse-groups later so a person with N spouses can
        //    render them all (e.g. Betty with Washington + Ellington).
        Map<Long, Map<Long, List<Long>>> primaryToSecondaryChildren = new LinkedHashMap<>();

        for (PersonRow child : byId.values()) {
            Long mid = child.motherId != null && nodeById.containsKey(child.motherId) ? child.motherId : null;
            Long fid = child.fatherId != null && nodeById.containsKey(child.fatherId) ? child.fatherId : null;

            if (mid != null && fid != null) {
                // Both parents known — decide which parent is "primary" (gets children)
                PersonRow motherRow = byId.get(mid);
                PersonRow fatherRow = byId.get(fid);
                boolean motherInFamily = (motherRow.motherId != null && nodeById.containsKey(motherRow.motherId))
                        || (motherRow.fatherId != null && nodeById.containsKey(motherRow.fatherId));
                boolean fatherInFamily = (fatherRow.motherId != null && nodeById.containsKey(fatherRow.motherId))
                        || (fatherRow.fatherId != null && nodeById.containsKey(fatherRow.fatherId));

                Long primaryId  = (motherInFamily && !fatherInFamily) ? mid : fid;
                Long secondaryId = primaryId.equals(fid) ? mid : fid;

                TreeNode childNode = nodeById.get(child.id);
                childNode.parentRelation = childParentRelation.get(child.id + ":" + primaryId);
                nodeById.get(primaryId).children.add(childNode);

                // Record child→secondary mapping for spouse-group building
                primaryToSecondaryChildren
                        .computeIfAbsent(primaryId, k -> new LinkedHashMap<>())
                        .computeIfAbsent(secondaryId, k -> new ArrayList<>())
                        .add(child.id);
            } else if (fid != null) {
                TreeNode childNode = nodeById.get(child.id);
                childNode.parentRelation = childParentRelation.get(child.id + ":" + fid);
                nodeById.get(fid).children.add(childNode);
            } else if (mid != null) {
                TreeNode childNode = nodeById.get(child.id);
                childNode.parentRelation = childParentRelation.get(child.id + ":" + mid);
                nodeById.get(mid).children.add(childNode);
            }
        }

        // 7) Build spouse groups for each primary parent.
        //    Each group holds the spouse node (if not placed elsewhere) and the child IDs
        //    that resulted from that relationship.
        Set<Long> placedAsSpouse = new HashSet<>();
        for (var entry : primaryToSecondaryChildren.entrySet()) {
            long primaryId = entry.getKey();
            TreeNode primaryNode = nodeById.get(primaryId);
            if (primaryNode == null) continue;

            for (var secEntry : entry.getValue().entrySet()) {
                long secondaryId = secEntry.getKey();
                List<Long> childIds = secEntry.getValue();
                PersonRow secondary = byId.get(secondaryId);
                if (secondary == null) continue;

                SpouseGroup sg = new SpouseGroup();
                sg.childIds.addAll(childIds);

                boolean secondaryHasParentInTree =
                        (secondary.motherId != null && nodeById.containsKey(secondary.motherId))
                     || (secondary.fatherId != null && nodeById.containsKey(secondary.fatherId));

                if (!secondaryHasParentInTree && !placedAsSpouse.contains(secondaryId)) {
                    sg.spouse = nodeById.get(secondaryId);
                    placedAsSpouse.add(secondaryId);
                } else {
                    sg.spouseRefId = secondaryId;
                }
                primaryNode.spouseGroups.add(sg);
            }

            // Sort children so spouse-group children are clustered together.
            // Order: group0's children, group1's children, …, unattributed children.
            // Within each group, sort by DOB then name.
            if (primaryNode.spouseGroups.size() >= 2) {
                Map<Long, Integer> childOrder = new HashMap<>();
                int groupIdx = 0;
                for (SpouseGroup sg : primaryNode.spouseGroups) {
                    for (Long cid : sg.childIds) {
                        childOrder.put(cid, groupIdx);
                    }
                    groupIdx++;
                }
                int unattributed = groupIdx; // last
                primaryNode.children.sort(
                        Comparator.<TreeNode, Integer>comparing(
                                c -> childOrder.getOrDefault(c.id, unattributed))
                        .thenComparing(
                                c -> c.dateOfBirth != null ? LocalDate.parse(c.dateOfBirth) : LocalDate.MAX)
                        .thenComparing(
                                c -> c.name, Comparator.nullsLast(String::compareToIgnoreCase)));
            }
        }

        // 7b) Attach spouses from PERSON_SPOUSE that weren't linked via child-parent logic.
        //     This handles couples with no shared children in the tree (e.g. Dora + Lavar Bullard).
        //     For each PERSON_SPOUSE row, if the person is in the tree and their spouse
        //     hasn't already been placed, add the spouse as a childless spouse group.
        var spouseRows = dsl.select(PERSON_SPOUSE.PERSON_ID, PERSON_SPOUSE.SPOUSE_PERSON_ID)
                .from(PERSON_SPOUSE)
                .fetch();
        for (var sr : spouseRows) {
            Long personId = sr.get(PERSON_SPOUSE.PERSON_ID);
            Long spouseId = sr.get(PERSON_SPOUSE.SPOUSE_PERSON_ID);
            if (!nodeById.containsKey(personId) || !nodeById.containsKey(spouseId)) continue;

            // Try to attach spouse to person (or person to spouse if person is already placed)
            for (long[] pair : new long[][]{{personId, spouseId}, {spouseId, personId}}) {
                long primary = pair[0];
                long secondary = pair[1];
                if (placedAsSpouse.contains(secondary)) continue;
                // Check if this spouse is already in a spouse group of primary
                TreeNode primaryNode = nodeById.get(primary);
                boolean alreadyGrouped = primaryNode.spouseGroups.stream()
                        .anyMatch(sg -> (sg.spouse != null && sg.spouse.id.equals(secondary))
                                     || (sg.spouseRefId != null && sg.spouseRefId.equals(secondary)));
                if (alreadyGrouped) continue;

                PersonRow secondaryRow = byId.get(secondary);
                if (secondaryRow == null) continue;
                boolean secondaryHasParentInTree =
                        (secondaryRow.motherId != null && nodeById.containsKey(secondaryRow.motherId))
                     || (secondaryRow.fatherId != null && nodeById.containsKey(secondaryRow.fatherId));

                // Prefer attaching to the person who has parents in the tree
                boolean primaryHasParentInTree =
                        (byId.get(primary).motherId != null && nodeById.containsKey(byId.get(primary).motherId))
                     || (byId.get(primary).fatherId != null && nodeById.containsKey(byId.get(primary).fatherId));

                if (secondaryHasParentInTree && !primaryHasParentInTree) continue; // try the other direction

                SpouseGroup sg = new SpouseGroup();
                if (!placedAsSpouse.contains(secondary) && !secondaryHasParentInTree) {
                    sg.spouse = nodeById.get(secondary);
                    placedAsSpouse.add(secondary);
                } else {
                    sg.spouseRefId = secondary;
                }
                primaryNode.spouseGroups.add(sg);
                break; // placed, don't try the other direction
            }
        }

        // 8) Roots = people with no parents in tree & not placed as spouse
        List<TreeNode> roots = byId.values().stream()
                .filter(p -> {
                    boolean hasMotherInTree = p.motherId != null && byId.containsKey(p.motherId);
                    boolean hasFatherInTree = p.fatherId != null && byId.containsKey(p.fatherId);
                    return !hasMotherInTree && !hasFatherInTree && !placedAsSpouse.contains(p.id);
                })
                .map(p -> nodeById.get(p.id))
                .distinct()
                .collect(Collectors.toCollection(ArrayList::new));

        // 9) Sort by dateOfBirth (if present), then by name
        Comparator<TreeNode> cmp = Comparator
                .comparing((TreeNode n) -> n.dateOfBirth != null ? LocalDate.parse(n.dateOfBirth) : LocalDate.MAX)
                .thenComparing(n -> n.name, Comparator.nullsLast(String::compareToIgnoreCase));
        sortNodes(roots, cmp);

        // 10) Convert to DTO tree
        List<DTOs.FamilyNodeDto> rootDtos = roots.stream().map(FamilyTreeService::toDto).toList();
        return new DTOs.FamilyNodeDto(0L, "All Families", null, null, rootDtos, null, null, List.of(), false, null);
    }

    /* Convert mutable TreeNode → immutable DTO */
    private static DTOs.FamilyNodeDto toDto(TreeNode node) {
        List<DTOs.SpouseInfoDto> spouseDtos = new ArrayList<>();
        for (SpouseGroup sg : node.spouseGroups) {
            DTOs.FamilyNodeDto spDto = null;
            if (sg.spouse != null) {
                spDto = new DTOs.FamilyNodeDto(
                        sg.spouse.id, sg.spouse.name,
                        sg.spouse.dateOfBirth, sg.spouse.dateOfDeath,
                        List.of(),
                        sg.spouse.avatarUrl, sg.spouse.userId,
                        List.of(), sg.spouse.deceased, null);
            }
            spouseDtos.add(new DTOs.SpouseInfoDto(spDto, sg.childIds, sg.spouseRefId));
        }

        List<DTOs.FamilyNodeDto> childDtos = node.children.stream()
                .map(FamilyTreeService::toDto)
                .collect(Collectors.toCollection(ArrayList::new));
        return new DTOs.FamilyNodeDto(node.id, node.name,
                node.dateOfBirth, node.dateOfDeath,
                childDtos, node.avatarUrl, node.userId, spouseDtos, node.deceased, node.parentRelation);
    }

    /* Internal mutable node used during tree construction */
    private static class TreeNode {
        Long id;
        String name;
        String dateOfBirth;
        String dateOfDeath;
        String avatarUrl;
        Long userId;
        boolean deceased;
        String parentRelation; // relation of this child to its parent node
        final List<SpouseGroup> spouseGroups = new ArrayList<>();
        final List<TreeNode> children = new ArrayList<>();
    }

    /* One spouse relationship with its associated children */
    private static class SpouseGroup {
        TreeNode spouse;       // the spouse node (null when spouseRefId is used)
        Long spouseRefId;      // cross-link: spouse is already placed elsewhere
        final List<Long> childIds = new ArrayList<>();  // which children belong to this couple
    }

    /* helpers */

    private static String emptyToNull(String s) { return (s == null || s.isBlank()) ? null : s; }

    private static String fullName(String first, String middle, String last) {
        StringBuilder sb = new StringBuilder();
        if (first != null && !first.isBlank()) sb.append(first.trim());
        if (middle != null && !middle.isBlank()) { if (!sb.isEmpty()) sb.append(' '); sb.append(middle.trim()); }
        if (last  != null && !last.isBlank())   { if (!sb.isEmpty()) sb.append(' '); sb.append(last.trim()); }
        return sb.isEmpty() ? "(Unnamed)" : sb.toString();
    }

    private static void sortNodes(List<TreeNode> nodes, Comparator<TreeNode> cmp) {
        nodes.sort(cmp);
        for (TreeNode n : nodes) {
            if (n.children.isEmpty()) continue;
            if (n.spouseGroups.size() >= 2) {
                // Multi-spouse parents: children are already ordered by group in step 7.
                // Only recurse into grandchildren — do NOT re-sort this level.
                for (TreeNode child : n.children) {
                    sortNodes(child.children, cmp);
                }
            } else {
                sortNodes(n.children, cmp);
            }
        }
    }

    private record PersonRow(Long id, String firstName, String middleName, String lastName,
                             LocalDate dateOfBirth, LocalDate dateOfDeath,
                             Long motherId, Long fatherId, String avatarUrl, boolean deceased) {
        static PersonRow from(Record r) {
            boolean isDeceased = Boolean.TRUE.equals(r.get(IS_DECEASED))
                    || r.get(PEOPLE.DATE_OF_DEATH) != null;
            return new PersonRow(r.get(PEOPLE.ID), r.get(PEOPLE.FIRST_NAME), r.get(P_MIDDLE_NAME),
                    r.get(PEOPLE.LAST_NAME),
                    r.get(PEOPLE.DATE_OF_BIRTH), r.get(PEOPLE.DATE_OF_DEATH),
                    r.get(PEOPLE.MOTHER_ID), r.get(PEOPLE.FATHER_ID),
                    r.get(P_PROFILE_PICTURE_URL), isDeceased);
        }
    }
}
