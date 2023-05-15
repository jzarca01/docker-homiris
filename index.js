const mqtt = require("mqtt");
const slugify = require("slugify");
const Homiris = require('homiris');

if(process.env.ENVIRONMENT === 'DEV') {
    require('dotenv').config();
    console.log(process.env);
}

const ALARM_TOPIC = `${process.env.MQTT_TOPIC}/alarm/0/command`;

const homiris = new Homiris({
    username: process.env.HOMIRIS_USERNAME,
    password: process.env.HOMIRIS_PASSWORD,
    basicToken: process.env.HOMIRIS_BASICTOKEN,
});

let mainFn;


const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {clientId:"mqtt-homiris", username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD});

mqttClient.on('connect', function() {
    console.log("Connected!");

    mqttClient.subscribe(ALARM_TOPIC);
    mqttClient.publish(process.env.MQTT_TOPIC, 'Subscribed');

    mainFn = setInterval(init, 2*60*1000);
});

mqttClient.on('message', async function(topic, message) {
    const decryptedMesage = message.toString();
    if(topic === ALARM_TOPIC) {
        await login();
        switch(decryptedMesage) {
            case 'ON':
                return await homiris.arm({
                    silentMode: false,
                    systemMode: 'TOTAL',
                });
            case 'OFF':
                return await homiris.disarm();
            default:
               break;
        }
        const { systemStatus } = await getData();
        return updateSecurityState(systemStatus.securityParameters);
    }
    return undefined;
});

mqttClient.on('disconnect', function() {
    console.log("Disconnected");
    clearInterval(mainFn);
});

mqttClient.on('reconnect', function() {
    console.log("Reconnected!");
    clearInterval(mainFn);
    mainFn = setInterval(init, 2*60*1000);
});
