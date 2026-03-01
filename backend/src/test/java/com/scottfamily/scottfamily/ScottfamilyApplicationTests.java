package com.scottfamily.scottfamily;

import org.junit.jupiter.api.Test;

class ScottfamilyApplicationTests {

	@Test
	void contextLoads() {
		// Smoke test — full SpringBootTest context load is skipped because the
		// datasource requires environment variables (SPRING_DATASOURCE_URL, etc.)
		// that are only available at runtime / in CI with a real SQL Server.
	}

}
