require('dotenv').config();

const fs = require('fs');
const childProcess = require('child_process');
const express = require('express');
const YAML = require('yaml');

const auth = process.env.ZYTEKARON_AUTH;
const port = process.env.PORT || 8080;

if (!auth) {
    // todo apply to notifications/logger
    throw new Error('No environment variable for authentication');
}

const app = express();
const services = new Map();

const file = fs.readFileSync('./services.yml').toString();
const data = YAML.parse(file);
for (const [name, run] of Object.entries(data)) {
    services.set(name, run);
}

app.use((req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization) {
        return res.status(403).send({ success: false, error: 'forbidden' });
    }
    if (authorization !== auth) {
        return res.status(401).send({ success: false, error: 'unauthorized' });
    }
    next();
});

app.get('/', (req, res) => {
    res.status(200).send({
        success: true,
        data: Array.from(services.keys())
    });
});

app.get('/restart/:name', async (req, res) => {
    const { name } = req.params;
    const commands = services.get(name);
    if (!commands) {
        return res.status(400).send({ success: false, error: 'invalid service name' });
    }

    const result = await exec(commands);

    res.status(200).send({
        success: true,
        data: result.replace(/\r?\n/g, '\n')
    });
});

function exec(commands) {
    return new Promise(resolve => {
        const buf = [];
        const child = childProcess.spawn(commands.join(' && '), {
            shell: true
        });

        child.stdout.on('data', data => {
            buf.push(data.toString());
        });

        child.stderr.on('data', data => {
            buf.push(data.toString());
        });

        child.on('exit', exitCode => {
            buf.push('Exited with code: ');
            buf.push(exitCode);
            resolve(buf.join(''));
        });
    });
}

app.listen(port, () => console.log('Listening on ' + port));
