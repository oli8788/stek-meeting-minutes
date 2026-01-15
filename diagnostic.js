const { GoogleGenerativeAI } = require("@google/generative-ai");

async function diagnostic() {
    const apiKey = "AIzaSyA4s9BnF28oO6uRDDn4OnNa42_sRLCHEps";
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("Fetching available models...");
        // In newer versions of @google/generative-ai, listModels might not be directly on genAI or might have changed.
        // Let's try to see if it exists as a method.
        if (typeof genAI.listModels === 'function') {
            const result = await genAI.listModels();
            console.log("Available models:");
            result.models.forEach(m => console.log(m.name, m.supportedGenerationMethods));
        } else {
            console.log("genAI.listModels is not a function. Checking prototype...");
            console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(genAI)));
        }
    } catch (error) {
        console.error("Diagnostic failed!");
        console.error(error);
    }
}

diagnostic();
