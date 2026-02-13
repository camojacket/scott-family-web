-- -- ===== 1. USERS: Login + Profile Info + Bio =====
-- CREATE TABLE users (
--     id BIGINT IDENTITY PRIMARY KEY,
--     username NVARCHAR(50) NOT NULL UNIQUE,
--     password_hash NVARCHAR(255) NOT NULL,
--     display_name NVARCHAR(100),
--     email NVARCHAR(100) UNIQUE,
--     bio NVARCHAR(MAX),  -- ✅ Added bio field
--     created_at DATETIME2 DEFAULT SYSDATETIME()
-- );

-- -- ===== 2. PEOPLE: Family Tree =====
-- CREATE TABLE people (
--     id BIGINT IDENTITY PRIMARY KEY,
--     first_name NVARCHAR(50) NOT NULL,
--     last_name NVARCHAR(50),
--     date_of_birth DATE,
--     mother_id BIGINT NULL,
--     father_id BIGINT NULL,
--     FOREIGN KEY (mother_id) REFERENCES people(id),
--     FOREIGN KEY (father_id) REFERENCES people(id)
-- );

-- -- ===== 3. BLOG POSTS =====
-- CREATE TABLE blog_posts (
--     id BIGINT IDENTITY PRIMARY KEY,
--     author_id BIGINT NOT NULL,
--     title NVARCHAR(255) NOT NULL,
--     content NVARCHAR(MAX),
--     created_at DATETIME2 DEFAULT SYSDATETIME(),
--     FOREIGN KEY (author_id) REFERENCES users(id)
-- );

-- -- ===== 4. COMMENTS =====
-- CREATE TABLE comments (
--     id BIGINT IDENTITY PRIMARY KEY,
--     post_id BIGINT NOT NULL,
--     author_id BIGINT NULL,
--     content NVARCHAR(MAX) NOT NULL,
--     created_at DATETIME2 DEFAULT SYSDATETIME(),
--     FOREIGN KEY (post_id) REFERENCES blog_posts(id),
--     FOREIGN KEY (author_id) REFERENCES users(id)
-- );

-- -- ===== 5. LIKES =====
-- CREATE TABLE likes (
--     id BIGINT IDENTITY PRIMARY KEY,
--     post_id BIGINT NOT NULL,
--     user_id BIGINT NOT NULL,
--     created_at DATETIME2 DEFAULT SYSDATETIME(),
--     FOREIGN KEY (post_id) REFERENCES blog_posts(id),
--     FOREIGN KEY (user_id) REFERENCES users(id)
-- );

-- -- ✅ ALTER statement for SQL Server
-- ALTER TABLE users
-- ADD approved_at DATETIME2 NULL,
--     requested_at DATETIME2 DEFAULT SYSDATETIME();

-- ALTER TABLE users
-- ADD user_role NVARCHAR(20) NOT NULL DEFAULT 'ROLE_USER';

-- ALTER TABLE users
-- ADD CONSTRAINT chk_user_role
-- CHECK (user_role IN ('ROLE_USER', 'ROLE_ADMIN'));

-- ALTER TABLE users
-- ADD profile_picture_url NVARCHAR(255) NULL,
--     banner_image_url NVARCHAR(255) NULL;
-- 67TaCXz323

