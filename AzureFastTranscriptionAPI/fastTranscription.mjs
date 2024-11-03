
import dotenv from 'dotenv';
dotenv.config();
import formidable from 'formidable';
import { createItem, updateItem } from './db.js';
import { BlobServiceClient } from '@azure/storage-blob';
import { readFile, } from "node:fs/promises"
import path from 'path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_REGION = process.env.AZURE_REGION;
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;
const FAST_TRANSCRIBE_API_URL = process.env.FAST_TRANSCRIBE_API_URL;

if (!AZURE_SPEECH_KEY || !AZURE_REGION || !AZURE_STORAGE_CONNECTION_STRING || !AZURE_STORAGE_CONTAINER_NAME || !FAST_TRANSCRIBE_API_URL) {
    throw new Error('Missing required environment variables');
}

async function fastTranscribeMultiPart(req, res) {
    console.log('request for fast transcribe multipart');
    const form = formidable({});
    try {
        let [fields, files] = await form.parse(req);

        //Todo: Validate request
        const parsedRequestData = {
            locales: fields.locales || ["en-US"],
            diarizationSettings: fields.diarizationSettings || {
                minSpeakers: 1,
                maxSpeakers: 4
            },
            profanityFilterMode: fields.profanityFilterMode || "Masked",
            channels: fields.channels || [0],
            callbackUrl: fields.callbackUrl
        }
        await performTranscription(res, parsedRequestData, files?.audio[0]?.filepath);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: 'Error in Transcription',
            error: err?.message
        });
    }
}

async function fastTranscribeJson(req, res) {
    console.log('request for fast transcribe using JSON');
    try {
        //Todo: Validate request
        const parsedRequestData = {
            locales: req.body.locales || ["en-US"],
            diarizationSettings: req.body.diarizationSettings || {
                minSpeakers: 1,
                maxSpeakers: 4
            },
            profanityFilterMode: req.body.profanityFilterMode || "Masked",
            channels: req.body.channels || [0],
            callbackUrl: req.body.callbackUrl
        }

        const filepath = await downloadFromBlobStorage(req.body.audioFilePath);

        await performTranscription(res, parsedRequestData, filepath);
    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: 'Error in Transcription',
            error: err
        });
    }
}


async function uploadToBlobStorage(fileContent, fileName) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);

    // await containerClient.createIfNotExists();

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const fileBuffer = Buffer.from(JSON.stringify(fileContent, null, 2));
    await blockBlobClient.uploadData(fileBuffer);

    return blockBlobClient.url;
}

async function downloadFromBlobStorage(fileUrl) {
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient('ww-dev-inbox');
    const fileName = fileUrl.split('/').pop();
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const localFilePath = path.join(__dirname, fileName);
    await blockBlobClient.downloadToFile(localFilePath);
    console.log(`Downloaded to local file ${localFilePath}`);

    return localFilePath;
}

async function fastTranscribeAPI(requestData, filepath) {
    console.log('Calling Fast Transcribe API');

    const formData = new FormData();
    formData.append('definition', JSON.stringify(requestData));

    const fileData = await readFile(filepath)
    const blob = new Blob([fileData], { type: "audio/mp3" });
    formData.append("audio", blob);

    const response = await fetch(FAST_TRANSCRIBE_API_URL, {
        method: 'POST',
        headers: {
            'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
            'Accept': 'application/json'
        },
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Transcription result:', result);
    return result;
}

async function callbackUrlwithData(url, data) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
    }

    return response.json();
}

async function performTranscription(res, parsedRequestData, filepath) {
    // Add transcription in azure
    const createdResource = await createItem(parsedRequestData)
    console.log('Resource created in azure cosmos:', createdResource);

    if (parsedRequestData.callbackUrl) {
        console.log('Callback URL Present, sending initial response to client');
        res.json({
            message: 'Transcription Started',
            requestData: createdResource
        })
    }

    // Call fast transcribe API
    const result = await fastTranscribeAPI(parsedRequestData, filepath);

    // Send response to client if callback url is not present
    if (!parsedRequestData.callbackUrl) {
        res.json({
            message: 'Transcription Successful',
            requestData: createdResource,
            result
        });
    }

    // Write file to azure blob storage
    const fileName = `transcription-${createdResource.id}.json`;
    const transcribedFileUrl = await uploadToBlobStorage(result, fileName);
    console.log('File uploaded to Azure Blob Storage:', transcribedFileUrl);

    // update azure file url in cosmos db
    const updatedItem = await updateItem(createdResource.id, createdResource.id, { ...createdResource, transcribedFileUrl });
    console.log('Resource updated:', updatedItem);

    if (parsedRequestData.callbackUrl) {
        console.log('Callback URL Present, sending response to Callback URL');
        await callbackUrlwithData(parsedRequestData.callbackUrl, {
            message: 'Transcription Successful',
            requestData: createdResource, result
        });
    }
}

export {
    fastTranscribeMultiPart,
    fastTranscribeJson
}