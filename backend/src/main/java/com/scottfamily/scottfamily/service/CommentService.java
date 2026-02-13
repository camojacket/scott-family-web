package com.scottfamily.scottfamily.service;

import com.scottfamily.scottfamily.dto.DTOs;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.COMMENTS;
import static com.yourproject.generated.scott_family_web.Tables.USERS;

@Service
@RequiredArgsConstructor
public class CommentService {
    private final DSLContext dsl;

    public List<DTOs.CommentDto> getComments(Long postId) {
        return dsl.select(
                        COMMENTS.ID,
                        COMMENTS.POST_ID,
                        USERS.DISPLAY_NAME,
                        COMMENTS.CONTENT,
                        COMMENTS.CREATED_AT
                )
                .from(COMMENTS)
                .leftJoin(USERS).on(COMMENTS.AUTHOR_ID.eq(USERS.ID))
                .where(COMMENTS.POST_ID.eq(postId))
                .orderBy(COMMENTS.CREATED_AT.asc())
                .fetch()
                .map(r -> new DTOs.CommentDto(
                        r.get(COMMENTS.ID),
                        r.get(COMMENTS.POST_ID),
                        r.get(USERS.DISPLAY_NAME),
                        r.get(COMMENTS.CONTENT),
                        r.get(COMMENTS.CREATED_AT).toString()
                ));
    }
}
