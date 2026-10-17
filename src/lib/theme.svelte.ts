/**
 * Two-state theme. With nothing saved the site follows the OS; toggling saves
 * the opposite theme in localStorage for good. src/app.html applies the saved
 * value before first paint, so this module only keeps the toggle in sync.
 */
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

function saved(): Theme | null {
	try {
		const value = localStorage.getItem(THEME_KEY);
		return value === 'light' || value === 'dark' ? value : null;
	} catch {
		return null;
	}
}

function system(): Theme {
	return matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export const theme = $state<{ current: Theme }>({ current: 'dark' });

/** Read the effective theme and follow OS changes until the user picks one. Returns a cleanup. */
export function initTheme(): () => void {
	theme.current = saved() ?? system();
	const media = matchMedia(DARK_QUERY);
	const onChange = () => {
		if (!saved()) theme.current = system();
	};
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}

export function toggleTheme(): void {
	const next: Theme = theme.current === 'dark' ? 'light' : 'dark';
	theme.current = next;
	document.documentElement.style.colorScheme = next;
	try {
		localStorage.setItem(THEME_KEY, next);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
}
