import http from "node:http";
import {execFile, execFileSync} from "node:child_process";
import {promisify} from "node:util";
const exec=promisify(execFile),PORT=3131;
const ADB = process.env.ADB ?? (() => {
  const candidates = [
    "/opt/homebrew/bin/adb",
    "/usr/local/bin/adb",
    "adb",
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["version"], {stdio: "ignore"});
      return candidate;
    } catch {
      // try the next fallback candidate
    }
  }
  return "adb";
})();
let screen=null,eventId=0,previous={connected:false,sandboxForeground:false,route:""};
const events=[];
let state={connected:false,sandboxForeground:false,updatedAt:new Date().toISOString(),events,test:{status:"idle",name:"Workout smoke test"}};
let test={status:"idle",name:"Workout smoke test"};
const adb=async(...args)=>(await exec(ADB,args,{encoding:"utf8",maxBuffer:8_000_000})).stdout.trim();
const addEvent=(label,detail,kind="info")=>{events.push({id:++eventId,at:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"}),label,detail,kind});if(events.length>30)events.shift()};
async function readRoute(pid){
  if(!pid)return"";

  try{
    await adb(
      "forward",
      "--remove",
      "tcp:9222"
    ).catch(()=>{});

    await adb(
      "forward",
      "tcp:9222",
      "localabstract:webview_devtools_remote_"+pid
    );

    const response=await fetch(
      "http://127.0.0.1:9222/json/list",
      {cache:"no-store"}
    );

    if(!response.ok)
      throw new Error("DevTools HTTP "+response.status);

    const pages=await response.json();

    console.log(
      "[DevTools]",
      JSON.stringify(pages,null,2)
    );

    const page=pages.find(
      item =>
        item.type==="page" &&
        item.webSocketDebuggerUrl
    );

    if(!page)return"";

    return new URL(page.url).pathname;

  }catch(error){
    console.log(
      "[DevTools] Route read failed:",
      error?.message||error
    );
    return"";
  }
}
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
async function runWorkoutTest() {
  if (test.status === "running") return;

  if (
    !state.connected ||
    !state.sandboxForeground ||
    state.route !== "/home"
  ) {
    throw new Error(
      "Sandbox must be connected and on Home"
    );
  }

  events.splice(0, events.length);

  test = {
    status: "running",
    name: "Workout smoke test",
    startedAt: new Date().toISOString(),
    step: "Finding START text"
  };

  addEvent(
    "Workout test started",
    "Tablet connected, Sandbox visible, Home screen confirmed",
    "info"
  );

  // ==================================================
  // CONNECT TO WEBVIEW
  // ==================================================

  const pages = await fetch(
    "http://127.0.0.1:9222/json"
  ).then(r => r.json());

  const url = pages[0]?.webSocketDebuggerUrl;

  if (!url) {
    throw new Error(
      "WebView telemetry unavailable"
    );
  }

  // ==================================================
  // FIND START TEXT + CLICKABLE ELEMENT AROUND IT
  // ==================================================

  const result = await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error("START detection timeout")
      );
    }, 5000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            returnByValue: true,

            expression: `
              (() => {

                // ------------------------------------------
                // NORMALIZE TEXT
                // ------------------------------------------

                const normalize = (text) => {
                  return (text || "")
                    // Remove icon/private-use characters
                    // e.g. START
                    .replace(/[\\\\uE000-\\\\uF8FF]/g, "")

                    // Replace punctuation with spaces
                    .replace(/[^\\\\p{L}\\\\p{N}]+/gu, " ")

                    // Remove duplicate spaces
                    .replace(/\\\\s+/g, " ")

                    .trim()
                    .toUpperCase();
                };


                // ------------------------------------------
                // CHECK IF ELEMENT IS VISIBLE
                // ------------------------------------------

                const isVisible = (el) => {

                  const rect =
                    el.getBoundingClientRect();

                  const style =
                    getComputedStyle(el);

                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    style.opacity !== "0"
                  );
                };


                // ------------------------------------------
                // CHECK IF ELEMENT IS CLICKABLE
                // ------------------------------------------

                const isClickable = (el) => {

                  const style =
                    getComputedStyle(el);

                  return (
                    el.tagName === "BUTTON" ||

                    el.tagName === "A" ||

                    el.onclick !== null ||

                    el.hasAttribute("onclick") ||

                    el.getAttribute("role") === "button" ||

                    el.hasAttribute("data-button") ||

                    style.cursor === "pointer"
                  );
                };


                // ------------------------------------------
                // ALL DOM ELEMENTS
                // ------------------------------------------

                const elements = [
                  ...document.querySelectorAll("*")
                ];


                // ------------------------------------------
                // FIND ELEMENT CONTAINING START TEXT
                // ------------------------------------------

                const startCandidates = elements
                  .map((el, index) => {

                    if (!isVisible(el)) {
                      return null;
                    }

                    const rawText =
                        el.innerText ||
                        el.textContent ||
                        "";

                      const text =
                        rawText.trim().toUpperCase();

                      if (!text.startsWith("START")) {
                        return null;
                      }


                    

                    const rect =
                      el.getBoundingClientRect();


                    return {
                      el,
                      index,

                      tag:
                        el.tagName.toLowerCase(),

                      id:
                        el.id || "",

                      className:
                        typeof el.className === "string"
                          ? el.className
                          : "",

                      rawText,

                      text,

                      bounds: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      },

                      area:
                        rect.width * rect.height
                    };

                  })
                  .filter(Boolean);


                // ------------------------------------------
                // SMALLEST START ELEMENT
                //
                // This prevents BODY / huge DIVs from
                // becoming the selected START element.
                // ------------------------------------------

                startCandidates.sort(
                  (a, b) => a.area - b.area
                );


                const startElement =
                  startCandidates[0];


                if (!startElement) {

                  return {
                    found: false,

                    startCandidates: []
                  };

                }


                // ------------------------------------------
                // WALK UP FROM START
                // ------------------------------------------

                const parents = [];

                let current =
                  startElement.el;


                while (
                  current &&
                  current !== document.body
                ) {

                  const rect =
                    current.getBoundingClientRect();

                  if (isVisible(current)) {

                    parents.push({

                      el: current,

                      tag:
                        current.tagName.toLowerCase(),

                      id:
                        current.id || "",

                      className:
                        typeof current.className ===
                        "string"
                          ? current.className
                          : "",

                      text:
                        normalize(
                          current.innerText ||
                          current.textContent ||
                          ""
                        ),

                      clickable:
                        isClickable(current),

                      bounds: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      },

                      area:
                        rect.width * rect.height
                    });

                  }

                  current =
                    current.parentElement;
                }


                // ------------------------------------------
                // FIND CLICKABLE ELEMENTS AROUND START
                // ------------------------------------------

                const clickableParents =
                  parents.filter(
                    item => item.clickable
                  );


                // Nearest/smallest clickable element
                clickableParents.sort(
                  (a, b) => a.area - b.area
                );


                const clickable =
                  clickableParents[0];


                // ------------------------------------------
                // LOG EVERYTHING
                // ------------------------------------------

                console.log(
                  "START TEXT ELEMENT:",
                  startElement
                );

                console.log(
                  "START PARENT CHAIN:",
                  parents
                );

                console.log(
                  "CLICKABLE AROUND START:",
                  clickable
                );


                // ------------------------------------------
                // CLICK
                // ------------------------------------------

                if (!clickable) {

                  return {
                    found: true,

                    clicked: false,

                    startElement: {
                      tag: startElement.tag,
                      id: startElement.id,
                      className:
                        startElement.className,
                      rawText:
                        startElement.rawText,
                      text:
                        startElement.text,
                      bounds:
                        startElement.bounds
                    },

                    parents:
                      parents.map(p => ({
                        tag: p.tag,
                        id: p.id,
                        className: p.className,
                        text: p.text,
                        clickable:
                          p.clickable,
                        bounds:
                          p.bounds
                      }))
                  };

                }


                // ------------------------------------------
                // SCROLL CLICKABLE INTO VIEW
                // ------------------------------------------

                clickable.el.scrollIntoView({
                  block: "center",
                  inline: "center"
                });


                // ------------------------------------------
                // CLICK IT
                // ------------------------------------------

                clickable.el.click();


                // ------------------------------------------
                // RETURN RESULT
                // ------------------------------------------

                return {

                  found: true,

                  clicked: true,

                  startElement: {
                    tag:
                      startElement.tag,

                    id:
                      startElement.id,

                    className:
                      startElement.className,

                    rawText:
                      startElement.rawText,

                    text:
                      startElement.text,

                    bounds:
                      startElement.bounds
                  },

                  clickedElement: {

                    tag:
                      clickable.tag,

                    id:
                      clickable.id,

                    className:
                      clickable.className,

                    text:
                      clickable.text,

                    bounds:
                      clickable.bounds
                  },

                  parents:
                    parents.map(p => ({
                      tag: p.tag,
                      id: p.id,
                      className: p.className,
                      text: p.text,
                      clickable:
                        p.clickable,
                      bounds:
                        p.bounds
                    }))

                };

              })()
            `
          }
        })
      );
    };

    ws.onmessage = event => {

      const message =
        JSON.parse(event.data);

      if (message.id === 1) {

        clearTimeout(timer);

        ws.close();

        const value =
          message.result?.result?.value;

        resolve(value);
      }
    };

    ws.onerror = () => {

      clearTimeout(timer);

      reject(
        new Error(
          "WebView START detection error"
        )
      );
    };
  });


  // ==================================================
  // HANDLE RESULT
  // ==================================================

  if (!result?.found) {

    addEvent(
      "START text not found",
      "No visible DOM element beginning with START was found",
      "error"
    );

    throw new Error(
      "START text not found in WebView"
    );
  }


  // ==================================================
  // LOG START TEXT
  // ==================================================

  console.log(
    "======================================"
  );

  console.log(
    "START TEXT FOUND"
  );

  console.log(
    "Text:",
    result.startElement.rawText
  );

  console.log(
    "Normalized:",
    result.startElement.text
  );

  console.log(
    "Tag:",
    result.startElement.tag
  );

  console.log(
    "ID:",
    result.startElement.id
  );

  console.log(
    "Class:",
    result.startElement.className
  );

  console.log(
    "Bounds:",
    result.startElement.bounds
  );

  console.log(
    "======================================"
  );


  addEvent(
    "Found Start text",
    `"${result.startElement.rawText}" detected in DOM`,
    "success"
  );


  // ==================================================
  // CLICK RESULT
  // ==================================================

  if (!result.clicked) {

    console.log(
      "No clickable parent found."
    );

    console.log(
      "Parent chain:",
      result.parents
    );

    addEvent(
      "START found but not clickable",
      "No clickable element was found around the START text",
      "error"
    );

    throw new Error(
      "START text found but no clickable element around it"
    );
  }


  console.log(
    "Clicked element:",
    result.clickedElement
  );


  addEvent(
    "Clicked Start",
    `${result.clickedElement.tag} "${result.clickedElement.text}"`,
    "success"
  );


  // ==================================================
  // VERIFY WORKOUT ROUTE
  // ==================================================

  test = {
    ...test,
    step: "Verifying workout screen"
  };


  if (!await waitForRoute("/record")) {

    addEvent(
      "Workout screen failed",
      "START was clicked but /record was not reached",
      "error"
    );

    throw new Error(
      "Workout screen did not open"
    );
  }


  // ==================================================
  // SUCCESS
  // ==================================================

  addEvent(
    "Workout screen opened",
    "Route changed from /home to /record",
    "success"
  );


  test = {
    status: "passed",

    name: "Workout smoke test",

    finishedAt:
      new Date().toISOString(),

    step: "Start click verified"
  };

  state.test = test;
}
async function debugWebViewScreen() {
  const pages = await fetch(
    "http://127.0.0.1:9222/json"
  ).then(r => r.json());

  const url = pages[0]?.webSocketDebuggerUrl;

  if (!url) {
    throw new Error("WebView unavailable");
  }

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error("Screen dump timeout"));
    }, 5000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            returnByValue: true,

            expression: `
              (() => {

                const normalize = (text) => {
                  return (text || "")
                    .replace(/[\\\\uE000-\\\\uF8FF]/g, "")
                    .replace(/[^\\\\p{L}\\\\p{N}]+/gu, " ")
                    .replace(/\\\\s+/g, " ")
                    .trim()
                    .toUpperCase();
                };

                const elements = [
                  ...document.querySelectorAll("*")
                ];

                const result = elements.map((el, index) => {

                  const rect =
                    el.getBoundingClientRect();

                  const style =
                    getComputedStyle(el);

                  const rawText =
                    el.innerText ||
                    el.textContent ||
                    "";

                  return {

                    index,

                    tag:
                      el.tagName.toLowerCase(),

                    id:
                      el.id || "",

                    className:
                      typeof el.className === "string"
                        ? el.className
                        : "",

                    rawText,

                    normalizedText:
                      normalize(rawText),

                    visible:
                      rect.width > 0 &&
                      rect.height > 0 &&
                      style.display !== "none" &&
                      style.visibility !== "hidden",

                    clickable:
                      el.tagName === "BUTTON" ||
                      el.tagName === "A" ||
                      el.onclick !== null ||
                      el.hasAttribute("onclick") ||
                      el.getAttribute("role") === "button" ||
                      el.hasAttribute("data-button") ||
                      style.cursor === "pointer",

                    bounds: {
                      x: Math.round(rect.x),
                      y: Math.round(rect.y),
                      width: Math.round(rect.width),
                      height: Math.round(rect.height)
                    },

                    attributes:
                      [...el.attributes].reduce(
                        (obj, attr) => {
                          obj[attr.name] = attr.value;
                          return obj;
                        },
                        {}
                      )

                  };

                });

                return {

                  pageTitle:
                    document.title,

                  pageUrl:
                    location.href,

                  bodyText:
                    document.body?.innerText || "",

                  elementCount:
                    result.length,

                  elements:
                    result

                };

              })()
            `
          }
        })
      );
    };

    ws.onmessage = event => {
      const message =
        JSON.parse(event.data);

      if (message.id === 1) {

        clearTimeout(timer);
        ws.close();

        resolve(
          message.result?.result?.value
        );
      }
    };

    ws.onerror = () => {

      clearTimeout(timer);

      reject(
        new Error("WebView screen dump error")
      );
    };
  });
}
async function launchSand(){
  if(!state.connected)
    throw new Error("Lenovo tablet is not connected");

  if(!state.sandboxForeground){
    await adb(
      "shell",
      "monkey",
      "-p",
      "com.versaclimber.sandbox",
      "-c",
      "android.intent.category.LAUNCHER",
      "1"
    );

    const started=Date.now();

    while(Date.now()-started<10000){
      if(state.sandboxForeground)break;
      await sleep(350);
    }
  }

  if(!state.sandboxForeground)
    throw new Error("Sandbox could not be brought to foreground");

  const routeStarted=Date.now();

  while(Date.now()-routeStarted<10000){
    if(state.route==="/home")break;
    await sleep(350);
  }

  if(state.route!=="/home")
    throw new Error(
      "Sandbox opened but Home was not detected. Current route: "+
      (state.route||"unknown")
    );

  addEvent(
    "Sandbox launched",
    "App is in foreground and Home is confirmed",
    "success"
  );
}
async function findMonumentsButton() {
  const pages = await fetch(
    "http://127.0.0.1:9222/json"
  ).then(r => r.json());

  const url = pages[0]?.webSocketDebuggerUrl;

  if (!url) {
    return {
      success: false,
      reason: "WebView unavailable",
    };
  }

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();

      reject(
        new Error("MONUMENTS detection timeout")
      );
    }, 5000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          id: 1,

          method: "Runtime.evaluate",

          params: {
            returnByValue: true,

            expression: `
              (() => {

                // ------------------------------------------
                // Check visibility
                // ------------------------------------------

                const isVisible = (el) => {

                  const rect =
                    el.getBoundingClientRect();

                  const style =
                    getComputedStyle(el);

                  return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    style.opacity !== "0"
                  );
                };


                // ------------------------------------------
                // Check whether element can be clicked
                // ------------------------------------------

                const isClickable = (el) => {

                  const style =
                    getComputedStyle(el);

                  return (
                    el.tagName === "BUTTON" ||

                    el.tagName === "A" ||

                    el.onclick !== null ||

                    el.hasAttribute("onclick") ||

                    el.getAttribute("role") === "button" ||

                    el.hasAttribute("data-button") ||

                    style.cursor === "pointer"
                  );
                };


                // ------------------------------------------
                // Find MONUMENTS text
                // ------------------------------------------

                const elements = [
                  ...document.querySelectorAll("*")
                ];

                const matches = elements
                  .map((el, index) => {

                    if (!isVisible(el)) {
                      return null;
                    }

                    const rawText =
                      el.innerText ||
                      el.textContent ||
                      "";

                    const text =
                      rawText
                        .trim()
                        .toUpperCase();

                    /*
                     * We specifically want text beginning
                     * with MONUMENTS.
                     *
                     * MONUMENTS
                     * MONUMENTS →
                     * MONUMENTS
                     *
                     * all work.
                     */

                    if (!text.startsWith("MONUMENTS")) {
                      return null;
                    }

                    const rect =
                      el.getBoundingClientRect();

                    return {
                      el,

                      index,

                      tag:
                        el.tagName.toLowerCase(),

                      id:
                        el.id || "",

                      className:
                        typeof el.className === "string"
                          ? el.className
                          : "",

                      rawText,

                      text,

                      bounds: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      },

                      area:
                        rect.width * rect.height
                    };

                  })
                  .filter(Boolean);


                // ------------------------------------------
                // Smallest MONUMENTS element
                // ------------------------------------------

                matches.sort(
                  (a, b) => a.area - b.area
                );


                const monumentText =
                  matches[0];


                if (!monumentText) {

                  return {
                    success: false,

                    reason:
                      "MONUMENTS text not found",

                    candidates: []
                  };
                }


                // ------------------------------------------
                // Walk upward from MONUMENTS text
                // ------------------------------------------

                const parents = [];

                let current =
                  monumentText.el;


                while (
                  current &&
                  current !== document.body
                ) {

                  if (isVisible(current)) {

                    const rect =
                      current.getBoundingClientRect();

                    parents.push({

                      el: current,

                      tag:
                        current.tagName.toLowerCase(),

                      id:
                        current.id || "",

                      className:
                        typeof current.className === "string"
                          ? current.className
                          : "",

                      text:
                        current.innerText ||
                        current.textContent ||
                        "",

                      clickable:
                        isClickable(current),

                      bounds: {
                        x: Math.round(rect.x),
                        y: Math.round(rect.y),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                      },

                      area:
                        rect.width * rect.height
                    });
                  }

                  current =
                    current.parentElement;
                }


                // ------------------------------------------
                // Find clickable element around text
                // ------------------------------------------

                const clickableParents =
                  parents.filter(
                    item => item.clickable
                  );


                /*
                 * The first clickable parent in the chain
                 * is the closest clickable element to the
                 * MONUMENTS text.
                 *
                 * This is preferable to choosing a random
                 * larger container.
                 */

                const clickable =
                  clickableParents[0];


                console.log(
                  "MONUMENTS TEXT:",
                  monumentText
                );

                console.log(
                  "MONUMENTS PARENT CHAIN:",
                  parents
                );

                console.log(
                  "MONUMENTS CLICKABLE:",
                  clickable
                );


                if (!clickable) {

                  return {

                    success: false,

                    reason:
                      "MONUMENTS text found but no clickable element around it",

                    text:
                      monumentText.rawText,

                    tag:
                      monumentText.tag,

                    id:
                      monumentText.id,

                    parents:
                      parents.map(p => ({
                        tag: p.tag,
                        id: p.id,
                        className: p.className,
                        text: p.text,
                        clickable: p.clickable,
                        bounds: p.bounds
                      }))
                  };
                }


                // ------------------------------------------
                // Scroll the clickable element into view
                // ------------------------------------------

                clickable.el.scrollIntoView({
                  block: "center",
                  inline: "center"
                });


                // ------------------------------------------
                // Click
                // ------------------------------------------

                clickable.el.click();


                // ------------------------------------------
                // Return result
                // ------------------------------------------

                return {

                  success: true,

                  text:
                    monumentText.rawText,

                  normalizedText:
                    monumentText.text,

                  tag:
                    clickable.tag,

                  id:
                    clickable.id,

                  className:
                    clickable.className,

                  bounds:
                    clickable.bounds,

                  startElement: {

                    tag:
                      monumentText.tag,

                    id:
                      monumentText.id,

                    className:
                      monumentText.className,

                    text:
                      monumentText.rawText,

                    bounds:
                      monumentText.bounds
                  },

                  clickedElement: {

                    tag:
                      clickable.tag,

                    id:
                      clickable.id,

                    className:
                      clickable.className,

                    text:
                      clickable.text,

                    bounds:
                      clickable.bounds
                  }

                };

              })()
            `
          }
        })
      );
    };

    ws.onmessage = event => {

      const message =
        JSON.parse(event.data);

      if (message.id === 1) {

        clearTimeout(timer);

        ws.close();

        resolve(
          message.result?.result?.value || {
            success: false,
            reason:
              "No result returned from WebView"
          }
        );
      }
    };

    ws.onerror = () => {

      clearTimeout(timer);

      reject(
        new Error(
          "MONUMENTS WebView detection error"
        )
      );
    };
  });
  
}
async function clickRandomMonument() {
  return await pageAction(`(() => {
    const monumentNames = [
      "Twin Towers Tribute Climb",
      "Vertical 100",
      "Qutub Minar",
      "Vertical 225",
      "Cologne Cathedral",
      "Mist of Niagara Falls",
      "Empire State Building",
      "Eiffel Tower",
      "Arc de Triomphe"
    ];

    const cards = [...document.querySelectorAll(
      "li.monument-item.defaultbg"
    )].filter(card => {
      const text = (card.innerText || "").trim();

      return monumentNames.some(name => text.includes(name));
    });

    if (!cards.length) {
      return {
        success: false,
        reason: "No monument cards found"
      };
    }

    const card = cards[
      Math.floor(Math.random() * cards.length)
    ];

    const text = (card.innerText || "").trim();

    const selectedMonument = monumentNames.find(name =>
      text.includes(name)
    );

    // Scroll the actual monument card into view
    card.scrollIntoView({
      behavior: "instant",
      block: "center"
    });

    const rect = card.getBoundingClientRect();

    // Click the card itself
    card.click();

    return {
      success: true,
      selectedMonument,
      cardText: text,
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      totalMonuments: cards.length
    };
  })()`);
}
async function clickSaveButton() {
  const pages = await fetch("http://127.0.0.1:9222/json")
    .then(r => r.json());

  const url = pages[0]?.webSocketDebuggerUrl;

  if (!url) {
    throw new Error("WebView DevTools unavailable");
  }

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error("Timeout waiting for SAVE")
      );
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          returnByValue: true,
          expression: `
            (() => {

              const save =
                document.getElementById("data-save");

              if (!save) {
                return {
                  success: false,
                  reason: "data-save not currently in DOM"
                };
              }

              const text =
                (
                  save.innerText ||
                  save.textContent ||
                  ""
                ).trim();

              try {
                save.click();

                return {
                  success: true,
                  text,
                  tag: save.tagName,
                  id: save.id,
                  className:
                    save.className || ""
                };

              } catch (error) {

                return {
                  success: false,
                  reason:
                    "SAVE exists but click failed: " +
                    error.message
                };
              }

            })()
          `
        }
      }));
    };

    ws.onmessage = event => {
      const message = JSON.parse(event.data);

      if (message.id !== 1) return;

      clearTimeout(timer);
      ws.close();

      return resolve(
        message.result?.result?.value
      );
    };

    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();

      reject(
        new Error("WebView SAVE click error")
      );
    };
    
  });
}
async function clickTextAround(targetText) {
  const pages = await fetch("http://127.0.0.1:9222/json")
    .then(r => r.json());

  const url = pages[0]?.webSocketDebuggerUrl;

  if (!url) {
    throw new Error("WebView DevTools unavailable");
  }

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error(`Timeout looking for "${targetText}"`)
      );
    }, 5000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          returnByValue: true,
          expression: `
            (() => {

              const target = ${JSON.stringify(targetText)}
                .trim()
                .toLowerCase();

              function isClickable(el) {
                if (!el) return false;

                const tag =
                  el.tagName?.toLowerCase();

                if (
                  tag === "button" ||
                  tag === "a" ||
                  tag === "input"
                ) {
                  return true;
                }

                if (typeof el.onclick === "function") {
                  return true;
                }

                if (
                  el.getAttribute("role") === "button"
                ) {
                  return true;
                }

                if (
                  el.hasAttribute("data-button") ||
                  el.hasAttribute("data-action")
                ) {
                  return true;
                }

                const style =
                  window.getComputedStyle(el);

                if (style.cursor === "pointer") {
                  return true;
                }

                return false;
              }

              // -----------------------------------------
              // Find text
              // -----------------------------------------

              let textElement = null;

              for (
                const el of document.querySelectorAll("*")
              ) {

                const raw =
                  el.innerText ||
                  el.textContent ||
                  "";

                const text =
                  raw.trim().toLowerCase();

                if (!text) continue;

                if (
                  text === target ||
                  text.startsWith(target)
                ) {

                  // Prefer the smallest element
                  // containing the text.

                  const children =
                    el.querySelectorAll("*");

                  let hasSmallerMatch = false;

                  for (const child of children) {

                    const childRaw =
                      child.innerText ||
                      child.textContent ||
                      "";

                    const childText =
                      childRaw.trim().toLowerCase();

                    if (
                      childText === target ||
                      childText.startsWith(target)
                    ) {
                      hasSmallerMatch = true;
                      break;
                    }
                  }

                  if (!hasSmallerMatch) {
                    textElement = el;
                    break;
                  }
                }
              }

              if (!textElement) {
                return {
                  success: false,
                  reason:
                    'Text "' +
                    targetText +
                    '" was not found'
                };
              }

              // -----------------------------------------
              // Walk upward to clickable element
              // -----------------------------------------

              let current = textElement;
              let clickedElement = null;

              const parentChain = [];

              while (
                current &&
                current !== document.documentElement
              ) {

                parentChain.push({
                  tag: current.tagName,
                  id: current.id || "",
                  className:
                    current.className || "",
                  text:
                    (
                      current.innerText ||
                      current.textContent ||
                      ""
                    ).trim()
                });

                if (isClickable(current)) {
                  clickedElement = current;
                  break;
                }

                current = current.parentElement;
              }

              if (!clickedElement) {
                return {
                  success: false,

                  reason:
                    'Found text "' +
                    targetText +
                    '" but no clickable parent was found',

                  text:
                    (
                      textElement.innerText ||
                      textElement.textContent ||
                      ""
                    ).trim(),

                  textTag:
                    textElement.tagName,

                  textClass:
                    textElement.className || "",

                  parentChain
                };
              }

              // -----------------------------------------
              // Click
              // -----------------------------------------

              try {
                clickedElement.scrollIntoView({
                  block: "center",
                  inline: "center"
                });
              } catch (_) {}

              clickedElement.click();

              const rect =
                clickedElement.getBoundingClientRect();

              return {
                success: true,

                text:
                  (
                    textElement.innerText ||
                    textElement.textContent ||
                    ""
                  ).trim(),

                textTag:
                  textElement.tagName,

                textClass:
                  textElement.className || "",

                clickedTag:
                  clickedElement.tagName,

                clickedId:
                  clickedElement.id || "",

                clickedClass:
                  clickedElement.className || "",

                clickedText:
                  (
                    clickedElement.innerText ||
                    clickedElement.textContent ||
                    ""
                  ).trim(),

                attributes: {
                  onclick:
                    clickedElement.getAttribute(
                      "onclick"
                    ),

                  role:
                    clickedElement.getAttribute(
                      "role"
                    ),

                  dataButton:
                    clickedElement.getAttribute(
                      "data-button"
                    ),

                  dataAction:
                    clickedElement.getAttribute(
                      "data-action"
                    )
                },

                bounds: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height
                }
              };

            })()
          `
        }
      }));
    };

    ws.onmessage = event => {
      const message = JSON.parse(event.data);

      if (message.id !== 1) return;

      clearTimeout(timer);
      ws.close();

      resolve(
        message.result?.result?.value
      );
    };

    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();

      reject(
        new Error("WebView click error")
      );
    };
  });
}
async function inspectMonumentList() {
  return await pageAction(`(() => {
    const lists = [...document.querySelectorAll("ul")];

    return lists.map((ul, index) => {
      const text = (ul.innerText || "").trim();

      if (
        !text.includes("FEATURED") ||
        !text.includes("Qutub Minar")
      ) {
        return null;
      }

      return {
        index,
        ulText: text,
        children: [...ul.children].map((child, childIndex) => ({
          childIndex,
          tag: child.tagName,
          className: String(child.className || ""),
          id: child.id,
          text: (child.innerText || "").trim().slice(0, 200),
          rect: (() => {
            const r = child.getBoundingClientRect();
            return {
              x: Math.round(r.x),
              y: Math.round(r.y),
              width: Math.round(r.width),
              height: Math.round(r.height)
            };
          })()
        }))
      };
    }).filter(Boolean);
  })()`);
}

