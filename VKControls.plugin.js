/**
 * @name VKControls
 * @author SPRAVEDLIVO
 * @description Connect VK music player with discord
 * @version 0.0.1
 * @authorId 355826920270594058
 * @website https://spravedlivo.dev/vkreact
 * @source https://github.com/VkReact/VKControls/VKControls.plugin.js
 */

const fs = require('fs')
const https = require('https')

let fetch = (url) => new Promise((resolve, reject) => {
    let data = ''
    https.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (X11; CrOS x86_64 8172.45.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.64 Safari/537.36"
        }
    }, (res) => {
        res.on('data', (d) => {
            data += d.toString()
        });
        res.on('end', () => {
            resolve(data)
        })
        res.on('error', (e) => reject(e))
    })
})

let download = (url, dest) => new Promise(async (resolve, reject) => {
    let file = fs.createWriteStream(dest);
    https.get(url, function (response) {
        response.pipe(file)
        file.on('finish', function () {
            file.close(resolve)
        })
    }).on('error', function (err) {
        fs.unlink(dest)
        reject(err.message)
    })
})

async function resolveTree() {
    let tree = await fetch("https://api.github.com/repos/websockets/ws/git/trees/master?recursive=true")
    tree = JSON.parse(tree)
    let final = {}
    tree["tree"].forEach(it => {
        final[it["path"]] = it
    })
    return final
}

class PanelController {
    createPanel() {
        let panel = document.querySelector(".panels-3wFtMD")
        let cloned = panel.cloneNode(true)
        Array.from(cloned.querySelector(".container-YkUktl").children).forEach(it => it.remove())
        cloned.querySelector(".container-YkUktl").innerHTML = `
           <div id="vkc_im">
               <img class="vkc_im_img">
           </div>
           <div id="vkc_grid"> 
               <div class="size14-3fJ-ot title-338goq vkc"><span></span>
                 <div class="size14-3fJ-ot title-338goq vkc artist">
                 </div>
               </div>
               <div class="vkc_button prev_button" onclick="vkc.prev()">
                   <img class="vkc_im_img btn" src="https://img.icons8.com/ios-filled/100/ffffff/rewind.png"></img>
               </div>
               <div class="vkc_button pause_button" onclick="vkc.playpause()">
                   <img class="vkc_im_img btn pause" src="https://img.icons8.com/material-outlined/32/ffffff/pause--v1.png">
               </div>
               <div class="vkc_button next_button" onclick="vkc.next()">
                   <img class="vkc_im_img btn" src="https://img.icons8.com/ios-filled/100/ffffff/fast-forward.png"></img>
               </div>  
               <div class="vkc_name_and_pg">
                   <div class="progress-container" onclick="vkc.pg(event, this)">
                       <div class="progress">
                       </div>
                   </div>
               </div>
           </div>
           `
        cloned.id = "vkc_panel"
        this.node = cloned
        panel.before(cloned)
    }
    constructor() {
        this.createPanel()
    }
    stop() {
        this.node.remove()
    }
    urlSwitch() {
        let nextChild = this.node.parentElement.children[Array.from(this.node.parentElement.children).indexOf(this.node)+1]
        if (nextChild && nextChild.tagName == "NAV") {
            nextChild.after(this.node)
        } 
    }
}


let jsonify = JSON.stringify

let mapRange = function (from, to, value) {
    if (parseFloat(value) < parseFloat(from[0])) return parseFloat(to[0]);
    else if (parseFloat(value) > parseFloat(from[1])) return parseFloat(to[1]);
    else return parseFloat(to[0]) + (parseFloat(value) - parseFloat(from[0])) * (parseFloat(to[1]) - parseFloat(to[0])) / (parseFloat(from[1]) - parseFloat(from[0]));
};

let stateButtons = {"PLAY": "https://img.icons8.com/material-outlined/32/ffffff/pause--v1.png", "PAUSE": "https://img.icons8.com/ios-glyphs/30/ffffff/play--v1.png"}

