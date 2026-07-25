# datasink.dev auth.md

Agent registration and authentication specifications for the datasink platform.

## Agent Audience
This service accepts registration requests from automated AI agents, browser extensions, and programmatic integrations seeking to execute contact hygiene operations (scrub, rinse, soak, steep).

## Registration & Provisioning
Agents register dynamically by issuing a request to the registration endpoint:
- **Registration URI**: `https://datasink.dev/agent/auth`
- **Claim URI**: `https://datasink.dev/agent/claim`
- **Revocation URI**: `https://datasink.dev/agent/revoke`

## Supported Identity Types & Flows

### 1. Anonymous Access
- **Supported Identity**: `anonymous`
- **Credential Type**: `bearer`
- Allows restricted rate-limited access for basic scrubbing and catalog discovery.

### 2. Identity Assertion
- **Supported Identity**: `identity_assertion`
- **Assertion Types**:
  - `urn:ietf:params:oauth:token-type:id-jag` (Identity-JWT Assertion Grant)
  - `verified_email`
- **Credential Type**: `bearer`

## Authentication & Authorization Metadata
- **Protected Resource Metadata (PRM)**: [/.well-known/oauth-protected-resource](https://datasink.dev/.well-known/oauth-protected-resource)
- **OAuth Authorization Server**: [/.well-known/oauth-authorization-server](https://datasink.dev/.well-known/oauth-authorization-server)
- **Bearer Token Transmission**: Pass credentials in the standard HTTP Header:
  `Authorization: Bearer <access_token>`

## Scopes Supported
- `read`: Query public API catalogs and documentation.
- `scrub`: Perform email syntax, typo mapping, and format validation.
- `enrich`: Perform contact enrichment and web metadata queries.
- `write`: Modify and save processed contact datasets.
