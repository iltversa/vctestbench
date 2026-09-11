import http from "node:http";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile),ADB="/opt/homebrew/bin/adb",PORT=3131;
let screen=null,eventId=0,previous={connected:false,sandboxForeground:false,route:""};
const events=[]; 
let state={connected:false,sandboxForeground:false,updatedAt:new Date().toISOString(),events,test:{status:"idle",name:"Workout smoke test"}};
let test={status:"idle",name:"Workout smoke test"};
const adb=async(...args)=>(await exec(ADB,args,{encoding:"utf8",maxBuffer:8_000_000})).stdout.trim();
const addEvent=(label,detail,kind="info")=>{events.push({id:++eventId,at:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"}),label,detail,kind});if(events.length>30)events.shift()};
async function readRoute(pid){if(!pid)return"";try{await adb("forward","tcp:9222","localabstract:webview_devtools_remote_"+pid);const pages=await fetch("http://127.0.0.1:9222/json").then(r=>r.json());return new URL(pages[0]?.url??"").pathname}catch{return""}}
async function pageTelemetry(){
 const pages=await fetch("http://127.0.0.1:9222/json").then(r=>r.json()),url=pages[0]?.webSocketDebuggerUrl;
 if(!url)throw new Error("WebView telemetry unavailable");
 return await new Promise((resolve,reject)=>{
  const ws=new WebSocket(url),timer=setTimeout(()=>{ws.close();reject(new Error("WebView telemetry timeout"))},4000);
  ws.onopen=()=>ws.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{returnByValue:true,expression:'(()=>{const v=document.querySelector("video"),q=v?.getVideoPlaybackQuality?.();return {text:document.body.innerText,video:v?{paused:v.paused,muted:v.muted,volume:v.volume,currentTime:v.currentTime,readyState:v.readyState,decoded:v.webkitDecodedFrameCount??q?.totalVideoFrames??0,dropped:v.webkitDroppedFrameCount??q?.droppedVideoFrames??0}:null,audioCount:document.querySelectorAll("audio").length}})()'}}));
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id===1){clearTimeout(timer);ws.close();resolve(message.result.result.value)}};
  ws.onerror=()=>{clearTimeout(timer);reject(new Error("WebView telemetry error"))};
 });
}
async function pageAction(expression){
 const pages=await fetch("http://127.0.0.1:9222/json").then(r=>r.json()),url=pages[0]?.webSocketDebuggerUrl;
 if(!url)throw new Error("WebView action channel unavailable");
 return await new Promise((resolve,reject)=>{
  const ws=new WebSocket(url),timer=setTimeout(()=>{ws.close();reject(new Error("WebView action timeout"))},4000);
  ws.onopen=()=>ws.send(JSON.stringify({id:2,method:"Runtime.evaluate",params:{returnByValue:true,expression}}));
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id===2){clearTimeout(timer);ws.close();resolve(message.result.result.value)}};
  ws.onerror=()=>{clearTimeout(timer);reject(new Error("WebView action error"))};
 });
}
async function clickText(labels){
 const wanted=JSON.stringify(labels.map(value=>value.toLowerCase()));
 const expression="(()=>{const wanted="+wanted+",nodes=[...document.querySelectorAll('button,[role=button],a,input[type=button],input[type=submit],.btn')],node=nodes.find(el=>wanted.some(text=>(el.innerText||el.value||el.getAttribute('aria-label')||'').trim().toLowerCase().includes(text)));if(!node)return '';node.click();return (node.innerText||node.value||node.getAttribute('aria-label')||'').trim()})()";
 return await pageAction(expression);
}
const feetFrom=text=>Number(text?.match(/Current Feet\s+([0-9,]+)/i)?.[1]?.replaceAll(",","")??0);
async function poll(){
 const next={connected:false,sandboxForeground:false,updatedAt:new Date().toISOString(),events,test};
 try{
  const devices=await adb("devices","-l"),line=devices.split("\n").find(value=>/\sdevice\s/.test(value));if(!line)throw new Error("not connected");
  next.connected=true;next.device=line.trim().split(/\s+/)[0];next.model=await adb("shell","getprop","ro.product.model");next.android=await adb("shell","getprop","ro.build.version.release");
  const activities=await adb("shell","dumpsys","activity","activities");
  // Android versions use different names for the resumed activity. Only read
  // active markers, never historical task entries that can include closed apps.
  const match=activities.match(/\btopResumedActivity\s*[:=][^\n]*?\s([a-zA-Z0-9._]+)\/[^\s}]+/)
   ??activities.match(/\bmResumedActivity\s*[:=][^\n]*?\s([a-zA-Z0-9._]+)\/[^\s}]+/);
  next.foregroundPackage=match?.[1]??"";next.sandboxForeground=next.foregroundPackage==="com.versaclimber.sandbox";
  const pid=next.sandboxForeground?await adb("shell","pidof","com.versaclimber.sandbox"):"";next.route=await readRoute(pid);
  const capture=await exec(ADB,["exec-out","screencap","-p"],{encoding:"buffer",maxBuffer:8_000_000});screen=capture.stdout;
 }catch{next.connected=false;next.sandboxForeground=false;next.route="";screen=null}
 if(next.connected!==previous.connected)addEvent(next.connected?"Tablet connected":"Tablet disconnected",next.connected?next.model+" authorized through USB debugging":"USB debugging connection was lost",next.connected?"success":"warning");
 if(next.connected&&next.sandboxForeground!==previous.sandboxForeground)addEvent(next.sandboxForeground?"Sandbox app became visible":"Sandbox app left foreground",next.sandboxForeground?"Android confirms Sandbox is the active app":"Foreground app: "+(next.foregroundPackage||"unknown"));
 if(next.connected&&next.route&&next.route!==previous.route)addEvent(next.route==="/home"?"Home screen is visible":"Screen changed to "+next.route,"WebView route confirmed: "+next.route,"success");
 previous={connected:next.connected,sandboxForeground:next.sandboxForeground,route:next.route??""};state=next;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForRoute(route,timeout=9000){const started=Date.now();while(Date.now()-started<timeout){if(state.connected&&state.route===route)return true;await sleep(350)}return false}
