package com.scottfamily.scottfamily.service;

import com.scottfamily.scottfamily.dto.DTOs;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;
import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.COMMENTS;
import static com.yourproject.generated.scott_family_web.Tables.USERS;
import static com.yourproject.generated.scott_family_web.Tables.PEOPLE;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final DSLContext dsl;

    public List<DTOs.CommentDto> getComments(Long postId) {
        return dsl.select(
                        COMMENTS.ID,
                        COMMENTS.POST_ID,
                        PEOPLE.FIRST_NAME,
                        PEOPLE.LAST_NAME,
                        COMMENTS.CONTENT,
                        COMMENTS.CREATED_AT
                )
                .from(COMMENTS)
                .leftJoin(USERS).on(COMMENTS.AUTHOR_ID.eq(USERS.ID))
                .leftJoin(PEOPLE).on(USERS.PERSON_ID.eq(PEOPLE.ID))
                .where(COMMENTS.POST_ID.eq(postId))
                .orderBy(COMMENTS.CREATED_AT.asc())
                .fetch()
                .map(r -> {
                    String fn = r.get(PEOPLE.FIRST_NAME);
                    String ln = r.get(PEOPLE.LAST_NAME);
                    String displayName = ((fn != null ? fn : "") + " " + (ln != null ? ln : "")).trim();
                    return new DTOs.CommentDto(
                            r.get(COMMENTS.ID),
                            r.get(COMMENTS.POST_ID),
                            displayName.isEmpty() ? null : displayName,
                            r.get(COMMENTS.CONTENT),
                            r.get(COMMENTS.CREATED_AT).toString()
                    );
                });
    }
}
