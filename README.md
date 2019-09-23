# homebridge-exivo Plugin

This homebridge plug-in exposes Lock accessories from Dormakaba Exivo API to Homekit.
You must get your site ID and generate API keys from [Customer portal](https://auth.exivo.io/login).

## config.json

```json
"platforms": [
    {
        "platform": "Exivo",
        "site_id": "00000000-0000-0000-0000-000000000000",
        "api_key": "00000000-0000-0000-0000-000000000000",
        "api_secret": "00000000-0000-0000-0000-000000000000",
        "apiDelay": 3,
        "autoLock": true,
        "autoLockDelay": 6,
        "delegatedUser": "Homebridge"
    }
]
```

## Optional values

> **apiDelay** // Default: 0 sec
Delay between Homekit action and API to execute command.

> **autoLock** // Default: true

> **autoLockDelay** // Default: 10

> **delagatedUser** // Default: Homebridge
String that appears on Customer Portal log.
