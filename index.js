let Accessory, Service, Characteristic, UUIDGen

const https = require('https')

module.exports = function(homebridge) {
    console.log("homebridge API version: " + homebridge.version)

  // Accessory must be created from PlatformAccessory Constructor
  Accessory = homebridge.platformAccessory

  // Service and Characteristic are from hap-nodejs
  Service = homebridge.hap.Service
  Characteristic = homebridge.hap.Characteristic
  UUIDGen = homebridge.hap.uuid

  // For platform plugin to be considered as dynamic platform plugin,
  // registerPlatform(pluginName, platformName, constructor, dynamic), dynamic must be true
  homebridge.registerPlatform("homebridge-exivo", "Exivo", Exivo, true)

}

// Platform constructor
function Exivo(log, config, api) {

  // Don't load the plugin if these aren't accessible for any reason
  if (!log || !api) {
    return
  }

  this.log = log
  if (!config || (!config['site_id'] && (!config['api_key'] && !config['api_secret']))) {
    log("Initialization skipped. Missing configuration data.")
    return
  }

  log("Initialising Exivo")

  let platform = this
  this.accessories = new Map()
  this.devicesFromApi = new Map()

  this.site_id = config.site_id || null
  this.api_key = config.api_key || null
  this.api_secret = config.api_secret || null
  this.apiDelay = config.apiDelay || 3
  this.autoLock = config.autoLock || true
  this.autoLockDelay = config.autoLockDelay || 6
  this.manufacturer = "Dormakaba"
  this.delegatedUser = config.delegatedUser || "Homebridge"

  this.url = "https://api.exivo.io/v1/" + this.site_id + "/component"
  this.hostname = "api.exivo.io"
  this.path = "/v1/" + this.site_id + "/component"

  this.auth = "Basic " + new Buffer(this.api_key + ":" + this.api_secret).toString("base64")

  // Get a list of all devices from the API
  if (api) {
    this.api = api
    this.api.on('didFinishLaunching', function () {

      var headers = {
        'accept': "application/json",
        'authorization': this.auth
      }

      const options = {
        hostname: this.hostname,
        port: 443,
        path: this.path,
        method: 'GET',
        headers: headers
      }

      platform.log.debug("Begin GET request")

      var req = https.request(options, (resp) => {

        platform.log.debug("GET response received (%s)", resp.statusCode)

        if (resp.statusCode === '401') {
          platform.log("Verify that you have the correct authenticationToken specified in your configuration.")
          return
        }

        let data = ''
        // A chunk of data has been received.
        resp.on('data', (chunk) => {
          data += chunk
        })

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
          // console.log(JSON.parse(data).explanation)
          if (resp.statusCode === 200) {
            // we succeeded
            var json = JSON.parse(data)
            let size = Object.keys(json).length
            platform.log("Exivo HTTPS API reports that there are a total of [%s] devices registered", size)

            if (size === 0) {
              platform.log("As there were no devices were found, all devices have been removed from the platorm's cache. Please register your devices and restart HomeBridge")
              platform.accessories.clear()
              platform.api.unregisterPlatformAccessories("homebridge-exivo", "Exivo", platform.accessories)
              return
            }

            json.forEach((device) => {
              if (device.templateIdentifier.indexOf("gateway") > -1) {
                platform.log('Skipping Gateway: [%s %s], ID : [%s]', device.identifier, device.labelling, device.id)
              } else {
                platform.log('Device [%s %s], ID : [%s] discovered. Ready: %s', device.identifier, device.labelling, device.id, device.ready)
                platform.devicesFromApi.set(device.id, device)
              }
            })

            // Now we compare the cached devices against the web list
            platform.log("Evaluating if devices need to be removed...")

            function checkIfDeviceIsStillRegistered(value, deviceId, map) {
              let accessory = platform.accessories.get(deviceId)
              if (platform.devicesFromApi.has(deviceId)) {
                platform.log('Device [%s] is registered with API. Nothing to do.', accessory.displayName)
              } else {
                platform.log('Device [%s], ID : [%s] was not present in the response from the API. It will be removed.', accessory.displayName, accessory.UUID)
                platform.removeAccessory(accessory)
              }
            }

            // If we have devices in our cache, check that they exist in the web response
            if (platform.accessories.size > 0) {
              platform.log("Verifying that all cached devices are still registered with the API. Devices that are no longer registered with the API will be removed.")
              platform.accessories.forEach(checkIfDeviceIsStillRegistered)
            }

            platform.log("Evaluating if new devices need to be added...")

            // Now we compare the cached devices against the web list
            function checkIfDeviceIsAlreadyConfigured(value, deviceId, map) {
              if (platform.accessories.has(deviceId)) {
                platform.log('Device with ID [%s] is already configured. Ensuring that the configuration is current.', deviceId)
                let accessory = platform.accessories.get(deviceId)
                let deviceInformationFromWebApi = platform.devicesFromApi.get(deviceId)
                let name = deviceInformationFromWebApi.identifier + " " + deviceInformationFromWebApi.labelling
                let serial = deviceInformationFromWebApi.id.split("-").pop()
                platform.log("Device with ID [%s] has been set: %s", deviceId, name)
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Name, name)
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, serial)
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, platform.manufacturer)
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, deviceInformationFromWebApi.templateIdentifier)
                accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Identify, false)
              } else {
                let deviceToAdd = platform.devicesFromApi.get(deviceId)
                let name = deviceToAdd.identifier + " " + deviceToAdd.labelling
                platform.log('Device [%s], ID : [%s] will be added', name, deviceToAdd.id)
                platform.addAccessory(deviceToAdd, null)
              }
            }

            // Go through the web response to make sure that all the devices that are in the response do exist in the accessories map
            if (platform.devicesFromApi.size > 0) {
              platform.devicesFromApi.forEach(checkIfDeviceIsAlreadyConfigured)
            }

          }
        })

      })

      req.on("error", (err) => {
        platform.log("An error was encountered while requesting a list of devices. Satus: %s - Error was [%s]", resp.statusCode, err.message)
      })

      req.on('timeout', function () {
        // Timeout happend. Server received request, but not handled it
        // (i.e. doesn't send any response or it took to long).
        // You don't know what happend.
        // It will emit 'error' message as well (with ECONNRESET code).

        platform.log('timeout')
        req.destroy
      })

      req.setTimeout(5000)
      req.end()

    }.bind(this))
  }
}

