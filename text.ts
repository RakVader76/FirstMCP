import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';

const NOTES_URI = 'notes://main-notes.txt';
const DEFAULT_NOTES = ['Bevasarolni tejet.', 'Megszerelni a biciklit.', 'MCP szervert programozni.'].join('\n');

const thisFilePath = fileURLToPath(import.meta.url);
const thisDirPath = dirname(thisFilePath);
const notesFilePath = join(thisDirPath, 'main-notes.txt');

async function ensureNotesFile(): Promise<void> {
    await mkdir(thisDirPath, { recursive: true });
    try {
        await readFile(notesFilePath, 'utf8');
    } catch {
        await writeFile(notesFilePath, `${DEFAULT_NOTES}\n`, 'utf8');
    }
}

async function readNotes(): Promise<string> {
    await ensureNotesFile();
    return readFile(notesFilePath, 'utf8');
}

async function appendNote(text: string): Promise<void> {
    await ensureNotesFile();
    const existing = await readFile(notesFilePath, 'utf8');
    const trimmed = text.trim();
    if (!trimmed) {
        return;
    }

    const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
    await writeFile(notesFilePath, `${existing}${separator}${trimmed}\n`, 'utf8');
}

export function registerPersonalNotesFeatures(server: McpServer): void {
    server.registerResource(
        'main-notes-resource',
        NOTES_URI,
        {
            title: 'Main Notes',
            description: 'Personal notes list that the AI can read.',
            mimeType: 'text/plain'
        },
        async (): Promise<ReadResourceResult> => {
            const notes = await readNotes();
            return {
                contents: [
                    {
                        uri: NOTES_URI,
                        text: notes
                    }
                ]
            };
        }
    );

    server.registerTool(
        'add_note',
        {
            title: 'Add Note',
            description: 'Adds a new note into notes://main-notes.txt.',
            inputSchema: z.object({
                text: z.string().min(1).describe('The note text to append')
            })
        },
        async ({ text }): Promise<CallToolResult> => {
            await appendNote(text);
            return {
                content: [
                    {
                        type: 'text',
                        text: `Jegyzet hozzaadva: "${text.trim()}"`
                    }
                ]
            };
        }
    );

    server.registerPrompt(
        'summarize-my-day',
        {
            title: 'Summarize My Day',
            description: 'Loads notes and asks the AI to create a short daily summary.',
            argsSchema: z.object({})
        },
        async (): Promise<GetPromptResult> => {
            return {
                messages: [
                    {
                        role: 'user',
                        content: {
                            type: 'text',
                            text: 'Kerlek, olvasd el a notes://main-notes.txt eroforrast, nezd meg a mai feladataimat, es keszits beloluk egy rovid osszefoglalot. Ha talalsz surgos dolgot, emeld ki!'
                        }
                    }
                ]
            };
        }
    );
}
