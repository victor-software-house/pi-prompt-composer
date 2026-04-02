#!/usr/bin/env bun
/**
 * Validate all skills in skills/ using Pi's own loadSkillsFromDir().
 *
 * This is the exact same parser and validation logic Pi runs at startup,
 * so any diagnostic here means Pi would show a warning on session load.
 *
 * Exit 0 → clean. Exit 1 → one or more diagnostics.
 */

// Resolved via local node_modules — pi-coding-agent is a devDependency.
// The dist/core/skills.js path is not a public export so we address it directly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — no type declarations for this internal dist path
import { loadSkillsFromDir } from '../node_modules/@mariozechner/pi-coding-agent/dist/core/skills.js';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

const raw: unknown = loadSkillsFromDir({ dir: './skills', source: 'package' });

if (!isRecord(raw)) {
	console.error('✗ validate-skills: Pi loadSkillsFromDir() returned a non-object result');
	process.exit(1);
}

const skillsRaw = raw['skills'];
const diagnosticsRaw = raw['diagnostics'];
const skills = Array.isArray(skillsRaw) ? skillsRaw : [];
const diagnostics = Array.isArray(diagnosticsRaw) ? diagnosticsRaw : [];

if (diagnostics.length === 0) {
	const names = skills
		.filter(isRecord)
		.map((skill) => skill['name'])
		.filter((name): name is string => typeof name === 'string');
	console.log(`✓ ${names.length} skill(s) valid: ${names.join(', ')}`);
	process.exit(0);
}

for (const diagnostic of diagnostics) {
	if (!isRecord(diagnostic)) {
		console.error('✗ [warning] <unknown path>\n    malformed diagnostic from Pi parser');
		continue;
	}
	const type = typeof diagnostic['type'] === 'string' ? diagnostic['type'] : 'warning';
	const path = typeof diagnostic['path'] === 'string' ? diagnostic['path'] : '<unknown path>';
	const message = typeof diagnostic['message'] === 'string' ? diagnostic['message'] : 'unknown diagnostic';
	console.error(`✗ [${type}] ${path}\n    ${message}`);
}

process.exit(1);
