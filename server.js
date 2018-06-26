const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const puppeteer = require('puppeteer');
require('events').EventEmitter.prototype._maxListeners = 50;


if (process.env.NODE_ENV === 'production') {
    var PORT = '/tmp/nginx.socket';
    var linkBase = "https://unblocker-webapp.herokuapp.com";
    var callbackFn = () => {
        fs.closeSync(fs.openSync('/tmp/app-initialized', 'w'));
        console.log(`Listening on ${PORT}`);
    };

} else {
    var PORT = 8080;
    var linkBase = `http://127.0.0.1:${PORT}`;
    var callbackFn = () => {
        console.log(`Listening on ${PORT}`);
    };
}

var RENDER_CACHE = new Map();

const ssr = async (url) => {
    if (RENDER_CACHE.has(url)) {
        return {html: RENDER_CACHE.get(url), ttRenderMs: 0};
    }

    if (RENDER_CACHE.size > 5) {
        RENDER_CACHE.clear();
    }

    var start = Date.now();

    var browser = await puppeteer.launch({
        userDataDir: __dirname + '/tmp',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--allow-cross-origin-auth-prompt',
            '--disable-web-security'
        ],
        headless: true
    });

    var page = await browser.newPage();
    page.on('dialog', async dialog => await dialog.dismiss());
    page.setDefaultNavigationTimeout(15000);

    try {
        await page.goto(url, {waitUntil: 'load'});
        await Promise.all([
            page.waitForSelector('body'),
            page.waitForSelector('script[src]'),
            page.waitForSelector('link[rel="stylesheet"]')
        ]);

        await page.evaluate(async () => {
            await new Promise(resolve => {
                var js = document.querySelectorAll('script[src]');

                for (let i = 0; i < js.length; i++) {
                    try {
                        let resUrl = new URL(js[i].src, location.href).href;

                        fetch(resUrl).then((response) => {
                            return response.text();
                        }).then((contents) => {
                            let script = document.createElement('script');
                            script.type = 'application/javascript';
                            script.innerHTML = contents;

                            js[i].parentNode.replaceChild(script, js[i]);
                        });

                    } catch (err) {
                        continue;
                    }
                }

                resolve();
            });
        });

        await page.evaluate(async () => {
            await new Promise(resolve => {
                var css = document.querySelectorAll('link[rel="stylesheet"]');

                for (let i = 0; i < css.length; i++) {
                    try {
                        let resUrl = new URL(css[i].href, location.href).href;

                        fetch(resUrl).then((response) => {
                            return response.text();
                        }).then((contents) => {
                            let style = document.createElement('style');
                            style.type = 'text/css';
                            style.innerHTML = contents;

                            css[i].parentNode.replaceChild(style, css[i]);
                        });

                    } catch (err) {
                        continue;
                    }
                }

                resolve();
            });
        });

        await page.evaluate(async ({ linkBase }) => {
            await new Promise(resolve => {
                var links = document.querySelectorAll('a[href]');

                for (let i = 0; i < links.length; i++) {
                    try {
                        if (links[i].href.match(/^(?:https?|\/)/)) {
                            links[i].href = `${linkBase}?url=${new URL(links[i].href, location.href).href}`;
                        }

                    } catch (err) {
                        continue;
                    }
                }

                resolve();
            });

        }, { linkBase });

        await page.evaluate(async () => {
            await new Promise(resolve => {
                var images = document.querySelectorAll('img[src]');

                for (let i = 0; i < 8; i++) {
                    try {
                        let resUrl = new URL(images[i].src, location.href).href;

                        fetch(resUrl).then((response) => {
                            return response.blob();
                        }).then((blob) => {
                            let reader = new FileReader();
                            reader.readAsDataURL(blob);
                            reader.onloadend = () => {
                                images[i].src = reader.result;
                            }
                        });

                    } catch (err) {
                        continue;
                    }
                }

                resolve();
            });
        });

    } catch (err) {
        return {html: `<h1>Failed to load. <br> ${err}</h1>`, ttRenderMs: Date.now() - start};
    }

    var html = await page.content();
    await browser.close();

    var ttRenderMs = Date.now() - start;
    console.info(`Page rendered in: ${ttRenderMs} ms.`);

    RENDER_CACHE.set(url, html);

    return {html, ttRenderMs};
};

setTimeout(() => {
    const app = express();
    app.use(helmet());
    app.use(compression());
    app.use('/static', express.static(path.join(__dirname, 'static')));

    app.get('/', async (req, res) => {
        if (req.query.url && req.query.url.match(/http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/)) {
            let {html, ttRenderMs} = await ssr(req.query.url);
            res.set('Server-Timing', `Prerender;dur=${ttRenderMs};desc="Render time (ms)"`);
            res.set('Content-Type', 'text/html');
            return res.send(new Buffer(html));
        }

        return res.sendFile(path.join(__dirname, 'templates', 'index.html'));
    });

    app.listen(PORT, callbackFn);

}, 2000);
