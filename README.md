# Global Prompt Injector

A SillyTavern extension that lets you define custom prompts that are injected into **every** Chat Completion generation — globally, regardless of which preset or character is active.

## Features

- Add any number of global prompts with a name, text, role, and position
- **Insert at position** — choose the exact 0-based index in the assembled message list where the prompt is spliced in
- Toggle individual prompts on/off without deleting them
- Prompts carry across all Chat Completion presets and all characters automatically
- Settings persist in SillyTavern's extension settings (saved with your profile)

## Installation

### Via SillyTavern's built-in installer (recommended)

1. Open SillyTavern → **Extensions** panel → **Install extension**
2. Paste `https://github.com/Ayletheris/promptinjector` and click Install

### Manual

1. Clone or download this repo
2. Copy the folder into `SillyTavern/public/scripts/extensions/global-prompt-injector/`
3. Reload SillyTavern

## Usage

1. Open the **Extensions** panel in SillyTavern
2. Find **Global Prompt Injector** and click **Manage Global Prompts**
3. Click **+ Add Prompt**
4. Fill in:
   - **Name** — a label for your own reference
   - **Prompt Text** — the content to inject
   - **Insert at position** — `0` = very top of the message list, `1` = after the first message, etc.
   - **Role** — `system`, `user`, or `assistant`
5. Click **Save**

The prompt will now be included in every Chat Completion request at the specified position.

## How "position" works

SillyTavern assembles the final messages array from your CC preset's ordered prompt list (system card, custom prompts, chat history, etc.). **Position** is the 0-based index into that assembled array where your prompt is inserted.

- `0` → injected before everything else
- `1` → after the first message (usually the character system prompt)
- A large number (e.g. `999`) → safely clamped to the end of the list

If you have multiple global prompts, each position is relative to the **original** assembled list — they don't shift each other's positions.

## Compatibility

- **API:** Chat Completion only (OpenAI, Claude, Mistral, etc.)
- Does **not** affect Text Completion (koboldcpp, llama.cpp in TC mode, etc.)
- Works with SillyTavern `staging` branch (1.12+)

## License

MIT
