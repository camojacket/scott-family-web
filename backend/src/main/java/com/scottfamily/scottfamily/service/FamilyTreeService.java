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
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;

import org.jooq.DSLContext;
import org.jooq.Record;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.scottfamily.scottfamily.dto.DTOs;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;
import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.tables.PersonParent.PERSON_PARENT;

import lombok.RequiredArgsConstructor;

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
            return new DTOs.FamilyNodeDto(0L, "All Families", null, null, List.of(), null, null, null, false, null);
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

        // 6) Attach children under ONE parent (prefer father, fall back to mother)
        //    Track couples (mother+father pairs that share a child)
        Map<String, long[]> coupleMap = new LinkedHashMap<>();

        for (PersonRow child : byId.values()) {
            Long mid = child.motherId != null && nodeById.containsKey(child.motherId) ? child.motherId : null;
            Long fid = child.fatherId != null && nodeById.containsKey(child.fatherId) ? child.fatherId : null;

            if (mid != null && fid != null) {
                // Both parents known — attach child to father; mother becomes spouse
                TreeNode childNode = nodeById.get(child.id);
                // Look up relation to the father from PERSON_PARENT
                childNode.parentRelation = childParentRelation.get(child.id + ":" + fid);
                nodeById.get(fid).children.add(childNode);
                String key = Math.min(mid, fid) + ":" + Math.max(mid, fid);
                coupleMap.putIfAbsent(key, new long[]{mid, fid});
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

        // 7) Set spouse on father node for each couple
        //    Only when the mother has no parents in the tree (otherwise she stays in her own subtree)
        Set<Long> placedAsSpouse = new HashSet<>();
        for (long[] pair : coupleMap.values()) {
            long motherId = pair[0];
            long fatherId = pair[1];
            PersonRow mother = byId.get(motherId);
            if (mother == null) continue;
            boolean motherHasParentInTree = (mother.motherId != null && nodeById.containsKey(mother.motherId))
                    || (mother.fatherId != null && nodeById.containsKey(mother.fatherId));
            if (!motherHasParentInTree && !placedAsSpouse.contains(motherId)) {
                nodeById.get(fatherId).spouse = nodeById.get(motherId);
                placedAsSpouse.add(motherId);
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
        return new DTOs.FamilyNodeDto(0L, "All Families", null, null, rootDtos, null, null, null, false, null);
    }

    /* Convert mutable TreeNode → immutable DTO */
    private static DTOs.FamilyNodeDto toDto(TreeNode node) {
        DTOs.FamilyNodeDto spouseDto = null;
        if (node.spouse != null) {
            spouseDto = new DTOs.FamilyNodeDto(
                    node.spouse.id, node.spouse.name,
                    node.spouse.dateOfBirth, node.spouse.dateOfDeath,
                    List.of(),
                    node.spouse.avatarUrl, node.spouse.userId, null, node.spouse.deceased, null);
        }
        List<DTOs.FamilyNodeDto> childDtos = node.children.stream()
                .map(FamilyTreeService::toDto)
                .collect(Collectors.toCollection(ArrayList::new));
        return new DTOs.FamilyNodeDto(node.id, node.name,
                node.dateOfBirth, node.dateOfDeath,
                childDtos, node.avatarUrl, node.userId, spouseDto, node.deceased, node.parentRelation);
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
        TreeNode spouse;
        final List<TreeNode> children = new ArrayList<>();
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
            if (!n.children.isEmpty()) sortNodes(n.children, cmp);
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
