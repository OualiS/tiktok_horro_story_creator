// const AWS = require('aws-sdk');
import AWS from 'aws-sdk';
import fs from 'fs';

AWS.config.update({
    accessKeyId: 'AKIAX6NPX7E7QYSHLJ4D',
    secretAccessKey: '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',
    region: 'us-west-2' // changez ceci en fonction de votre région
});

const run = async () => {
    // Créez un client Polly
    const pollyClient = new AWS.Polly({
        region: 'eu-west-3'
    });

    // Spécifiez le texte que vous souhaitez synthétiser
    const text = "Bonjour, ceci est un test, je suis une IA et je vais raconter des histoires d'horreur";

    // Spécifiez le format audio que vous souhaitez générer
    const voiceId = 'Lea';

    // Spécifiez la qualité audio que vous souhaitez générer
    const sampleRate = '24000';

    // Effectuez un appel à l'API Polly
    const response = pollyClient.synthesizeSpeech(
        {
            Text: text,
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
run();
