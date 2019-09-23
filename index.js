let Accessory, Service, Characteristic, UUIDGen

const request = require('request')

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

    this.log = log
    if(!config || (!config['site_id'] && (!config['api_key'] && !config['api_secret']))) {
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
    this.apiDelay = config.apiDelay || 0
    this.autoLock = config.autoLock || true
    this.autoLockDelay = config.autoLockDelay || 10
    this.manufacturer = "Dormakaba"
    this.delegatedUser = config.delegatedUser || "Homebridge"

    this.url = "https://api.exivo.io/v1/" + this.site_id + "/component"
    this.auth = "Basic " + new Buffer(this.api_key + ":" + this.api_secret).toString("base64")
    this.headers_get = {
      'accept': "application/json",
      'authorization' : this.auth }
    this.headers_post = {
      'accept': "application/json",
      'authorization' : this.auth,
      'Content-Type': "application/json" }
    this.body = JSON.stringify({ delegatedUser: this.delegatedUser })

    // Get a list of all devices from the API
    if (api) {
      this.api = api
      this.api.on('didFinishLaunching', function() {
        request.get({
          url: this.url,
          headers : this.headers_get
        }, function(err, response, body) {
          // response will be 204
          if (!err && response.statusCode == 200) {
            // we succeeded
            var json = JSON.parse(body);
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
                platform.log('Device [%s], ID : [%s] will be added', name, deviceToAdd.id);
                platform.addAccessory(deviceToAdd, null)
              }
            }

            // Go through the web response to make sure that all the devices that are in the response do exist in the accessories map
            if (platform.devicesFromApi.size > 0) {
              platform.devicesFromApi.forEach(checkIfDeviceIsAlreadyConfigured);
            }

          } else
          {
            if (err){
                platform.log("An error was encountered while requesting a list of devices. Error was [%s]", err)
                return
            } else if (!body || body.hasOwnProperty('error')) {
                let response = JSON.stringify(body)
                platform.log("An error was encountered while requesting a list of devices. Response was [%s]", response)
                if (body && body.error === '401') {
                    platform.log("Verify that you have the correct authenticationToken specified in your configuration.")
                }
                return
            }
          }
        }.bind(this))
      }.bind(this))
    }
}

Exivo.prototype.configureAccessory = function(accessory) {

  this.log("[%s] : Configure Accessory", accessory.displayName)

  let platform = this

  // Configure service
  var service = accessory.getService(Service.LockMechanism)

  service.getCharacteristic(Characteristic.LockTargetState)
    .on('get', function(callback) {
        platform.getLockCurrentState(accessory, callback)
    })
    .on('set', function(value, callback) {
        platform.setLockTargetState(accessory, value, callback)
    })
  service.getCharacteristic(Characteristic.LockCurrentState)
    .on('get', function(callback) {
        platform.getLockCurrentState(accessory, callback)
    })

  this.accessories.set(accessory.context.deviceId, accessory)
}

Exivo.prototype.updateName = function(device) {
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

Exivo.prototype.addAccessory = function(device, deviceId = null) {

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
      .on('get', function(callback) {
          platform.getLockCurrentState(accessory, callback)
      })
      .on('set', function(value, callback) {
          platform.setLockTargetState(accessory, value, callback)
      })
    service.getCharacteristic(Characteristic.LockCurrentState)
      .on('get', function(callback) {
          platform.getLockCurrentState(accessory, callback)
      })

    accessory.on('identify', function(paired, callback) {
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
  this.log.debug('[%s] Setting LockTargetState to %s',accessory.displayName, value)
  if (value === 1) {
      this.log('[%s] Closed the lock', accessory.displayName)
      accessory.getService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState).updateValue(1)
      callback()
  } else {
      /*
      this.log('Opened the lock')
      setTimeout(() => {
        this.service.getCharacteristic(Characteristic.LockCurrentState).updateValue(0)
        if (this.autoLock) {
          this.autoLockFunction()
        }
      }, this.apiDelay * 1000)
      */

    // A request to unlock the door will be sent. This is only a request so there is no guarantee the door will be unlocked.
    request.post({
      url: this.url + "/" + accessory.context.deviceId + "/unlock",
      headers : this.headers_post,
      body: this.body
    }, function(err, response, body) {
      // response will be 204
      if (!err && response.statusCode == 204) {
        // we succeeded, so update the "current" state as well
        this.log('[%s] Opened the lock', accessory.displayName)
        setTimeout(() => {
          accessory.getService(Service.LockMechanism).getCharacteristic(Characteristic.LockCurrentState).updateValue(0)
          if (this.autoLock) {
            this.autoLockFunction(accessory)
          }
          this.log("[%s] State change complete.", accessory.displayName)
          callback() // success
        }, this.apiDelay * 1000)
      }
      else {
        this.log("[%s] Error '%s' setting lock state. Response: %s", accessory.displayName, err, body)
        callback(err || new Error("Error setting lock state."))
      }
    }.bind(this))  // end for comment
  }
}

Exivo.prototype.autoLockFunction = function (accessory) {
  this.log('[%s] Waiting %s seconds for autolock', accessory.displayName, this.autoLockDelay)
  setTimeout(() => {
    accessory.getService(Service.LockMechanism).setCharacteristic(Characteristic.LockTargetState, 1)
  }, this.autoLockDelay * 1000)
}

Exivo.prototype.removeAccessory = function(accessory) {

    this.log('Removing accessory [%s]', accessory.displayName)

    this.accessories.delete(accessory.context.deviceId)

    this.api.unregisterPlatformAccessories('homebridge-exivo',
        'Exivo', [accessory])
}
