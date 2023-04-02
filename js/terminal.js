class terminal extends HTMLElement
{
    constructor()
    {
        super()
        this.port_open = false
        this.hold_port = null

        this.open_close = this.open_close.bind(this)
        this.change_settings = this.change_settings.bind(this)
        this.send_string = this.send_string.bind(this)
        this.send_string_input = this.send_string_input.bind(this)
        this.clear_terminal = this.clear_terminal.bind(this)
        this.detect_enter = this.detect_enter.bind(this)

        this.read_line_script = this.read_line_script.bind(this)

        this.dtr_on_ms_button_clicked = this.dtr_on_ms_button_clicked.bind(this)
        this.dtr_off_ms_button_clicked = this.dtr_off_ms_button_clicked.bind(this)
        this.rts_on_ms_button_clicked = this.rts_on_ms_button_clicked.bind(this)
        this.rts_off_ms_button_clicked = this.rts_off_ms_button_clicked.bind(this)

        this.dtr_on = this.dtr_on.bind(this)
        this.rts_on = this.rts_on.bind(this)

        this.dtr_on_off_ms = this.dtr_on_off_ms.bind(this)
        this.rts_on_off_ms = this.rts_on_off_ms.bind(this)

        this.dtr_checkbox_clicked = this.dtr_checkbox_clicked.bind(this)
        this.rts_checkbox_clicked = this.rts_checkbox_clicked.bind(this)

        this.active_term_tab = this.active_term_tab.bind(this)
        this.active_script_tab = this.active_script_tab.bind(this)
    }

    async open_close()
    {
        if (this.port_open) {
            this.reader.cancel()
            console.log("attempt to close")
            return
        }

        this.port_promise = new Promise((resolve) => {
            (async () => {
                if (this.hold_port == null) {
                    try {
                        this.port = await navigator.serial.requestPort()
                        console.log(this.port)
                    } catch(e) {
                        console.log(e)
//                        alert(e)
                        return
                    }
                } else {
                    this.port = this.hold_port
                    this.hold_port = null
                }
                var baud_selected = parseInt(this.baud_rate_select.value)
                try {
                    await this.port.open({ baudRate: baud_selected })
                } catch(e) {
                  console.log(e)
                  alert(e)
                  return
                }

                const text_decoder = new TextDecoderStream()
                this.reader = text_decoder.readable.getReader()
                const readable_stream_closed = this.port.readable.pipeTo(text_decoder.writable)

                this.port_open = true
                this.shadowRoot.getElementById("openclose_port").innerText = "Close"
                this.shadowRoot.getElementById("term_input").disabled = false
                this.shadowRoot.getElementById("send").disabled = false
                this.shadowRoot.getElementById("clear").disabled = false
                this.shadowRoot.getElementById("change").disabled = false

                this.shadowRoot.getElementById("dtr_on_ms_button").disabled = false
                this.shadowRoot.getElementById("rts_on_ms_button").disabled = false
//                this.shadowRoot.getElementById("dtr_off_ms_button").disabled = false
//                this.shadowRoot.getElementById("rts_off_ms_button").disabled = false

                this.shadowRoot.getElementById("dtr_checkbox").disabled = false
                this.shadowRoot.getElementById("rts_checkbox").disabled = false

                let port_infonfo = this.port.getInfo()
                console.log(port_infonfo)

                this.read_text=""
                this.shadowRoot.getElementById("port_info").innerText =
                    "Connected to   device with VID " +
                    port_infonfo.usbVendorId +
                    " and PID " +
                    port_infonfo.usbProductId

                while (true) {
                    const { value, done } = await this.reader.read()
                    if (done) {
                        this.reader.releaseLock()
                        break
                    }
                    this.shadowRoot.getElementById("term_window").value += value
                    this.read_text += value

                    let newline_index = this.read_text.search("\n")
                    while(newline_index >= 0) {
                        this.read_line_script(this.read_text.substring(0, newline_index))
                        this.read_text = this.read_text.substring(newline_index + 1, this.read_text.length)
                        newline_index = this.read_text.search("\n")
                    }
                }

                await readable_stream_closed.catch(() => {})
                await this.port.close()

                this.port_open = false
                this.shadowRoot.getElementById("openclose_port").innerText = "Open"
                this.shadowRoot.getElementById("term_input").disabled = true
                this.shadowRoot.getElementById("send").disabled = true
                this.shadowRoot.getElementById("change").disabled = true
                this.shadowRoot.getElementById("port_info").innerText = "Disconnected"

                this.shadowRoot.getElementById("dtr_on_ms_button").disabled = true
                this.shadowRoot.getElementById("rts_on_ms_button").disabled = true
                this.shadowRoot.getElementById("dtr_off_ms_button").disabled = true
                this.shadowRoot.getElementById("rts_off_ms_button").disabled = true

                this.shadowRoot.getElementById("dtr_checkbox").disabled = true
                this.shadowRoot.getElementById("rts_checkbox").disabled = true

                console.log("port closed")
                resolve()
            })()
        })

        return
    }

    async change_settings()
    {
        this.hold_port = this.port
        this.reader.cancel()
        console.log("changing setting...")
        console.log("waiting for port to close...")
        await this.port_promise
        console.log("port closed, opening with new settings...")
        this.open_close()
    }

    async send_string(out_string)
    {
        if (!this.port_open) {
            return
        }

        const text_encoder = new TextEncoderStream()
        const writable_stream_closed = text_encoder.readable.pipeTo(this.port.writable)
        const writer = text_encoder.writable.getWriter()

        await writer.write(out_string+"\n")
        this.shadowRoot.getElementById("term_window").value += "\n>" + out_string +"\n"

        writer.close()
        await writable_stream_closed

    }

    async send_string_input()
    {
        let out_string = this.shadowRoot.getElementById("term_input").value
        this.shadowRoot.getElementById("term_input").value = ""

        await this.send_string(out_string)
     }

    async dtr_on(b)
    {
        if (!this.port_open) {
            return
        }

        this.shadowRoot.getElementById("dtr_on_ms_button").disabled = b
        this.shadowRoot.getElementById("dtr_off_ms_button").disabled = !b
        this.shadowRoot.getElementById("dtr_checkbox").checked = b
        await this.port.setSignals({ dataTerminalReady: !b })
    }

    async rts_on(b)
    {
        if (!this.port_open) {
            return
        }

        this.shadowRoot.getElementById("rts_on_ms_button").disabled = b
        this.shadowRoot.getElementById("rts_off_ms_button").disabled = !b
        this.shadowRoot.getElementById("rts_checkbox").checked = b
        await this.port.setSignals({ requestToSend: !b })
    }

    async dtr_on_off_ms(ms, b)
    {
        this.dtr_on(b)
        await new Promise(resolve => setTimeout(resolve, ms))
        this.dtr_on(!b)
}

    async rts_on_off_ms(ms, b)
    {
        this.rts_on(b)
        await new Promise(resolve => setTimeout(resolve, ms))
        this.rts_on(!b)
    }

    async dtr_on_ms_button_clicked()
    {
        await this.dtr_on_off_ms(Number(this.shadowRoot.getElementById("dtr_on_off_ms_input").value), true)
    }

    async rts_on_ms_button_clicked()
    {
        await this.rts_on_off_ms(Number(this.shadowRoot.getElementById("rts_on_off_ms_input").value), true)
    }

    async dtr_off_ms_button_clicked()
    {
        await this.dtr_on_off_ms(Number(this.shadowRoot.getElementById("dtr_on_off_ms_input").value), false)
    }

    async rts_off_ms_button_clicked()
    {
        await this.rts_on_off_ms(Number(this.shadowRoot.getElementById("rts_on_off_ms_input").value), false)
    }

    dtr_checkbox_clicked()
    {
        this.dtr_on(this.shadowRoot.getElementById("dtr_checkbox").checked)
    }

    rts_checkbox_clicked()
    {
        this.rts_on(this.shadowRoot.getElementById("rts_checkbox").checked )
    }

    clear_terminal()
    {
        this.shadowRoot.getElementById("term_window").value = ""
//        eval("this.shadowRoot.getElementById(\"term_window\").value = \"\"")
    }

    read_line_script(line)
    {
//        console.log("["+line+"]");
        eval("let line = \""+line+"\"; "+this.shadowRoot.getElementById("script_window").value)
    }

    detect_enter(e)
    {
        if (!this.port_open) {
            return
        }

        if (e.keyCode == 13) {
            e.preventDefault()
            this.send_string_input()
        }
        return
    }

    active_term_tab()
    {
        this.shadowRoot.getElementById("term_tab").style.backgroundColor = "white"
        this.shadowRoot.getElementById("script_tab").style.backgroundColor = "grey"
        this.shadowRoot.getElementById("term_tab_div").style.display = "block"
        this.shadowRoot.getElementById("script_tab_div").style.display = "none"
    }

    active_script_tab()
    {
        this.shadowRoot.getElementById("term_tab").style.backgroundColor = "grey"
        this.shadowRoot.getElementById("script_tab").style.backgroundColor = "white"
        this.shadowRoot.getElementById("term_tab_div").style.display = "none"
        this.shadowRoot.getElementById("script_tab_div").style.display = "block"
    }

    connectedCallback()
    {
        console.log("connectedCallback()")

        const style = `
                * {
                box-sizing: border-box
            }
            .tabname {
                border: none;
            }

            #term_tab {
                background-color: white;
            }

            #script_tab {
                background-color: grey;
            }

            #term_window_div {
                width: 100%;
            }

            #term_window {
                width: 100%;
                height: 600px;
            }

            #script_window_div {
                width: 100%;
            }

            #script_window {
                width: 100%;
                height: 600px;
            }

            #script_tab_div {
                display: none;
            }

            .flex_row {
                width: 100%;
                display: flex;
                flex-direction: row;
                //justify-content: space-between;
                align-items: left;//flex-start;
            }

            #term_input {
                width: 95%;
                height: 20px;
            }
            .number_input {
                width: 60px;
            }
           `

        const html = `
        <div>
            <button class="tabname" id="term_tab">Terminal</button>
            <button class="tabname" id="script_tab">Script</button>
        </div>

        <div id="term_tab_div">
            <div id="term_window_div">
                <textarea id="term_window" readonly></textarea>
            </div>
            <div class="flex_row">
                <input type="text" id="term_input"></input>
                <button id="send" disabled>Send</button>
                <button id="clear" disabled>Clear</button>
            </div>
            <div class="flex_row">
                <button id="openclose_port">Open</button>
                <div>
                    <span>Baud Rate: </span>
                    <select id="baud_rate">
                        <option value="9600">9600</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="57600">57600</option>
                        <option value="115200">115200</option>
                    </select><button id="change" disabled>Change</button>
                </div>
            </div>
            <div class="flex_row">
                <input class="number_input" type="number" min="1" step="1" value="100" id="dtr_on_off_ms_input"></input>
                <button id="dtr_on_ms_button" disabled>DTR on ms</button>
                <button id="dtr_off_ms_button" disabled>DTR Off ms</button>
            </div>
            <div class="flex_row">
                <input class="number_input" type="number" min="1" step="1" value="100" id="rts_on_off_ms_input"></input>
                <button id="rts_on_ms_button" disabled>RTS On ms</button>
                <button id="rts_off_ms_button" disabled>RTS Off ms</button>
            </div>
            <div class="flex_row">
                <input type="checkbox" id="dtr_checkbox" disabled>DTR</input>
            </div>
            <div class="flex_row">
                <input type="checkbox" id="rts_checkbox" disabled>RTS</input>
            </div>
            <div class="flex_row">
                <span id="port_info">Disconnected</span>
            </div>
        </div>
        <div id="script_tab_div">
            <div id="script_window_div">
                <textarea id="script_window">
                </textarea>
            </div>
        </div>

            `
        this.attachShadow({ mode: 'open' })
        this.shadowRoot.innerHTML = `
            <style>
            ${style}
            </style>
            ${html}
        `
        this.openclose_port_button = this.shadowRoot.getElementById("openclose_port")
        this.baud_rate_select = this.shadowRoot.getElementById("baud_rate")
        console.log(this.baud_rate_select)

        if ("serial" in navigator) {
            this.openclose_port_button.addEventListener("click", this.open_close)

            this.shadowRoot.getElementById("change").addEventListener("click", this.change_settings)
            this.shadowRoot.getElementById("clear").addEventListener("click", this.clear_terminal)
            this.shadowRoot.getElementById("send").addEventListener("click", this.send_string_input)
            this.shadowRoot.getElementById("term_input").addEventListener("keydown", this.detect_enter)

            this.shadowRoot.getElementById("dtr_on_ms_button").addEventListener("click", this.dtr_on_ms_button_clicked)
            this.shadowRoot.getElementById("dtr_off_ms_button").addEventListener("click", this.dtr_off_ms_button_clicked)
            this.shadowRoot.getElementById("rts_on_ms_button").addEventListener("click", this.rts_on_ms_button_clicked)
            this.shadowRoot.getElementById("rts_off_ms_button").addEventListener("click", this.rts_off_ms_button_clicked)

            this.shadowRoot.getElementById("dtr_checkbox").addEventListener("click", this.dtr_checkbox_clicked)
            this.shadowRoot.getElementById("rts_checkbox").addEventListener("click", this.rts_checkbox_clicked)

            this.shadowRoot.getElementById("term_tab").addEventListener("click", this.active_term_tab)
            this.shadowRoot.getElementById("script_tab").addEventListener("click", this.active_script_tab)
            this.shadowRoot.getElementById("script_window").value =
                "console.log(\"[script] [\"+line+\"]\")\n"+
                "if (line == \"qwerty\") {\n"+
                "    console.log(\"[script send_line] [ytrewq]\")\n"+
                "    this.send_string(\"ytrewq\")\n"+
                "}\n"+
                "if (line == \"now\") {\n"+
                "    this.send_string(\"now \"+\n"+
                "        (Math.trunc(Date.now() / 1000) - 1680459000))\n"+
                "}\n"
            this.clear_terminal()

            const params = new Proxy(new URLSearchParams(window.location.search), {
                get: (searchParams, prop) => searchParams.get(prop),
            })
            let prefill = params.prefill
            if (prefill != null) {
                this.shadowRoot.getElementById("term_input").value = prefill
            }
        } else {
            alert("The Web Serial API is not supported by your browser")
        }
    }

    disconnectedCallback()
    {
        console.log("disconnectedCallback()")
    }
}

customElements.define('term-inal', terminal)
