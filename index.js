import { Configuration, OpenAIApi } from 'openai';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import videoshow from 'videoshow';
import spawn from 'await-spawn';
import AWS from 'aws-sdk';

// const spawn = child_process.spawn;

dotenv.config();

AWS.config.update({
    accessKeyId: process.env.AWS_POLLY_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_POLLY_SECRET_ACCESS_KEY_ID,
    region: 'us-west-2' // changez ceci en fonction de votre région
});

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
});

const openai = new OpenAIApi(configuration);

const generateStoryThenImagePromptWithTimestamp = async () => {
    let messages = [
        {
            role: 'user',
            content:
                "Peux tu me générer un assez courte histoire d'horreur qui je vais pouvoir publier sur tiktok, assurez-vous que l'intrigue est intrigante et culmine avec une fin étonnante et imprévisible., dans ta réponse donne moi seulement l'histoire."
        }
    ];
    const generateStory = await openai.createChatCompletion({
        model: 'gpt-4-0613',
        messages: messages
    });
    messages.push(generateStory.data.choices[0].message);

    const response = {
        story: generateStory.data.choices[0].message.content
    };

    messages.push({
        role: 'user',
        content:
            'Peux tu me générer un objet au format json en respectant ce format  : dataImages : [{"prompt" : "x", timestamp : "x"}], avec les prompt en anglais que je vais donner à une autre ia pour générer des images en illustrant chaque actions, scène à montrer de l\'histoire afin d\'illustrer celle ci, ainsi que le timestamp ou afficher chaques images. Dans ta réponse donne moi seulement l\'objet json.'
    });

    const generateImagePromptAndTimestamp = await openai.createChatCompletion({
        model: 'gpt-4-0613',
        messages
    });
    response.prompt = JSON.parse(generateImagePromptAndTimestamp.data.choices[0].message.content);

    messages.push({
        role: 'user',
        content:
            "Peux tu me répondre le nombre de seconde qu'il faudra en moyenne pour réciter l'histoire que tu viens de me donner, dans ta réponse donne moi seulement le nombre de seconde sans rien d'autre."
    });

    const generateTimeToReadStory = await openai.createChatCompletion({
        model: 'gpt-4-0613',
        messages
    });

    response.timeToReadStory = generateTimeToReadStory.data.choices[0].message.content;

    return response;
};

const getAvailableModels = async () => {
    return await openai.listModels().data.data;
};

const generateImagesFromStory = async (prompt) => {
    try {
        const result = await axios.post('http://127.0.0.1:7860/sdapi/v1/txt2img', {
            prompt: prompt,
            step: 5
        });
        return result.data.images;
    } catch (error) {
        console.log(error);
    }
};

const convertStringToImageAndCreateFile = (imageString, index) => {
    let base64String = imageString.split(',', 1)[0]; // split string
    let base64Image = base64String.split(';base64,').pop();
    fs.writeFileSync(`currentStoryImages/image${index}.png`, base64Image, { encoding: 'base64' }, function (err) {
        console.log('File created');
    });
};

const setSDModel = async (model) => {
    try {
        await axios.post('http://127.0.0.1:7860/sdapi/v1/options', {
            model
        });
    } catch (error) {
        console.log('Error when trying to set model : ', error.message);
    }
};

const generateVoiceFromElevenLabs = async (prompt, voiceId) => {
    try {
        const result = await axios({
            method: 'POST',
            url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            data: {
                text: prompt,
                model_id: 'eleven_multilingual_v1'
            },
            headers: {
                Accept: 'audio/mpeg',
                'xi-api-key': 'dc6402de63b22287a1c6783d1ae4bb59',
                'Content-Type': 'application/json'
            },
            responseType: 'stream'
        });
        result.data.pipe(fs.createWriteStream('audio.mp3'));
        return 'success';
    } catch (error) {
        console.log('Error when trying to generate voice : ', error.message);
    }
};

const generateVoiceFromBark = async (prompt) => {
    try {
        const process = await spawn('bash', ['.\\bark\\script.py', prompt]);
        process.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
            return code;
        });
    } catch (error) {
        return error;
    }
};

const generateVoiceFromAWSPolly = async (story) => {
    // Créez un client Polly
    const pollyClient = new AWS.Polly({
        region: 'eu-west-3'
    });

    // Spécifiez le format audio que vous souhaitez générer
    const voiceId = 'Remi';

    // Spécifiez la qualité audio que vous souhaitez générer
    const sampleRate = '24000';

    // Effectuez un appel à l'API Polly
    const response = pollyClient.synthesizeSpeech(
        {
            Text: story,
            VoiceId: voiceId,
            OutputFormat: 'mp3',
            SampleRate: sampleRate,
            Engine: 'neural'
        },
        (error, data) => {
            if (error) console.log(error);
            else {
                const audioStream = data.AudioStream;
                // Enregistrez le flux audio dans un fichier
                fs.writeFileSync('audio.mp3', audioStream);
            }
        }
    );

    // // Obtenez le flux audio
};

const createVideo = (imagesCount, timeToReadStory) => {
    const images = [];
    for (let i = 0; i < 5; i++) {
        images.push(`currentStoryImages/image${i}.png`);
    }
    const timeBetweenTransition = timeToReadStory / imagesCount;
    const videoOptions = {
        fps: 25,
        loop: timeBetweenTransition, // seconds
        transition: true,
        transitionDuration: 1, // seconds
        videoBitrate: 1024,
        videoCodec: 'libx264',
        size: '640x?',
        audioBitrate: '128k',
        audioChannels: 2,
        format: 'mp4',
        pixelFormat: 'yuv420p'
    };

    videoshow(images, videoOptions)
        .audio('audio.mp3')
        .save('video.mp4')
        .on('end', function (output) {
            console.error('Video created in:', output);
        });
};

const run = async () => {
    console.time('TotalRunTime');
    console.time('generateStoryThenImagePromptWithTimestampRunTime');
    const storyAndDataImages = await generateStoryThenImagePromptWithTimestamp();
    console.log(storyAndDataImages.story);
    console.log('storyAndDataImages.timeToReadStory', storyAndDataImages.timeToReadStory);
    console.timeEnd('generateStoryThenImagePromptWithTimestampRunTime');

    // await setSDModel('dreamshaper_7.safetensors');
    console.time('generateImagesFromStoryRunTime');
    let imagesResults = [];
    for (const dataImage of storyAndDataImages.prompt.dataImages) {
        const resultImage = await generateImagesFromStory(
            `${dataImage.prompt}, cinematic, detailed, atmospheric, in a dark ambient`
        );
        imagesResults.push(resultImage);
    }
    console.timeEnd('generateImagesFromStoryRunTime');

    console.time('convertStringToImagesAndCreateFilesRunTime');
    imagesResults.forEach((image, index) => {
        convertStringToImageAndCreateFile(image[0], index);
    });
    console.timeEnd('convertStringToImagesAndCreateFilesRunTime');

    console.time('generateVoiceRunTime');
    // await generateVoice(storyAndDataImages.story, 'AZnzlk1XvdvUeBnXmlld');
    await generateVoiceFromAWSPolly(storyAndDataImages.story);
    console.timeEnd('generateVoiceRunTime');

    console.time('createVideoRunTime');
    createVideo(storyAndDataImages.prompt.dataImages.length, storyAndDataImages.timeToReadStory);
    console.timeEnd('createVideoRunTime');
    console.timeEnd('TotalRunTime');
};

run();
