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
 * Service for managing blog posts, including likes.
 */
@Service
public class BlogPostService {

    // ── Tables ──
    private static final Table<?> BLOG_POSTS = DSL.table("blog_posts");
    private static final Table<?> USERS      = DSL.table("users");
    private static final Table<?> PEOPLE     = DSL.table("people");
    private static final Table<?> LIKES      = DSL.table("likes");
    private static final Table<?> DISLIKES   = DSL.table("dislikes");

    // ── Unqualified fields (for INSERT / single-table ops) ──
    private static final Field<Long>          F_ID         = DSL.field("id",         SQLDataType.BIGINT.identity(true));
    private static final Field<Long>          F_AUTHOR_ID  = DSL.field("author_id",  SQLDataType.BIGINT);
    private static final Field<String>        F_TITLE      = DSL.field("title",      SQLDataType.NVARCHAR(255));
    private static final Field<String>        F_CONTENT    = DSL.field("content",    SQLDataType.NVARCHAR);
    private static final Field<LocalDateTime> F_CREATED_AT = DSL.field("created_at", SQLDataType.LOCALDATETIME);

    // ── Qualified fields (for JOINs — disambiguate shared column names) ──
    private static final Field<Long>          F_BP_ID         = DSL.field(DSL.name("blog_posts", "id"),         SQLDataType.BIGINT);
    private static final Field<Long>          F_BP_AUTHOR_ID  = DSL.field(DSL.name("blog_posts", "author_id"),  SQLDataType.BIGINT);
    private static final Field<LocalDateTime> F_BP_CREATED_AT = DSL.field(DSL.name("blog_posts", "created_at"), SQLDataType.LOCALDATETIME);
    // After V12: author name comes from PEOPLE (via users.person_id)
    private static final Field<String>        F_PERSON_FIRST  = DSL.field(DSL.name("people", "first_name"),     SQLDataType.NVARCHAR(100));
    private static final Field<String>        F_PERSON_LAST   = DSL.field(DSL.name("people", "last_name"),      SQLDataType.NVARCHAR(100));
    private static final Field<Long>          F_USER_ID       = DSL.field(DSL.name("users", "id"),              SQLDataType.BIGINT);
    private static final Field<Long>          F_USER_PERSON_ID = DSL.field(DSL.name("users", "person_id"),       SQLDataType.BIGINT);
    private static final Field<Long>          F_PEOPLE_ID     = DSL.field(DSL.name("people", "id"),             SQLDataType.BIGINT);

    // ── Likes table fields ──
    private static final Field<Long> F_LIKE_POST_ID = DSL.field(DSL.name("likes", "post_id"), SQLDataType.BIGINT);
    private static final Field<Long> F_LIKE_USER_ID = DSL.field(DSL.name("likes", "user_id"), SQLDataType.BIGINT);

    // ── Dislikes table fields ──
    private static final Field<Long> F_DISLIKE_POST_ID = DSL.field(DSL.name("dislikes", "post_id"), SQLDataType.BIGINT);
    private static final Field<Long> F_DISLIKE_USER_ID = DSL.field(DSL.name("dislikes", "user_id"), SQLDataType.BIGINT);

    private final DSLContext dsl;

    public BlogPostService(DSLContext dsl) {
        this.dsl = dsl;
    }

    // ── DTO ──

    @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BlogPostDto {
        private long    id;
        private long    authorId;
        private Long    authorPersonId;
        private String  title;
        private String  content;
        private String  createdAt;
        private String  authorName;
        private int     likeCount;
        private boolean likedByMe;
        private int     dislikeCount;
        private boolean dislikedByMe;
        private int     commentCount;
    }

    // ── List posts with like counts, comment counts ──

    public List<BlogPostDto> listAll(Long currentUserId, String sort) {
        return listAll(currentUserId, sort, 0, 50);
    }

