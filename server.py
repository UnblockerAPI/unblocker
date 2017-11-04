from requests import Session
from flask import Flask, render_template, make_response, send_from_directory, request, redirect, jsonify
from flask_sslify import SSLify
from bs4 import BeautifulSoup
from urllib.parse import urlparse
from os import environ, chdir, unlink
from os.path import dirname, abspath
from random import choice
from shutil import copyfileobj
from re import match
from flask_wtf.csrf import CSRFProtect
from cachecontrol import CacheControl
from base64 import b64encode


debug = False

app = Flask(__name__, template_folder='templates')
app.config['SECRET_KEY'] = environ.get("SECRET_KEY", "".join(choice("abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)") for _ in range(50)))

csrf = CSRFProtect(app)

if not debug:
    sslify = SSLify(app)


@app.route('/', methods=['GET', 'POST'])
def main():
    if request.method == 'POST':
        template_string = None
        url = request.form.get('link_in', '')

        if match(r"http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", url):
            s = CacheControl(Session())

            s.headers.update({'Upgrade-Insecure-Requests': '1',
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
                              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                              'DNT': '1',
                              'Accept-Encoding': 'gzip, deflate, br',
                              'Accept-Language': 'ru-RU,en-US;q=0.8,ru;q=0.6,en;q=0.4'})

            template_string = s.get(url).content
            domain = urlparse(url).netloc
            soup = BeautifulSoup(template_string, "lxml")

            imgs = [x for x in soup.findAll('img', {"src": True}) if urlparse(x['src']).netloc == domain]
            css = [x for x in soup.findAll('link', {'rel': 'stylesheet'}) if urlparse(x['href']).netloc == domain]
            jss = [x for x in soup.findAll('script', {"src": True}) if urlparse(x['src']).netloc == domain]

            img_links = [x['src'] for x in imgs]
            css_links = [x['href'] for x in css]
            js_links = [x['src'] for x in jss]

            css_data = []
            js_data = []

            for link in img_links:
                image_stream = s.get(link, stream=True)

                with open("./tmp/img.png", "wb") as png:
                    copyfileobj(image_stream.raw, png)

                b64_img = "data:image/png;base64," + b64encode(open("./tmp/img.png", 'rb').read()).decode("utf-8").strip("b")
                template_string = template_string.replace(link, b64_img)
                unlink("./tmp/img.png")

            for link in css_links:
                css_stream = s.get(link, stream=True)

                with open("./tmp/css.css", "wb") as css:
                    copyfileobj(css_stream.raw, css)

                with open("./tmp/css.css", "r") as css_text:
                    css_data.append(css_text.read())

                unlink('./tmp/css.css')

            for link in js_links:
                js_stream = s.get(link, stream=True)

                with open("./tmp/js.js", "wb") as js:
                    copyfileobj(js_stream.raw, js)

                with open("./tmp/js.js", "r") as js_text:
                    js_data.append(js_text.read())

                unlink('./tmp/js.js')

            for num, tag in enumerate(css):
                template_string = template_string.replace(str(tag), f"<style>{css_data[num]}</style>")

            for num, tag in enumerate(jss):
                template_string = template_string.replace(str(tag), f"<script>{js_data[num]}</script>")

            with open("./tmp/html.html", 'wb') as html:
                html.write(template_string)

            with open("./tmp/html.html", 'r') as html_r:
                template_string = html_r.read()

            unlink("./tmp/html.html")

            return template_string

        else:
            return jsonify("<input type='text' value='Invalid URL' name='link_out' autocomplete='off' />")

    response = make_response(render_template('index.html'))

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response


@app.route('/images/<path:path>', methods=['GET'])
def serve_images(path):
    return send_from_directory('static/images', path)


@app.route('/js/<path:path>', methods=['GET'])
def serve_js(path):
    return send_from_directory('static/js', path)


@app.route('/css/<path:path>', methods=['GET'])
def serve_css(path):
    return send_from_directory('static/css', path)


if __name__ == "__main__":
    chdir(dirname(abspath(__file__)))
    app.run(debug=debug, use_reloader=True)
