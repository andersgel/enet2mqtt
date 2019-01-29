#!/usr/bin/env node

const log = require('yalm');
const oe = require('obj-ease');
const Mqtt = require('mqtt');
//const Hue = require('node-hue-api');
const eNet = require('node-enet-api');
//const pjson = require('persist-json')('hue2mqtt');
const config = require('./config.js');
const pkg = require('./package.json');

let mqtt;
let mqttConnected = false;
let enetConnected = false;
let enetAddress;
var gw;



log.setLevel(config.verbosity);
log.info(pkg.name + ' ' + pkg.version + ' starting');

//Find gateway
var discover = new eNet.discover();

discover.on('discover', function(gws) {
    log.info('New gateway: ' + JSON.stringify(gws));
    gw = eNet.gateway(gws);
});
   
//on discovery call discovered function
discover.discover(function(err, gws) {
    if (err) console.log('Error: ' + err);
    else console.log('All discovered gateways: ' + JSON.stringify(gws));
    discovered();
});

//function to call when gateway has been found
function discovered()
{
    //connect to the discovered gateway
    enetAddress = gw.host;
    log.info (enetAddress);
    gw.idleTimeout = 600000;
    gw.connect();
    
    //get gateway version
    log.info("Requesting gateway version.");
    gw.getVersion(function(err, res) {
        if (err) log.error("error: " + err);
        else log.debug("command succeeded: \n" + JSON.stringify(res));
        enetConnected = true;
    });
    
    //get channel info
    log.info("Requesting Channel Info");
    gw.getChannelInfo(function(err, res) {
        if (err) log.error("error: " + err);
        else log.debug("command succeeded: \n" + JSON.stringify(res));
    });
    
    //get project listStyleType
    log.info("Requesting Project List"); 
    gw.getProjectList(function(err, res) {
        if (err) log.error("error: " + err);
        else log.debug("command succeeded: \n" + JSON.stringify(res));
    });
    
    //trying to get all data from signed in channels
    gw.client.on('data', function(data) {
        this.data += data;
        var arr = this.data.split("\r\n\r\n");
    
        this.data = arr[arr.length-1];
    
        for (var i = 0; i < arr.length-1; ++i) {
            try{
                var json=JSON.parse(arr[i]);
                //publish dimmer and switch states on mqtt
                if (!(json.VALUES === undefined)){
                    log.info("Gateway:" + JSON.stringify(json));
                    for (var i = 0; i < json.VALUES.length; i++){
                        mqttPublish('enet/get/dimmmer/'+json.VALUES[i].NUMBER  , json.VALUES[i].VALUE, {retain: config.mqttRetain});
                        mqttPublish('enet/get/switch/'+json.VALUES[i].NUMBER  , json.VALUES[i].VALUE, {retain: config.mqttRetain});
                    }
                }
            }
            catch(e){
                log.error(e);
            }
        }    
    }.bind(this));
    
    //sign in to channels if connection to enet is lost
    gw.client.on('close', function() {
        (config.channelArray);
    });                                                                                     
        
    
            
    //sign in every 5 minutes
    (function(){
        signIn(config.channelArray);
        setTimeout(arguments.callee, 300000);
    })();
    
    
    

    
    //Connect to mqtt
    log.info('mqtt trying to connect', config.mqttUrl);
    
    mqtt = Mqtt.connect(config.mqttUrl, {
        clientId: config.name + '_' + Math.random().toString(16).substr(2, 8),
        will: {topic: config.name + '/connected', payload: '0', retain: (config.mqttRetain)},
        rejectUnauthorized: !config.insecure
    });
    
    mqtt.on('connect', () => {
        mqttConnected = true;
        log.info('mqtt connected', config.mqttUrl);
        mqtt.publish(config.name + '/connected', enetConnected ? '2' : '1', {retain: config.mqttRetain});
        log.info('mqtt subscribe', config.name + '/set/#');
        mqtt.subscribe(config.name + '/set/#');
    });
    
    mqtt.on('close', () => {
        if (mqttConnected) {
            mqttConnected = false;
            log.info('mqtt closed ' + config.mqttUrl);
        }
    });
    
    mqtt.on('error', err => {
        log.error('mqtt', err.toString());
    });
    
    mqtt.on('offline', () => {
        log.error('mqtt offline');
    });
    
    mqtt.on('reconnect', () => {
        log.info('mqtt reconnect');
    });
    
    mqtt.on('message', (topic, payload) => {
        payload = payload.toString();
        log.debug('mqtt <', topic, payload);
    
        if (payload.indexOf('{') !== -1) {
            try {
                payload = JSON.parse(payload);
            } catch (err) {
                log.error(err.toString());
            }
        } else if (payload === 'false') {
            payload = false;
        } else if (payload === 'true') {
            payload = true;
        } else if (!isNaN(payload)) {
            payload = parseFloat(payload);
        }
        const [, method, type, name, datapoint] = topic.split('/');
    
        switch (method) {
            case 'set':
                switch (type) {
                    case 'dimmer':
                        setValue(type, name, payload);
                        break;   
                    case 'switch':
                        switch(payload) {
                            case 'ON':
                                setValue(type, name, 100);
                                break;
                            case 'OFF':
                                setValue(type, name, 0);
                                break:
                            default:
                            log.error('unknown type', type);  
                        }
                        break;
                    default:
                        log.error('unknown type', type);
                }
                break;
            default:
                log.error('unknown method', method);
        }
    });
}
    
    


function setValue(type, name, payload) {
    gw.setValueDim(name, payload, function(err, res) {
        if (err) log.error("error: " + err);
        else {
            log.info("Channel command succeeded: \n" + JSON.stringify(res));
        }
    });   
};

function signIn(name) {
    gw.signIn(name, function(err, res) {
    if (err) log.error("sign in error: " + err);
    else log.info("sign in succeeded: \n" + JSON.stringify(res));
    });
};

function mqttPublish(topic, payload, options) {
    if (!payload) {
        payload = '';
    } else if (typeof payload !== 'string') {
        payload = JSON.stringify(payload);
    }
    log.debug('mqtt >', topic, payload);
    mqtt.publish(topic, payload, options);
};





