const fs = require('fs');
const pg = require('pg');
const os = require('os');
const cluster = require('cluster');
var jwt = require('jsonwebtoken');
require('dotenv').config();

/*
const httpsServer = new https.createServer({
         cert:fs.readFileSync('/etc/apache2/ssl/cert.pem'),
		 key:fs.readFileSync('/etc/apache2/ssl/cert.key')
});
*/

var config = {
  user: process.env.DB_USER,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: process.env.PORT,
  host: process.env.HOST
};
var connStr = `postgres://${config.user}:${config.password}@${config.host}/${config.database}`;


if (cluster.isMaster) {
  //если процесс в кластере - главный

  const client = new pg.Client(connStr); //делаем соединение с бд

  client.connect(async (err, client, done) => {
    if (err) console.log('err');else {
      client.on('notification', data => {
        //привязываемся к событию и слушаем
        //for(var worker_id in cluster.workers)//при получении сообщения рассылаем всем воркерам
        for (var worker_id in cluster.workers) cluster.workers[worker_id].send(data.payload);
      });
      for (var i = 0; i < 10; i++) cluster.fork(); //делаем 10 воркеров на каждый процесс	
    }
  });

  const query = client.query("LISTEN ws_event");
  cluster.on('exit', function (worker, code) {
    //если воркер умер, пересоздаем еще один
    console.log('child worker ' + worker.id + ' died');
    cluster.fork();
  });
} else if (cluster.isWorker) {
  var len = 0;
  var arr_ws = []; //каждый дочерний воркер имеет пул вебсокет-подключений
  var arr_ws_admin = [];
  //const wss = new WebSocketServer.Server({
  //	port:port

  //});//и слушает порт, который был передан оновному процессу

  process.on('message', function (data) {
    try {
      var _arr_ws$message$idc;
      var message = JSON.parse(data);
      (_arr_ws$message$idc = arr_ws[message.idc]) === null || _arr_ws$message$idc === void 0 ? void 0 : _arr_ws$message$idc.forEach(ws => ws.send(data));
    } catch (err) {
      //	console.log(err);
      //console.log(data);
    }
    ;
  });
  process.on('error', function (data) {
    console.log(data);
  });
  console.log('create child worker  ' + cluster.worker.id);
  const port = Number(process.argv[2]);
  this.open = 0;
  var wss = require('uWebSockets.js').App({}).ws('/*', {
    upgrade: (response, request, context) => {
      var _request$getHeader;
      var arr_cookie = [];
      var wsInfo = {};
      (_request$getHeader = request.getHeader('cookie')) === null || _request$getHeader === void 0 ? void 0 : _request$getHeader.split(';').map(cookie => {
        var _c$, _c$2;
        var c = cookie.split('=');
        arr_cookie[(_c$ = c[0]) === null || _c$ === void 0 ? void 0 : _c$.trim()] = (_c$2 = c[1]) === null || _c$2 === void 0 ? void 0 : _c$2.trim();
      });
      if (arr_cookie['ws_token'] != undefined) {
        jwt.verify(arr_cookie['ws_token'], 'secret_key', function (err, decoded) {
          if (decoded != undefined) {
            wsInfo.id_user = Number(decoded.id);
            wsInfo.isAlive = true;
            wsInfo.role = decoded.role;
            response.upgrade(
            // upgrade to websocket
            wsInfo,
            // 1st argument sets which properties to pass to ws object, in this case ip address
            request.getHeader('sec-websocket-key'), request.getHeader('sec-websocket-protocol'), request.getHeader('sec-websocket-extensions'),
            // 3 headers are used to setup websocket
            context // also used to setup websocket
            );
          } else {
            console.log('fast close');
            response.end();
          }
        });
      } else {
        console.log('not ws');
        console.log(arr_cookie);
        response.end();
      }
    },
    pong: ws => {
      ws.isAlive = true;
    },
    ping: ws => {
      ws.isAlive = false;
    },
    open: (ws, request) => {
      if (ws.id_user) {
        var _arr_ws$ws$id_user$le, _arr_ws$ws$id_user;
        if (arr_ws[ws.id_user] == undefined) arr_ws[ws.id_user] = [ws];else arr_ws[ws.id_user].push(ws);
        len++;
        ws.isClose = false;
        console.log('id:' + ws.id_user + ' length:' + ((_arr_ws$ws$id_user$le = (_arr_ws$ws$id_user = arr_ws[ws.id_user]) === null || _arr_ws$ws$id_user === void 0 ? void 0 : _arr_ws$ws$id_user.length) !== null && _arr_ws$ws$id_user$le !== void 0 ? _arr_ws$ws$id_user$le : 0) + ' in cluster:' + cluster.worker.id);
      } else {
        ws.end();
      }
    },
    message: (client, message /*, isBinary*/) => {},
    drain: client => {
      console.log('drain', client, client.getBufferedAmount());
    },
    close: (ws, code, message) => {
      ws.isClose = true;
      ws.isAlive = false;
    }
  }).listen(port, ws => {
    if (ws) console.log(`Listening to port ${port}`);else console.log('Not listening');
  });
  function clearWSStack(stack) {
    var clearPool = true;
    setInterval(() => {
      //console.log('start clear');
      if (clearPool) {
        clearPool = false;
        var keys = Object.keys(stack);
        var start_key = 0;
        var end_key = keys.length;
        (function cycleClearPool(key, _stack$key) {
          var reIndex = false;
          (_stack$key = stack[key]) === null || _stack$key === void 0 ? void 0 : _stack$key.forEach((ws, i) => {
            if (!ws.isAlive) {
              if (!ws.isClose) ws.close();
              delete stack[key][i];
              reIndex = true;
              console.log('delete client');
            }
          });
          if (reIndex == true) stack[key] = stack[key].filter(ws => {
            if (ws != undefined) return ws;
          });
          if (start_key < end_key) setTimeout(() => cycleClearPool(keys[++start_key]), 0);else clearPool = true;
        })(keys[start_key]);
        /*	
        wss.clients.forEach(ws=>{
        	if(!ws.isAlive) 
        	        ws.terminate();
        	        else {
        				console.log('z');
        	        ws.ping();
        	        ws.isAlive = false;
        		}
        });
        */
        //console.log('end clear');
        //console.log(process.memoryUsage());
      }
    }, 10000);
  }
  clearWSStack(arr_ws);
  clearWSStack(arr_ws_admin);
}
//# sourceMappingURL=ws.js.map