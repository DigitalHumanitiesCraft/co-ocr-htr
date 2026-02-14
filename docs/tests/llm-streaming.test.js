/**
 * Tests for LLM streaming parsers
 *
 * Tests the streaming parse logic for:
 * - Gemini SSE (_parseGeminiSSE)
 * - Anthropic SSE (_parseAnthropicSSE)
 * - Ollama NDJSON with <think> tags (_parseOllamaStream, _processOllamaToken)
 *
 * Uses ReadableStream to simulate server-sent event responses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let llmService;

beforeEach(async () => {
    vi.resetModules();
    const { llmService: svc } = await import('../js/services/llm.js');
    llmService = svc;
});

/**
 * Helper: create a ReadableStream from an array of string chunks
 */
function createStream(chunks) {
    const encoder = new TextEncoder();
    let index = 0;
    return new ReadableStream({
        pull(controller) {
            if (index < chunks.length) {
                controller.enqueue(encoder.encode(chunks[index]));
                index++;
            } else {
                controller.close();
            }
        }
    });
}

// ============================================
// Gemini SSE Parser Tests
// ============================================

describe('Gemini SSE Parser (_parseGeminiSSE)', () => {
    it('should extract text parts and ignore thinking parts', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"Let me analyze..."}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"The text appears to be..."}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"Line 1: Hallo Welt"}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"\\nLine 2: Guten Tag"}]}}]}\n\n'
        ];

        const thinkingChunks = [];
        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, (text) => thinkingChunks.push(text));

        expect(result).toBe('Line 1: Hallo Welt\nLine 2: Guten Tag');
        expect(thinkingChunks).toEqual(['Let me analyze...', 'The text appears to be...']);
    });

    it('should handle mixed thinking and text parts in one chunk', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking"},{"text":"response"}]}}]}\n\n'
        ];

        const thinkingChunks = [];
        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, (text) => thinkingChunks.push(text));

        expect(result).toBe('response');
        expect(thinkingChunks).toEqual(['thinking']);
    });

    it('should handle [DONE] marker', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n',
            'data: [DONE]\n\n'
        ];

        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, undefined);

        expect(result).toBe('Hello');
    });

    it('should skip malformed JSON chunks', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"text":"Good"}]}}]}\n\n',
            'data: {invalid json}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":" text"}]}}]}\n\n'
        ];

        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, undefined);

        expect(result).toBe('Good text');
    });

    it('should handle empty stream', async () => {
        const stream = createStream([]);
        const result = await llmService._parseGeminiSSE(stream, undefined);

        expect(result).toBe('');
    });

    it('should work without thinking callback', async () => {
        const sseData = [
            'data: {"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking"}]}}]}\n\n',
            'data: {"candidates":[{"content":{"parts":[{"text":"response"}]}}]}\n\n'
        ];

        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, undefined);

        expect(result).toBe('response');
    });

    it('should handle partial SSE lines split across chunks', async () => {
        // The SSE data line is split across two chunks
        const sseData = [
            'data: {"candidates":[{"content":{"parts"',
            ':[{"text":"Hello World"}]}}]}\n\n'
        ];

        const stream = createStream(sseData);
        const result = await llmService._parseGeminiSSE(stream, undefined);

        expect(result).toBe('Hello World');
    });
});

// ============================================
// Anthropic SSE Parser Tests
// ============================================

