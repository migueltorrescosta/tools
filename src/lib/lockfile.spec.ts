import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
}

/**
 * Extracts all dependencies from package.json
 */
function getPackageJsonDeps(): Record<string, string> {
	const packageJsonPath = resolve('package.json');
	const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
	const packageJson: PackageJson = JSON.parse(packageJsonContent);

	return {
		...(packageJson.dependencies || {}),
		...(packageJson.devDependencies || {})
	};
}

/**
 * Extracts dependency specs from pnpm-lock.yaml
 * Parses the YAML format that pnpm uses (lockfileVersion: '9.0')
 */
function getLockfileDeps(): Record<string, string> {
	const lockfilePath = resolve('pnpm-lock.yaml');
	const lockfileContent = readFileSync(lockfilePath, 'utf-8');

	const deps: Record<string, string> = {};

	const lines = lockfileContent.split('\n');
	let inImportersDot = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check if we are in the importers -> . section
		// Line has exactly 2 spaces followed by .:
		if (/^\s{2}\.:\s*$/.test(line)) {
			inImportersDot = true;
			continue;
		}

		// Exit the importers section if we hit another top-level key (no leading spaces)
		if (inImportersDot && /^[a-z]/.test(line)) {
			inImportersDot = false;
		}

		if (!inImportersDot) continue;

		// Match package name at 6-space indent (within dependencies or devDependencies)
		// Packages can be quoted: 'package-name':
		const packageMatch = line.match(/^\s{6}('?[^:]+'?:)\s*$/);
		if (packageMatch) {
			// Remove quotes and trailing colon: 'package-name': -> package-name
			let packageName = packageMatch[1].replace(/^'|':$/g, '').replace(/:$/, '');
			// Look ahead for specifier on the next lines
			for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
				const nextLine = lines[j];
				const specifierMatch = nextLine.match(/^\s{8}specifier:\s+'?"?([^'"\s,]+)'?"?/);
				if (specifierMatch) {
					deps[packageName] = specifierMatch[1];
					break;
				}
			}
		}
	}

	return deps;
}

describe('Lockfile sync', () => {
	it('package.json and pnpm-lock.yaml should be in sync', () => {
		const packageJsonDeps = getPackageJsonDeps();
		const lockfileDeps = getLockfileDeps();

		const missingFromLockfile: string[] = [];
		const versionMismatch: string[] = [];

		for (const [pkg, expectedVersion] of Object.entries(packageJsonDeps)) {
			if (!(pkg in lockfileDeps)) {
				missingFromLockfile.push(pkg);
			} else if (lockfileDeps[pkg] !== expectedVersion) {
				versionMismatch.push(
					`${pkg}: lockfile has ${lockfileDeps[pkg]}, package.json has ${expectedVersion}`
				);
			}
		}

		const errors: string[] = [];
		if (missingFromLockfile.length > 0) {
			errors.push(
				`Missing from lockfile: ${missingFromLockfile.join(', ')}\nRun "pnpm install --no-frozen-lockfile" to fix.`
			);
		}
		if (versionMismatch.length > 0) {
			errors.push(`Version mismatches:\n${versionMismatch.join('\n')}`);
		}

		expect(errors.length, `Lockfile out of sync:\n${errors.join('\n\n')}`).toBe(0);
	});
});
