# AI Prompt Implementation Plan

## Summary
This is a complex implementation that requires:
1. Replacing the executeAIPrompt function (~400+ lines of code)
2. Adding helper structures and functions for AI response processing
3. The Edit tool has limitations - may need to use Write + manual integration

## Key Requirements from User:
1. Get promptData from node config (text field)
2. Get apiKey and model from device settings (api_key and api_key_option)
3. If any of these 3 is null, terminate
4. Get conv_last as lasttext (whole conversation history)
5. Get userMessage as currenttext
6. Build exact content string with all instructions
7. Call OpenRouter API with exact payload structure
8. Parse response following exact sanitization rules
9. Update stage if present in response
10. Process response parts (text/image) with onemessage handling
11. Send messages via WhatsApp
12. Update conv_last for each message sent

## Implementation Strategy:
Due to length, I'll provide the complete implementation code that the user can review.
The function is too large for Edit tool, so I'll write it to a separate file first.