Exivo.prototype.configureAccessory = function (accessory) {

  this.log("[%s] : Configure Accessory", accessory.displayName)

  let platform = this

  // Configure service
  var service = accessory.getService(Service.LockMechanism)

  service.getCharacteristic(Characteristic.LockTargetState)
    .on('get', function (callback) {
      platform.getLockCurrentState(accessory, callback)
    })
    .on('set', function (value, callback) {
      platform.setLockTargetState(accessory, value, callback)
    })
  service.getCharacteristic(Characteristic.LockCurrentState)
    .on('get', function (callback) {
      platform.getLockCurrentState(accessory, callback)
    })

  this.accessories.set(accessory.context.deviceId, accessory)
}

Exivo.prototype.updateName = function (device) {
  let accessory = this.accessories.get(device.id)
  let name = device.identifier + " " + device.labelling
  let serial = device.id.split("-").pop()

  platform.log("Device with ID [%s] has been set: %s", deviceId, name)

  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Name, name)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, serial)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, this.templateIdentifier)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Identify, false)
}

Exivo.prototype.addAccessory = function (device, deviceId = null) {

  let uuid = UUIDGen.generate((deviceId ? deviceId : device.id).toString())

  // Here we need to check if it is currently there

  if (this.accessories.get(deviceId ? deviceId : device.id)) {
    this.log("Not adding [%s] as it already exists in the cache", deviceId ? deviceId : device.id)
    this.updateName(device)
    return
  }

  let platform = this

  var name = device.identifier + " " + device.labelling
  const accessory = new Accessory(name, uuid)

  accessory.context.deviceId = deviceId ? deviceId : device.id
  accessory.reachable = device.ready === 'true'

  // Register service
  var service = accessory.addService(Service.LockMechanism, name)

  service.getCharacteristic(Characteristic.LockTargetState)
    .on('get', function (callback) {
      platform.getLockCurrentState(accessory, callback)
    })
    .on('set', function (value, callback) {
      platform.setLockTargetState(accessory, value, callback)
    })
  service.getCharacteristic(Characteristic.LockCurrentState)
    .on('get', function (callback) {
      platform.getLockCurrentState(accessory, callback)
    })

  accessory.on('identify', function (paired, callback) {
    platform.log(accessory.displayName, "Identify not supported")
    callback()
  })

  let serial = device.id.split("-").pop()
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.SerialNumber, serial)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Model, device.templateIdentifier)
  accessory.getService(Service.AccessoryInformation).setCharacteristic(Characteristic.Identify, false)

  this.accessories.set(device.id, accessory)
  this.api.registerPlatformAccessories("homebridge-exivo", "Exivo", [accessory])

  // Set initial state
  accessory.getService(Service.LockMechanism).setCharacteristic(Characteristic.LockCurrentState, 1)

}

