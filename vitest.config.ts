import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		testTimeout: 30_000,
		passWithNoTests: true,
		include: ['test/**/*.test.ts'],
		typecheck: {
			tsconfig: './tsconfig.test.json',
		},
	},
});
