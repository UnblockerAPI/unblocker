const express = require('express');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');


let isProduction = process.env.NODE_ENV === 'production';
let PORT = isProduction ? '/tmp/nginx.socket' : 8080;
let callbackFn = () => {
    if (isProduction) {
        fs.closeSync(fs.openSync('/tmp/app-initialized', 'w'));
    }

    console.log(`Listening on ${PORT}`);
};


const utils = require('./modules/utils');


const app = express();
app.enable("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use('/static', express.static(path.join(process.cwd(), 'static')));

app.get('/', async (req, res) => {
    if (!req.query.url) {
        return res.status(200).sendFile(path.join(process.cwd(), 'templates', 'index.html'));
    }

    try {
        if (/magnet:\?xt=urn:[a-z0-9]+:[a-zA-Z0-9]*/.test(req.query.url)) {
            return res.redirect(`https://magnet-api.herokuapp.com/?url=${req.query.url}`);
        }

        let targetUrl = new URL(req.query.url);

        let { isOk, headers } = await utils.checkAvailability({ url: targetUrl.href });

        if (!isOk) {
            return res.status(400).json({ success: false, reason: "Non200StatusCode" });
        }

        let contentTypeHeaderExists = headers.hasOwnProperty('content-type');

        if (contentTypeHeaderExists) {
            let contentType = headers["content-type"];

            if (contentType.includes("text/html")) {
                return res.redirect(`https://pdf-render-api.herokuapp.com/?url=${targetUrl.href}&display=true`);

            } else {
                return res.redirect(`https://download-stream-api.herokuapp.com/?url=${targetUrl.href}`);
            }

        } else {
            return res.status(400).json({ success: false, reason: "NoValidHeaders" });
        }

    } catch (e) {
        return res.status(400).json({ success: false, reason: "InvalidURL" });
    }
});

app.listen(PORT, callbackFn);
