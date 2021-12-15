/* eslint-disable react/prop-types */
/* eslint-disable react/react-in-jsx-scope */
const NavButton = ({ 
  text, 
  activeTab, 
  setActiveTab, 
  altText,
  altClass
  } = props) => {

  return (
    <button
      id={`${text}Button`}
      className = {altClass || 'navbutton'}  
      style={
        activeTab === text ? 
          { backgroundColor: '#333', color:"#bbb"} : 
          {}} // highlights when selected
      onClick={() => {
        setActiveTab(text)
      }}
    >
      {altText || text[0].toUpperCase() + text.slice(1)}
    </button>
  )
}

export default NavButton;