    public List<BlogPostDto> listAll(Long currentUserId, String sort, int offset, int limit) {
        // Sub-select: like count per post
        Field<Integer> likeCountField = DSL.field(
                DSL.select(DSL.count())
                        .from(LIKES)
                        .where(F_LIKE_POST_ID.eq(F_BP_ID))
        ).as("like_count");

        // Sub-select: did current user like this post?
        Field<Integer> likedByMeField = DSL.field(
                DSL.select(DSL.count())
                        .from(LIKES)
                        .where(F_LIKE_POST_ID.eq(F_BP_ID)
                                .and(F_LIKE_USER_ID.eq(DSL.val(currentUserId))))
        ).as("liked_by_me");

        // Sub-select: dislike count per post
        Field<Integer> dislikeCountField = DSL.field(
                DSL.select(DSL.count())
                        .from(DISLIKES)
                        .where(F_DISLIKE_POST_ID.eq(F_BP_ID))
        ).as("dislike_count");

        // Sub-select: did current user dislike this post?
        Field<Integer> dislikedByMeField = DSL.field(
                DSL.select(DSL.count())
                        .from(DISLIKES)
                        .where(F_DISLIKE_POST_ID.eq(F_BP_ID)
                                .and(F_DISLIKE_USER_ID.eq(DSL.val(currentUserId))))
        ).as("disliked_by_me");

        // Sub-select: comment count per post
        Field<Integer> commentCountField = DSL.field(
                DSL.select(DSL.count())
                        .from(DSL.table("comments"))
                        .where(DSL.field(DSL.name("comments", "post_id"), SQLDataType.BIGINT).eq(F_BP_ID))
        ).as("comment_count");

        // Determine sort order
        OrderField<?> orderBy;
        switch (sort != null ? sort : "newest") {
            case "oldest":   orderBy = F_BP_CREATED_AT.asc();  break;
            case "popular":  orderBy = likeCountField.desc();  break;
            default:         orderBy = F_BP_CREATED_AT.desc(); break; // "newest"
        }

        return dsl.select(F_BP_ID, F_BP_AUTHOR_ID, F_TITLE, F_CONTENT, F_BP_CREATED_AT,
                        F_PERSON_FIRST, F_PERSON_LAST, F_USER_PERSON_ID,
                        likeCountField, likedByMeField,
                        dislikeCountField, dislikedByMeField, commentCountField)
                .from(BLOG_POSTS)
                .leftJoin(USERS).on(F_BP_AUTHOR_ID.eq(F_USER_ID))
                .leftJoin(PEOPLE).on(F_USER_PERSON_ID.eq(F_PEOPLE_ID))
                .orderBy(orderBy)
                .offset(offset)
                .limit(limit)
                .fetch(r -> BlogPostDto.builder()
                        .id(r.get(F_BP_ID))
                        .authorId(r.get(F_BP_AUTHOR_ID))
                        .authorPersonId(r.get(F_USER_PERSON_ID))
                        .title(r.get(F_TITLE))
                        .content(r.get(F_CONTENT))
                        .createdAt(r.get(F_BP_CREATED_AT) != null
                                ? r.get(F_BP_CREATED_AT).toString() : null)
                        .authorName(buildDisplayName(r.get(F_PERSON_FIRST), r.get(F_PERSON_LAST), null))
                        .likeCount(r.get("like_count", Integer.class))
                        .likedByMe(r.get("liked_by_me", Integer.class) > 0)
                        .dislikeCount(r.get("dislike_count", Integer.class))
                        .dislikedByMe(r.get("disliked_by_me", Integer.class) > 0)
                        .commentCount(r.get("comment_count", Integer.class))
                        .build());
    }

    // ── Create a post ──

