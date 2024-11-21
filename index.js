const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const admin = require("firebase-admin");

const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, "public")));

// Middleware para processar JSON no corpo da requisição
app.use(express.json({ limit: '10mb' }));

const openai = new OpenAI.OpenAI({
    apiKey: "sk-svcacct-30SHwEtRB7UOjYAKzmDqjbo9yd67ooEFajS6fJmyeP8heQTXaYuEBTeUB9-NCT3BlbkFJ0JD7UjXi56gI8J4cUAaz9HgE4tlnr3XtqsQjbkFY9l7_WGiNE4V-mh2Dd_uAA"
});
var serviceAccount = require("./bracefaucet-firebase-adminsdk-ngeww-97d5f0ff05.json");

const firebaseConfig = {
    apiKey: "AIzaSyDkBRWLF4ZtQYZItABNpUYnVXqK5-hjtBs",
    authDomain: "bracefaucet.firebaseapp.com",
    databaseURL: "https://bracefaucet-default-rtdb.firebaseio.com",
    projectId: "bracefaucet",
    storageBucket: "bracefaucet.appspot.com",
    messagingSenderId: "27435789987",
    appId: "1:27435789987:web:ad33787850594dee00d916",
    measurementId: "G-KTVHTKWHV8"
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bracefaucet-default-rtdb.firebaseio.com",
  storageBucket: "bracefaucet.appspot.com" // Certifique-se de que o nome está correto
});
const bucket = admin.storage().bucket()

// Função para converter vídeo para GIF e fazer upload para o Firebase
async function downloadAndConvertVideoToGif(videoUrl) {
    const videoPath = path.join(__dirname, "temp-video.mp4");
    const gifPath = path.join(__dirname, "temp-gif.gif");

    // Baixa o vídeo usando axios
    const response = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(videoPath, Buffer.from(response.data));

    // Converte para GIF
    await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
            .output(gifPath)
            .on("end", resolve)
            .on("error", reject)
            .run();
    });

    // Faz upload para o Firebase Storage
    const file = bucket.file("gifs/" + Date.now() + ".gif");
    await file.save(fs.readFileSync(gifPath), {
        contentType: "image/gif",
    });

    // Apaga arquivos temporários
    fs.unlinkSync(videoPath);
    fs.unlinkSync(gifPath);

    // Gera e retorna a URL do GIF
    return `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodeURIComponent(file.name)}?alt=media`;
}

// Define a nova rota para receber a URL do vídeo e retornar o GIF
app.get("/convert-video-to-gif", async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).send("URL do vídeo é necessária.");
    }

    try {
        const gifUrl = await downloadAndConvertVideoToGif(videoUrl);
        res.json({ url:gifUrl });
    } catch (error) {
        console.error("Erro ao converter e fazer upload do GIF:", error);
        res.status(500).send("Erro ao processar a solicitação.");
    }
});

// Rota para análise de GIF em formato Base64
// Rota para análise de GIF em formato Base64
app.post("/analyze-gif", async (req, res) => {
    let { base64Gif, details = "", lang = "American", type = "gif", is=false } = req.body;
    console.log("Image Base64:",base64Gif)
    console.log("Details: "+details)
    console.log("Language: "+lang)
    console.log("Type: "+type)
    // Verifica se o GIF Base64 foi enviado
    if (!base64Gif) {
        return res.status(400).send("O GIF em Base64 é necessário.");
    }

    // Limite o tamanho do GIF em Base64 para evitar estouro de memória
    const MAX_BASE64_SIZE = 10 * 1024 * 1024; // 10 MB, ajuste conforme necessário
    if (base64Gif.length > MAX_BASE64_SIZE) {
        return res.status(400).send("O GIF é muito grande. Por favor, envie um arquivo menor.");
    }

    try {
        const completion = await openai.chat.completions.create({
            "model": "gpt-4o",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": is ? details :`Can you identify the sign being made in this ${type}? The sign is part of ${lang} Sign Language. Please analyze the image carefully, focusing on the hand shapes, facial expressions, and any other relevant contextual elements. Provide specific details about the sign, including its meaning and any cultural context that may apply. Additionally, explain your reasoning and the observations that led you to your conclusion, with as much detail as possible. This information will help enhance your understanding for future reference. If "Details" have any value, it is because your analysis is wrong. Details: ${details}`
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": base64Gif,
                            }
                        }
                    ]
                }
            ]
        });
        

        const response = completion.choices[0].message;

        res.json(response);
    } catch (error) {
        console.error("Erro ao chamar a API do OpenAI:", error);
        res.status(500).send("Erro ao processar a solicitação.");
    }
});




function saveHistory(data) {
    const historyPath = path.join(__dirname, "history.json");

    // Carrega o histórico existente ou cria um novo array
    let history = [];
    if (fs.existsSync(historyPath)) {
        history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    }

    // Adiciona a nova entrada e salva o arquivo atualizado
    history.push(data);
    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");
}
function loadHistory() {
    const historyPath = path.join(__dirname, "history.json");
    if (fs.existsSync(historyPath)) {
        return JSON.parse(fs.readFileSync(historyPath, "utf8"));
    }
    return [];
}
app.get("/history", (req, res) => {
    const history = loadHistory();
    res.json(history);
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});


