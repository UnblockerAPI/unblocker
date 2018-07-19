const request = require('request');


module.exports = {
    checkAvailability({ url }) {
        return new Promise(resolve => {
            request({
                method: 'HEAD',
                uri: url
            },
            (err, httpResponse, body) => {
                if (err || httpResponse.statusCode !== 200) {
                    return resolve({ isOk: false, headers: null });
                }

                return resolve({ isOk: true, headers: httpResponse.headers });
            });
        });
    }
}
