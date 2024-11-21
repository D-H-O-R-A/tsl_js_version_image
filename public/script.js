// Inclua o Firebase e o SweetAlert2 no HTML
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

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

firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();

// .container-video4s
let video = document.getElementById("video");
let statusMessage = document.getElementById("statusMessage");
let gifResult = document.getElementById("gifResult");
let countdownDisplay = document.createElement("div");
countdownDisplay.style.fontSize = "24px";
countdownDisplay.style.marginTop = "10px";
document.querySelector(".container-video4s").appendChild(countdownDisplay);
let recordingTimeMS = 4000; // Tempo de gravação em milissegundos (5 segundos)
let isCameraInitialized = false; // Flag para verificar se a câmera foi inicializada
let isclickedstartbefore = false;
let data = [];
let videogifurl,imageBase64,clickToUploadImage,langIdioma
let detailsGPT = ""
// finish .container-video4s

const Toast = Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.onmouseenter = Swal.stopTimer;
        toast.onmouseleave = Swal.resumeTimer;
    }
});

function startRecording(stream) {
    let recorder = new MediaRecorder(stream);

    recorder.ondataavailable = event => data.push(event.data);
    recorder.start();
    statusMessage.textContent = "Recording...";

    return new Promise((resolve) => {
        let stopped = new Promise((stopResolve) => {
            recorder.onstop = () => {
                resolve(data);
                stopResolve();
            };
        });

        // Contador de 5 segundos
        let countdown = recordingTimeMS / 1000; // Convertendo para segundos
        countdownDisplay.textContent = countdown; // Mostrando o contador inicial
        let countdownInterval = setInterval(() => {
            countdown--;
            countdownDisplay.textContent = countdown;

            if (countdown <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000); // Atualiza a cada 1 segundo

        setTimeout(() => {
            recorder.stop();
            clearInterval(countdownInterval); // Para o contador quando a gravação termina
        }, recordingTimeMS);

        return stopped;
    });
}

// Função para upload do vídeo para o Firebase
async function uploadVideoToFirebase(blob) {
    const storageRef = storage.ref();
    const videoRef = storageRef.child(`videos/${Date.now()}.mp4`); // Cria um caminho único para o vídeo

    const uploadTask = videoRef.put(blob);

    // Monitorar o progresso do upload
    await uploadTask.on("state_changed", 
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            Toast.fire({
                icon: "info",
                title: `Loading: ${progress.toFixed(2)}%`
            });
        }, 
        (error) => {
            console.error("Erro ao fazer upload: ", error);
            statusMessage.textContent = "Error uploading.";
        }, 
        async () => {
            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
            Toast.fire({
                icon: "success",
                title: "Upload completed!"
            });
            setVideo(downloadURL)
            Toast.fire("Converting to GIF...","","warning")
            var gif = await sendVideoToFFMpeg(downloadURL);
            videogifurl=gif;
            console.log(gif)
            Toast.fire("Submitting for AI analysis, please wait...","","info")
            poupUpselect("gif",gif,"")
        }
    );
}

// Evento de clique no botão de início
function detectVideo4sStart(){
    document.getElementById("aiResult").style.display="none";
    if (!isCameraInitialized) {
        // Inicializa a câmera
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
                video.srcObject = stream;
                isCameraInitialized = true; // Marca a câmera como inicializada
                startButton.textContent = "Start"; // Muda o texto do botão
                statusMessage.textContent = "Camera initialized. Click 'Start' to record.";
            })
            .catch(err => {
                console.error("Erro ao acessar a câmera: ", err);
                statusMessage.textContent = "Error accessing the camera.";
            });
    } else {
        // Começa a gravação
        startRecording(video.captureStream())
            .then(async recordedChunks => {
                let recordedBlob = new Blob(recordedChunks, { type: "video/mp4" });
                video.src = URL.createObjectURL(recordedBlob);

                // Exibir vídeo gravado no elemento de vídeo
                await uploadVideoToFirebase(recordedBlob);
            })
            .catch(err => {
                console.error("Erro: ", err);
                statusMessage.textContent = "Error recording video.";
                countdownDisplay.textContent = ""; // Limpa o contador em caso de erro
            });
    }
}



