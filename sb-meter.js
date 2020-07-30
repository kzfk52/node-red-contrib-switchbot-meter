module.exports = function (RED) {
  const Switchbot = require('node-switchbot');

  function sbMeter(n) {
    RED.nodes.createNode(this, n);

    this.log('call sbMeter');

    // startScanチェック間隔
    this.loop_ms = 15 * 1000;

    // args
    this.name = n.name;
    this.macaddr = n.macaddress;

    var node = this;
    node.is_start_scan = false;

    if (typeof node.switchbot === 'undefined') {
      // init
      node.log('new Switchbot Instance');

      const switchbot = new Switchbot();
      node.switchbot = switchbot;

      node.status({ fill: 'yellow', shape: 'dot', text: 'init...' });

      // callback set //
      // ref: https://qiita.com/warpzone/items/11ec9bef21f5b965bce3
      // SwitchBot 温湿度計の情報は、Advertisement パケットのうち、
      // UUID: 0x0d00(00000d00 - 0000 - 1000 - 8000 - 00805f9b34fb) の
      // 6オクテットの Service Data として およそ 2 秒間隔で送信されています。
      node.log('set onadvertisement callback');
      switchbot.onadvertisement = (ad) => {
        node.debug('advertisement from bot meter: ' + ad.id);
        node.status({ fill: 'green', shape: 'dot', text: 'advertisementing' });

        // console.log(ad);

        const msg = {
          meter: {
            macaddress: ad.address,
            rssi: ad.rssi,
            temperature: ad.serviceData.temperature.c,
            temperature_f: ad.serviceData.temperature.f,
            humidity: ad.serviceData.humidity,
            battery: ad.serviceData.battery,
          },
        };
        node.send(msg);

        // fill: red, green, yellow, blue, grey
        // shape: ring, dot

        node.status({ fill: 'blue', shape: 'dot', text: 'Scan Wait...' });
        // node.done();
      };

      // scan_loop make and start
      node.log('set scanLoop');
      node.loop = setInterval(function () {
        if (!node.is_start_scan) {
          node.log('startScan bot meter: ' + node.macaddr);
          // Start to scan advertising packets
          switchbot
            .startScan({
              id: node.macaddr,
            })
            .then(() => {
              node.is_start_scan = true;
              // Wait for 30 seconds
              //return switchbot.wait(30000);
            })
            .catch((error) => {
              node.is_start_scan = false;
              node.error(error, error);
              node.status({ fill: 'red', shape: 'dot', text: 'error' });
            });
          node.status({ fill: 'blue', shape: 'ring', text: 'startScan...' });
        }
      }, node.loop_ms);
    } else {
      // インスタンス生成済の場合
      node.log('reconfig', node.macaddr);
      if (node.switchbot) {
        node.status({ fill: 'red', shape: 'ring', text: 'disconnected' });
        node.switchbot.stopScan();
      }
      node.is_start_scan = false;

      //enable(node);
    }

    // node close時の処理
    this.on('close', function () {
      node.log('on close: ' + node.macaddr);
      if (node.loop) {
        node.log('on close: clear interval');
        clearInterval(node.loop);
      }
      if (node.switchbot) {
        node.log('on close: stopScan');
        node.switchbot.stopScan();
      }
      node.status({});
      node.is_start_scan = false;
    });
  }

  RED.nodes.registerType('sbotMeter', sbMeter);
};
