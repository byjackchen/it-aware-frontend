# Agent Guidance

Guidance for AI agents working on the IT Aware frontend.

## Environment

- **Development**: Always use `IT_AWARE_ENV=local`
- **Non-local environments**: Ask user to manually execute or verify

## Specs

- Backend API specs: `specs/backend/`

## Troubleshooting

When debugging issues that may involve the backend API:

1. **Write test script**: Create a Node.js script in `tests/temp/` with `IT_AWARE_ENV=local`. Include auth token retrieval (see `specs/backend/api_specs_auth.md`)
2. **Ask user to run**: Request user to execute the script and provide output
3. **Backend issue**: If API fails, provide a context-independent description for user to fix in backend repo
4. **Frontend issue**: If API works, debug and fix the frontend logic