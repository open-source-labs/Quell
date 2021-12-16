import React, { useState } from "react";
import logo from "../images/quell_logos/icon128.png";
import Header from "../images/headers/QUELL-headers-devtools w lines.png";

const Devtool = () => {
  const [activeTab, setActiveTab] = useState("client");

  return (
    <center>
      <div id='devtool-header-container'>
        <img id='devtool-header' src={Header} width={275}/>
      </div>
      
      <div className='devtool-text'>
        <h4>Quell now also features a Chrome Developer Tools extension designed for Quell users. </h4>
        <h4>With this extension, users can:</h4>
        <br />
        <li>Inspect and monitor the latency of client-side GraphQL/Quell requests</li>
        <li>Make and monitor the latency of GraphQL/Quell requests to a specified server endpoint</li>
        <li>View server-side cache data and contents, with the ability to manually clear the cache</li>
        <li>{`Requires zero-to-minimal configuration and can work independently of Quell's client \nand server libraries`}</li>
        <br/>
      </div>

      <div className="devtool_demo">
        <div className="navbar">
          <img src={'https://imgur.com/180d29b4-ba3f-4c3b-93cd-ba635f087350'} />
          <button
            id='client_button'
            onClick={() => setActiveTab("client")}
            style={activeTab === "client" ? { backgroundColor: "#444" } : {}}
          >
            Client
          </button>
          <button
            id='server_button'
            onClick={() => setActiveTab("server")}
            style={activeTab === "server" ? { backgroundColor: "#444" } : {}}
          >
            Server
          </button>
          <button
            id='cache_button'
            onClick={() => setActiveTab("cache")}
            style={activeTab === "cache" ? { backgroundColor: "#444" } : {}}
          >
            Cache
          </button>
          <button
            id='settings_button'
            onClick={() => setActiveTab("settings")}
            style={activeTab === "settings" ? { backgroundColor: "#444" } : {}}
          >
            Settings
          </button>
        </div>
        <div className="gif_container">
          {activeTab === "client" && <img src={'https://i.imgur.com/mdZj4OD.gif'} width={800} />}
          {activeTab === "server" && <img src={'https://i.imgur.com/FBlvNhI.gif'} width={800} />}
          {activeTab === "cache" && <img src={'https://i.imgur.com/Wj435ZW.gif'} width={800} />}
          {activeTab === "settings" && <img src={'https://i.imgur.com/WK5saAJ.gif'} width={800} />}
        </div>
      </div>
    </center>
  );
};

export default Devtool;