describe('Anthropic SSE Parser (_parseAnthropicSSE)', () => {
    it('should extract thinking_delta and text_delta', async () => {
        const sseData = [
            'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Analyzing the text..."}}\n\n',
            'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"I see several patterns..."}}\n\n',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"The transcription looks"}}\n\n',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" correct."}}\n\n'
        ];

        const thinkingChunks = [];
        const stream = createStream(sseData);
        const result = await llmService._parseAnthropicSSE(stream, (text) => thinkingChunks.push(text));

        expect(result).toBe('The transcription looks correct.');
        expect(thinkingChunks).toEqual(['Analyzing the text...', 'I see several patterns...']);
    });

    it('should ignore non-content_block_delta events', async () => {
        const sseData = [
            'data: {"type":"message_start","message":{"id":"msg_123"}}\n\n',
            'data: {"type":"content_block_start","content_block":{"type":"thinking"}}\n\n',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Result"}}\n\n',
            'data: {"type":"message_stop"}\n\n'
        ];

        const thinkingChunks = [];
        const stream = createStream(sseData);
        const result = await llmService._parseAnthropicSSE(stream, (text) => thinkingChunks.push(text));

        expect(result).toBe('Result');
        expect(thinkingChunks).toEqual([]);
    });

    it('should handle empty stream', async () => {
        const stream = createStream([]);
        const result = await llmService._parseAnthropicSSE(stream, undefined);

        expect(result).toBe('');
    });

    it('should skip malformed JSON', async () => {
        const sseData = [
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Good"}}\n\n',
            'data: broken\n\n',
            'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" result"}}\n\n'
        ];

        const stream = createStream(sseData);
        const result = await llmService._parseAnthropicSSE(stream, undefined);

        expect(result).toBe('Good result');
    });
});

// ============================================
// Ollama Token Processor Tests (_processOllamaToken)
// ============================================

describe('Ollama Think Tag Processor (_processOllamaToken)', () => {
    it('should extract text inside <think> tags as thinking', () => {
        const thinkingChunks = [];
        const callback = (text) => thinkingChunks.push(text);

        const state = { insideThink: false, tagBuffer: '' };

        // Token containing full think block
        const result = llmService._processOllamaToken(
            '<think>reasoning here</think>actual response',
            state.insideThink, state.tagBuffer, callback
        );

        expect(result.text).toBe('actual response');
        expect(result.insideThink).toBe(false);
        expect(thinkingChunks).toEqual(['reasoning here']);
    });

    it('should handle think tags split across tokens', () => {
        const thinkingChunks = [];
        const callback = (text) => thinkingChunks.push(text);

        // Token 1: opening tag
        let result = llmService._processOllamaToken(
            '<think>first part',
            false, '', callback
        );
        expect(result.insideThink).toBe(true);
        expect(result.text).toBe('');

        // Token 2: more thinking
        result = llmService._processOllamaToken(
            ' more thinking',
            result.insideThink, result.tagBuffer, callback
        );
        expect(result.insideThink).toBe(true);

        // Token 3: close tag + response
        result = llmService._processOllamaToken(
            '</think>response text',
            result.insideThink, result.tagBuffer, callback
        );
        expect(result.insideThink).toBe(false);
        expect(result.text).toBe('response text');
        expect(thinkingChunks.join('')).toContain('first part');
        expect(thinkingChunks.join('')).toContain('more thinking');
    });

    it('should handle multiple think blocks', () => {
        const thinkingChunks = [];
        const callback = (text) => thinkingChunks.push(text);

        const result = llmService._processOllamaToken(
            '<think>first</think>text1<think>second</think>text2',
            false, '', callback
        );

        expect(result.text).toBe('text1text2');
        expect(result.insideThink).toBe(false);
        expect(thinkingChunks).toContain('first');
        expect(thinkingChunks).toContain('second');
    });

    it('should handle token with no think tags', () => {
        const thinkingChunks = [];
        const callback = (text) => thinkingChunks.push(text);

        const result = llmService._processOllamaToken(
            'regular text without thinking',
            false, '', callback
        );

        expect(result.text).toBe('regular text without thinking');
        expect(result.insideThink).toBe(false);
        expect(thinkingChunks).toEqual([]);
    });

    it('should handle empty token', () => {
        const result = llmService._processOllamaToken(
            '', false, '', undefined
        );

        expect(result.text).toBe('');
        expect(result.insideThink).toBe(false);
    });

    it('should handle thinking without callback', () => {
        const result = llmService._processOllamaToken(
            '<think>ignored</think>response',
            false, '', undefined
        );

        expect(result.text).toBe('response');
        expect(result.insideThink).toBe(false);
    });
});

