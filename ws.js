const port = process.argv[2];//получаем порт на котором запущен сервер вебсокет
const WebSocketServer = require('ws');
const pg = require('pg');
const os = require('os');
const cluster = require('cluster');
var jwt = require('jsonwebtoken');
var workers_id = [];






var config = {
	user:'ruglonass',
	database:'ruglonass',
	password:'Trn8ksBpPEz',
	port:5432,
	host:'127.0.0.1'};
	var connStr = `postgres://${config.user}:${config.password}@${config.host}/${config.database}`;

	


if(cluster.isMaster){//если процесс в кластере - главный

	const client = new pg.Client(connStr); //делаем соединение с бд


client.connect((err,client,done)=>{
	if(err)
	console.log('err');
	else
	{
		console.log('connx');
	
client.on('notification',(data)=>{//привязываемся к событию и слушаем
	for(var worker_id in cluster.workers){//при получении сообщения рассылаем всем воркерам
		console.log(worker_id);
	cluster.workers[worker_id].send(data.payload);
}
		});
		console.log('main worker');
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
	const wss = new WebSocketServer.Server({port:port});//и слушает порт, который был передан оновному процессу
	
	process.on('message',function(data){
		var message = JSON.parse(data);

	arr_ws[message.id].forEach(ws=>ws.send(data));
	});
	
	process.on('error',function(data){
		console.log(data);
	});
	
console.log('create child worker  '+cluster.worker.id);

  wss.on("connection", (ws,request,resp) => {

	  console.log('client connect in '+port+' in worker '+cluster.worker.id);


    ws.on("message", data => {
        console.log(`Client has sent us: ${data}`)
    });
    

    ws.on("close", (data) => {
        console.log("the client has disconnected");
        console.log(data);
    });

    ws.on('error', function () {
        console.log("Some Error occurred")
    });
    

	var arr_cookie = [];

    request.headers?.cookie?.split(';').map(cookie=>{
      var c = cookie.split('=');
	  arr_cookie[c[0].trim()] = c[1].trim();
	});

	console.log(arr_cookie);
if(arr_cookie['ws_token']!=undefined){

	jwt.verify(arr_cookie['ws_token'],'secret_key',function(err,decoded){
		if(decoded!=undefined){
			
			ws.id_user = decoded.id; 
				ws.isAlive = true;
	          ws.on('pong',function(){
		            this.isAlive = true;
               	});
              
               	 if(arr_ws[decoded.id]==undefined)
               	 arr_ws[decoded.id] = [ws];
               	 else
               	 arr_ws[decoded.id].push(ws);
               	 len++;
					console.log('set ws');
               
}
		   else 
		   ws.close();  
		});
}
else
ws.close();

});


setInterval(()=>{

	arr_ws.forEach((arr,index)=>{
		
		var reIndex = false;
		arr.forEach((ws,i)=>{
			
			if(!ws.isAlive){
	        ws.terminate();
	        delete arr[i];
	        reIndex = true;
	    
		}
	        else {
		
	        ws.ping();
	        ws.isAlive = false;
		}
		});
		
		if(reIndex==true)
		  arr_ws[index] = arr.filter(ws=>{
			 
			  if(ws!=undefined)return ws;
			  });
	});
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

console.log(process.memoryUsage());

console.log(arr_ws[100]?.length);
},10000);

}



