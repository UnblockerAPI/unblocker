const request = require("request");

module.exports = {
  checkAvailability(url) {
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
};
