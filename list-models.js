const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = "AIzaSyAouy6rprXnhV3JAm4VV3o6o6r5UJVNtWs";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        const result = await genAI.listModels();
        console.log("Available models:");
        result.models.forEach((m) => console.log(m.name));
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
