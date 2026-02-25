# The Registry

The Dance of Tal Registry is a centrally hosted Cloudflare KV datastore that manages versioned AI assets.

## Architecture
The registry exposes REST endpoints to retrieve and index context blocks.
* `GET /packages` - Lists recently published assets.
* `GET /packages/:category/:username/:name` - Retrieves the exact JSON metadata block for installation.

## Publishing Constraints
1. **GitHub Auth**: You must be authenticated. The registry maps your asset strictly to your GitHub username namespace. This entirely prevents malicious spoofing of foundational system prompts.
2. **Schema Verification**: Published JSON must strictly adhere to the V2 `BaseAsset` type signature defining what is a Tal, Dance, and Act.

## Tags and Searching
Assets can be tagged via the CLI `--tags` flag at publish time. The official frontend (`http://localhost:3000`) relies on these queryable tags to categorize and filter search requests.
