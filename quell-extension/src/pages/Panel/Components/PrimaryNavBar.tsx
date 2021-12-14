import NavButton from './NavButton';

const PrimaryNavBar = ({ 
  activeTab, 
  setActiveTab, 
  Logo,
  graphQL_field,
  server_field,
  redis_field 
} = props) => {

  return (
    <div id="navbar_container">
      <div id="navbar">
        <img id="logo-img" src={Logo} alt="quell logo" />

        <NavButton
          text={'client'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        {(graphQL_field && server_field) ? 
          <NavButton
            text={'server'}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          /> :
          <button 
            className="navbutton"  
            onClick={()=>setActiveTab('settings')}
          >
            Server
          </button>
        }

        {(redis_field && server_field) ? 
          <NavButton
            text={'cache'}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          /> : 
          <button 
            className="navbutton"  
            onClick={()=>setActiveTab('settings')}
          >
            Cache
          </button>
        }

        <NavButton
          text={'settings'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </div>
      <div id= "docs_link">
        <a href="https://github.com/open-source-labs/Quell" target="_blank">Docs</a>
      </div>
    </div>
  );
};

export default PrimaryNavBar;
