# -*- coding: utf-8 -*-

from base64 import b64encode
from os import environ, chdir, unlink
from os.path import dirname, abspath
from random import choice
from shutil import copyfileobj
from re import match
from flask import Flask, render_template, make_response, send_from_directory, request, redirect, jsonify
from flask_sslify import SSLify
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urlunparse
from flask_wtf.csrf import CSRFProtect
from requests import Session
from requests.exceptions import ConnectionError, InvalidSchema
from requests.adapters import HTTPAdapter
from cachecontrol import CacheControl
from whitenoise import WhiteNoise


debug = False

app = Flask(__name__, template_folder='templates')
app.config['SECRET_KEY'] = environ.get("SECRET_KEY", "".join(choice("abcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(-_=+)") for _ in range(50)))
app.wsgi_app = WhiteNoise(app.wsgi_app, root="static/")

if not debug:
    cache = Cache(app, config={'CACHE_TYPE': 'redis', 'CACHE_REDIS_URL': environ.get("REDIS_URL")})
    sslify = SSLify(app)
    csrf = CSRFProtect(app)


def get_data(url):
        if match(r"http[s]?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+", url):
            s = CacheControl(Session())
            s.mount('http://', HTTPAdapter(max_retries=5))
            s.mount('https://', HTTPAdapter(max_retries=5))

            s.headers.update({'Upgrade-Insecure-Requests': '1',
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
                              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                              'DNT': '1',
                              'Accept-Encoding': 'gzip, deflate, br',
                              'Accept-Language': 'ru-RU,en-US;q=0.8,ru;q=0.6,en;q=0.4'})

            try:
                response = s.get(url)

                if response.status_code != 200:
                    if debug:
                        print(response.status_code)

                    return jsonify("<input type='text' value='Connection error' name='link_out' autocomplete='off' />")

                else:
                    if debug:
                        print("Connection established.")

                content = response.text

            except ConnectionError:
                return jsonify("<input type='text' value='Connection error' name='link_out' autocomplete='off' />")

            protocol = urlparse(url).scheme
            base_path = urlparse(url).path
            domain = urlparse(url).netloc
            soup = BeautifulSoup(content, "html.parser")

            imgs = [x for x in soup.findAll('img', {"src": True})]
            css = [x for x in soup.findAll('link', {'rel': 'stylesheet'})]
            jss = [x for x in soup.findAll('script', {"src": True})]

            a = [x for x in soup.findAll('a', {'href': True})]

            if debug:
                print("Made contents list")

            img_links = [x['src'] for x in imgs]

            for num, link in enumerate(img_links):
                if link.startswith("//"):
                    img_links[num] = f"http://{link[2:]}"

            css_links = [x['href'] for x in css]

            for num, link in enumerate(css_links):
                if link.startswith("//"):
                    css_links[num] = f"http://{link[2:]}"

            js_links = [x['src'] for x in jss]

            for num, link in enumerate(js_links):
                if link.startswith("//"):
                    js_links[num] = f"http://{link[2:]}"

            a_links = [x['href'] for x in a]

            if debug:
                base = "http://127.0.0.1:5000"

            else:
                base = "https://unblocker-webapp.herokuapp.com"

            for num, link in enumerate(a_links):
                try:
                    if urlparse(link).scheme is not '' and urlparse(link).netloc is not '':
                        a_links[num] = f"{base}?url={link}"

                    elif urlparse(link).scheme is '' and urlparse(link).netloc is not '':
                        a_links[num] = f"{base}?url={protocol}://{urlunparse(urlparse(link))}"

                    else:
                        a_links[num] = f"{base}?url={protocol}://{domain}/{base_path.split('/')[:-1][-1]}/{link}"

                except IndexError:
                    continue

            img_data = []
            css_data = []
            js_data = []

            for link in img_links:
                if urlparse(link).path.startswith("/"):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path}"

                elif urlparse(link).path.startswith("."):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path[1:]}"

                else:
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}/{urlparse(link).path}"

                try:
                    image_stream = s.get(tmp_link, stream=True)

                except (ConnectionError, InvalidSchema):
                    continue

                with open("./tmp/img.png", "wb") as img_file:
                    copyfileobj(image_stream.raw, img_file)

                img_data.append("data:image/png;base64," + b64encode(open("./tmp/img.png", 'rb').read()).decode("utf-8", "ignore").strip("b"))
                unlink("./tmp/img.png")

            if debug:
                print("Got images")

            for link in css_links:
                if urlparse(link).path.startswith("/"):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path}"

                elif urlparse(link).path.startswith("."):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path[1:]}"

                else:
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}/{urlparse(link).path}"

                try:
                    css_stream = s.get(tmp_link, stream=True)

                except ConnectionError:
                    return jsonify("<input type='text' value='Connection error' name='link_out' autocomplete='off' />")

                with open("./tmp/css.css", "wb") as css_file:
                    css_stream.raw.decode_content = True
                    copyfileobj(css_stream.raw, css_file)

                with open("./tmp/css.css", "rb") as css_text:
                    css_data.append(css_text.read().decode('charmap', 'ignore').strip("b"))

                unlink('./tmp/css.css')

            if debug:
                print("Got CSSs")

            for link in js_links:
                if urlparse(link).path.startswith("/"):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path}"

                elif urlparse(link).path.startswith("."):
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}{urlparse(link).path[1:]}"

                else:
                    tmp_link = f"{urlparse(link).scheme if urlparse(link).scheme is not '' else protocol}://{urlparse(link).netloc if urlparse(link).netloc is not '' else domain}/{urlparse(link).path}"

                try:
                    js_stream = s.get(tmp_link, stream=True)

                except ConnectionError:
                    return jsonify("<input type='text' value='Connection error' name='link_out' autocomplete='off' />")

                with open("./tmp/js.js", "wb") as js_file:
                    js_stream.raw.decode_content = True
                    copyfileobj(js_stream.raw, js_file)

                with open("./tmp/js.js", "rb") as js_text:
                    js_data.append(js_text.read().decode('charmap', 'ignore').strip("b"))

                unlink('./tmp/js.js')

            if debug:
                print("Got JSs")

            tmp_template = str(soup)

            for num, tag in enumerate(css):
                if debug:
                    print("Replaced CSS tag: " + str(tag))

                tmp_template = tmp_template.replace(str(tag), f"<style>{css_data[num]}</style>")

            for num, tag in enumerate(jss):
                if debug:
                    print("Replaced JS tag: " + str(tag))

                tmp_template = tmp_template.replace(str(tag), f"<script>{js_data[num]}</script>")

            for num, tag in enumerate(imgs):
                if debug:
                    print("Replaced IMG tag: " + str(tag))

                try:
                    tmp_template = tmp_template.replace(str(tag), f"<img src={img_data[num]}></img>")

                except IndexError:
                    continue

            for num, tag in enumerate(a):
                if debug:
                    print("Replaced A tag: " + str(tag))

                tmp_template = tmp_template.replace(str(tag), f"<a href={a_links[num]}>{tag.text}</a>")

            if debug:
                print("Returning template...")

            return str(tmp_template)

        else:
            return jsonify("<input type='text' value='Invalid URL' name='link_out' autocomplete='off' />")


@app.route('/', methods=['GET', 'POST'])
def main():
    if request.method == 'POST':
        url = request.form.get('link_in', '')

        if url is not '':
            return get_data(url)

    else:
        if request.args.get('url', '') is not '':
            response = make_response(render_template('index.html', link_in=request.args.get('url', '')))

        else:
            response = make_response(render_template('index.html'))

    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000'
    return response


if __name__ == "__main__":
    chdir(dirname(abspath(__file__)))
    app.run(debug=debug, use_reloader=True)
