# DNS for AI Discovery (DNS-AID) Setup

This document describes the DNS-AID (DNS for AI Discovery) configuration for `datasink.dev` per [draft-mozleywilliams-dnsop-dnsaid](https://datatracker.ietf.org/doc/draft-mozleywilliams-dnsop-dnsaid/) and RFC 9460.

## Record Definitions

Add the following SVCB records to your DNS provider (e.g., Cloudflare DNS / Vercel DNS):

```dns
_a2a._agents.datasink.dev. 3600 IN SVCB 1 datasink.dev. alpn="a2a" port=443 mandatory=alpn,port
_index._agents.datasink.dev. 3600 IN SVCB 1 datasink.dev. alpn="a2a" port=443 mandatory=alpn,port
```

## DNSSEC Requirements
Ensure DNSSEC is enabled for `datasink.dev` so validating resolvers (such as Cloudflare `1.1.1.1` and Google `8.8.8.8` DNS-over-HTTPS resolvers) return authenticated AD (Authentic Data) responses.
