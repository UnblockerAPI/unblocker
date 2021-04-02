const request = require("request");

function checkAvailability(url) {
    return new Promise(resolve => {
      let r = request({
        method: "GET",
        uri: url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3563.0 Safari/537.36"
        }
      });

      r.on("response", response => {
        r.abort();

        if (String(response.statusCode).match(/^(4|5)\d{2}$/)) {
          return resolve({ isOk: false, headers: null });
        }

        return resolve({ isOk: true, headers: response.headers });
      });

      r.on("error", err => {
        r.abort();
        return resolve({ isOk: false, headers: null });
      });
    });
}

module.exports = async (req, res) => {
  try {
    let decodedUrl = Buffer.from(req.query.url, "base64").toString("ascii");

    if (/magnet:\?xt=urn:[a-z0-9]+:[a-zA-Z0-9]*/.test(decodedUrl)) {
      return res.redirect(
        `https://magnet-api.herokuapp.com/?url=${Buffer.from(
          decodedUrl
        ).toString("base64")}`
      );
    }

    let targetUrl = new URL(decodedUrl);
    let { isOk, headers } = await checkAvailability(targetUrl.href);
    if (!isOk) {
      return res
        .status(400)
        .json({ success: false, reason: "Non200StatusCode" });
    }

    let contentTypeHeaderExists = headers.hasOwnProperty("content-type");

    if (contentTypeHeaderExists) {
      let contentType = headers["content-type"];

      if (contentType.includes("text/html")) {
        return res.redirect(
          `https://pdf-render-api.herokuapp.com/?url=${Buffer.from(
            targetUrl.href
          ).toString("base64")}&display=true`
        );
      } else {
        return res.redirect(
          `https://download-stream-api.herokuapp.com/?url=${Buffer.from(
            targetUrl.href
          ).toString("base64")}`
        );
      }
    } else {
      return res.status(400).json({ success: false, reason: "NoValidHeaders" });
    }
  } catch (e) {
    return res.status(400).json({ success: false, reason: "InvalidURL" });
  }
}