    @Transactional
    public BlogPostDto create(String title, String content, Long authorId) {
        var record = dsl.insertInto(BLOG_POSTS)
                .set(F_TITLE, title)
                .set(F_CONTENT, content)
                .set(F_AUTHOR_ID, authorId)
                .returning(F_ID, F_CREATED_AT)
                .fetchOne();

        if (record == null) throw new RuntimeException("Failed to insert blog post");

        var authorRow = dsl.select(F_PERSON_FIRST, F_PERSON_LAST, F_USER_PERSON_ID)
                .from(USERS)
                .leftJoin(PEOPLE).on(F_USER_PERSON_ID.eq(F_PEOPLE_ID))
                .where(F_USER_ID.eq(authorId))
                .fetchOne();
        String authorName = authorRow != null
                ? buildDisplayName(authorRow.get(F_PERSON_FIRST), authorRow.get(F_PERSON_LAST), null)
                : null;
        Long authorPersonId = authorRow != null ? authorRow.get(F_USER_PERSON_ID) : null;

        return BlogPostDto.builder()
                .id(record.get(F_ID))
                .authorId(authorId)
                .authorPersonId(authorPersonId)
                .title(title)
                .content(content)
                .createdAt(record.get(F_CREATED_AT) != null
                        ? record.get(F_CREATED_AT).toString() : null)
                .authorName(authorName)
                .likeCount(0).likedByMe(false)
                .dislikeCount(0).dislikedByMe(false).commentCount(0)
                .build();
    }

    // ── Delete a post ──

    @Transactional
    public boolean delete(Long postId, Long userId, boolean isAdmin) {
        if (!isAdmin) {
            // Only author can delete their own post
            Long authorId = dsl.select(F_AUTHOR_ID).from(BLOG_POSTS)
                    .where(F_ID.eq(postId)).fetchOneInto(Long.class);
            if (authorId == null || !authorId.equals(userId)) return false;
        }
        return dsl.deleteFrom(BLOG_POSTS).where(F_ID.eq(postId)).execute() > 0;
    }

    // ── Toggle like on a post ──

    @Transactional
    public ReactionResult toggleLike(Long postId, Long userId) {
        Field<Long> fPostId = DSL.field("post_id", SQLDataType.BIGINT);
        Field<Long> fUserId = DSL.field("user_id", SQLDataType.BIGINT);

        int existing = dsl.selectCount().from(LIKES)
                .where(fPostId.eq(postId).and(fUserId.eq(userId)))
                .fetchOneInto(int.class);

        if (existing > 0) {
            dsl.deleteFrom(LIKES).where(fPostId.eq(postId).and(fUserId.eq(userId))).execute();
        } else {
            // Remove any existing dislike first
            dsl.deleteFrom(DISLIKES).where(fPostId.eq(postId).and(fUserId.eq(userId))).execute();
            dsl.insertInto(LIKES).set(fPostId, postId).set(fUserId, userId).execute();
        }

        int likeCount = dsl.selectCount().from(LIKES).where(fPostId.eq(postId)).fetchOneInto(int.class);
        int dislikeCount = dsl.selectCount().from(DISLIKES).where(fPostId.eq(postId)).fetchOneInto(int.class);

        return new ReactionResult(existing == 0, false, likeCount, dislikeCount);
    }

    // ── Toggle dislike on a post ──

    @Transactional
    public ReactionResult toggleDislike(Long postId, Long userId) {
        Field<Long> fPostId = DSL.field("post_id", SQLDataType.BIGINT);
        Field<Long> fUserId = DSL.field("user_id", SQLDataType.BIGINT);

        int existing = dsl.selectCount().from(DISLIKES)
                .where(fPostId.eq(postId).and(fUserId.eq(userId)))
                .fetchOneInto(int.class);

        if (existing > 0) {
            dsl.deleteFrom(DISLIKES).where(fPostId.eq(postId).and(fUserId.eq(userId))).execute();
        } else {
            // Remove any existing like first
            dsl.deleteFrom(LIKES).where(fPostId.eq(postId).and(fUserId.eq(userId))).execute();
            dsl.insertInto(DISLIKES).set(fPostId, postId).set(fUserId, userId).execute();
        }

        int likeCount = dsl.selectCount().from(LIKES).where(fPostId.eq(postId)).fetchOneInto(int.class);
        int dislikeCount = dsl.selectCount().from(DISLIKES).where(fPostId.eq(postId)).fetchOneInto(int.class);

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
