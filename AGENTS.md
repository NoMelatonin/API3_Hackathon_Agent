# Project instructions

Give very short, precise and concise answers unless asked otherwise.

## Maintain the V3 functionality map

- Read `docs/v3/LANDKARTE.md` before changing V3 functionality, interfaces, roles, infrastructure or data flows.
- Update affected map entries in the same change as the implementation. Keep README links, `docs/v3/UI.md`, operating instructions and implementation documentation consistent.
- Explain in plain German who can do what, what approval is required, important limits and the next step. Include the rough implementation and links to responsible source files.
- Distinguish implemented local behavior, simulated identities/data, optional integrations, previously verified behavior and planned or missing functionality. Document upload, signature import, mined transaction and confirmed decision are distinct states.
- Keep the interface/role table, workflow, feature inventory, financial rules, architecture and known gaps synchronized with the code. In particular, do not reintroduce the obsolete reviewer-browser workflow in current instructions.
- Update the review date and basis of review after substantive map changes. Never imply fresh runtime testing unless it was performed.
- Reviewing affected map entries is part of completing V3 work. If no update is needed, state in the work report that the map was reviewed and why it remains accurate.
