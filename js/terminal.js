class terminal extends HTMLElement
{
    constructor()
    {
        super();
        this.port_open = false;
        this.hold_port = null;

        this.default_script_read =
            "if (line == 'qwerty') {\n"+
            "    line_write = 'ytrewq'\n"+
            "}\n"+
            "if (line == 'now') {\n"+
            "    line_write = 'now '+(Math.trunc(Date.now() / 1000) - 1680459000)\n"+
            "}\n";
        this.default_script_write =
            "if (line == 'bubu') {\n"+
            "    line = 'BUBU'\n"+
            "}\n";
    }

    async open_close()
    {
        if (this.port_open) {
            this.reader.cancel();
            console.log("attempt to close");
            return;
        }

        this.port_promise = new Promise((resolve) => {
            (async () => {
                if (this.hold_port == null) {
                    try {
                        this.port = await navigator.serial.requestPort();
                        console.log(this.port);
                    } catch(e) {
                        console.log(e);
//                        alert(e);
                        return;
                    }
                } else {
                    this.port = this.hold_port;
                    this.hold_port = null;
                }
                var baud_selected = parseInt(this.shadowRoot.getElementById("baud_rate").value);
                try {
                    await this.port.open({ baudRate: baud_selected });
                } catch(e) {
                  console.log(e);
                  alert(e);
                  return;
                }

                const text_decoder = new TextDecoderStream();
                this.reader = text_decoder.readable.getReader();
                const readable_stream_closed = this.port.readable.pipeTo(text_decoder.writable);

                this.port_open = true;
                this.shadowRoot.getElementById("openclose_port").innerText = "Close";
                this.shadowRoot.getElementById("term_input").disabled = false;
                this.shadowRoot.getElementById("send").disabled = false;
                this.shadowRoot.getElementById("clear").disabled = false;
                this.shadowRoot.getElementById("change").disabled = false;

                this.shadowRoot.getElementById("dtr_on_ms_button").disabled = false;
                this.shadowRoot.getElementById("rts_on_ms_button").disabled = false;
//                this.shadowRoot.getElementById("dtr_off_ms_button").disabled = false;
//                this.shadowRoot.getElementById("rts_off_ms_button").disabled = false;

                this.shadowRoot.getElementById("dtr_checkbox").disabled = false;
                this.shadowRoot.getElementById("rts_checkbox").disabled = false;

                let port_infonfo = this.port.getInfo();
                console.log(port_infonfo);

                this.read_text="";
                this.shadowRoot.getElementById("port_info").innerText =
                    "Connected to   device with VID " +
                    port_infonfo.usbVendorId +
                    " and PID " +
                    port_infonfo.usbProductId;

                    this.shadowRoot.getElementById("term_input").focus();
this.add_line("now", "line_read");

                while (true) {
                    try {
                        const { value, done } = await this.reader.read();

                        if (done) {
                            this.reader.releaseLock();
                            break;
                        }

                        if (value[0] == '\x00') {
                            console.log("read value[0] == '\\x00'");
                            continue;
                        }

//                        this.shadowRoot.getElementById("term_window").value += value;
                        this.read_text += value;

                        let newline_index = this.read_text.search("\n");
                        while(newline_index >= 0) {
                            let line = this.read_text.substring(0, newline_index);
                            this.add_line(line, "line_read");
                            this.read_text = this.read_text.substring(newline_index + 1, this.read_text.length);
                            newline_index = this.read_text.search("\n");
                        }

                    } catch (e) {
                        console.log(e);
                        console.log("---");
                        break;
                    }
                }

                await readable_stream_closed.catch(() => {});
                await this.port.close();

                this.port_open = false;
                this.shadowRoot.getElementById("openclose_port").innerText = "Open";
                this.shadowRoot.getElementById("term_input").disabled = true;
                this.shadowRoot.getElementById("send").disabled = true;
                this.shadowRoot.getElementById("change").disabled = true;
                this.shadowRoot.getElementById("port_info").innerText = "Disconnected";

                this.shadowRoot.getElementById("dtr_on_ms_button").disabled = true;
                this.shadowRoot.getElementById("rts_on_ms_button").disabled = true;
                this.shadowRoot.getElementById("dtr_off_ms_button").disabled = true;
                this.shadowRoot.getElementById("rts_off_ms_button").disabled = true;

                this.shadowRoot.getElementById("dtr_checkbox").disabled = true;
                this.shadowRoot.getElementById("rts_checkbox").disabled = true;

                console.log("port closed");
                resolve();
            })()
        })

        return;
    }

    num2str(num)
    {
        var s = "";
        if (num < 10) {
            s += "0";
        }
        s += num.toString();
        return s;
    }

    add_line(line, line_read_or_write)
    {
        console.log("add_line ["+line+"]");
        var last_is_code = false;
        var inner_text = "";
        inner_text += "<span class='line_date'>";
        const d =  new Date();
        inner_text += (this.num2str(d.getHours())+":"+this.num2str(d.getMinutes())+":"+this.num2str(d.getSeconds()));
        inner_text += "</span>";

        inner_text +=
            "<span class='"+line_read_or_write+"'>";

        for (let i = 0; i < line.length; i++) {
            if (line[i].charCodeAt() < 32 || line[i].charCodeAt() > 126) {
                if (last_is_code == false) {
                    inner_text +=
                        "</span></br><span class='"+line_read_or_write+"_code'>";
                }
                inner_text +=
                    "\\x"+line[i].charCodeAt();
                last_is_code = true;

            } else {
                if (last_is_code == true) {
                    inner_text +=
                        "</span></br><span class='"+line_read_or_write+"'>";
                }

                if (line[i] == '<') {
                    inner_text += "&lt;";

                } else if (line[i] == '>') {
                    inner_text += "&gt;";

                } else {
                    inner_text += line[i];
                }
                last_is_code = false;
            }
        }

        inner_text += "</span></br>";
        this.shadowRoot.getElementById("term_window").innerHTML += inner_text;

        if (this.shadowRoot.getElementById("auto_scroll_down_checkbox").checked) {
            this.shadowRoot.getElementById("term_window").scrollTop =
            this.shadowRoot.getElementById("term_window").scrollHeight;
        }

        if (line_read_or_write == "line_read") {
            this.read_line_script(line);
        }
    }

    async change_settings()
    {
        this.hold_port = this.port;
        this.reader.cancel();
        console.log("changing setting...");
        console.log("waiting for port to close...");
        await this.port_promise;
        console.log("port closed, opening with new settings...");
        this.open_close();
    }

    async send_string(out_string)
    {
        if (!this.port_open)
            return;

        const text_encoder = new TextEncoderStream();
        const writable_stream_closed = text_encoder.readable.pipeTo(this.port.writable);
        const writer = text_encoder.writable.getWriter();

        await writer.write(out_string+"\n");

        this.add_line(out_string, "line_write");
        writer.close();
        await writable_stream_closed;

    }

    async send_string_input()
    {
        let line = this.shadowRoot.getElementById("term_input").value;
        this.shadowRoot.getElementById("term_input").value = "";

        eval(this.shadowRoot.getElementById("script_write_textarea").value);

        await this.send_string(line);
     }

    async dtr_on(b)
    {
        if (!this.port_open)
            return;

        this.shadowRoot.getElementById("dtr_on_ms_button").disabled = b;
        this.shadowRoot.getElementById("dtr_off_ms_button").disabled = !b;
        this.shadowRoot.getElementById("dtr_checkbox").checked = b;
        await this.port.setSignals({ dataTerminalReady: !b });
    }

    async rts_on(b)
    {
        if (!this.port_open)
            return;

        this.shadowRoot.getElementById("rts_on_ms_button").disabled = b;
        this.shadowRoot.getElementById("rts_off_ms_button").disabled = !b;
        this.shadowRoot.getElementById("rts_checkbox").checked = b;
        await this.port.setSignals({ requestToSend: !b });
    }

    async dtr_on_off_ms(ms, b)
    {
        this.dtr_on(b);
        await new Promise(resolve => setTimeout(resolve, ms));
        this.dtr_on(!b);
    }

    async rts_on_off_ms(ms, b)
    {
        this.rts_on(b);
        await new Promise(resolve => setTimeout(resolve, ms));
        this.rts_on(!b);
    }

    async dtr_on_ms_button_clicked()
    {
        await this.dtr_on_off_ms(Number(this.shadowRoot.getElementById("dtr_on_off_ms_input").value), true);
    }

    async rts_on_ms_button_clicked()
    {
        await this.rts_on_off_ms(Number(this.shadowRoot.getElementById("rts_on_off_ms_input").value), true);
    }

    async dtr_off_ms_button_clicked()
    {
        await this.dtr_on_off_ms(Number(this.shadowRoot.getElementById("dtr_on_off_ms_input").value), false);
    }

    async rts_off_ms_button_clicked()
    {
        await this.rts_on_off_ms(Number(this.shadowRoot.getElementById("rts_on_off_ms_input").value), false);
    }

    dtr_checkbox_clicked()
    {
        this.dtr_on(this.shadowRoot.getElementById("dtr_checkbox").checked);
    }

    rts_checkbox_clicked()
    {
        this.rts_on(this.shadowRoot.getElementById("rts_checkbox").checked);
    }

    clear_terminal()
    {
        console.log("clear_terminal()");
        this.shadowRoot.getElementById("term_window").innerHTML = "";
    }

    async read_line_script(line)
    {
        let line_write = '';
        eval(this.shadowRoot.getElementById("script_read_textarea").value);

        if (line_write != '') {
            await this.send_string(line_write);
        }
    }

    detect_enter(e)
    {
        if (!this.port_open)
            return;

        if (e.keyCode == 13) {
            e.preventDefault();
            this.send_string_input();
        }
        return;
    }

    active_term_tab()
    {
        this.shadowRoot.getElementById("term_tab").style.backgroundColor = "white";
        this.shadowRoot.getElementById("script_read_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("script_write_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("term_tab_div").style.display = "block";
        this.shadowRoot.getElementById("script_read_tab_div").style.display = "none";
        this.shadowRoot.getElementById("script_write_tab_div").style.display = "none";
        this.shadowRoot.getElementById("term_input").focus();
    }

    active_script_read_tab()
    {
        this.shadowRoot.getElementById("term_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("script_read_tab").style.backgroundColor = "white";
        this.shadowRoot.getElementById("script_write_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("term_tab_div").style.display = "none";
        this.shadowRoot.getElementById("script_read_tab_div").style.display = "block";
        this.shadowRoot.getElementById("script_write_tab_div").style.display = "none";
    }

    active_script_write_tab()
    {
        this.shadowRoot.getElementById("term_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("script_read_tab").style.backgroundColor = "grey";
        this.shadowRoot.getElementById("script_write_tab").style.backgroundColor = "white";
        this.shadowRoot.getElementById("term_tab_div").style.display = "none";
        this.shadowRoot.getElementById("script_read_tab_div").style.display = "none";
        this.shadowRoot.getElementById("script_write_tab_div").style.display = "block";
    }

    script_read_save_clicked()
    {
        localStorage.setItem("script_read", this.shadowRoot.getElementById("script_read_textarea").value);
    }
    script_read_restore_default_clicked()
    {
        localStorage.removeItem("script_read");
        this.shadowRoot.getElementById("script_read_textarea").value = this.default_script_read;
    }
    script_write_save_clicked()
    {
        localStorage.setItem("script_write", this.shadowRoot.getElementById("script_write_textarea").value);

    }
    script_write_restore_default_clicked()
    {
        localStorage.removeItem("script_write");
        this.shadowRoot.getElementById("script_write_textarea").value = this.default_script_write;
    }


    connectedCallback()
    {
        console.log("connectedCallback()");

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

            #script_read_tab {
                background-color: grey;
            }

            #script_write_tab {
                background-color: grey;
            }

            #term_window_div {
                width: 100%;
            }

            #term_window {
                width: 100%;
                height: 600px;
                background-color: white;
                font-family: monospace;
                overflow: scroll;
            }
            .line_read {
                background-color: white;
                color: red;
            }
            .line_read_code {
                background-color: red;
                color: white;
            }

            .line_write {
                background-color: white;
                color: limegreen;

            }
            .line_write_code {
                background-color: limegreen;
                color: white;
            }
            .line_date {
                background-color: deepskyblue;
                color: white;
            }
            .script_window_class {
                width: 100%;
            }

            .script_textarea_class {
                width: 100%;
                height: 600px;
            }

            .script_read_tab_div_class {
                display: none;
            }

            .flex_row {
                width: 100%;
                display: flex;
                flex-direction: row;
                //justify-content: space-between;
                align-items: stretch; //left;//flex-start;
            }

            #term_input {
                width: 95%;
                height: 20px;
            }
            .number_input {
                width: 60px;
            }
           `;

        const html = `
        <div>
            <button class="tabname" id="term_tab">Terminal</button>
            <button class="tabname" id="script_read_tab">Script read</button>
            <button class="tabname" id="script_write_tab">Script write</button>
        </div>

        <div id="term_tab_div">
            <div id="term_window_div">
                <div id="term_window" readonly></div>
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
<!--            </div>
            <div class="flex_row"> -->
                <input type="checkbox" id="rts_checkbox" disabled>RTS</input>
                <input type="checkbox" id="auto_scroll_down_checkbox">auto scroll down</input>
            </div>
            <div class="flex_row">
                <span id="port_info">Disconnected</span>
            </div>
        </div>
        <div class="script_read_tab_div_class" id="script_read_tab_div">
            <div class="script_window_class">
                <textarea class="script_textarea_class" id="script_read_textarea">
                </textarea>
            </div>
            <div class="flex_row">
                <button id="script_read_save">Save</button>
                <button id="script_read_restore_default">Restore default</button>
            </div>
        </div>
        <div class="script_read_tab_div_class" id="script_write_tab_div">
             <div class="script_window_class">
                 <textarea class="script_textarea_class" id="script_write_textarea">
                 </textarea>
             </div>
             <div class="flex_row">
             <button id="script_write_save">Save</button>
             <button id="script_write_restore_default">Restore default</button>
         </div>
     </div>

            `;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
            ${style}
            </style>
            ${html}
        `;

        if ("serial" in navigator) {
            this.shadowRoot.getElementById("openclose_port").addEventListener("click", this.open_close.bind(this));

            this.shadowRoot.getElementById("change").addEventListener("click", this.change_settings.bind(this));
            this.shadowRoot.getElementById("clear").addEventListener("click", this.clear_terminal.bind(this));
            this.shadowRoot.getElementById("send").addEventListener("click", this.send_string_input.bind(this));
            this.shadowRoot.getElementById("term_input").addEventListener("keydown", this.detect_enter.bind(this));

            this.shadowRoot.getElementById("dtr_on_ms_button").addEventListener("click", this.dtr_on_ms_button_clicked.bind(this));
            this.shadowRoot.getElementById("dtr_off_ms_button").addEventListener("click", this.dtr_off_ms_button_clicked.bind(this));
            this.shadowRoot.getElementById("rts_on_ms_button").addEventListener("click", this.rts_on_ms_button_clicked.bind(this));
            this.shadowRoot.getElementById("rts_off_ms_button").addEventListener("click", this.rts_off_ms_button_clicked.bind(this));

            this.shadowRoot.getElementById("dtr_checkbox").addEventListener("click", this.dtr_checkbox_clicked.bind(this));
            this.shadowRoot.getElementById("rts_checkbox").addEventListener("click", this.rts_checkbox_clicked.bind(this));
//            this.shadowRoot.getElementById("auto_scroll_down_checkbox").addEventListener("click", this._checkbox_clicked.bind(this));

            this.shadowRoot.getElementById("term_tab").addEventListener("click", this.active_term_tab.bind(this));
            this.shadowRoot.getElementById("script_read_tab").addEventListener("click", this.active_script_read_tab.bind(this));
            this.shadowRoot.getElementById("script_write_tab").addEventListener("click", this.active_script_write_tab.bind(this));

            this.shadowRoot.getElementById("script_read_save").addEventListener("click", this.script_read_save_clicked.bind(this));
            this.shadowRoot.getElementById("script_read_restore_default").addEventListener("click", this.script_read_restore_default_clicked.bind(this));
            this.shadowRoot.getElementById("script_write_save").addEventListener("click", this.script_write_save_clicked.bind(this));
            this.shadowRoot.getElementById("script_write_restore_default").addEventListener("click", this.script_write_restore_default_clicked.bind(this));


            let script_read = localStorage.getItem("script_read");
            if (script_read == null) {
                this.shadowRoot.getElementById("script_read_textarea").value = this.default_script_read;
            } else {
                this.shadowRoot.getElementById("script_read_textarea").value = script_read;
            }

            let script_write = localStorage.getItem("script_write");
            if (script_write == null) {
                this.shadowRoot.getElementById("script_write_textarea").value = this.default_script_write;
            } else {
                this.shadowRoot.getElementById("script_write_textarea").value = script_write;
            }

            this.clear_terminal();

            const params = new Proxy(new URLSearchParams(window.location.search), {
                get: (searchParams, prop) => searchParams.get(prop),
            });
            let prefill = params.prefill;
            if (prefill != null) {
                this.shadowRoot.getElementById("term_input").value = prefill;
            }
        } else {
            alert("The Web Serial API is not supported by your browser");
        }
    }

    disconnectedCallback()
    {
        console.log("disconnectedCallback()");
    }
}

customElements.define('term-inal', terminal);
