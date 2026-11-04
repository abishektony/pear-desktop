import type { LineLyrics, WordLyric } from '../types';

interface SpanInfo {
  text: string;
  startTime: number; // in ms
  endTime: number;   // in ms
  hasTrailingSpace: boolean;
}

export const TTMLParser = {
  parse(ttmlText: string): LineLyrics[] {
    if (!ttmlText || typeof ttmlText !== 'string') return [];

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(ttmlText, 'text/xml');
      const pElements = doc.getElementsByTagName('p');
      const lines: LineLyrics[] = [];

      for (let i = 0; i < pElements.length; i++) {
        const pElement = pElements[i];
        const beginAttr = pElement.getAttribute('begin');
        if (!beginAttr) continue;

        const startTime = this.parseTime(beginAttr);
        const endAttr = pElement.getAttribute('end');
        const endTime = endAttr ? this.parseTime(endAttr) : null;

        const spanInfos: SpanInfo[] = [];
        const backgroundLines: LineLyrics[] = [];

        const childNodes = pElement.childNodes;
        for (let j = 0; j < childNodes.length; j++) {
          const node = childNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            const span = node as Element;
            if (span.tagName.toLowerCase() === 'span') {
              const role = this.getAttributeByLocalName(span, 'role');
              if (role === 'x-bg') {
                const bgLine = this.parseBackgroundSpan(span, startTime);
                if (bgLine) backgroundLines.push(bgLine);
              } else if (role === 'x-translation' || role === 'x-roman') {
                // Skip translations and romanizations in main lyrics stream
                continue;
              } else {
                const wordBegin = span.getAttribute('begin');
                const wordEnd = span.getAttribute('end');
                const wordText = span.textContent?.trim() || '';

                if (wordText && wordBegin && wordEnd) {
                  const nextSibling = node.nextSibling;
                  const hasTrailingSpace =
                    nextSibling?.nodeType === Node.TEXT_NODE &&
                    /\s/.test(nextSibling.textContent || '');

                  spanInfos.push({
                    text: wordText,
                    startTime: this.parseTime(wordBegin),
                    endTime: this.parseTime(wordEnd),
                    hasTrailingSpace,
                  });
                }
              }
            }
          }
        }

        // Merge consecutive spans without spaces (syllables) into whole words
        const words = this.mergeSpansIntoWords(spanInfos);
        const lineText = words.length > 0
          ? words.map((w) => w.text).join(' ')
          : this.getDirectTextContent(pElement).trim();

        if (!lineText) continue;

        const duration = endTime !== null
          ? Math.max(500, endTime - startTime)
          : words.length > 0
            ? Math.max(500, words[words.length - 1].endTime - startTime)
            : 3000;

        lines.push({
          time: this.formatTime(startTime),
          timeInMs: Math.round(startTime),
          duration: Math.round(duration),
          text: lineText,
          status: 'upcoming',
          words: words.length > 0 ? words : undefined,
        });

        // Add background vocal lines if any
        for (const bg of backgroundLines) {
          lines.push(bg);
        }
      }

      // Sort lines chronologically
      lines.sort((a, b) => a.timeInMs - b.timeInMs);

      // Adjust duration between consecutive lines when appropriate
      for (let i = 0; i < lines.length - 1; i++) {
        const nextStart = lines[i + 1].timeInMs;
        const currentEnd = lines[i].timeInMs + lines[i].duration;
        if (currentEnd > nextStart) {
          lines[i].duration = Math.max(500, nextStart - lines[i].timeInMs);
        }
      }

      // Prepend intro spacer if song starts after 300ms
      const first = lines.at(0);
      if (first && first.timeInMs > 300) {
        lines.unshift({
          time: '00:00.00',
          timeInMs: 0,
          duration: first.timeInMs,
          text: '',
          status: 'upcoming',
        });
      }

      return lines;
    } catch (err) {
      console.error('[TTMLParser] Failed to parse TTML:', err);
      return [];
    }
  },

  getAttributeByLocalName(element: Element, localName: string): string {
    const nsValue = element.getAttributeNS('http://www.w3.org/ns/ttml#metadata', localName);
    if (nsValue) return nsValue;

    const prefixedValue = element.getAttribute(`ttm:${localName}`);
    if (prefixedValue) return prefixedValue;

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name === localName || attr.name.endsWith(`:${localName}`)) {
        return attr.value;
      }
    }
    return '';
  },

  parseBackgroundSpan(span: Element, parentStartTime: number): LineLyrics | null {
    const bgBegin = span.getAttribute('begin');
    const bgEnd = span.getAttribute('end');
    const startTime = bgBegin ? this.parseTime(bgBegin) : parentStartTime;
    const endTime = bgEnd ? this.parseTime(bgEnd) : null;

    const spanInfos: SpanInfo[] = [];
    const childNodes = span.childNodes;

    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        const innerSpan = node as Element;
        if (innerSpan.tagName.toLowerCase() === 'span') {
          const role = this.getAttributeByLocalName(innerSpan, 'role');
          if (role === 'x-translation' || role === 'x-roman') continue;

          const wordBegin = innerSpan.getAttribute('begin');
          const wordEnd = innerSpan.getAttribute('end');
          const wordText = innerSpan.textContent?.trim() || '';

          if (wordText && wordBegin && wordEnd) {
            const nextSibling = node.nextSibling;
            const hasTrailingSpace =
              nextSibling?.nodeType === Node.TEXT_NODE &&
              /\s/.test(nextSibling.textContent || '');

            spanInfos.push({
              text: wordText,
              startTime: this.parseTime(wordBegin),
              endTime: this.parseTime(wordEnd),
              hasTrailingSpace,
            });
          }
        }
      }
    }

    const words = this.mergeSpansIntoWords(spanInfos);
    const lineText = words.length > 0
      ? words.map((w) => w.text).join(' ')
      : this.getDirectTextContent(span).trim();

    if (!lineText) return null;

    const duration = endTime !== null
      ? Math.max(500, endTime - startTime)
      : words.length > 0
        ? Math.max(500, words[words.length - 1].endTime - startTime)
        : 2500;

    return {
      time: this.formatTime(startTime),
      timeInMs: Math.round(startTime),
      duration: Math.round(duration),
      text: `(${lineText})`,
      status: 'upcoming',
      words: words.length > 0 ? words : undefined,
    };
  },

  getDirectTextContent(element: Element): string {
    let result = '';
    const childNodes = element.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        const role = this.getAttributeByLocalName(el, 'role');
        if (role !== 'x-bg' && role !== 'x-translation' && role !== 'x-roman') {
          if (el.tagName.toLowerCase() === 'span') {
            result += el.textContent || '';
          }
        }
      }
    }
    return result;
  },

  mergeSpansIntoWords(spanInfos: SpanInfo[]): WordLyric[] {
    if (spanInfos.length === 0) return [];

    const words: WordLyric[] = [];
    let currentText = '';
    let currentStartTime = spanInfos[0].startTime;
    let currentEndTime = spanInfos[0].endTime;

    for (let i = 0; i < spanInfos.length; i++) {
      const span = spanInfos[i];
      if (i === 0) {
        currentText = span.text;
        currentStartTime = span.startTime;
        currentEndTime = span.endTime;
      } else {
        const prevSpan = spanInfos[i - 1];
        if (prevSpan.hasTrailingSpace) {
          if (currentText.trim()) {
            words.push({
              text: currentText.trim(),
              startTime: Math.round(currentStartTime),
              endTime: Math.round(currentEndTime),
            });
          }
          currentText = span.text;
          currentStartTime = span.startTime;
          currentEndTime = span.endTime;
        } else {
          currentText += span.text;
          currentEndTime = span.endTime;
        }
      }
    }

    if (currentText.trim()) {
      words.push({
        text: currentText.trim(),
        startTime: Math.round(currentStartTime),
        endTime: Math.round(currentEndTime),
      });
    }

    return words;
  },

  parseTime(timeStr: string): number {
    if (!timeStr) return 0;
    const clean = timeStr.trim().replace('s', '');
    if (clean.includes(':')) {
      const parts = clean.split(':');
      if (parts.length === 2) {
        return parseFloat(parts[0]) * 60000 + parseFloat(parts[1]) * 1000;
      }
      if (parts.length === 3) {
        return (
          parseFloat(parts[0]) * 3600000 +
          parseFloat(parts[1]) * 60000 +
          parseFloat(parts[2]) * 1000
        );
      }
    }
    return parseFloat(clean) * 1000;
  },

  formatTime(millis: number): string {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((millis % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  },
};

