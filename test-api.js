const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testKey() {
    const apiKey = "AIzaSyA4s9BnF28oO6uRDDn4OnNa42_sRLCHEps";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    try {
        console.log("Testing Gemini API connection...");
        const result = await model.generateContent("Hello, are you there?");
        const response = await result.response;
        console.log("Response success!");
        console.log(response.text());
    } catch (error) {
        console.error("Test failed!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.cause) {
            console.error("Error Cause:", error.cause);
        }
    }
}

testKey();
