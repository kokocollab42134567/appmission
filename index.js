require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.RENDER_SECRET_KEY;

if (!OPENROUTER_API_KEY) {
    console.error("Missing OpenRouter API Key. Please set OPENROUTER_API_KEY or RENDER_SECRET_KEY in your Render environment settings.");
    process.exit(1);
}

// Helper function to decode mission description
function decodeMission(description) {
    try {
        return decodeURIComponent(description);
    } catch (e) {
        return description; // Return as-is if decoding fails
    }
}

// Function to clean AI response and extract JSON
function extractJsonFromResponse(aiContent) {
    if (!aiContent) return { error: "Empty response from AI." };

    aiContent = aiContent.trim();
    
    // Remove Markdown code block if present
    const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
    const cleanJson = jsonMatch ? jsonMatch[1] : aiContent;

    try {
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("JSON Parsing Error:", error);
        return { error: "Failed to parse AI response." };
    }
}

// AI Function to Analyze and Generate Mission Details
async function getMissionDetails(mission, totalPoints) {
    try {
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "system", content: "You analyze mission descriptions and provide structured details. Always return a valid JSON format." },
                    { 
                        role: "user", 
                        content: `Mission: ${mission}\nTotal Points: ${totalPoints}\n\nExtract and provide the following details in JSON format:\n{\n  "title": "Mission Title",\n  "description": "Detailed mission explanation.",\n  "criteria": ["Criteria 1:?pts", "Criteria 2:?pts", "Criteria 3:?pts"...],\n  "difficulty": "S, A, B, C, D, E, F, Z",\n  "domain": "Programming, Marketing, Editing, etc."\n}`
                    }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const responseData = response.data;
        if (responseData && responseData.choices) {
            return extractJsonFromResponse(responseData.choices[0]?.message?.content);
        } else {
            return { error: "Unexpected AI response format." };
        }
    } catch (error) {
        console.error("Error contacting OpenRouter:", error);
        return { error: "Failed to generate mission details." };
    }
}

// API Route
app.get("/mission", async (req, res) => {
    const { description, total_points } = req.query;
    
    if (!description || !total_points) {
        return res.status(400).json({ error: "Missing required parameters: description or total_points." });
    }
    
    const decodedMission = decodeMission(description);
    const missionDetails = await getMissionDetails(decodedMission, total_points);
    
    res.json({
        original_mission: decodedMission,
        total_points: total_points,
        ai_generated_details: missionDetails
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
