const redis = require('redis');

module.exports = isProduction => {
    class ProductonCacheEngine {
        constructor() {
            this.client = redis.createClient({ url: process.env.REDIS_URL });
        }

        setKey(key, value) {
            return this.client.set(key, value, 'EX', 60 * 60 * 24 * 2);
        }

        deleteKey(key) {
            return this.client.del(key);
        }

        async getKey(key) {
            return new Promise(resolve => {
                this.client.get(key, (err, reply) => {
                    resolve(err ? null : reply);
                });
            });
        }

        async hasKey(key) {
            return new Promise(resolve => {
                this.client.exists(key, (err, reply) => {
                    resolve(err ? false : Boolean(reply));
                });
            });
        }
    };

    class DevelopmentCacheEngine {
        constructor() {
            this.client = new Map();
        }

        setKey(key, value) {
            return this.client.set(key, value);
        }

        deleteKey(key) {
            return this.client.delete(key);
        }

        async getKey(key) {
            return Promise.resolve(this.client.get(key));
        }

        async hasKey(key) {
            return Promise.resolve(this.client.has(key));
        }
    };

    return isProduction ? new ProductonCacheEngine() : new DevelopmentCacheEngine();
};