function setVideo(videoURL){
    console.log(videoURL)
    let recordedVideo = document.createElement("video");
    recordedVideo.src = videoURL; // URL do vídeo do Firebase
    recordedVideo.controls = true;
    recordedVideo.style.width = "100%";
    gifResult.innerHTML = ""; // Limpar resultados anteriores
    gifResult.appendChild(recordedVideo);

    statusMessage.textContent = "Recording completed. See the video above.";
    countdownDisplay.textContent = ""; // Limpa o contador
    startButton.textContent = "Initialize Camera"; // Restaura texto original
    isCameraInitialized = false; // Reseta a inicialização da câmera
}



async function sendToChatgpt(gif, details, type,idioma,is) {
    langIdioma=idioma;
    var airesult = await analyzeWithOpenAI(gif,details,type,idioma,is)
    console.log(airesult)
    if(airesult.error!= undefined){
        Toast.fire("Error",airesult.error,"error")
        // sendToChatgpt(gif,details,type,idioma,)
    }else{
        setAfterLayout(type,airesult)
    }
}

function setAfterLayout(type,airesult){
    switch(type){
        case "training":
            
        break;
        case "gif":
            document.getElementById("aiResult").style.display="flex";
            document.querySelector("#aiResult p").innerHTML = airesult.content
            detailsGPT=airesult.content
        break;
        case "realtime":

        break;
        case "image":
            document.getElementById("aiResultImage").style.display="flex";
            document.querySelector("#aiResultImage p").innerHTML = airesult.content
            detailsGPT=airesult.content

        break;
        default:
            setAfterLayout("gif",airesult)
    }
}

async function getHistory() {
    try {
        const response = await fetch(`/history`);
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a API: ' + response.statusText);
        }

        const result = await response.json();
        console.log(result)
        return result; // Retorna o resultado da análise
    } catch (error) {
        console.error('Erro:', error);
        return { error: 'Falha ao obter histórico' };
    }
}

async function sendVideoToFFMpeg(firebaseULR){
    try {
        const response = await fetch(`/convert-video-to-gif?url=${encodeURIComponent(firebaseULR)}`);
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a API: ' + response.statusText);
        }

        const result = await response.json();
        console.log(result)
        return result.url; // Retorna o resultado da análise
    } catch (error) {
        console.error('Erro:', error);
        return { error: 'Falha ao analisar o GIF. Tente novamente mais tarde.' };
    }
}

