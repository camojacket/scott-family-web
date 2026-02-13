package com.scottfamily.scottfamily.service;

import lombok.*;
import org.jooq.*;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Service for blog comments — CRUD, likes, and sorting.
 */
@Service
public class BlogCommentService {

    // ── Tables ──
    private static final Table<?> COMMENTS         = DSL.table("comments");
    private static final Table<?> USERS            = DSL.table("users");
    private static final Table<?> PEOPLE           = DSL.table("people");
    private static final Table<?> COMMENT_LIKES    = DSL.table("COMMENT_LIKES");
    private static final Table<?> COMMENT_DISLIKES = DSL.table("COMMENT_DISLIKES");

    // ── Unqualified fields (single-table ops) ──
    private static final Field<Long>          F_ID         = DSL.field("id",         SQLDataType.BIGINT.identity(true));
    private static final Field<Long>          F_POST_ID    = DSL.field("post_id",    SQLDataType.BIGINT);
    private static final Field<Long>          F_AUTHOR_ID  = DSL.field("author_id",  SQLDataType.BIGINT);
    private static final Field<String>        F_CONTENT    = DSL.field("content",    SQLDataType.NVARCHAR);
    private static final Field<LocalDateTime> F_CREATED_AT = DSL.field("created_at", SQLDataType.LOCALDATETIME);

    // ── Qualified fields (for JOINs) ──
    private static final Field<Long>          F_C_ID         = DSL.field(DSL.name("comments", "id"),         SQLDataType.BIGINT);
    private static final Field<Long>          F_C_POST_ID    = DSL.field(DSL.name("comments", "post_id"),    SQLDataType.BIGINT);
    private static final Field<Long>          F_C_AUTHOR_ID  = DSL.field(DSL.name("comments", "author_id"),  SQLDataType.BIGINT);
    private static final Field<String>        F_C_CONTENT    = DSL.field(DSL.name("comments", "content"),    SQLDataType.NVARCHAR);
    private static final Field<LocalDateTime> F_C_CREATED_AT = DSL.field(DSL.name("comments", "created_at"), SQLDataType.LOCALDATETIME);
    // After V12: author name from PEOPLE (via users.person_id)
    private static final Field<String>        F_PERSON_FIRST = DSL.field(DSL.name("people", "first_name"),   SQLDataType.NVARCHAR(100));
    private static final Field<String>        F_PERSON_LAST  = DSL.field(DSL.name("people", "last_name"),    SQLDataType.NVARCHAR(100));
    private static final Field<Long>          F_USER_ID      = DSL.field(DSL.name("users", "id"),            SQLDataType.BIGINT);
    private static final Field<Long>          F_USER_PERSON_ID = DSL.field(DSL.name("users", "person_id"),   SQLDataType.BIGINT);
    private static final Field<Long>          F_PEOPLE_ID    = DSL.field(DSL.name("people", "id"),           SQLDataType.BIGINT);

    // ── Comment likes fields ──
    private static final Field<Long> F_CL_COMMENT_ID = DSL.field(DSL.name("COMMENT_LIKES", "comment_id"), SQLDataType.BIGINT);
    private static final Field<Long> F_CL_USER_ID    = DSL.field(DSL.name("COMMENT_LIKES", "user_id"),    SQLDataType.BIGINT);

    // ── Comment dislikes fields ──
    private static final Field<Long> F_CDL_COMMENT_ID = DSL.field(DSL.name("COMMENT_DISLIKES", "comment_id"), SQLDataType.BIGINT);
    private static final Field<Long> F_CDL_USER_ID    = DSL.field(DSL.name("COMMENT_DISLIKES", "user_id"),    SQLDataType.BIGINT);

    private final DSLContext dsl;

    public BlogCommentService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTO ──

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class CommentDto {
        private long    id;
        private long    postId;
        private long    authorId;
        private Long    authorPersonId;
        private String  authorName;
        private String  content;
        private String  createdAt;
        private int     likeCount;
        private boolean likedByMe;
        private int     dislikeCount;
        private boolean dislikedByMe;
    }

    // ── List comments for a post ──

