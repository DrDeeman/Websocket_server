const port = process.argv[2];//получаем порт на котором запущен сервер вебсокет
const fs = require('fs');
const WebSocketServer = require('ws');
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
	user:process.env.DB_USER,
	database:process.env.DATABASE,
	password:process.env.PASSWORD,
	port:process.env.PORT,
	host:process.env.HOST
};
	var connStr = `postgres://${config.user}:${config.password}@${config.host}/${config.database}`;

	


if(cluster.isMaster){//если процесс в кластере - главный

	const client = new pg.Client(connStr); //делаем соединение с бд


client.connect(async(err,client,done)=>{
	if(err)
	console.log('err');
	else
	{
	

client.on('notification',(data)=>{//привязываемся к событию и слушаем
	for(var worker_id in cluster.workers){//при получении сообщения рассылаем всем воркерам
	cluster.workers[worker_id].send(data.payload);
}
		});
		
	for(var i=0; i<10;i++)
 cluster.fork();//делаем 10 воркеров на каждый процесс
 

	
}
});

const query = client.query("LISTEN ws_event");

	
	cluster.on('exit',function(worker,code){//если воркер умер, пересоздаем еще один
		console.log('child worker '+worker.id+' died');
		cluster.fork();
	});
	
	console.log("The WebSocket server is running on port "+port);
	
}else if(cluster.isWorker){
	var len = 0;
	var arr_ws = [];//каждый дочерний воркер имеет пул вебсокет-подключений
	var arr_ws_admin = [];
	const wss = new WebSocketServer.Server({
		port:port
		
	});//и слушает порт, который был передан оновному процессу
	
	process.on('message',function(data){
		try{
			
		var message = JSON.parse(data);
	arr_ws[message.idc]?.forEach(ws=>ws.send(data));
	//arr_ws_admin[message.ida]?.forEach(ws=>ws.send(data));
		}catch(err){
			
		};
	});
	
	process.on('error',function(data){
		console.log('error');
	});
	
console.log('create child worker  '+cluster.worker.id);

  wss.on("connection", (ws,request,resp) => {

	  console.log('client connect in '+port+' in worker '+cluster.worker.id);


    ws.on("message", data => {
        console.log(`Client has sent us: ${data}`)
    });
    

    ws.on("close", (data) => {
        console.log("the client has disconnected");
    });

    ws.on('error', function () {
        console.log("Some Error occurred")
    });
    

	var arr_cookie = [];
	
    request.headers?.cookie?.split(';').map(cookie=>{
      var c = cookie.split('=');
	  arr_cookie[c[0].trim()] = c[1].trim();
	});


if(arr_cookie['ws_token']!=undefined){

	jwt.verify(arr_cookie['ws_token'],'secret_key',function(err,decoded){
		if(decoded!=undefined){
			
			ws.id_user = decoded.id; 
				ws.isAlive = true;
	          ws.on('pong',function(){
		            this.isAlive = true;
               	});
               
				var arr;
				switch(decoded.role){
					case 'ROLE_USER':
						arr = arr_ws;
						break;

						case 'ROLE_ADMIN':
						arr = arr_ws_admin;
						break;
				}
               	 if(arr[decoded.id]==undefined)
               	 arr[decoded.id] = [ws];
               	 else
               	 arr[decoded.id].push(ws);
               	 len++;
				 console.log(decoded.id);
					console.log('set ws');
               
}
		   else 
		   ws.close();  
		});
}
else
ws.close();

});

function clearWSStack(stack){
var clearPool = true;
setInterval(()=>{
	//console.log('start clear');
if(clearPool){
	clearPool = false;
	var keys = Object.keys(stack);
	var start_key = 0;
	var end_key = keys.length;
	(function cycleClearPool(key){
		
		
		var reIndex = false;
		stack[key]?.forEach((ws,i)=>{
			
			if(!ws.isAlive){
	        ws.terminate();
	        delete stack[key][i];
	        reIndex = true;
			console.log('delete client');
	    
		}
	        else {
		
	        ws.ping();
	        ws.isAlive = false;
		}
		});
		
		if(reIndex==true)
		  stack[key] = stack[key].filter(ws=>{
			 
			  if(ws!=undefined)return ws;
			  });
            if(start_key<end_key)
			  setTimeout(()=>cycleClearPool(keys[++start_key]),0);
			  else 
			  clearPool = true;
			
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
},10000);

}



clearWSStack(arr_ws);
clearWSStack(arr_ws_admin);
}