const https = require("https");

const apiKey = "AIzaSyA4s9BnF28oO6uRDDn4OnNa42_sRLCHEps";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

console.log("Starting direct HTTPS request to:", url);

https.get(url, (res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers);

    let data = "";
    res.on("data", (chunk) => {
        data += chunk;
    });

    res.on("end", () => {
        try {
            const parsedData = JSON.parse(data);
            console.log("Response Body (Parsed):", JSON.stringify(parsedData, null, 2));
        } catch (e) {
            console.log("Response Body (Raw):", data);
        }
    });
}).on("error", (err) => {
    console.error("HTTPS Request Failed!");
    console.error(err);
});