    public List<CommentDto> listComments(Long postId, Long currentUserId, String sort) {
        // Sub-select: like count per comment
        Field<Integer> likeCountField = DSL.field(
                DSL.select(DSL.count())
                        .from(COMMENT_LIKES)
                        .where(F_CL_COMMENT_ID.eq(F_C_ID))
        ).as("like_count");

        // Sub-select: did current user like this comment?
        Field<Integer> likedByMeField = DSL.field(
                DSL.select(DSL.count())
                        .from(COMMENT_LIKES)
                        .where(F_CL_COMMENT_ID.eq(F_C_ID)
                                .and(F_CL_USER_ID.eq(DSL.val(currentUserId))))
        ).as("liked_by_me");

        // Sub-select: dislike count per comment
        Field<Integer> dislikeCountField = DSL.field(
                DSL.select(DSL.count())
                        .from(COMMENT_DISLIKES)
                        .where(F_CDL_COMMENT_ID.eq(F_C_ID))
        ).as("dislike_count");

        // Sub-select: did current user dislike this comment?
        Field<Integer> dislikedByMeField = DSL.field(
                DSL.select(DSL.count())
                        .from(COMMENT_DISLIKES)
                        .where(F_CDL_COMMENT_ID.eq(F_C_ID)
                                .and(F_CDL_USER_ID.eq(DSL.val(currentUserId))))
        ).as("disliked_by_me");

        // Sort order
        OrderField<?> orderBy;
        switch (sort != null ? sort : "oldest") {
            case "newest":  orderBy = F_C_CREATED_AT.desc(); break;
            case "popular": orderBy = likeCountField.desc(); break;
            default:        orderBy = F_C_CREATED_AT.asc();  break; // "oldest"
        }

        return dsl.select(F_C_ID, F_C_POST_ID, F_C_AUTHOR_ID, F_C_CONTENT,
                        F_C_CREATED_AT, F_PERSON_FIRST, F_PERSON_LAST, F_USER_PERSON_ID,
                        likeCountField, likedByMeField,
                        dislikeCountField, dislikedByMeField)
                .from(COMMENTS)
                .leftJoin(USERS).on(F_C_AUTHOR_ID.eq(F_USER_ID))
                .leftJoin(PEOPLE).on(F_USER_PERSON_ID.eq(F_PEOPLE_ID))
                .where(F_C_POST_ID.eq(postId))
                .orderBy(orderBy)
                .fetch(r -> CommentDto.builder()
                        .id(r.get(F_C_ID))
                        .postId(r.get(F_C_POST_ID))
                        .authorId(r.get(F_C_AUTHOR_ID) != null ? r.get(F_C_AUTHOR_ID) : 0)
                        .authorPersonId(r.get(F_USER_PERSON_ID))
                        .authorName(buildDisplayName(r.get(F_PERSON_FIRST), r.get(F_PERSON_LAST), null))
                        .content(r.get(F_C_CONTENT))
                        .createdAt(r.get(F_C_CREATED_AT) != null
                                ? r.get(F_C_CREATED_AT).toString() : null)
                        .likeCount(r.get("like_count", Integer.class))
                        .likedByMe(r.get("liked_by_me", Integer.class) > 0)
                        .dislikeCount(r.get("dislike_count", Integer.class))
                        .dislikedByMe(r.get("disliked_by_me", Integer.class) > 0)
                        .build());
    }

    // ── Create a comment ──

    @Transactional
    public CommentDto create(Long postId, String content, Long authorId) {
        var record = dsl.insertInto(COMMENTS)
                .set(F_POST_ID, postId)
                .set(F_CONTENT, content)
                .set(F_AUTHOR_ID, authorId)
                .returning(F_ID, F_CREATED_AT)
                .fetchOne();

        if (record == null) throw new RuntimeException("Failed to insert comment");

        var authorRow = dsl.select(F_PERSON_FIRST, F_PERSON_LAST, F_USER_PERSON_ID)
                .from(USERS)
                .leftJoin(PEOPLE).on(F_USER_PERSON_ID.eq(F_PEOPLE_ID))
                .where(F_USER_ID.eq(authorId))
                .fetchOne();
        String authorName = authorRow != null
                ? buildDisplayName(authorRow.get(F_PERSON_FIRST), authorRow.get(F_PERSON_LAST), null)
                : null;
        Long authorPersonId = authorRow != null ? authorRow.get(F_USER_PERSON_ID) : null;

        return CommentDto.builder()
                .id(record.get(F_ID))
                .postId(postId)
                .authorId(authorId)
                .authorPersonId(authorPersonId)
                .authorName(authorName)
                .content(content)
                .createdAt(record.get(F_CREATED_AT) != null
                        ? record.get(F_CREATED_AT).toString() : null)
                .likeCount(0).likedByMe(false)
                .dislikeCount(0).dislikedByMe(false)
                .build();
    }

