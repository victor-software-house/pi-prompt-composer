/// <reference types="vitest/globals" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	discoverTemplateExamples,
	loadTemplateCase,
	readTemplateExpected,
	renderTemplateExample,
	shouldUpdateTemplateExamples,
	writeTemplateExpected,
} from './template-example-runner';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_ROOT = path.join(__dirname, '..', 'examples', 'templating');
const examples = await discoverTemplateExamples(EXAMPLES_ROOT);

describe('templating examples', () => {
	if (examples.length === 0) {
		test.skip('no templating examples discovered', () => {
			// placeholder
		});
		return;
	}

	for (const example of examples) {
		test(`${example.name} renders identical to expected.md`, async () => {
			const exampleCase = await loadTemplateCase(example.casePath);
			const rendered = await renderTemplateExample(example);

			if (shouldUpdateTemplateExamples()) {
				await writeTemplateExpected(example, rendered);
			}

			const expected = await readTemplateExpected(example);
			expect(
				expected,
				`Missing expected.md for template example "${example.name}". Run UPDATE_TEMPLATE_EXAMPLES=1 pnpm test. Description: ${exampleCase.description}`,
			).not.toBeNull();
			expect(rendered).toBe(expected);
		});
	}
});
