const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const request = require('request');
const WebTorrent = require('webtorrent');
const mime = require('mime-types');
require('events').EventEmitter.prototype._maxListeners = Infinity;


var isProduction = process.env.NODE_ENV === 'production';
var linkBase = isProduction ? 'https://unblocker-webapp.herokuapp.com' : `http://127.0.0.1:${PORT}`;
var PORT = isProduction ? '/tmp/nginx.socket' : 8080;
var callbackFn = () => {
    if (isProduction) {
        fs.closeSync(fs.openSync('/tmp/app-initialized', 'w'));
    }

    console.log(`Listening on ${PORT}`);
};


const RENDER_CACHE = require('./modules/cacheEngine')(isProduction);
const render = require('./modules/render');


const app = express();
app.enable("trust proxy", 1);
app.use(helmet());
app.use(compression());
app.use('/static', express.static(path.join(process.cwd(), 'static')));

app.get('/', async (req, res) => {
    try {
        let targetUrl = new URL(req.query.url);

        if (/magnet:\?xt=urn:[a-z0-9]+:[a-zA-Z0-9]*/.test(targetUrl.href)) {
            let torrentClient = new WebTorrent();

            let { error, torrentFile } = await new Promise(resolve => {
                torrentClient.on('error', () => {
                    resolve({ error: true, torrentFile: null });
                });

                torrentClient.on('torrent', torrentObject => {
                    torrentClient.destroy();
                    resolve({ error: false, torrentFile: torrentObject.torrentFile });
                });

                torrentClient.add(targetUrl.href);
            });

            if (error) {
                let responseHTML = Buffer.from("<h1>Failed to convert magnet link.</h1>");

                res.status(200);
                res.set({
                    'Content-Type': 'text/html',
                    'Content-Length': Buffer.byteLength(responseHTML)
                });

                return res.send(responseHTML);
            }

            res.status(200);
            res.set({
                'Content-Type': 'application/x-bittorrent',
                'Content-Length': Buffer.byteLength(torrentFile),
                'Content-Disposition': `attachment; filename="${'download.' + mime.extension('application/x-bittorrent')}"`
            });

            return res.send(torrentFile);
        }

        let keyExists = await RENDER_CACHE.hasKey(targetUrl.href);

        if (keyExists) {
            let { entryStillValid, entry } = await new Promise(async resolve => {
                let entry = await RENDER_CACHE.getKey(targetUrl.href);

                if (!entry) {
                    RENDER_CACHE.deleteKey(targetUrl.href);
                    return resolve({ entryStillValid: false, entry: null });
                }

                request({
                    method: 'HEAD',
                    uri: entry
                },
                (err, httpResponse, body) => {
                    if (err || httpResponse.statusCode !== 200) {
                        RENDER_CACHE.deleteKey(targetUrl.href);
                        return resolve({ entryStillValid: false, entry: null });
                    }

                    return resolve({ entryStillValid: true, entry: entry });
                });
            });

            if (entryStillValid) {
                return res.redirect(`/view?pdf=${entry}`);
            }
        }

        let { isOk, headers } = await new Promise(resolve => {
            request({
                method: 'HEAD',
                uri: targetUrl.href
            },
            (err, httpResponse, body) => {
                if (err || httpResponse.statusCode !== 200) {
                    return resolve({ isOk: false, headers: null });
                }

                return resolve({ isOk: true, headers: httpResponse.headers });
            });
        });

        if (!isOk) {
            let responseHTML = Buffer.from("<h1>Server returned non-200 status code.</h1>");

            res.status(200);
            res.set({
                'Content-Type': 'text/html',
                'Content-Length': Buffer.byteLength(responseHTML)
            });

            return res.send(responseHTML);
        }

        let contentTypeHeaderExists = headers.hasOwnProperty('content-type');
        let contentLengthHeaderExists = headers.hasOwnProperty('content-length');

        if (contentTypeHeaderExists && contentLengthHeaderExists) {
            let contentType = headers["content-type"];
            let contentLength = headers["content-length"];

            if (contentType !== "text/html") {
                res.status(200);
                res.set({
                    'Content-Type': contentType,
                    'Content-Length': contentLength,
                    'Content-Disposition': `attachment; filename=${'download.' + mime.extension(contentType)}`
                });

                return request({ method: 'GET', uri: targetUrl.href }).pipe(res);
            }
        }

        let shouldScroll = (req.query.shouldScroll && /^true$/.test(req.query.shouldScroll));
        let { pdfDestination } = await render({ url: targetUrl.href, linkBase: linkBase, shouldScroll: shouldScroll });

        if (pdfDestination) {
            let formPayload = {
                'files[]': fs.createReadStream(pdfDestination)
            };

            let { failed, uploadResult } = await new Promise(resolve => {
                    request({
                        method: 'POST',
                        uri: 'https://rokket.space/upload',
                        formData: formPayload
                    },
                    (err, httpResponse, body) => {
                        if (err || httpResponse.statusCode !== 200) {
                            return resolve({
                                failed: true,
                                uploadResult: {
                                    success: false
                                }
                            });
                        }

                        return resolve({
                            failed: false,
                            uploadResult: JSON.parse(body)
                        });
                    });
            });

            if (!failed && uploadResult.success) {
                fs.unlinkSync(pdfDestination);

                let uploadUrl = uploadResult.files[0].url;
                RENDER_CACHE.setKey(targetUrl.href, uploadUrl);

                return res.redirect(`/view?pdf=${uploadUrl}`);

            } else {
                fs.unlinkSync(pdfDestination);

                let responseHTML = Buffer.from("<h1>Failed to upload result.</h1>");

                res.status(200);
                res.set({
                    'Content-Type': 'text/html',
                    'Content-Length': Buffer.byteLength(responseHTML)
                });

                return res.send(responseHTML);
            }

        } else {
            let responseHTML = Buffer.from("<h1>Failed to load page.</h1>");

            res.status(200);
            res.set({
                'Content-Type': 'text/html',
                'Content-Length': Buffer.byteLength(responseHTML)
            });

            return res.send(responseHTML);
        }

    } catch (err) {
        return res.sendFile(path.join(process.cwd(), 'templates', 'index.html'));
    }
});

app.get('/view', (req, res) => {
    if (req.query.pdf) {
        return res.sendFile(path.join(process.cwd(), 'templates', 'view.html'));
    }

    let responseHTML = Buffer.from("<h1>You shall not pass!!1</h1>");

    res.status(200);
    res.set({
        'Content-Type': 'text/html',
        'Content-Length': Buffer.byteLength(responseHTML)
    });

    return res.send(responseHTML);
});

app.listen(PORT, callbackFn);

process.on('SIGINT', async () => {
    await pool.drain();
    await pool.clear();
    process.exit(0);
});
