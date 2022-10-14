const mqtt = require("mqtt");
const slugify = require("slugify");
const Homiris = require('homiris');

if(process.env.ENVIRONMENT === 'DEV') {
    require('dotenv').config();
    console.log(process.env);
}

let mainFn;

const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {clientId:"mqtt-homiris", username: process.env.MQTT_USERNAME, password: process.env.MQTT_PASSWORD});

mqttClient.on('connect', function() {
    console.log("Connected!");
    mainFn = setInterval(init, 5*60*1000);
});

mqttClient.on('error', function(err) {
    console.log("Error!", err);
    clearInterval(mainFn);
});

async function getData() {
    const homiris = new Homiris({
        username: process.env.HOMIRIS_USERNAME,
        password: process.env.HOMIRIS_PASSWORD,
        basicToken: process.env.HOMIRIS_BASICTOKEN,
    });

    const login = await homiris.login();
    // console.log(login);
    const session = await homiris.getIdSession();
    // console.log(session);

    const temp = await homiris.getTemperature();
    // console.log(temp);

    /*await homiris.arm({
        silentMode: true,
        systemMode: 'TOTAL',
    });*/

    // const systemStatus = await homiris.getSystemState();
    // console.log(systemStatus);

    return {
        temp,
        // systemStatus
    };
}

async function init () {
    try {
        const { temp } = await getData();
        console.log(temp);
        temp.statements.map(t => {
            const label = slugify(t.label, {
                lower: true,      // convert to lower case, defaults to `false`
                trim: true         // trim leading and trailing replacement chars, defaults to `true`
              })
            mqttClient.publish(
                `${process.env.MQTT_TOPIC}/sensor/${label}/state`,
                JSON.stringify({
                        temperature: t.temperature,

                }),
            );
        })
    }
    catch(err) {
        console.log(err);
        mqttClient.publish(
            `${process.env.MQTT_TOPIC}/homiris/state`,
            JSON.stringify(err),
        );
        clearInterval(mainFn);
    }   
}


