import { createEffect, For, Show, createSignal, createMemo } from 'solid-js';

import { type VirtualizerHandle } from 'virtua/solid';

import { type LineLyrics } from '@/plugins/synced-lyrics/types';

import { config, currentTime } from '../renderer';
import { _ytAPI } from '..';

import { canonicalize, romanize, simplifyUnicode } from '../utils';

interface SyncedLineProps {
  scroller: VirtualizerHandle;
  index: number;

  line: LineLyrics;
  status: 'upcoming' | 'current' | 'previous';
}

const EmptyLine = (props: SyncedLineProps) => {
  const states = createMemo(() => {
    const defaultText = config()?.defaultTextString ?? '';
    return Array.isArray(defaultText) ? defaultText : [defaultText];
  });

  const index = createMemo(() => {
    const progress = currentTime() - props.line.timeInMs;
    const total = props.line.duration;

    const percentage = Math.min(1, progress / total);
    return Math.max(0, Math.floor((states().length - 1) * percentage));
  });

  return (
    <div
      class={`synced-line ${props.status}`}
      onClick={() => {
        const offset = (window as any).pearLyricsOffset || 0;
        _ytAPI?.seekTo(Math.max(0, (props.line.timeInMs - offset + 10) / 1000));
      }}
    >
      <div class="description ytmusic-description-shelf-renderer" dir="auto">
        <yt-formatted-string
          text={{
            runs: [
              {
                text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
              },
            ],
          }}
        />

        <div class="text-lyrics">
          <span>
            <span>
              <Show
                fallback={
                  <yt-formatted-string
                    text={{ runs: [{ text: states()[0] }] }}
                  />
                }
                when={states().length > 1}
              >
                <yt-formatted-string
                  text={{
                    runs: [
                      {
                        text: states().at(
                          props.status === 'current' ? index() : -1,
                        )!,
                      },
                    ],
                  }}
                />
              </Show>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export const SyncedLine = (props: SyncedLineProps) => {
  const text = createMemo(() => props.line.text.trim());

  const wordsList = createMemo(() => {
    if (props.line.words && props.line.words.length > 0) {
      return props.line.words;
    }
    const parts = text().split(' ').filter(Boolean);
    if (parts.length === 0) return [];
    const dur = Math.max(500, props.line.duration);
    const step = dur / parts.length;
    return parts.map((part, idx) => ({
      text: part,
      startTime: props.line.timeInMs + Math.round(idx * step),
      endTime: props.line.timeInMs + Math.round((idx + 1) * step),
    }));
  });

  const [romanization, setRomanization] = createSignal('');
  createEffect(() => {
    const input = canonicalize(text());
    if (!config()?.romanization) return;

    romanize(input).then((result) => {
      setRomanization(canonicalize(result));
    });
  });

  return (
    <Show fallback={<EmptyLine {...props} />} when={text()}>
      <div
        class={`synced-line ${props.status}`}
        onClick={() => {
          const offset = (window as any).pearLyricsOffset || 0;
          _ytAPI?.seekTo(Math.max(0, (props.line.timeInMs - offset + 10) / 1000));
        }}
      >
        <div class="description ytmusic-description-shelf-renderer" dir="auto">
          <yt-formatted-string
            text={{
              runs: [
                {
                  text: config()?.showTimeCodes ? `[${props.line.time}] ` : '',
                },
              ],
            }}
          />

          <div
            class="text-lyrics"
            ref={(div: HTMLDivElement) => {
              div.style.setProperty(
                '--lyrics-duration',
                `${props.line.duration / 1000}s`,
                'important',
              );
            }}
            style={{ 'display': 'flex', 'flex-direction': 'column' }}
          >
            <span class="synced-line-words">
              <For each={wordsList()}>
                {(word) => {
                  const isWordActive = () =>
                    props.status === 'current' &&
                    currentTime() >= word.startTime &&
                    currentTime() < word.endTime;

                  const hasWordPassed = () =>
                    props.status === 'previous' ||
                    (props.status === 'current' && currentTime() >= word.endTime);

                  const wordProgress = () => {
                    if (hasWordPassed()) return 1;
                    if (!isWordActive()) return 0;
                    const dur = word.endTime - word.startTime;
                    if (dur <= 0) return 1;
                    const elapsed = currentTime() - word.startTime;
                    const linear = Math.min(1, Math.max(0, elapsed / dur));
                    return linear * linear * (3 - 2 * linear);
                  };

                  return (
                    <span
                      class={`synced-word ${isWordActive() ? 'word-active' : ''} ${hasWordPassed() ? 'word-passed' : ''} ${!isWordActive() && !hasWordPassed() ? 'word-upcoming' : ''}`}
                      style={{
                        '--word-progress': wordProgress().toFixed(2),
                      }}
                    >
                      <yt-formatted-string
                        text={{
                          runs: [{ text: `${word.text} ` }],
                        }}
                      />
                    </span>
                  );
                }}
              </For>
            </span>

            <Show
              when={
                config()?.romanization &&
                simplifyUnicode(text()) !== simplifyUnicode(romanization())
              }
            >
              <span class="romaji">
                <For each={romanization().split(' ')}>
                  {(word, index) => {
                    return (
                      <span
                        style={{
                          'transition-delay': `${index() * 0.05}s`,
                          'animation-delay': `${index() * 0.05}s`,
                        }}
                      >
                        <yt-formatted-string
                          text={{
                            runs: [{ text: `${word} ` }],
                          }}
                        />
                      </span>
                    );
                  }}
                </For>
              </span>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
