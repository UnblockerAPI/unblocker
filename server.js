const express = require('express');
const path = require('path');
const helmet = require('helmet');
const shrinkRay = require('shrink-ray-current');
const puppeteer = require('puppeteer');

var PORT = process.env.PORT || 8080;
var RENDER_CACHE = new Map();

if (process.env.NODE_ENV === 'production') {
    var linkBase = "https://unblocker-webapp.herokuapp.com";

} else {
    var linkBase = `http://127.0.0.1:${PORT}`;
}

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
            '--allow-file-access-from-files',
            '--allow-file-access', 
            '--allow-cross-origin-auth-prompt',
            '--disable-web-security'
        ],
        headless: true
    });

    var page = await browser.newPage();
    page.on('dialog', async (dialog) => dialog.dismiss());

    try {
        await page.goto(url, { waitUntil: 'load' });

        await page.evaluate(({ linkBase, url }) => {
            var links = document.querySelectorAll('a[href]');
            
            for (let i = 0; i < links.length; i++) {
                if (links[i].href.match(/^(?:https?|\/)/)) {
                    links[i].href = `${linkBase}?url=${new URL(links[i].href, url).href}`;
                }
            }
    
            var images = document.querySelectorAll('img[src]');
    
            for (let i = 0; i < images.length; i++) {
                let resUrl = new URL(images[i].src, url).href;
    
                fetch(resUrl).then((response) => {
                    return response.blob();
                }).then((blob) => {
                    let reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        images[i].src = reader.result;
                    } 
                });
            }
    
            var js = document.querySelectorAll('script[src]');
    
            for (let i = 0; i < js.length; i++) {
                let resUrl = new URL(js[i].src, url).href;
    
                fetch(resUrl).then((response) => {
                    return response.text();
                }).then((contents) => {
                    let script = document.createElement('script');
                    script.type = 'application/javascript';
                    script.innerHTML = contents;
    
                    js[i].parentNode.replaceChild(script, js[i]);
                });
            }
    
            var css = document.querySelectorAll('link[rel="stylesheet"]');
    
            for (let i = 0; i < css.length; i++) {
                let resUrl = new URL(css[i].href, url).href;
    
                fetch(resUrl).then((response) => {
                    return response.text();
                }).then((contents) => {
                    let style = document.createElement('style');
                    style.type = 'text/css';
                    style.innerHTML = contents;
    
                    css[i].parentNode.replaceChild(style, css[i]);
                });
            }
    
        }, { linkBase, url });

    } catch (err) {
        return {html: "<h1>Failed to load</h1>", ttRenderMs: 0};
    }

    var html = await page.content();
    await browser.close();

    var ttRenderMs = Date.now() - start;
    console.info(`Page rendered in: ${ttRenderMs} ms.`);

    RENDER_CACHE.set(url, html);

    return {html, ttRenderMs};
};

const app = express();
app.use(helmet());
app.use(shrinkRay());
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

app.listen(PORT, () => {
    console.log(`Listening on ${PORT}`);
});
