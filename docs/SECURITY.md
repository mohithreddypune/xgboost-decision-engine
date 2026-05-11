# Security & Authentication

The orchestrator ships with **auth disabled** for the local demo experience —
all dashboard endpoints are open. Two production-ready paths are scaffolded:

## 1. GitHub OAuth (Spring Security OAuth2 client)

### Step 1 — Register a GitHub OAuth App

Go to **https://github.com/settings/developers → New OAuth App**:

- **Application name:** XGBoost Decision Engine
- **Homepage URL:** `http://localhost:4200`
- **Authorization callback URL:** `http://localhost:8080/login/oauth2/code/github`

GitHub will issue a Client ID and a Client Secret.

### Step 2 — Add the Spring Security starter

In `orchestrator/pom.xml`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>
```

### Step 3 — Configure the client

In `application.yml`:

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          github:
            client-id:     ${OAUTH_GITHUB_CLIENT_ID}
            client-secret: ${OAUTH_GITHUB_CLIENT_SECRET}
            scope: read:user, user:email
```

### Step 4 — Add a SecurityFilterChain

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/api/health/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/decisions/**", "/api/insights/**").authenticated()
                .requestMatchers(HttpMethod.POST, "/api/analyze/**", "/api/model/retrain").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2Login(Customizer.withDefaults())
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"));
        return http.build();
    }
}
```

### Step 5 — Set env vars and run

```bash
export OAUTH_GITHUB_CLIENT_ID=...
export OAUTH_GITHUB_CLIENT_SECRET=...
docker compose up
```

Visiting `http://localhost:4200` will redirect to GitHub for sign-in. Once
authorized, the user's email becomes the audit identity for every decision.

## 2. AI Co-Pilot (LLM-powered analyst chat)

The `/api/copilot/ask` endpoint runs in **local mode** out of the box —
canned-intent classifier hitting Postgres directly. It returns useful answers for:

- "blocked transactions over $X" → SQL query, rows returned
- "what's the current fraud rate" → aggregate over the last 60min
- "what's happening right now" → live action breakdown

### To enable LLM mode

1. Get an API key:
   - **Anthropic Claude:** https://console.anthropic.com/
   - **OpenAI:** https://platform.openai.com/api-keys
2. Set the env vars:
   ```bash
   export COPILOT_PROVIDER=anthropic    # or openai
   export COPILOT_API_KEY=sk-...
   ```
3. Implement the `askLlm()` method body in `CopilotController.java` (a starter
   for both providers is in the file's javadoc).
4. Restart the orchestrator: `docker compose up -d --build orchestrator`

The LLM receives both the question and the local intent classifier's structured
results as context — so even when the LLM hallucinates, the user sees the
ground-truth row count and can verify.
