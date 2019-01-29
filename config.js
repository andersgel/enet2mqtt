const pkg = require('./package.json');

module.exports = require('yargs')
    .env('ENET2MQTT')
    .usage(pkg.name + ' ' + pkg.version + '\n' + pkg.description + '\n\nUsage: $0 [options]')
    .describe('verbosity', 'possible values: "error", "warn", "info", "debug"')
    .describe('name', 'instance name. used as mqtt client id and as prefix for connected topic')
    .describe('mqtt-url', 'mqtt broker url.')
    .describe('help', 'show help')
    .describe('channelArray', 'Array with channels to monitor, [ch1, ch2, ..])
    .describe('mqtt-retain', 'enable/disable retain flag for mqtt messages')
    .alias({
        h: 'help',
        m: 'mqtt-url',
        n: 'name',
        v: 'verbosity',
        c: 'channelArray'
    })
    .boolean('mqtt-retain')
    .default({
        'mqtt-url': 'mqtt://192.168.10.6',
        name: 'enet',
        verbosity: 'info',
        'mqtt-retain': true,
        'channelArray': [16, 17, 18, 19]
    })
    .version()
    .help('help')
    .argv;
