console.log("Getting ready...")
// vars
let { token, client_id, gatewayUrl, response } = require("./creds.json");
let heartbeatInterval;
let gatewaySequence;
const ws = require("ws");
const fetch = require("node-fetch");
const { writeFileSync } = require("fs");
const api = "https://discord.com/api/v10";

// log bot invite link
console.log(`Add bot to your server with this link: https://discord.com/api/oauth2/authorize?client_id=${client_id}&permissions=3072&scope=bot%20applications.commands`);

// fetch for already existing commands
fetch(`${api}/applications/${client_id}/commands`, {
    method: "GET",
    headers: {
        Authorization: `Bot ${token}`
    }
}).then(commands => commands.json()).then(async commands => {
    if (!commands[0]) {
        // if no commands, create one
        await fetch(`${api}/applications/${client_id}/commands`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bot ${token}`
            },
            body: JSON.stringify({
                name: "badge",
                description: "Get Discord Developer Badge"
            })
        });
    }

    connectToGateway()
    function connectToGateway(hasFetchedNewUrl) {
        // connect to bot gateway
        const gateway = new ws.WebSocket(gatewayUrl);

        // events
        gateway.on("open", () => {
            // login
            gateway.send(JSON.stringify({
                op: 2,
                d: {
                    token,
                    properties: {
                        os: "linux",
                        browser: "abrowser",
                        device: "adevice"
                    },
                    presence: {
                        status: "dnd",
                    },
                    intents: 3072
                }
            }))
        });

        gateway.on("message", (message) => {
            // parse gateway message
            message = JSON.parse(message)
            if (message.s) gatewaySequence = message.s;

            if (message.op === 0) {
                if (message.t === "INTERACTION_CREATE") {
                    // respond to command
                    let sendResponse = response;

                    // just some extra stuff to change response message if the command had a string option (for fun)
                    if (message.d.data) {
                        if (message.d.data.options) {
                            if (message.d.data.options[0]) {
                                if (message.d.data.options[0].type === 3) {
                                    sendResponse = `"${message.d.data.options[0].value}" - <@${message.d.member.user.id}>`
                                }
                            }
                        }
                    }

                    fetch(`${api}/interactions/${message.d.id}/${message.d.token}/callback`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            type: 4,
                            data: {
                                content: sendResponse
                            }
                        })
                    }).then(() => {
                        console.log("Replied to slash command, you should be eligible for a Developer Badge soon!")
                        return process.exit(0);
                    });
                }
            }

            if (message.op === 1) {
                // ready
                console.log(`Go in any server that the bot is in and look for the bot's slash command(s) (it can be any)`);
            }

            if (message.op === 9) {
                console.log("Could not connect to gateway, your token is probably wrong!")
                return process.exit(1);
            }

            if (message.op === 10) {
                // on open for heartbeat interval

                // heartbeat
                heartbeatInterval = setInterval(() => {
                    gateway.send(JSON.stringify({
                        op: 1,
                        d: gatewaySequence || null
                    }));
                }, message.d.heartbeat_interval);
            }
        });

        gateway.on("error", (err) => {
            // on gateway error
            if (hasFetchedNewUrl) {
                // if 2nd error
                console.log("Failed to connect to the gateway")
                return process.exit(1);
            }
            // fetch gateway URL
            fetch(`${api}/gateway`).then(newGatewayUrl => newGatewayUrl.json()).then(newGatewayUrl => {
                if (newGatewayUrl.url === gatewayUrl) {
                    // if fetched gateway url has not changed
                    console.log("Failed to connect to the gateway")
                    return process.exit(1);
                }
                // set new gateway url
                gatewayUrl = newGatewayUrl.url;
                writeFileSync("./creds.json", JSON.stringify({ token, client_id, gatewayUrl, response }, null, 4));
                // reconnect
                return connectToGateway(true);
            })
        })
    }
});