# Auth.md Agent Registration Skill

Register and authenticate AI agents with datasink API endpoints.

## Overview
This skill describes how an agent requests registration, asserts identity (ID-JAG or verified email), obtains bearer credentials, and invokes protected datasink services.

## Metadata Endpoints
- `/auth.md`: Registration workflow instructions.
- `/.well-known/oauth-protected-resource`: Resource scopes and authorization server declarations.
- `/.well-known/oauth-authorization-server`: Token issuing parameters and registration endpoints.
