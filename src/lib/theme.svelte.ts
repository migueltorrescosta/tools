/**
 * Three-way theme: Light, Dark, or Match device (nothing saved). src/app.html
 * applies a saved choice before first paint; this module keeps the switch, the
 * page's color-scheme and the browser bar colour (meta theme-color) in sync.
 */
export type Theme = 'light' | 'dark';
export type Mode = Theme | 'system';

export const THEME_KEY = 'theme';

/** --bg-start of each theme in tokens.css (the top-left corner of the dawn gradient), for the browser bar; keep in sync with src/app.html. */
export const THEME_COLOURS: Record<Theme, string> = { light: '#f9a870', dark: '#613521' };

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

/** `current` is the theme on screen; `mode` is what the switch shows. */
export const theme = $state<{ current: Theme; mode: Mode }>({ current: 'dark', mode: 'system' });

function paintBar(t: Theme) {
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		meta.content = THEME_COLOURS[t];
	}
}

/** Read the saved mode and follow OS changes while matching the device. Returns a cleanup. */
export function initTheme(): () => void {
	theme.mode = saved() ?? 'system';
	theme.current = saved() ?? system();
	const media = matchMedia(DARK_QUERY);
	const onChange = () => {
		if (theme.mode === 'system') {
			theme.current = system();
			paintBar(theme.current);
		}
	};
	media.addEventListener('change', onChange);
	return () => media.removeEventListener('change', onChange);
}

export function setMode(mode: Mode): void {
	theme.mode = mode;
	theme.current = mode === 'system' ? system() : mode;
	document.documentElement.style.colorScheme = mode === 'system' ? '' : mode;
	paintBar(theme.current);
	try {
		if (mode === 'system') localStorage.removeItem(THEME_KEY);
		else localStorage.setItem(THEME_KEY, mode);
	} catch {
		// Storage blocked: the choice lasts for this page only.
	}
}
