import express from 'express';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import helmet from 'helmet';
import cors from 'cors';
import { fastTranscribeJson, fastTranscribeMultiPart } from './fastTranscription.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(helmet());
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.post('/callback', (req, res) => {
    console.log('Received callback with data: ', req.body);
    res.json({ message: 'success' });
});

app.post('/fastTranscribeMultiPart', fastTranscribeMultiPart)

app.post('/fastTranscribeJson', fastTranscribeJson)

app.listen(port, () => {
    console.log(`Server running at Port ${port}`);
});