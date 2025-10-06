# homebridge-exivo Release Notes

This homebridge plug-in exposes Lock accessories from Dormakaba Exivo API to Homekit.
You must get your site ID and generate API keys from [Customer portal](https://auth.exivo.io/login).
Restart homebridge to reflect any additions, deletions or modifications made to your installation.

***Changes in v2.0.1***
- Add explicit compatibility with Homebridge v2 while retaining support for v1.
- Adopt the modern Homebridge API registration pattern and updated HAP references.
- Replace deprecated Node.js buffer usage and clean up accessory bookkeeping for dynamic platform events.

***Changes in v1.1.3***
- Fix README formatting.

***Changes in v1.1.2***
- Update engines versions.

***Changes in v1.1.1***
- Provide more detailed connection logs.

***Changes in v1.1.0***
- Refactor requests to use `https` instead of the deprecated `request` module.

***Changes in v1.0.1***
- Add `config.schema.json` for Homebridge UI configuration.