async function sendVideoToCreatomate(firebaseUrl) {
    const url = 'https://api.creatomate.com/v1/renders';
    const apiKey = 'fde822cefe36440bb2764a567fc1ea4176b342ec061806f1512f3419139b1f141d7d67261da137ab3c45a53dd5e321ec'; // Substitua pela sua chave de API

    // Dados a serem enviados na requisição
    const data = {
        source: {
            output_format: "gif",
            gif_quality: "best",
            gif_compression: 100,
            frame_rate: "10 fps",
            duration: 3,
            elements: [
                {
                    type: "video",
                    source: firebaseUrl // Use a URL do Firebase aqui
                }
            ]
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Request error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Resultado:', result);
        return result; // Retorne o resultado se necessário

    } catch (error) {
        console.error('Erro ao enviar vídeo:', error);
    }
}


async function analyzeWithOpenAI(videoUrl, details, type, idioma,is) {
    try {
        var body = JSON.stringify({
            base64Gif: videoUrl, // Supondo que o GIF está em formato Base64
            details: details,
            lang: idioma,
            type: type,
            is: is
        })
        console.log(body)
        const response = await fetch(`/analyze-gif`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a API: ' + response.statusText);
        }

        const result = await response.json();
        console.log(result);
        return result; // Retorna o resultado da análise
    } catch (error) {
        console.error('Erro:', error);
        return { error: 'Falha ao analisar o GIF. Tente novamente mais tarde.' };
    }
}


async function yes(type,format){
    Swal.fire("I'm glad your analysis is correct!","Thank you for marking it as correct, this helps the AI ​​to learn more and more and analyze better","success")
    document.querySelector("#aiResult p, #aiResultImage p").innerHTML ="";
    switch(type){
        case "training":

        break;
        case "gif":
            await sendToChatgpt(videogifurl,`Your analysis of the ${format} about (${detailsGPT}) was correct! Thank you!`,type,langIdioma,true)
        break;
        case "realtime":

        break;
        case "image":
            await sendToChatgpt(imageBase64,`Your analysis of the ${format} about (${detailsGPT}) was correct! Thank you!`,type,langIdioma,true)
        break;
        default:
            yes("gif",format)
    }
}

async function no(type,format){
    Swal.fire({
        title: "What was the expected signal?",
        input: "text",
        inputPlaceholder: "The expected sign was...",
        showCancelButton: true,
        confirmButtonText: "Enviar",
        cancelButtonText: "Cancelar",
        preConfirm: (reason) => {
            if (!reason) {
                Swal.showValidationMessage("Please describe what the expected signal was in detail");
                return false;
            }
            return reason;
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            var r =result.value
            Toast.fire("New analysis being sent, please wait...","","info")
            // Chama a função no() com o motivo fornecido pelo usuário
            document.querySelector("#aiResult p, #aiResultImage p").innerHTML ="";
            switch(type){
                case "training":
        
                break;
                case "gif":
                    await sendToChatgpt(videogifurl,`That's not what's in the ${format} (${detailsGPT}). The expected result that would be detected is ${r}`,type,langIdioma,false)
                break;
                case "realtime":
        
                break;
                case "image":
                    await sendToChatgpt(imageBase64,`That's not what's in the ${format} (${detailsGPT}). The expected result that would be detected is ${r}`,type,langIdioma,false)
                break;
                default:
                    no("gif",format)
            }
        }
    });


}

function set(a){
    $(".todetect").css("display","none")
    $("."+a+', [onclick="back()"]').css("display","flex")
}

function back(){
    detailsGPT="";
    data=[];
    isCameraInitialized = false; // Flag para verificar se a câmera foi inicializada
    isclickedstartbefore = false;
    $('.todetect, [onclick="back()"]').css("display","none")
    $(".select").css("display","flex")
    document.location.reload(true)
}

async function poupUpselect(type,data,text){
    await sendToChatgpt(data,text,type,"American")
}

function imageUpload() {
    if(clickToUploadImage){
        poupUpselect("image",imageBase64,"")
    }else{
        clickToUploadImage=true;
        const fileInput = document.getElementById('fileInput');
        const file = fileInput.files[0];
    
        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(event) {
                // Obtem a imagem em base64
                const base64Image = event.target.result;
                
                // Salva a imagem em base64 em uma variável
                imageBase64 = base64Image;
                console.log("Imagem em Base64:", imageBase64); // Exibe no console para teste
    
                // Adiciona a imagem como background ao canvas
                const canvas = document.getElementById('canvasImageDetect');
                const context = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = function() {
                    // Ajusta o canvas ao tamanho da imagem
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    // Desenha a imagem no canvas
                    context.drawImage(img, 0, 0, canvas.width, canvas.height);
                };
                img.src = base64Image;
            };
            
            // Lê o arquivo selecionado como Data URL
            reader.readAsDataURL(file);
        }
        $("#startButtonImage").text("Submit for analysis")
        $("#startButtonImage").attr("onclick","imageUpload()")
        $("#startButtonImage").attr("onselect","imageUpload()")
    }
}

$(window).on("load",async ()=>{
    const jsonData = await getHistory()

    // Ordenar os dados por timestamp (do mais recente para o mais antigo)
    jsonData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Exibir os dados na página
    jsonData.forEach(item => {
        $('.container-treinamento #mainw').append(`
            <div class="item">
                <img src="${item.request.imageUrl}" alt="Imagem" style="max-width: 100%; height: auto; border-radius: 5px;"/>
                <div>
                    <div class="prompt">Prompt: ${item.prompt}</div>
                    <div class="result">Response: ${item.response.content}</div>
                    <div class="timestamp">Date: ${new Date(item.timestamp).toLocaleString()}</div>
                </div>
            </div>
        `);
    });
})