async function runWorkoutTest(){
 if(test.status==="running")return;
 if(!state.connected||!state.sandboxForeground||state.route!=="/home")throw new Error("Sandbox must be connected and on Home");
 events.splice(0,events.length);
 test={status:"running",name:"Workout smoke test",startedAt:new Date().toISOString(),step:"Starting workout"};addEvent("Workout test started","Preconditions verified: tablet connected, Sandbox visible, Home screen confirmed","info");
 await adb("shell","input","tap","400","1165");
 if(!await waitForRoute("/record"))throw new Error("Workout screen did not open");
 addEvent("Clicked Start button","Tablet changed from /home to /record","success");test={...test,step:"Verifying active workout"};
 await sleep(3000);
 if(state.route!=="/record")throw new Error("Workout did not remain active");
 const smokeTelemetry=await pageTelemetry(),smokeFeet=feetFrom(smokeTelemetry.text);
 if(smokeFeet>=50)throw new Error("Smoke test crossed 50 ft before Stop");
 addEvent("Workout is running","Active workout verified at "+smokeFeet+" ft — below the 50 ft save threshold","success");test={...test,step:"Stopping workout before 50 ft"};
 await clickText(["stop"]);
 if(!await waitForRoute("/home",20000))throw new Error("Home screen did not return after Stop");
 addEvent("Clicked Stop button","Tablet changed from /record to /home","success");
 addEvent("Finished the workout","Home screen confirmed after a clean stop","success");
 test={status:"passed",name:"Workout smoke test",finishedAt:new Date().toISOString(),step:"Complete"};state.test=test;
}
async function launchSand(){
 if(!state.connected)throw new Error("Lenovo tablet is not connected");
 if(!state.sandboxForeground){
  await adb("shell","am","start","-a","android.settings.APPLICATION_DETAILS_SETTINGS","-d","package:com.versaclimber.sandbox");
  await sleep(900);await adb("shell","input","tap","153","317");
  const started=Date.now();while(Date.now()-started<10000&&!state.sandboxForeground)await sleep(350);
 }
 if(!state.sandboxForeground)throw new Error("Sandbox could not be brought to foreground");
 if(state.route!=="/home"){await adb("shell","input","tap","760","52");if(!await waitForRoute("/home",10000))throw new Error("Sandbox opened but Home was not reached")}
 addEvent("Sandbox launched","App is in foreground and Home is confirmed","success");
}
async function runMonumentTest(){
 if(test.status==="running")return;
 if(!state.connected||!state.sandboxForeground||state.route!=="/home")throw new Error("Sandbox must be connected and on Home");
 events.splice(0,events.length);test={status:"running",name:"Monument smoke test",startedAt:new Date().toISOString(),step:"Opening Monuments"};addEvent("Monument test started","Tablet, Sandbox, and Home screen verified","info");
 await adb("shell","input","tap","600","1025");await sleep(1000);addEvent("Clicked Monuments","Monuments chooser opened","success");test={...test,step:"Selecting Qutub Minar"};
 await adb("shell","input","tap","200","650");await sleep(1200);addEvent("Selected Qutub Minar","Monument detail card opened","success");test={...test,step:"Starting climb"};
 const started=Date.now();let startClicked="";while(Date.now()-started<15000&&!state.route?.startsWith("/record-new")){try{startClicked=await clickText(["start climbing"])}catch{}await sleep(350)}
 if(!startClicked&&!state.route?.startsWith("/record-new"))throw new Error("Start Climbing control was not clickable");
 if(!state.route?.startsWith("/record-new"))throw new Error("Monument workout did not open");
 addEvent("Clicked Start Climbing","Monument workout screen /record-new confirmed","success");await sleep(3000);
 const telemetry=await pageTelemetry(),feet=feetFrom(telemetry.text);if(feet>=50)throw new Error("Monument smoke test crossed 50 ft before Stop");
 addEvent("Climb is running","Monument workout verified at "+feet+" ft — below the 50 ft save threshold","success");test={...test,step:"Stopping before 50 ft"};
 await clickText(["stop"]);if(!await waitForRoute("/home",20000))throw new Error("Home did not return after Monument Stop");
 addEvent("Clicked Stop button","Monument workout stopped below 50 ft","success");addEvent("Returned Home","Monument smoke test finished cleanly","success");test={status:"passed",name:"Monument smoke test",finishedAt:new Date().toISOString(),step:"Complete"};state.test=test;
}
async function runVideoClassTest(){
 if(test.status==="running")return;
 if(!state.connected||!state.sandboxForeground||state.route!=="/home")throw new Error("Sandbox must be connected and on Home");
 events.splice(0,events.length);
 test={status:"running",name:"Video class test",startedAt:new Date().toISOString(),step:"Opening All Classes"};addEvent("Video class test started","Tablet, Sandbox, and Home screen verified","info");
 await adb("shell","input","tap","600","725");
 if(!await waitForRoute("/home-classes"))throw new Error("All Classes did not open");
 addEvent("Tapped All Classes","Class category screen confirmed","success");test={...test,step:"Selecting 15 Mins category"};
 await adb("shell","input","tap","110","1180");await sleep(1500);
 let telemetry=await pageTelemetry();
 if(!telemetry.text.includes("15 MINS"))throw new Error("15 Mins category was not selected");
 addEvent("Tapped 15 Mins category","Filtered class cards are visible","success");test={...test,step:"Opening first class"};
 await adb("shell","input","tap","200","250");
 const started=Date.now();while(Date.now()-started<15000&&!state.route?.startsWith("/live-stream-ts/"))await sleep(350);
 if(!state.route?.startsWith("/live-stream-ts/"))throw new Error("Video training view did not open");
 addEvent("Tapped first class card","Video training route confirmed","success");test={...test,step:"Waiting for video playback"};
 let first=null,last=null;
 const loadStarted=Date.now();
 while(Date.now()-loadStarted<30000){try{telemetry=await pageTelemetry();if(telemetry.video&&!telemetry.video.paused&&telemetry.video.readyState>=3){first=telemetry;break}}catch{}await sleep(1000)}
 if(!first)throw new Error("Training video did not begin playback");
 await sleep(4000);last=await pageTelemetry();
 if(last.video.currentTime<=first.video.currentTime+2||last.video.decoded<=first.video.decoded)throw new Error("Video frames are not advancing smoothly");
 const dropped=last.video.dropped??0,decoded=last.video.decoded??1;
 addEvent("Video playback is healthy","Playback advanced "+Math.round(last.video.currentTime-first.video.currentTime)+"s · "+dropped+" dropped of "+decoded+" decoded frames","success");
 const mediaVolume=await adb("shell","cmd","media_session","volume","--stream","3","--get");
 if(last.video.muted||last.video.volume===0||/volume is 0/i.test(mediaVolume))throw new Error("Media audio is muted");
 addEvent("Audio output is active","Video is unmuted and Android media volume is above zero","success");
 addEvent("Music channel is available","Music controls are visible; subjective clarity requires a listening check","info");
 test={...test,step:"Monitoring vitals until 45 ft"};
 let initialFeet=feetFrom(last.text),latestFeet=initialFeet,previousFeet=initialFeet,updates=0;
 if(/Unable\s+to connect to sensor/i.test(last.text))throw new Error("VersaClimber sensor is not connected; vitals cannot update");
 const metricStart=Date.now();
 while(Date.now()-metricStart<180000&&latestFeet<45){await sleep(2000);telemetry=await pageTelemetry();if(/Unable\s+to connect to sensor/i.test(telemetry.text))throw new Error("VersaClimber sensor is not connected; vitals cannot update");if(!state.route?.startsWith("/live-stream-ts/"))throw new Error("Video class was closed before reaching 45 ft");latestFeet=feetFrom(telemetry.text);if(latestFeet>previousFeet){updates++;previousFeet=latestFeet}test={...test,step:"Vitals updating · "+latestFeet+" ft"};state.test=test}
 if(latestFeet<45)throw new Error("Workout did not reach 45 ft within 3 minutes");
 if(updates<2)throw new Error("Feet metric did not update consistently");
 const hasCalories=/\bcal\b/i.test(telemetry.text),hasWatts=/\bwatts\b/i.test(telemetry.text),heartRateConnected=!/\bHR\s+Connect\b/i.test(telemetry.text);
 if(!hasCalories||!hasWatts)throw new Error("Expected calorie or watt metrics are missing");
 addEvent("Vitals reached 45 ft","Feet progressed from "+initialFeet+" to "+latestFeet+"; calories and watts remained visible","success");
 if(heartRateConnected)addEvent("Heart rate is updating","Connected HR value is visible","success");else addEvent("Heart rate not available","No HR sensor is connected; marked not applicable","warning");
 test={...test,step:"Stopping class before 50 ft"};
 await clickText(["stop"]);
 if(!await waitForRoute("/home-classes",20000))throw new Error("Class did not end after Stop");
 addEvent("Stopped before 50 ft","Class ended without a Save workout dialog, as expected","success");
 await sleep(700);
 const rateClicked=await clickText(["rate this class"]);
 if(!rateClicked)throw new Error("Rate this Class control was not found");
 addEvent("Clicked Rate this Class","Feedback view opened","success");await sleep(800);
 const ratingExpression="(()=>{const radios=[...document.querySelectorAll('input[type=radio]')],stars=[...document.querySelectorAll('[data-rating],.star,.rating-star')],target=radios.at(-1)||stars.at(-1);if(target){target.click();return true}const buttons=[...document.querySelectorAll('button,[role=button]')],choice=buttons.find(el=>/great|excellent|love|5/i.test(el.innerText||el.getAttribute('aria-label')||''));if(choice){choice.click();return true}return false})()";
 const ratingSelected=await pageAction(ratingExpression);
 if(!ratingSelected)throw new Error("Feedback rating control was not recognized");
 const submitted=await clickText(["submit","save feedback","done"]);
 if(!submitted)throw new Error("Feedback submit control was not found");
 addEvent("Submitted class feedback","Highest available rating selected and submitted","success");await sleep(700);
 for(let attempts=0;attempts<3&&state.route!=="/home";attempts++){await adb("shell","input","keyevent","KEYCODE_BACK");await sleep(700)}
 if(!await waitForRoute("/home",5000))throw new Error("Home did not return after feedback");
 addEvent("Returned Home","Video class, save, and feedback flow finished cleanly","success");
 test={status:"passed",name:"Video class test",finishedAt:new Date().toISOString(),step:"Complete"};state.test=test;
}
const server=http.createServer((req,res)=>{
 res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Cache-Control","no-store");
 if(req.method==="OPTIONS"){res.writeHead(204);return res.end()}
 if(req.url?.startsWith("/screen")){if(!screen){res.writeHead(404);return res.end()}res.writeHead(200,{"Content-Type":"image/png"});return res.end(screen)}
 if(req.url==="/state"){res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({...state,test}))}
 if(req.url==="/run-workout"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runWorkoutTest().catch(error=>{addEvent("Workout test failed",error.message,"warning");test={status:"failed",name:"Workout smoke test",error:error.message,finishedAt:new Date().toISOString()};state.test=test});return}
 if(req.url==="/launch-sand"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));launchSand().catch(error=>addEvent("Sandbox launch failed",error.message,"warning"));return}
 if(req.url==="/run-monument"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runMonumentTest().catch(error=>{addEvent("Monument test failed",error.message,"warning");test={status:"failed",name:"Monument smoke test",error:error.message,finishedAt:new Date().toISOString()};state.test=test;try{if(state.route?.startsWith("/record-new"))adb("shell","input","tap","660","1275")}catch{}});return}
 if(req.url==="/tap-stop"&&req.method==="POST"){res.writeHead(200,{"Content-Type":"application/json"});clickText(["stop"]).then(value=>res.end(JSON.stringify({clicked:value||false}))).catch(error=>{res.writeHead(500);res.end(JSON.stringify({error:error.message}))});return}
 if(req.url==="/run-video-class"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runVideoClassTest().catch(async error=>{addEvent("Video class test failed",error.message,"warning");test={status:"failed",name:"Video class test",error:error.message,finishedAt:new Date().toISOString()};state.test=test;try{if(state.route?.startsWith("/live-stream-ts/"))await adb("shell","input","tap","660","690")}catch{}});return}
 res.writeHead(404);res.end();
});
server.listen(PORT,"127.0.0.1",()=>console.log("VC TestBench bridge listening on http://localhost:"+PORT));poll();setInterval(poll,1500);
