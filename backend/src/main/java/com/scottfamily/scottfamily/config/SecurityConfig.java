package com.scottfamily.scottfamily.config;

import com.yourproject.generated.scott_family_web.tables.records.UsersRecord;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import jakarta.servlet.http.HttpServletRequest;

import java.util.List;

import static com.yourproject.generated.scott_family_web.Tables.USERS;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    // Comma-separated list of allowed origins; fall back to localhost:3000 in dev.
    @Value("${app.cors.origin:http://localhost:3000}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // CORS must be before CSRF/authZ so preflights succeed
                .cors(Customizer.withDefaults())

                // CSRF via double-submit cookie: Spring sets XSRF-TOKEN cookie,
                // frontend reads it and sends it back as X-XSRF-TOKEN header.
                .csrf(csrf -> {
                    var delegate = new CsrfTokenRequestAttributeHandler();
                    delegate.setCsrfRequestAttributeName(null); // force eager resolution
                    csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(delegate)
                        // Exempt webhook endpoints (authenticated via HMAC, not session)
                        // and auth endpoints (public, no session yet so no CSRF cookie)
                        .ignoringRequestMatchers("/api/webhooks/**", "/api/auth/**");
                })

                // Your auth rules — keep these aligned with “site behind login except auth/public”
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()       // preflight
                        .requestMatchers("/api/auth/**").permitAll()                  // login, signup, forgot/reset
                        .requestMatchers("/api/assets/anonymous/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/settings").permitAll() // public site settings
                        .requestMatchers(HttpMethod.GET, "/api/announcements/active").permitAll() // public announcements
                        .requestMatchers(HttpMethod.GET, "/api/people/search").permitAll()        // needed during signup for profile claim
                        .requestMatchers(HttpMethod.GET, "/api/people/unclaimed").permitAll()     // needed during signup for profile claim
                        .requestMatchers(HttpMethod.GET, "/api/people/unclaimed-archived").permitAll() // needed during signup for archived profile claim
                        .requestMatchers(HttpMethod.GET, "/api/profile/{personId}").permitAll()   // needed during signup auto-populate
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/square").permitAll()     // Square webhook (signature-verified internally)
                        .requestMatchers(HttpMethod.GET, "/api/page-content/**").permitAll()      // public page content
                        // everything else requires login
                        .anyRequest().authenticated()
                )

                // Use the HTTP session for authentication state
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                // Let Spring Security write/read the SecurityContext to the HTTP session
                .securityContext(sc -> sc.securityContextRepository(securityContextRepository()))

                // Explicit logout — invalidates session, clears cookies
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((req, resp, auth) -> {
                            resp.setStatus(200);
                            resp.setContentType("application/json");
                            resp.getWriter().write("{\"loggedOut\":true}");
                        })
                )

                // Return 401 JSON for unauthenticated requests (e.g. expired/missing session)
                // and 403 JSON for authenticated users lacking permissions.
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((req, resp, ex) -> {
                            resp.setStatus(401);
                            resp.setContentType("application/json");
                            resp.getWriter().write("{\"error\":\"Unauthenticated\",\"message\":\"Session expired or invalid. Please log in again.\"}");
                        })
                        .accessDeniedHandler((req, resp, ex) -> {
                            resp.setStatus(403);
                            resp.setContentType("application/json");
                            resp.getWriter().write("{\"error\":\"Forbidden\",\"message\":\"You do not have permission to access this resource.\"}");
                        })
                )

                // Security headers
                .headers(headers -> headers
                        .frameOptions(frame -> frame.sameOrigin())
                        .contentTypeOptions(cto -> {})         // X-Content-Type-Options: nosniff
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000))    // Strict-Transport-Security
                );

        return http.build();
    }

    // Global CORS: allow credentials, permit common headers/methods, and reflect your configured origin
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        return new CorsConfigurationSource() {
            @Override
            public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
                CorsConfiguration cfg = new CorsConfiguration();

                // IMPORTANT: with allowCredentials(true), AllowedOrigins must be explicit (no “*”)
                cfg.setAllowedOrigins(
                    java.util.Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList()
                );
                cfg.setAllowCredentials(true);

                // Methods your frontend actually uses
                cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));

                // Headers your frontend will send/read
                cfg.setAllowedHeaders(List.of(
                        "Origin", "Content-Type", "Accept",
                        "Authorization", "X-Requested-With",
                        "X-XSRF-TOKEN"
                ));

                // Expose any headers the frontend needs to read (e.g., Set-Cookie is handled by the browser,
                // but exposing it here is harmless; most useful are custom headers if you add them later)
                cfg.setExposedHeaders(List.of("Location", "Content-Disposition"));

                // Cache preflight for 30 minutes
                cfg.setMaxAge(1800L);

                return cfg;
            }
        };
    }

    // Default DelegatingPasswordEncoder (no custom bean needed elsewhere)
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
    }

    // Backed by HttpSession — solves the “SecurityContextRepository bean” complaints
    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public UserDetailsService userDetailsService(@Autowired final DSLContext dsl) {
        return username -> {
            UsersRecord user = dsl.selectFrom(USERS)
                    .where(USERS.USERNAME.eq(username))
                    .fetchOne();
            if(user == null){
                throw new UsernameNotFoundException("username not found");
            }
            var authorities = List.of(new SimpleGrantedAuthority(user.getUserRole()));
            return org.springframework.security.core.userdetails.User
                    .withUsername(user.getUsername())
                    .password(user.getPasswordHash())
                    .authorities(authorities)
                    .accountExpired(false).accountLocked(false).credentialsExpired(false).disabled(false)
                    .build();
        };
    }
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

}
