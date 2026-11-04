import type { WordLyric } from '../types';

interface LRCTag {
  tag: string;
  value: string;
}

interface LRCLine {
  time: string;
  timeInMs: number;
  duration: number;
  text: string;
  words?: WordLyric[];
}

interface LRC {
  tags: LRCTag[];
  lines: LRCLine[];
}

const tagRegex = /^\[(?<tag>\w+):\s*(?<value>.+?)\s*\]$/;
// prettier-ignore
const lyricRegex = /^\[(?<minutes>\d+):(?<seconds>\d+)(?:\.(?<milliseconds>\d+))?\](?<text>.*)$/;

export const LRC = {
  parse: (text: string): LRC => {
    const lrc: LRC = {
      tags: [],
      lines: [],
    };

    let offset = 0;
    let previousLine: LRCLine | null = null;

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();

      // Check for Metrolist word timing line: <word:start:end|word:start:end>
      if (line.startsWith('<') && line.endsWith('>') && previousLine) {
        const inner = line.slice(1, -1).trim();
        const wordParts = inner.split('|');
        const words: WordLyric[] = [];

        for (const part of wordParts) {
          const colonIdx1 = part.indexOf(':');
          const colonIdx2 = part.lastIndexOf(':');
          if (colonIdx1 !== -1 && colonIdx2 !== -1 && colonIdx1 !== colonIdx2) {
            const wText = part.slice(0, colonIdx1);
            const wStartSec = parseFloat(part.slice(colonIdx1 + 1, colonIdx2));
            const wEndSec = parseFloat(part.slice(colonIdx2 + 1));
            if (!isNaN(wStartSec) && !isNaN(wEndSec)) {
              words.push({
                text: wText,
                startTime: Math.round(wStartSec * 1000),
                endTime: Math.round(wEndSec * 1000),
              });
            }
          }
        }

        if (words.length > 0) {
          previousLine.words = words;
        }
        continue;
      }

      if (!line.startsWith('[')) continue;

      const lyric = line.match(lyricRegex)?.groups;
      if (!lyric) {
        const tag = line.match(tagRegex)?.groups;
        if (tag) {
          if (tag.tag === 'offset') {
            offset = parseInt(tag.value);
            continue;
          }

          lrc.tags.push({
            tag: tag.tag,
            value: tag.value,
          });
        }
        continue;
      }

      const { minutes, seconds, milliseconds, text: rawLyricText } = lyric;
      const timeInMs =
        parseInt(minutes) * 60 * 1000 +
        parseInt(seconds) * 1000 +
        (milliseconds ? parseInt(milliseconds.padEnd(3, '0').slice(0, 3)) : 0);

      // Clean up agent tags like {agent:v1} or {bg}
      const cleanedText = rawLyricText
        .replace(/^\{agent:[^}]+\}/, '')
        .replace(/^\{bg\}/, '')
        .trim();

      const currentLine: LRCLine = {
        time: `${minutes}:${seconds}:${milliseconds}`,
        timeInMs,
        text: cleanedText,
        duration: Infinity,
      };

      if (previousLine) {
        previousLine.duration = timeInMs - previousLine.timeInMs;
      }

      previousLine = currentLine;
      lrc.lines.push(currentLine);
    }

    for (const line of lrc.lines) {
      line.timeInMs += offset;
    }

    const first = lrc.lines.at(0);
    if (first && first.timeInMs > 300) {
      lrc.lines.unshift({
        time: '0:0:0',
        timeInMs: 0,
        duration: first.timeInMs,
        text: '',
      });
    }

    return lrc;
  },
};
