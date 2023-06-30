const { Configuration, OpenAIApi } = require("openai");
require('dotenv').config()

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });

console.log(process.env.OPENAI_API_KEY);

const openai = new OpenAIApi(configuration);

const genereteStoryThenImagePromptWithTimestamp = async () => {
    let messages = [{role: "user", content: "Peux tu me générer un assez courte histoire d'horreur qui je vais pouvoir publier sur tiktok"}]
    const generateStory = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages : messages
      });
      messages.push(generateStory.data.choices[0].message)
      messages.push({role: "user", content: "Peux tu me générer un objet au format json avec les prompt que je vais donner à une autre ia pour générer des images en rapport avec l'histoire afin d'illustrer celle ci, ainsi que le timestamp ou afficher chaques images"})
      
      const response = {
        story : generateStory.data.choices[0].message.content,
      }


      const generateImagePromptAndTimestamp = await openai.createChatCompletion(
        {
            model : "gpt-3.5-turbo",
            messages
        });

    response.prompt = generateImagePromptAndTimestamp.data.choices[0].message.content

    return response;
}

genereteStoryThenImagePromptWithTimestamp().then((response) => console.log(response));