    // ── Delete a comment ──

    @Transactional
    public boolean delete(Long commentId, Long userId, boolean isAdmin) {
        if (!isAdmin) {
            Long authorId = dsl.select(F_AUTHOR_ID).from(COMMENTS)
                    .where(F_ID.eq(commentId)).fetchOneInto(Long.class);
            if (authorId == null || !authorId.equals(userId)) return false;
        }
        return dsl.deleteFrom(COMMENTS).where(F_ID.eq(commentId)).execute() > 0;
    }

    // ── Toggle like on a comment ──

    @Transactional
    public ReactionResult toggleLike(Long commentId, Long userId) {
        Field<Long> fCommentId = DSL.field("comment_id", SQLDataType.BIGINT);
        Field<Long> fUserId    = DSL.field("user_id",    SQLDataType.BIGINT);

        int existing = dsl.selectCount().from(COMMENT_LIKES)
                .where(fCommentId.eq(commentId).and(fUserId.eq(userId)))
                .fetchOneInto(int.class);

        if (existing > 0) {
            dsl.deleteFrom(COMMENT_LIKES)
                    .where(fCommentId.eq(commentId).and(fUserId.eq(userId))).execute();
        } else {
            // Remove any existing dislike
            dsl.deleteFrom(COMMENT_DISLIKES)
                    .where(fCommentId.eq(commentId).and(fUserId.eq(userId))).execute();
            dsl.insertInto(COMMENT_LIKES)
                    .set(fCommentId, commentId).set(fUserId, userId).execute();
        }

        int likeCount = dsl.selectCount().from(COMMENT_LIKES)
                .where(fCommentId.eq(commentId)).fetchOneInto(int.class);
        int dislikeCount = dsl.selectCount().from(COMMENT_DISLIKES)
                .where(fCommentId.eq(commentId)).fetchOneInto(int.class);

        return new ReactionResult(existing == 0, false, likeCount, dislikeCount);
    }

    // ── Toggle dislike on a comment ──

    @Transactional
    public ReactionResult toggleDislike(Long commentId, Long userId) {
        Field<Long> fCommentId = DSL.field("comment_id", SQLDataType.BIGINT);
        Field<Long> fUserId    = DSL.field("user_id",    SQLDataType.BIGINT);

        int existing = dsl.selectCount().from(COMMENT_DISLIKES)
                .where(fCommentId.eq(commentId).and(fUserId.eq(userId)))
                .fetchOneInto(int.class);

        if (existing > 0) {
            dsl.deleteFrom(COMMENT_DISLIKES)
                    .where(fCommentId.eq(commentId).and(fUserId.eq(userId))).execute();
        } else {
            // Remove any existing like
            dsl.deleteFrom(COMMENT_LIKES)
                    .where(fCommentId.eq(commentId).and(fUserId.eq(userId))).execute();
            dsl.insertInto(COMMENT_DISLIKES)
                    .set(fCommentId, commentId).set(fUserId, userId).execute();
        }

        int likeCount = dsl.selectCount().from(COMMENT_LIKES)
                .where(fCommentId.eq(commentId)).fetchOneInto(int.class);
        int dislikeCount = dsl.selectCount().from(COMMENT_DISLIKES)
                .where(fCommentId.eq(commentId)).fetchOneInto(int.class);

        return new ReactionResult(false, existing == 0, likeCount, dislikeCount);
    }

    public record LikeResult(boolean liked, int likeCount) {}
    public record ReactionResult(boolean liked, boolean disliked, int likeCount, int dislikeCount) {}

    /** Prefer first+last; fall back to legacy display_name. */
    private static String buildDisplayName(String first, String last, String legacyDisplayName) {
        String computed = ((first != null ? first : "") + " " + (last != null ? last : "")).trim();
        return computed.isEmpty() ? legacyDisplayName : computed;
    }
}
