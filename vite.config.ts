import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import type { Plugin } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';

// Killing `pnpm dev` leaves vite, and the workerd it starts, running with no parent.
// The dev server closes itself once its launcher is gone, which also stops workerd: the
// launcher is vite's parent, and that parent's parent too when it is the `sh -c` pnpm runs
// scripts through (found through /proc, so on Linux only).
function launchers(): number[] {
	const pids = [process.ppid];
	try {
		if (readFileSync(`/proc/${process.ppid}/comm`, 'utf8').trim() === 'sh') {
			const stat = readFileSync(`/proc/${process.ppid}/stat`, 'utf8');
			pids.push(Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]));
		}
	} catch {
		// No /proc: watch the parent alone.
	}
	return pids;
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		return (err as NodeJS.ErrnoException).code === 'EPERM';
	}
}

// `vite build` exits with the workerd its prerender starts still running. On exit, vite stops
// any workerd child it has left, whichever thread started it (found through /proc, so on
// Linux only).
if (!process.env.VITEST) {
	process.once('exit', () => {
		try {
			for (const task of readdirSync('/proc/self/task')) {
				const children = readFileSync(`/proc/self/task/${task}/children`, 'utf8');
				for (const pid of children.split(' ').filter(Boolean).map(Number)) {
					if (readFileSync(`/proc/${pid}/comm`, 'utf8').trim() === 'workerd') process.kill(pid);
				}
			}
		} catch {
			// No /proc, or a child already gone.
		}
	});
}

function exitWithLauncher(): Plugin {
	return {
		name: 'exit-with-launcher',
		apply: 'serve',
		configureServer(server) {
			if (process.env.VITEST) return;
			const parent = process.ppid;
			const watched = launchers();
			setInterval(() => {
				if (process.ppid !== parent || !watched.every(alive)) {
					void server.close().finally(() => process.exit());
				}
			}, 1000).unref();
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), exitWithLauncher()],
	server: {
		allowedHosts: ['aurora.seagull-dominant.ts.net']
	},
	test: {
		expect: {
			requireAssertions: true
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [
							{
								browser: 'chromium',
								headless: true
							}
						]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
