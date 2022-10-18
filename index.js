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

    mainFn = setInterval(init, 60*1000);
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
    mainFn = setInterval(init, 60*1000);
});

mqttClient.on('error', function(err) {
    console.log("Error!", err);
    clearInterval(mainFn);

    mqttClient.end();
    process.exit(1);
});

async function login() {
    await homiris.login();
    await homiris.getIdSession();
}

async function getData() {
    await login();

    const temp = await homiris.getTemperature();
    // console.log(temp);

    const systemStatus = await homiris.getSystemState();
    // console.log(systemStatus);

    return {
        temp,
        systemStatus
    };
}

function updateTemperature(statementsArray) {
    return statementsArray.map(t => {
        const label = slugify(t.label, {
            lower: true,      // convert to lower case, defaults to `false`
            trim: true         // trim leading and trailing replacement chars, defaults to `true`
          })
        return mqttClient.publish(
            `${process.env.MQTT_TOPIC}/sensor/${label}/state`,
            JSON.stringify({
                    temperature: t.temperature,

            }),
            {
                retain: true,
            }
        );
    })
}

function updateSecurityState(securityParameters) {
    if(securityParameters.status === 'IN_PROGRESS') {
        return undefined;
    }

    const alarmState = securityParameters?.status === 'ON' ? 'on' : 'off'
    return mqttClient.publish(`${process.env.MQTT_TOPIC}/sensor/alarm/state`,
    JSON.stringify({status: alarmState}),
    {
        qos: 2,
        retain: true
    }
);
}

async function init () {
    try {
        const { temp, systemStatus } = await getData();
        console.log(systemStatus);

        if(temp?.statements) {
            updateTemperature(temp.statements);
        }
        if(systemStatus?.securityParameters) {
            updateSecurityState(systemStatus.securityParameters)
        }

    }
    catch(err) {
        console.log(err);
        mqttClient.publish(
            `${process.env.MQTT_TOPIC}/homiris/state`,
            JSON.stringify(err),
        );
        clearInterval(mainFn);
        process.exit(1);
    }   
}

