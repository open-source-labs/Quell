/* eslint-disable react/prop-types */
/* eslint-disable react/react-in-jsx-scope */
import NavButton from "./NavButton";

const PrimaryNavBar = ({ 
  activeTab, 
  setActiveTab, 
  Logo 
  } = props) => {
  
  return (
    <div id="navbar">
        <img id="logo-img" src={Logo} alt="quell logo" />

        < NavButton 
          text={'query'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        < NavButton 
          text={'network'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
        
        < NavButton 
          text={'cache'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />

        < NavButton 
          text={'settings'} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
        />
    </div>
  )
};

export default PrimaryNavBar;