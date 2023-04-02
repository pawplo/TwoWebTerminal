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
        this.clear_terminal = this.clear_terminal.bind(this)
        this.detect_enter = this.detect_enter.bind(this)

        this.dtr = this.dtr.bind(this)
        this.rts = this.rts.bind(this)

        this.dtr_on_off = this.dtr_on_off.bind(this)
        this.rts_on_off = this.rts_on_off.bind(this)
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

                this.shadowRoot.getElementById("dtr_button").disabled = false
                this.shadowRoot.getElementById("rts_button").disabled = false

                this.shadowRoot.getElementById("dtr_checkbox").disabled = false
                this.shadowRoot.getElementById("rts_checkbox").disabled = false

                let port_infonfo = this.port.getInfo()
                console.log(port_infonfo)
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
                }

                await readable_stream_closed.catch(() => {})
                await this.port.close()

                this.port_open = false
                this.shadowRoot.getElementById("openclose_port").innerText = "Open"
                this.shadowRoot.getElementById("term_input").disabled = true
                this.shadowRoot.getElementById("send").disabled = true
                this.shadowRoot.getElementById("change").disabled = true
                this.shadowRoot.getElementById("port_info").innerText = "Disconnected"

                this.shadowRoot.getElementById("dtr_button").disabled = true
                this.shadowRoot.getElementById("rts_button").disabled = true

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

    async send_string()
    {
      let out_string = this.shadowRoot.getElementById("term_input").value
      this.shadowRoot.getElementById("term_input").value = ""

      const text_encoder = new TextEncoderStream()
      const writable_stream_closed = text_encoder.readable.pipeTo(this.port.writable)
      const writer = text_encoder.writable.getWriter()

      await writer.write(out_string+"\n")
      this.shadowRoot.getElementById("term_window").value += "\n>" + out_string +"\n"

      writer.close()
      await writable_stream_closed
    }

    dtr_on(b)
    {
        if (b) {
            this.shadowRoot.getElementById("dtr_checkbox").checked = true
            this.port.setSignals({ dataTerminalReady: false })
        } else {
            this.shadowRoot.getElementById("dtr_checkbox").checked = false
            this.port.setSignals({ dataTerminalReady: true })
        }
    }

    async dtr()
    {
        let ms = this.shadowRoot.getElementById("dtr_input").value
        await this.port.setSignals({ dataTerminalReady: false })
        await new Promise(resolve => setTimeout(resolve, Number(ms)))
        await this.port.setSignals({ dataTerminalReady: true })
    }

    async rts()
    {
        let ms = this.shadowRoot.getElementById("rts_input").value
        await this.port.setSignals({ requestToSend : false })
        await new Promise(resolve => setTimeout(resolve, Number(ms)))
        await this.port.setSignals({ requestToSend: true })
    }

    dtr_on_off()
    {
        this.port.setSignals({ dataTerminalReady: ! this.shadowRoot.getElementById("dtr_checkbox").checked })
    }

    rts_on_off()
    {
        this.port.setSignals({ requestToSend : ! this.shadowRoot.getElementById("rts_checkbox").checked })
    }

    clear_terminal()
    {
      this.shadowRoot.getElementById("term_window").value = ""
    }

    detect_enter(e)
    {
      if (e.keyCode == 13) {
        e.preventDefault()
        this.send_string()
      }
      return
    }

    connectedCallback()
    {
        console.log("connectedCallback()")

        const style = `
                * {
                box-sizing: border-box
            }

            body {
                width: 100%;
                margin: 0px;
                padding: 0px;
            }

            #term_window_div {
                width: 100%;
                margin: 0px;
                margin: 0px;
                padding: 0px;
            }

            #term_window {
                width: 100%;
                height: 600px;
                margin: 0px;
                padding: 0px;
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
                <input class="number_input" type="number" min="1" step="1" value="1000" id="dtr_input"></input>
                <button id="dtr_button" disabled>DTR</button>
            </div>
            <div class="flex_row">
                <input class="number_input" type="number" min="1" step="1" value="1000" id="rts_input"></input>
                <button id="rts_button" disabled>RTS</button>
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
            this.shadowRoot.getElementById("send").addEventListener("click", this.send_string)
            this.shadowRoot.getElementById("term_input").addEventListener("keydown", this.detect_enter)

            this.shadowRoot.getElementById("dtr_button").addEventListener("click", this.dtr)
            this.shadowRoot.getElementById("rts_button").addEventListener("click", this.rts)

            this.shadowRoot.getElementById("dtr_checkbox").addEventListener("click", this.dtr_on_off)
            this.shadowRoot.getElementById("rts_checkbox").addEventListener("click", this.rts_on_off)

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
