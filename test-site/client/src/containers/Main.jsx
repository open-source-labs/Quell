import React from 'react';
import Header from '../components/Header.jsx'
import QueryAll from '../components/QueryAll.jsx'
import QuerySome from '../components/QuerySome.jsx'
import Footer from '../components/Footer.jsx'

const Main = () => {
  return(
    <div className="main">
      <Header />
      {/* <QueryAll /> */}
      <QuerySome />
      <Footer />
    </div>
  )
}

export default Main;