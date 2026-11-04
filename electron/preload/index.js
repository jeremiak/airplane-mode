import { contextBridge } from 'electron';

// Expose a minimal, explicit API to the SvelteKit renderer as `window.electron`
contextBridge.exposeInMainWorld('electron', {
	platform: process.platform,
	versions: { ...process.versions }
});