module.exports = class VKControls {
    prev() {
        this.wss.broadcast(jsonify({"command": "playPrev"}))
    }
    next() {
        this.wss.broadcast(jsonify({"command": "playNext"}))
    }
    playpause() {
        this.wss.broadcast(jsonify({"command": "play_pause"}))
    }
    pg(e, element) {
        let rects = element.getClientRects()[0]
        if (!this.max_time) return
        let pos = Math.round(mapRange([rects.left, rects.left + rects.width], [0, this.max_time], e.clientX))
        this.wss.broadcast(jsonify({"command": "seek_time", "time": pos}))
    }
    async load() {
        window.vkc = this
        let pluginFolder = BdApi.Plugins.folder
        if (!fs.existsSync(`${pluginFolder}/ws-master`)) {
            console.log("WS not found. Executing step 1: resolving tree")
            let tree = await resolveTree()
            console.log("Step 2: creating folder")
            fs.mkdirSync(`${pluginFolder}/ws-master`)
            console.log("Step 3: downloading repo (v1.0)")
            for (const [path, obj] of Object.entries(tree)) {
                if (obj.type == "tree") {
                    fs.mkdirSync(`${pluginFolder}/ws-master/${path}`)
                }
                else {
                    await download(`https://raw.githubusercontent.com/websockets/ws/master/${path}`, `${pluginFolder}/ws-master/${path}`)
                }
            }
            console.log("downloading complete")
        }
        else {
            console.log("detected ws installation")
            try {
                require(`${pluginFolder}/ws-master/index.js`)
            }
            catch (e) {
                console.log(`WS Require Error: ${e}`)
                return
            }
        }
        this.ws = require(`${pluginFolder}/ws-master/index.js`)

    }
    se(htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString.trim();
        return div.firstChild;
    }
    start() {
        this.wss = new this.ws.Server({ "port": 6374 })
        this.wss.on("connection", wsClient => {
            wsClient.send(jsonify({"command":"request_data"}))
            wsClient.on("message", message => {
                let parsed = JSON.parse(message)
                switch (parsed.command) {
                    case "update_info": {
                        if (parsed.status != "NO_PLAYER") {
                            this.controller.node.querySelector(".size14-3fJ-ot.title-338goq.vkc > span").textContent = parsed.name
                            this.controller.node.querySelector(".size14-3fJ-ot.title-338goq.vkc.artist").innerText = parsed.artist
                            this.controller.node.querySelector(".vkc_im_img").src = parsed.cover
                            this.controller.node.querySelector(".vkc_im_img.btn.pause").src = stateButtons[parsed.status]
                            this.controller.node.querySelector(".progress").style.width = `${parsed.progress}%`
                            this.max_time = parsed.duration
                            this.controller.node.style.height = '53px'
                        }
                        break
                    }
                }
            })
        })
        this.wss.broadcast = function(message) {
            this.clients.forEach(it => {
                it.send(message)
            })
        }
        BdApi.injectCSS("vkc_css", `
            .vkc_button {
                align-self: center;
            }
            #vkc_panel {
                transition: height 1s;
                height: 1px;
            }
             #vkc_grid {
                 display:grid;
                 grid-template-columns: 9rem repeat(3, 16px);
             }
             .progress-container {
                 height: 0.4rem;
                 width: 11.5rem;
                 border-radius: 0.4rem;
                 background: white;
               }
               #vkc_im {
                    margin-right: 8px;
               }
               .size14-3fJ-ot.title-338goq.vkc {
                   padding-bottom: 10px;
                   word-break: break-word;
                   height: 32px;
               }
               .size14-3fJ-ot.title-338goq.vkc.artist {
                    color: var(--header-secondary);
               }
               .vkc_im_img {
                   height: 32px;
                   width: 32px;
                   border-radius: 4px;
                   background-color: rgba(0,0,0,0);
               }
               .vkc_im_img.btn {
                    height: 16px;
                    width: 16px;
                }
               .progress-container .progress {
                 height: 100%;
                 width: 0;
                 border-radius: 0.4rem;
                 background: #ff4754;
                 transition: width 0.4s ease;
               }
             `)
        this.controller = new PanelController()
    }
    stop() {
        this.wss.close()
        BdApi.clearCSS("vkc_css")
        this.controller.stop()
    }
    onSwitch() {
        this.controller.urlSwitch()
    }
}