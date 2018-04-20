const pm2 = require('pm2');

var instances = process.env.WEB_CONCURRENCY || -1;
var maxMemory = process.env.WEB_MEMORY || 512;
var options = {
  name: 'server',
  script: 'server.js',
  exec_mode: 'cluster',
  instances: instances,
  max_restarts: Infinity,
  min_uptime: 300,
  node_args: ["--optimize_for_size", "--max_old_space_size=460", "--gc_interval=100"],
  max_memory_restart: `${maxMemory}M`,
};

pm2.connect((err) => {
  if (err) {
    console.error(err);
    process.exit(2);
  }

  pm2.start(options, (err) => {
    if (err) {
      return console.error('Error while launching applications', err.stack || err);
    }

    console.log(`[PM2] Started ${instances} instances of ${options.script}. Memory limit: ${maxMemory}`)

    pm2.launchBus((err, bus) => {
      console.log('[PM2] Log streaming started\n');

      bus.on('log:out', (packet) => {
        console.log('[App:%s] %s', packet.process.name, packet.data);
      });

      bus.on('log:err', (packet) => {
        console.error('[App:%s][ERR] %s', packet.process.name, packet.data);
      });
    });
  });

  process.on('SIGINT', () => {
      pm2.stop((err) => {
        process.exit(err ? 1 : 0);
      });
  });
});