async function runMonumentTest() {
  if (test.status === "running") return;

  if (
    !state.connected ||
    !state.sandboxForeground ||
    state.route !== "/home"
  ) {
    throw new Error(
      "Sandbox must be connected and on Home"
    );
  }

  events.splice(0, events.length);

  test = {
    status: "running",
    name: "Monument smoke test",
    startedAt: new Date().toISOString(),
    step: "Opening monuments",
  };

  state.test = test;

  addEvent(
    "Monument test started",
    "Opening Monuments",
    "info"
  );

  // --------------------------------------------------
  // 1. Open Monuments
  // --------------------------------------------------

  const openResult =
    await findMonumentsButton();

  if (!openResult?.success) {
    addEvent(
      "Monuments open failed",
      openResult?.reason ||
        "Could not open the Monuments modal",
      "error"
    );

    throw new Error(
      openResult?.reason ||
        "Could not open the Monuments modal"
    );
  }

  addEvent(
    "Monuments opened",
    `Clicked ${
      openResult.text ||
      openResult.id ||
      openResult.tag
    }`,
    "success"
  );

  test = {
    ...test,
    step: "Inspecting Monuments modal",
  };

  state.test = test;

  // --------------------------------------------------
  // 2. Wait for modal
  // --------------------------------------------------

  await sleep(1000);

  const inspection =
    await inspectMonumentList();

  addEvent(
    "Monument list hierarchy",
    JSON.stringify(
      inspection,
      null,
      2
    ),
    "info"
  );

  // --------------------------------------------------
  // 3. Select random monument
  // --------------------------------------------------

  test = {
    ...test,
    step: "Selecting random monument",
  };

  state.test = test;

  const monument =
    await clickRandomMonument();

  addEvent(
    "Random monument result",
    JSON.stringify(
      monument,
      null,
      2
    ),
    "info"
  );

  if (!monument?.success) {
    addEvent(
      "Monument selection failed",
      monument?.reason ||
        "Unknown error",
      "error"
    );

    throw new Error(
      monument?.reason ||
        "Monument selection failed"
    );
  }

  addEvent(
    "Random monument selected",
    `Clicked ${
      monument.text ||
      monument.id ||
      monument.tag
    }`,
    "success"
  );

  test = {
    ...test,

    monument:
      monument.text ||
      monument.id ||
      monument.tag ||
      "Unknown",

    step: "Monument selected",
  };

  state.test = test;

  // --------------------------------------------------
  // 4. Start monument climb
  // --------------------------------------------------

  await sleep(1000);

  test = {
    ...test,
    step: "Starting monument climb",
  };

  state.test = test;

  let startResult = null;

  // Give START CLIMBING up to 5 seconds to appear
  for (let i = 0; i < 20; i++) {

    startResult =
      await clickTextAround(
        "START CLIMBING"
      );

    if (startResult?.success) {
      break;
    }

    await sleep(250);
  }

  if (!startResult?.success) {
    throw new Error(
      startResult?.reason ||
        "START CLIMBING could not be clicked"
    );
  }

  addEvent(
    "Start Climbing clicked",
    `Detected "${startResult.text}" and clicked its surrounding clickable element`,
    "success"
  );

  // --------------------------------------------------
  // 5. Verify workout started
  // --------------------------------------------------

  if (
    !await waitForRoute(
      "/record-new"
    )
  ) {
    throw new Error(
      `Expected /record-new after Start Climbing, got ${state.route}`
    );
  }

  addEvent(
    "Workout started",
    "Monument workout rendered at /record-new",
    "success"
  );

  test = {
    ...test,
    step: "Workout running",
  };

  state.test = test;

  // --------------------------------------------------
  // 6. Confirm telemetry
  // --------------------------------------------------

  try {

    const telemetry =
      await pageTelemetry();

    const feet =
      feetFrom(
        telemetry.text
      );

    addEvent(
      "Climb is running",
      "Monument workout verified at " +
        feet +
        " ft",
      "success"
    );

  } catch (error) {

    addEvent(
      "Telemetry warning",
      "Workout started but telemetry was unavailable.",
      "warning"
    );
  }

  // --------------------------------------------------
  // 7. Let workout run for 1 minute
  // --------------------------------------------------

  test = {
    ...test,
    step: "Running workout for 1 minute",
  };

  state.test = test;

  addEvent(
    "Workout running",
    "Allowing monument workout to run for 1 minute.",
    "info"
  );

  await sleep(60000);

  // --------------------------------------------------
  // 8. Click STOP
  // --------------------------------------------------

  test = {
    ...test,
    step: "Stopping workout",
  };

  state.test = test;

  let stopResult = null;

  for (let i = 0; i < 20; i++) {

    stopResult =
      await clickTextAround(
        "STOP"
      );

    if (stopResult?.success) {
      break;
    }

    await sleep(250);
  }

  if (!stopResult?.success) {
    throw new Error(
      stopResult?.reason ||
        "STOP could not be clicked"
    );
  }

  addEvent(
    "Stop clicked",
    `Detected "${stopResult.text}" and clicked its surrounding clickable element`,
    "success"
  );

  // --------------------------------------------------
  // 9. Wait for SAVE
  // --------------------------------------------------

  test = {
    ...test,
    step: "Waiting for Save",
  };

  state.test = test;

  addEvent(
    "Waiting for Save",
    "Monitoring DOM for #data-save.",
    "info"
  );

  // --------------------------------------------------
  // 10. Detect and click SAVE
  // --------------------------------------------------

  let saveResult = null;

  for (let i = 0; i < 200; i++) {

    try {

      saveResult =
        await clickSaveButton();

      if (
        saveResult?.success
      ) {
        break;
      }

    } catch (error) {

      saveResult = {
        success: false,
        reason: error.message
      };
    }

    await sleep(50);
  }

  if (!saveResult?.success) {

    addEvent(
      "Save failed",
      saveResult?.reason ||
        "SAVE could not be clicked",
      "error"
    );

    throw new Error(
      saveResult?.reason ||
        "SAVE could not be clicked"
    );
  }

  addEvent(
    "Save clicked",
    `Detected "${saveResult.text}" and clicked #${saveResult.id}`,
    "success"
  );

  // --------------------------------------------------
  // 11. Check where the app went after SAVE
  // --------------------------------------------------

  await sleep(1500);

  addEvent(
    "After Save",
    `Current route: ${state.route}`,
    "info"
  );

  // --------------------------------------------------
  // 12. Test finished
  // --------------------------------------------------

  test = {
    status: "passed",
    name: "Monument smoke test",
    startedAt:
      test.startedAt,
    finishedAt:
      new Date().toISOString(),
    monument:
      monument.text ||
      monument.id ||
      monument.tag ||
      "Unknown",
    step: "Complete",
  };

  state.test = test;

  addEvent(
    "Monument test complete",
    "Start → workout → Stop → Save flow completed.",
    "success"
  );
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

async function runTest(testData) {
console.log(testData||'testData')

  // if (testData.status === "running") {
  //   throw new Error("A test is already running");
  // }
  // resetEvents();

  test = {
    status: "running",
    name: testData.title,
    startedAt: new Date().toISOString(),
    step: "Starting test",
  };

  state.test = test;

  addEvent(
    `Starting test: ${testData.title}`,
    "",
    "info"
  );

  try {
    for (const action of testData.actions) {
      test.step = action.title;
      state.test = test;

      addEvent(
        `Running action: ${action.title}`,
        "",
        "info"
      );

      await executeTestAction(action);
    }

    test = {
      status: "passed",
      name: testData.title,
      startedAt: test.startedAt,
      finishedAt: new Date().toISOString(),
      step: "Test completed",
    };

    state.test = test;

    addEvent(
      `Test completed: ${testData.title}`,
      "",
      "success"
    );
  } catch (error) {
    test = {
      status: "failed",
      name: testData.title,
      error: error instanceof Error
        ? error.message
        : String(error),
      finishedAt: new Date().toISOString(),
    };

    state.test = test;

    addEvent(
      `${testData.title} failed`,
      test.error,
      "warning"
    );

    throw error;
  }
}
async function executeTestAction(action) {
  if (action.action === "SAVE") {
    await clickSaveButton();
  } else {
    const text =
      action.action === "CUSTOM"
        ? action.customAction
        : action.action;

    if (!text?.trim()) {
      throw new Error(
        `No text configured for action "${action.title}"`
      );
    }

    await clickTextAround(text.trim());
  }

  if (action.hasConfirmation) {
    await executeConfirmation(action);
  }

  if (action.actionTimeout > 0) {
    await sleep(action.actionTimeout * 1000);
  }
}


const server=http.createServer((req,res)=>{
  res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
//  res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Cache-Control","no-store");
 if(req.method==="OPTIONS"){res.writeHead(204);return res.end()}
 if(req.url?.startsWith("/screen")){if(!screen){res.writeHead(404);return res.end()}res.writeHead(200,{"Content-Type":"image/png"});return res.end(screen)}
 if(req.url==="/state"){res.writeHead(200,{"Content-Type":"application/json"});return res.end(JSON.stringify({...state,test}))}
 if(req.url==="/run-workout"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runWorkoutTest().catch(error=>{addEvent("Workout test failed",error.message,"warning");test={status:"failed",name:"Workout smoke test",error:error.message,finishedAt:new Date().toISOString()};state.test=test});return}
 if(req.url==="/launch-sand"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));launchSand().catch(error=>addEvent("Sandbox launch failed",error.message,"warning"));return}
 if(req.url==="/run-monument"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runMonumentTest().catch(error=>{addEvent("Monument test f",error.message,"warning");test={status:"failed",name:"Monument smoke test",error:error.message,finishedAt:new Date().toISOString()};state.test=test;try{if(state.route?.startsWith("/record-new"))adb("shell","input","tap","660","1275")}catch{}});return}
 if(req.url==="/tap-stop"&&req.method==="POST"){res.writeHead(200,{"Content-Type":"application/json"});clickText(["stop"]).then(value=>res.end(JSON.stringify({clicked:value||false}))).catch(error=>{res.writeHead(500);res.end(JSON.stringify({error:error.message}))});return}
 if(req.url==="/run-video-class"&&req.method==="POST"){res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({accepted:true}));runVideoClassTest().catch(async error=>{addEvent("Video class test failed",error.message,"warning");test={status:"failed",name:"Video class test",error:error.message,finishedAt:new Date().toISOString()};state.test=test;try{if(state.route?.startsWith("/live-stream-ts/"))await adb("shell","input","tap","660","690")}catch{}});return}
 if (req.url === "/run-test" && req.method === "POST") {
  let body = "";

  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const testData = JSON.parse(body);

      res.writeHead(202, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          accepted: true,
        })
      );

      runTest(testData).catch(error => {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        addEvent(
          `${testData.title} failed`,
          message,
          "warning"
        );

        test = {
          status: "failed",
          name: testData.title,
          error: message,
          finishedAt: new Date().toISOString(),
        };

        state.test = test;
      });
    } catch (error) {
      res.writeHead(400, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          accepted: false,
          error: "Invalid test data",
        })
      );
    }
  });

  return;
}
 res.writeHead(404);res.end();
});
server.listen(PORT,"127.0.0.1",()=>console.log("VC TestBench bridge listening on http://localhost:"+PORT));poll();setInterval(poll,1500);