// ============================================
// Ollama Partial Tag Match Tests
// ============================================

describe('Ollama Partial Tag Match (_partialTagMatch)', () => {
    it('should detect partial <think> at end of text', () => {
        expect(llmService._partialTagMatch('some text<thi', '<think>')).toBe(4); // '<thi'
        expect(llmService._partialTagMatch('text<', '<think>')).toBe(1); // '<'
        expect(llmService._partialTagMatch('text<think', '<think>')).toBe(6); // '<think'
    });

    it('should detect partial </think> at end of text', () => {
        expect(llmService._partialTagMatch('content</thi', '</think>')).toBe(5); // '</thi'
        expect(llmService._partialTagMatch('content</', '</think>')).toBe(2); // '</'
    });

    it('should return 0 for no partial match', () => {
        expect(llmService._partialTagMatch('no match here', '<think>')).toBe(0);
        expect(llmService._partialTagMatch('abc', '</think>')).toBe(0);
    });

    it('should return 0 for empty text', () => {
        expect(llmService._partialTagMatch('', '<think>')).toBe(0);
    });
});

// ============================================
// Ollama Full Stream Parser Tests
// ============================================

describe('Ollama Stream Parser (_parseOllamaStream)', () => {
    it('should parse NDJSON generate endpoint with think tags', async () => {
        const ndjson = [
            '{"response":"<think>"}\n',
            '{"response":"analyzing"}\n',
            '{"response":"</think>"}\n',
            '{"response":"The answer"}\n',
            '{"response":" is here"}\n',
            '{"done":true}\n'
        ];

        const thinkingChunks = [];
        const stream = createStream(ndjson);
        const result = await llmService._parseOllamaStream(stream, false, (text) => thinkingChunks.push(text));

        expect(result).toBe('The answer is here');
        expect(thinkingChunks.join('')).toContain('analyzing');
    });

    it('should parse NDJSON chat endpoint', async () => {
        const ndjson = [
            '{"message":{"content":"Hello"}}\n',
            '{"message":{"content":" World"}}\n',
            '{"done":true}\n'
        ];

        const stream = createStream(ndjson);
        const result = await llmService._parseOllamaStream(stream, true, undefined);

        expect(result).toBe('Hello World');
    });

    it('should handle stream without think tags', async () => {
        const ndjson = [
            '{"response":"Just"}\n',
            '{"response":" regular"}\n',
            '{"response":" text"}\n'
        ];

        const stream = createStream(ndjson);
        const result = await llmService._parseOllamaStream(stream, false, undefined);

        expect(result).toBe('Just regular text');
    });

    it('should handle empty stream', async () => {
        const stream = createStream([]);
        const result = await llmService._parseOllamaStream(stream, false, undefined);

        expect(result).toBe('');
    });

    it('should skip malformed JSON lines', async () => {
        const ndjson = [
            '{"response":"good"}\n',
            'not json\n',
            '{"response":" text"}\n'
        ];

        const stream = createStream(ndjson);
        const result = await llmService._parseOllamaStream(stream, false, undefined);

        expect(result).toBe('good text');
    });
});

// ============================================
// _supportsThinking Tests
// ============================================

describe('_supportsThinking', () => {
    it('should return true for gemini', () => {
        expect(llmService._supportsThinking('gemini')).toBe(true);
    });

    it('should return true for anthropic', () => {
        expect(llmService._supportsThinking('anthropic')).toBe(true);
    });

    it('should return true for ollama', () => {
        expect(llmService._supportsThinking('ollama')).toBe(true);
    });

    it('should return false for openai', () => {
        expect(llmService._supportsThinking('openai')).toBe(false);
    });

    it('should return false for mistral', () => {
        expect(llmService._supportsThinking('mistral')).toBe(false);
    });

    it('should return false for unknown provider', () => {
        expect(llmService._supportsThinking('unknown')).toBe(false);
    });
});
