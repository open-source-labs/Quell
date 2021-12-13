import NavButton from './NavButton';

const PrimaryNavBar = ({ activeTab, setActiveTab, Logo } = props) => {
  return (
    <div id="navbar_container">
      <div id="navbar">
        <img id="logo-img" src={Logo} alt="quell logo" />

        <NavButton
          text={'client'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <NavButton
          text={'server'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <NavButton
          text={'cache'}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

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
