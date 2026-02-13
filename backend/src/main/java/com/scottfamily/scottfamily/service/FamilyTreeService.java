package com.scottfamily.scottfamily.service;

import com.scottfamily.scottfamily.dto.DTOs;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;

import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

@Service
@RequiredArgsConstructor
public class FamilyTreeService {
    private final DSLContext dsl;

    public DTOs.FamilyNodeDto buildTree() {
        var root = dsl.selectFrom(PEOPLE)
                .where(PEOPLE.MOTHER_ID.isNull().and(PEOPLE.FATHER_ID.isNull()))
                .orderBy(PEOPLE.DATE_OF_BIRTH.asc())
                .limit(1)
                .fetchOne();

        return root == null ? null : toNode(root);
    }

    private DTOs.FamilyNodeDto toNode(org.jooq.Record person) {
        var children = dsl.selectFrom(PEOPLE)
                .where(PEOPLE.MOTHER_ID.eq(person.get(PEOPLE.ID))
                        .or(PEOPLE.FATHER_ID.eq(person.get(PEOPLE.ID))))
                .fetch();

        List<DTOs.FamilyNodeDto> childDtos = children.stream()
                .map(this::toNode)
                .toList();

        return new DTOs.FamilyNodeDto(
                person.get(PEOPLE.ID),
                person.get(PEOPLE.FIRST_NAME) + " " + person.get(PEOPLE.LAST_NAME),
                childDtos
        );
    }
}
