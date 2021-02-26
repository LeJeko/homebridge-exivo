<p align="center">
  <a href="https://github.com/homebridge/homebridge"><img src="https://raw.githubusercontent.com/homebridge/branding/master/logos/homebridge-color-round-stylized.png" height="140"></a>
</p>

<span align="center">

# homebridge-exivo

[![npm](https://img.shields.io/npm/v/homebridge-exivo.svg)](https://www.npmjs.com/package/homebridge-exivo) [![npm](https://img.shields.io/npm/dt/homebridge-exivo.svg)](https://www.npmjs.com/package/homebridge-exivo) [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins) [![Donate](https://img.shields.io/badge/donate-PayPal-blue.svg)](https://www.paypal.com/donate?hosted_button_id=LU7BSTQF3DEZQ)

</span>

## Description
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

<table>
<thead>
<th>Entry</th>
<th>Type</th>
<th>Default</th>
<th>Explanation</th>
</thead>
<tr>
<td><code>apiDelay</code></td>
<td align="center"><code>integer</code></td>
<td align="center"><code>3</code></td>
<td>Delay between the Homekit action and the lock response time to execute the command.</td>
</tr>
<tr>
<td><code>autoLock</code></td>
<td align="center"><code>bool</code></td>
<td align="center"><code>true</code></td>
<td>Simulate autolock behavior</td>
</tr>
<tr>
<td><code>autoLockDelay</code></td>
<td align="center"><code>integer</code></td>
<td align="center"><code>6</code></td>
<td>Time in seconds after the lock is self-locked</td>
</tr>
<tr>
<td><code>delagatedUser</code></td>
<td align="center"><code>bool</code></td>
<td align="center"><code>false</code></td>
<td>String that appears on Customer Portal log.</td>
</tr>
</table>