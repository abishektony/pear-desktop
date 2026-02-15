import { test, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('launch app', async () => {
    const appPath = path.resolve(import.meta.dirname, '..');
    const app = await electron.launch({
        cwd: appPath,
        args: [appPath],
    });
    await app.close();
});
