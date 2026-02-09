import { createPlugin } from '@/utils';
import { t } from '@/i18n';

import style from './style.css?inline';

export default createPlugin({
    name: () => t('plugins.miniplayer.name'),
    description: () => t('plugins.miniplayer.description'),
    restartNeeded: false,
    config: {
        enabled: false,
        visualizerEnabled: true,
        visualizerStyle: 'bars', // 'bars' | 'wave'
        videoEnabled: true,
        clickToSwitch: true,
        draggableEnabled: true,
        widescreenMode: true,
        crossfadeEnabled: false,
        autoOpenOnSongChange: false,
    },
    stylesheets: [style],
    menu: async ({ getConfig, setConfig }) => {
        const config = await getConfig();
        return [
            {
                label: t('plugins.miniplayer.menu.visualizer-enabled'),
                type: 'checkbox',
                checked: config.visualizerEnabled,
                click(item) {
                    setConfig({ visualizerEnabled: item.checked });
                },
            },
            {
                label: t('plugins.miniplayer.menu.visualizer-style.label'),
                submenu: [
                    {
                        label: t('plugins.miniplayer.menu.visualizer-style.bars'),
                        type: 'radio',
                        checked: config.visualizerStyle === 'bars',
                        click() {
                            setConfig({ visualizerStyle: 'bars' });
                        },
                    },
                    {
                        label: t('plugins.miniplayer.menu.visualizer-style.wave'),
                        type: 'radio',
                        checked: config.visualizerStyle === 'wave',
                        click() {
                            setConfig({ visualizerStyle: 'wave' });
                        },
                    },
                ],
            },
            {
                label: t('plugins.miniplayer.menu.video-enabled'),
                type: 'checkbox',
                checked: config.videoEnabled,
                click(item) {
                    setConfig({ videoEnabled: item.checked });
                },
            },
            {
                label: t('plugins.miniplayer.menu.click-to-switch'),
                type: 'checkbox',
                checked: config.clickToSwitch,
                click(item) {
                    setConfig({ clickToSwitch: item.checked });
                },
            },
            {
                label: t('plugins.miniplayer.menu.draggable-enabled'),
                type: 'checkbox',
                checked: config.draggableEnabled,
                click(item) {
                    setConfig({ draggableEnabled: item.checked });
                },
            },
            {
                label: t('plugins.miniplayer.menu.widescreen-mode'),
                type: 'checkbox',
                checked: config.widescreenMode,
                click(item) {
                    setConfig({ widescreenMode: item.checked });
                },
            },
            {
                label: 'Crossfade Between Songs',
                type: 'checkbox',
                checked: config.crossfadeEnabled,
                click(item) {
                    setConfig({ crossfadeEnabled: item.checked });
                },
            },
            {
                label: t('plugins.miniplayer.menu.auto-open-on-click'),
                type: 'checkbox',
                checked: config.autoOpenOnSongChange,
                click(item) {
                    setConfig({ autoOpenOnSongChange: item.checked });
                },
            },
        ];
    },
    renderer: {
        miniplayer: undefined as any,

        async start(this: any, { getConfig }: { getConfig: () => Promise<any> }) {
            const config = await getConfig();
            // Dynamically import to avoid loading in main process
            const { Miniplayer } = await import('./miniplayer');
            this.miniplayer = new Miniplayer(config);
            const playerApi = (document.querySelector('ytmusic-app-layout') as any)?.playerApi;
            if (playerApi) {
                this.miniplayer.setPlayerApi(playerApi);
            }
            document.body.appendChild(this.miniplayer.getElement());
        },

        stop(this: any) {
            if (this.miniplayer) {
                this.miniplayer.destroy();
                this.miniplayer = undefined;
            }
        },

        onConfigChange(this: any, newConfig: any) {
            if (this.miniplayer) {
                this.miniplayer.setConfig(newConfig);
            }
        },
    },
});