Exivo.prototype.getLockCurrentState = function (accessory, callback) {
  // Exivo API doesn't return state of component, so locked by default
  callback(null, 1)
}

Exivo.prototype.setLockTargetState = function (accessory, value, callback) {

  let platform = this
  this.log.debug('[%s] Setting LockTargetState to %s', accessory.displayName, value)
  if (value === 1) {
    this.log('[%s] Closed the lock', accessory.displayName)
    accessory.getService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState).updateValue(1)
    callback()
  } else {

    // A request to unlock the door will be sent. This is only a request so there is no guarantee the door will be unlocked.

    var body = JSON.stringify({ delegatedUser: this.delegatedUser })
    var headers = {
      'accept': "application/json",
      'authorization': this.auth,
      'Content-Type': "application/json",
      'Content-Length': Buffer.byteLength(body)
    }

    const options = {
      hostname: this.hostname,
      port: 443,
      path: this.path + "/" + accessory.context.deviceId + "/unlock",
      method: 'POST',
      headers: headers
    }

    platform.log.debug("Begin POST request")
    platform.log.debug("Headers: %s", headers)
    platform.log.debug("Option: %s", options)

    var req = https.request(options, (resp) => {

      platform.log.debug("POST response received (%s)", resp.statusCode)

      let data = ''
      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk
      })

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        // response will be 204
        if (resp.statusCode == 204) {
          // we succeeded, so update the "current" state as well
          platform.log('[%s] Opened the lock', accessory.displayName)
          setTimeout(() => {
            accessory.getService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState).updateValue(0)
            if (this.autoLock) {
              this.autoLockFunction(accessory)
            }
            platform.log("[%s] State change complete.", accessory.displayName)
            callback() // success
          }, this.apiDelay * 1000)
        }
      })
    })

    req.on("error", (err) => {
      platform.log("[%s] Error '%s' setting lock state. Error: %s", accessory.displayName, resp.statusCode, err.message)
    })

    req.on('timeout', function () {
      // Timeout happend. Server received request, but not handled it
      // (i.e. doesn't send any response or it took to long).
      // You don't know what happend.
      // It will emit 'error' message as well (with ECONNRESET code).

      platform.log('timeout')
      req.destroy
    })

    req.setTimeout(5000)
    req.end(body)
  }
}

Exivo.prototype.autoLockFunction = function (accessory) {
  let platform = this
  platform.log('[%s] Waiting %s seconds for autolock', accessory.displayName, this.autoLockDelay)
  setTimeout(() => {
    accessory.getService(Service.LockMechanism).setCharacteristic(Characteristic.LockTargetState, 1)
  }, this.autoLockDelay * 1000)
}

Exivo.prototype.removeAccessory = function (accessory) {
  let platform = this
  platform.log('Removing accessory [%s]', accessory.displayName)
    accessories.delete(accessory.context.deviceId)

  this.api.unregisterPlatformAccessories('homebridge-exivo',
    'Exivo', [accessory])
}
